const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');
const { JOB_TYPES } = require('../../queues/jobTypes');
const { getAnalysisRepository, getUserRepository } = require('../../repositories');

class EmailProcessor {
  constructor() {
    this.transporter = null;
    this.analysisRepository = null;
    this.userRepository = null;
  }

  async initialize() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
      this.userRepository = await getUserRepository();
    }
  }

  async processAnalysisCompleteEmail(job) {
    await this.initialize();
    
    const { userId, analysisId, results, customMessage } = job.data;
    
    logger.info(`Sending analysis complete email:`, {
      jobId: job.id,
      userId,
      analysisId,
      resultCount: results?.length,
    });

    try {
      // Get user information
      const user = await this.userRepository.findById(userId);
      if (!user || !user.email) {
        throw new Error(`User not found or no email address: ${userId}`);
      }

      // Get analysis details
      const analysis = await this.analysisRepository.findById(analysisId);
      if (!analysis) {
        throw new Error(`Analysis not found: ${analysisId}`);
      }

      await job.updateProgress(25);

      // Prepare email content
      const emailContent = this.generateAnalysisCompleteEmail(
        user,
        analysis,
        results,
        customMessage
      );

      await job.updateProgress(50);

      // Send email
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: `YouTube Analysis Complete - ${results?.length || 0} Outliers Found`,
        html: emailContent.html,
        text: emailContent.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      await job.updateProgress(100);

      logger.info(`Analysis complete email sent:`, {
        jobId: job.id,
        messageId: info.messageId,
        userEmail: user.email,
      });

      return {
        success: true,
        messageId: info.messageId,
        userEmail: user.email,
      };
    } catch (error) {
      logger.error(`Failed to send analysis complete email:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processErrorNotificationEmail(job) {
    await this.initialize();
    
    const { userId, analysisId, error, context } = job.data;
    
    logger.info(`Sending error notification email:`, {
      jobId: job.id,
      userId,
      analysisId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.email) {
        throw new Error(`User not found or no email address: ${userId}`);
      }

      await job.updateProgress(50);

      const emailContent = this.generateErrorNotificationEmail(
        user,
        analysisId,
        error,
        context
      );

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: `YouTube Analysis Failed - Analysis ${analysisId}`,
        html: emailContent.html,
        text: emailContent.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      await job.updateProgress(100);

      logger.info(`Error notification email sent:`, {
        jobId: job.id,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (sendError) {
      logger.error(`Failed to send error notification email:`, {
        jobId: job.id,
        error: sendError.message,
      });
      throw sendError;
    }
  }

  async processWeeklyDigestEmail(job) {
    await this.initialize();
    
    const { userId, weekStart, weekEnd } = job.data;
    
    logger.info(`Sending weekly digest email:`, {
      jobId: job.id,
      userId,
      weekStart,
      weekEnd,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user || !user.email) {
        throw new Error(`User not found or no email address: ${userId}`);
      }

      await job.updateProgress(25);

      // Get user's analyses for the week
      const analyses = await this.analysisRepository.findByUserIdAndDateRange(
        userId,
        new Date(weekStart),
        new Date(weekEnd)
      );

      await job.updateProgress(50);

      const emailContent = this.generateWeeklyDigestEmail(
        user,
        analyses,
        weekStart,
        weekEnd
      );

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: `Weekly YouTube Analysis Digest - ${analyses.length} Analyses`,
        html: emailContent.html,
        text: emailContent.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      await job.updateProgress(100);

      logger.info(`Weekly digest email sent:`, {
        jobId: job.id,
        messageId: info.messageId,
        analysisCount: analyses.length,
      });

      return {
        success: true,
        messageId: info.messageId,
        analysisCount: analyses.length,
      };
    } catch (error) {
      logger.error(`Failed to send weekly digest email:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  generateAnalysisCompleteEmail(user, analysis, results, customMessage) {
    const resultCount = results?.length || 0;
    const topOutliers = results?.slice(0, 5) || [];
    
    const html = `
      <h2>Your YouTube Analysis is Complete!</h2>
      
      <p>Hi ${user.username || user.email},</p>
      
      <p>Your YouTube outlier analysis has finished processing. Here are the results:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Analysis Summary</h3>
        <ul>
          <li><strong>Total Outliers Found:</strong> ${resultCount}</li>
          <li><strong>Analysis ID:</strong> ${analysis.id}</li>
          <li><strong>Started:</strong> ${new Date(analysis.started_at).toLocaleString()}</li>
          <li><strong>Completed:</strong> ${new Date(analysis.completed_at).toLocaleString()}</li>
        </ul>
      </div>
      
      ${topOutliers.length > 0 ? `
        <h3>Top Performing Outliers</h3>
        <ol>
          ${topOutliers.map(video => `
            <li>
              <strong>${video.snippet?.title}</strong><br>
              Channel: ${video.channelInfo?.snippet?.title}<br>
              Outlier Score: ${video.outlierScore?.toFixed(1)}<br>
              Views: ${parseInt(video.statistics?.viewCount || 0).toLocaleString()}
            </li>
          `).join('')}
        </ol>
      ` : ''}
      
      ${customMessage ? `<p><em>${customMessage}</em></p>` : ''}
      
      <p>
        <a href="${process.env.FRONTEND_URL}/analysis/${analysis.id}" 
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Full Results
        </a>
      </p>
      
      <p>Best regards,<br>YouTube Outlier Discovery Team</p>
    `;

    const text = `
      Your YouTube Analysis is Complete!
      
      Hi ${user.username || user.email},
      
      Your YouTube outlier analysis has finished processing.
      
      Analysis Summary:
      - Total Outliers Found: ${resultCount}
      - Analysis ID: ${analysis.id}
      - Started: ${new Date(analysis.started_at).toLocaleString()}
      - Completed: ${new Date(analysis.completed_at).toLocaleString()}
      
      ${topOutliers.length > 0 ? `
        Top Performing Outliers:
        ${topOutliers.map((video, index) => `
          ${index + 1}. ${video.snippet?.title}
             Channel: ${video.channelInfo?.snippet?.title}
             Outlier Score: ${video.outlierScore?.toFixed(1)}
             Views: ${parseInt(video.statistics?.viewCount || 0).toLocaleString()}
        `).join('')}
      ` : ''}
      
      ${customMessage ? `\n${customMessage}\n` : ''}
      
      View full results: ${process.env.FRONTEND_URL}/analysis/${analysis.id}
      
      Best regards,
      YouTube Outlier Discovery Team
    `;

    return { html, text };
  }

  generateErrorNotificationEmail(user, analysisId, error, context) {
    const html = `
      <h2>Analysis Failed</h2>
      
      <p>Hi ${user.username || user.email},</p>
      
      <p>Unfortunately, your YouTube analysis encountered an error and could not be completed.</p>
      
      <div style="background: #ffe6e6; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff4444;">
        <h3>Error Details</h3>
        <ul>
          <li><strong>Analysis ID:</strong> ${analysisId}</li>
          <li><strong>Error:</strong> ${error}</li>
          ${context ? `<li><strong>Context:</strong> ${context}</li>` : ''}
        </ul>
      </div>
      
      <p>Please try running the analysis again. If the problem persists, contact support.</p>
      
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard" 
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Try Again
        </a>
      </p>
      
      <p>Best regards,<br>YouTube Outlier Discovery Team</p>
    `;

    const text = `
      Analysis Failed
      
      Hi ${user.username || user.email},
      
      Unfortunately, your YouTube analysis encountered an error and could not be completed.
      
      Error Details:
      - Analysis ID: ${analysisId}
      - Error: ${error}
      ${context ? `- Context: ${context}` : ''}
      
      Please try running the analysis again. If the problem persists, contact support.
      
      Dashboard: ${process.env.FRONTEND_URL}/dashboard
      
      Best regards,
      YouTube Outlier Discovery Team
    `;

    return { html, text };
  }

  generateWeeklyDigestEmail(user, analyses, weekStart, weekEnd) {
    const completedAnalyses = analyses.filter(a => a.status === 'completed');
    const failedAnalyses = analyses.filter(a => a.status === 'failed');
    const totalOutliers = completedAnalyses.reduce((sum, a) => sum + (a.total_outliers_found || 0), 0);
    
    const html = `
      <h2>Your Weekly YouTube Analysis Digest</h2>
      
      <p>Hi ${user.username || user.email},</p>
      
      <p>Here's a summary of your YouTube analysis activity from ${new Date(weekStart).toLocaleDateString()} to ${new Date(weekEnd).toLocaleDateString()}:</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Week Summary</h3>
        <ul>
          <li><strong>Total Analyses:</strong> ${analyses.length}</li>
          <li><strong>Completed:</strong> ${completedAnalyses.length}</li>
          <li><strong>Failed:</strong> ${failedAnalyses.length}</li>
          <li><strong>Total Outliers Found:</strong> ${totalOutliers}</li>
        </ul>
      </div>
      
      ${completedAnalyses.length > 0 ? `
        <h3>Recent Completed Analyses</h3>
        <ul>
          ${completedAnalyses.slice(0, 5).map(analysis => `
            <li>
              <strong>Analysis ${analysis.id.substring(0, 8)}...</strong><br>
              Completed: ${new Date(analysis.completed_at).toLocaleDateString()}<br>
              Outliers Found: ${analysis.total_outliers_found || 0}
            </li>
          `).join('')}
        </ul>
      ` : ''}
      
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard" 
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Dashboard
        </a>
      </p>
      
      <p>Best regards,<br>YouTube Outlier Discovery Team</p>
    `;

    const text = `
      Your Weekly YouTube Analysis Digest
      
      Hi ${user.username || user.email},
      
      Here's a summary of your YouTube analysis activity from ${new Date(weekStart).toLocaleDateString()} to ${new Date(weekEnd).toLocaleDateString()}:
      
      Week Summary:
      - Total Analyses: ${analyses.length}
      - Completed: ${completedAnalyses.length}
      - Failed: ${failedAnalyses.length}
      - Total Outliers Found: ${totalOutliers}
      
      ${completedAnalyses.length > 0 ? `
        Recent Completed Analyses:
        ${completedAnalyses.slice(0, 5).map(analysis => `
          - Analysis ${analysis.id.substring(0, 8)}... (${new Date(analysis.completed_at).toLocaleDateString()}): ${analysis.total_outliers_found || 0} outliers
        `).join('')}
      ` : ''}
      
      Dashboard: ${process.env.FRONTEND_URL}/dashboard
      
      Best regards,
      YouTube Outlier Discovery Team
    `;

    return { html, text };
  }

  async process(job) {
    const { name } = job;
    
    switch (name) {
      case JOB_TYPES.ANALYSIS_COMPLETE_EMAIL:
        return await this.processAnalysisCompleteEmail(job);
      
      case JOB_TYPES.ERROR_NOTIFICATION_EMAIL:
        return await this.processErrorNotificationEmail(job);
      
      case JOB_TYPES.WEEKLY_DIGEST_EMAIL:
        return await this.processWeeklyDigestEmail(job);
      
      default:
        throw new Error(`Unknown email job type: ${name}`);
    }
  }
}

module.exports = new EmailProcessor();