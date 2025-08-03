const queueManager = require('../queues/queueManager');
const { JOB_TYPES, JOB_QUEUES, validateJobData, createJobOptions } = require('../queues/jobTypes');
const logger = require('../utils/logger');

class QueueService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      try {
        await queueManager.initialize();
        this.isInitialized = true;
        logger.info('Queue service initialized');
      } catch (error) {
        logger.error('Failed to initialize queue service:', error);
        throw error;
      }
    }
  }

  // YouTube Analysis Jobs
  async startYouTubeAnalysis(analysisId, config, userId, options = {}) {
    await this.initialize();
    
    const jobData = {
      analysisId,
      config,
      userId,
      socketRoom: options.socketRoom || `analysis-${analysisId}`,
      priority: options.priority,
    };

    try {
      validateJobData(JOB_TYPES.YOUTUBE_ANALYSIS, jobData);
      
      const jobOptions = createJobOptions(JOB_TYPES.YOUTUBE_ANALYSIS, {
        priority: options.priority || 75,
        delay: options.delay || 0,
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.YOUTUBE_ANALYSIS,
        JOB_TYPES.YOUTUBE_ANALYSIS,
        jobData,
        jobOptions
      );

      logger.info(`YouTube analysis job queued:`, {
        jobId: job.id,
        analysisId,
        userId,
      });

      return {
        jobId: job.id,
        analysisId,
        queueName: JOB_QUEUES.YOUTUBE_ANALYSIS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue YouTube analysis:', error);
      throw error;
    }
  }

  async buildExclusionList(channelNames, timeWindowDays = 7, options = {}) {
    await this.initialize();
    
    const jobData = {
      channelNames,
      timeWindowDays,
      analysisId: options.analysisId,
    };

    try {
      validateJobData(JOB_TYPES.EXCLUSION_LIST_BUILD, jobData);
      
      const jobOptions = createJobOptions(JOB_TYPES.EXCLUSION_LIST_BUILD, {
        priority: options.priority || 75,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.YOUTUBE_ANALYSIS,
        JOB_TYPES.EXCLUSION_LIST_BUILD,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.YOUTUBE_ANALYSIS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue exclusion list build:', error);
      throw error;
    }
  }

  async discoverChannels(searchQueries, subscriberRange, options = {}) {
    await this.initialize();
    
    const jobData = {
      searchQueries,
      subscriberRange,
      analysisId: options.analysisId,
      maxResults: options.maxResults,
    };

    try {
      validateJobData(JOB_TYPES.CHANNEL_DISCOVERY, jobData);
      
      const jobOptions = createJobOptions(JOB_TYPES.CHANNEL_DISCOVERY, {
        priority: options.priority || 50,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.YOUTUBE_ANALYSIS,
        JOB_TYPES.CHANNEL_DISCOVERY,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.YOUTUBE_ANALYSIS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue channel discovery:', error);
      throw error;
    }
  }

  // Batch Processing Jobs
  async processBatchChannelAnalysis(channels, config, analysisId, userId, options = {}) {
    await this.initialize();
    
    const jobData = {
      channels,
      config,
      analysisId,
      userId,
    };

    try {
      const jobOptions = createJobOptions(JOB_TYPES.BATCH_CHANNEL_ANALYSIS, {
        priority: options.priority || 50,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.BATCH_PROCESSING,
        JOB_TYPES.BATCH_CHANNEL_ANALYSIS,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.BATCH_PROCESSING,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue batch channel analysis:', error);
      throw error;
    }
  }

  async processBatchVideos(videos, processingType, config, options = {}) {
    await this.initialize();
    
    const jobData = {
      videos,
      processingType,
      config,
    };

    try {
      const jobOptions = createJobOptions(JOB_TYPES.BATCH_VIDEO_PROCESSING, {
        priority: options.priority || 25,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.BATCH_PROCESSING,
        JOB_TYPES.BATCH_VIDEO_PROCESSING,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.BATCH_PROCESSING,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue batch video processing:', error);
      throw error;
    }
  }

  // Email Notification Jobs
  async sendAnalysisCompleteEmail(userId, analysisId, results, customMessage = null, options = {}) {
    await this.initialize();
    
    const jobData = {
      userId,
      analysisId,
      results,
      customMessage,
    };

    try {
      validateJobData(JOB_TYPES.ANALYSIS_COMPLETE_EMAIL, jobData);
      
      const jobOptions = createJobOptions(JOB_TYPES.ANALYSIS_COMPLETE_EMAIL, {
        priority: options.priority || 50,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.EMAIL_NOTIFICATIONS,
        JOB_TYPES.ANALYSIS_COMPLETE_EMAIL,
        jobData,
        jobOptions
      );

      logger.info(`Analysis complete email queued:`, {
        jobId: job.id,
        userId,
        analysisId,
      });

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.EMAIL_NOTIFICATIONS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue analysis complete email:', error);
      throw error;
    }
  }

  async sendErrorNotificationEmail(userId, analysisId, error, context = null, options = {}) {
    await this.initialize();
    
    const jobData = {
      userId,
      analysisId,
      error,
      context,
    };

    try {
      const jobOptions = createJobOptions(JOB_TYPES.ERROR_NOTIFICATION_EMAIL, {
        priority: options.priority || 75,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.EMAIL_NOTIFICATIONS,
        JOB_TYPES.ERROR_NOTIFICATION_EMAIL,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.EMAIL_NOTIFICATIONS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue error notification email:', error);
      throw error;
    }
  }

  async sendWeeklyDigestEmail(userId, weekStart, weekEnd, options = {}) {
    await this.initialize();
    
    const jobData = {
      userId,
      weekStart,
      weekEnd,
    };

    try {
      const jobOptions = createJobOptions(JOB_TYPES.WEEKLY_DIGEST_EMAIL, {
        priority: options.priority || 25,
        delay: options.delay || 0,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.EMAIL_NOTIFICATIONS,
        JOB_TYPES.WEEKLY_DIGEST_EMAIL,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.EMAIL_NOTIFICATIONS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to queue weekly digest email:', error);
      throw error;
    }
  }

  // Scheduled Task Jobs
  async scheduleCleanupOldAnalyses(olderThanDays = 90, batchSize = 100, options = {}) {
    await this.initialize();
    
    const jobData = {
      olderThanDays,
      batchSize,
    };

    try {
      validateJobData(JOB_TYPES.CLEANUP_OLD_ANALYSES, jobData);
      
      const jobOptions = createJobOptions(JOB_TYPES.CLEANUP_OLD_ANALYSES, {
        priority: options.priority || 10,
        delay: options.delay || 0,
        repeat: options.repeat, // For recurring jobs
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.DATA_CLEANUP,
        JOB_TYPES.CLEANUP_OLD_ANALYSES,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.DATA_CLEANUP,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to schedule cleanup old analyses:', error);
      throw error;
    }
  }

  async scheduleRefreshCache(cacheType = 'all', forceRefresh = false, options = {}) {
    await this.initialize();
    
    const jobData = {
      cacheType,
      forceRefresh,
    };

    try {
      const jobOptions = createJobOptions(JOB_TYPES.REFRESH_CACHE, {
        priority: options.priority || 25,
        delay: options.delay || 0,
        repeat: options.repeat,
      });

      const job = await queueManager.addJob(
        JOB_QUEUES.SCHEDULED_TASKS,
        JOB_TYPES.REFRESH_CACHE,
        jobData,
        jobOptions
      );

      return {
        jobId: job.id,
        queueName: JOB_QUEUES.SCHEDULED_TASKS,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to schedule cache refresh:', error);
      throw error;
    }
  }

  // Job Management
  async getJob(queueName, jobId) {
    await this.initialize();
    
    try {
      return await queueManager.getJob(queueName, jobId);
    } catch (error) {
      logger.error(`Failed to get job ${jobId} from ${queueName}:`, error);
      throw error;
    }
  }

  async getJobStatus(queueName, jobId) {
    await this.initialize();
    
    try {
      const job = await queueManager.getJob(queueName, jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress;
      
      return {
        status: state,
        progress,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      };
    } catch (error) {
      logger.error(`Failed to get job status ${jobId}:`, error);
      throw error;
    }
  }

  async removeJob(queueName, jobId) {
    await this.initialize();
    
    try {
      return await queueManager.removeJob(queueName, jobId);
    } catch (error) {
      logger.error(`Failed to remove job ${jobId}:`, error);
      throw error;
    }
  }

  async retryJob(queueName, jobId) {
    await this.initialize();
    
    try {
      return await queueManager.retryJob(queueName, jobId);
    } catch (error) {
      logger.error(`Failed to retry job ${jobId}:`, error);
      throw error;
    }
  }

  // Queue Management
  async getQueueStats(queueName = null) {
    await this.initialize();
    
    try {
      if (queueName) {
        return await queueManager.getQueueStats(queueName);
      } else {
        return await queueManager.getAllQueueStats();
      }
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  async pauseQueue(queueName) {
    await this.initialize();
    
    try {
      await queueManager.pauseQueue(queueName);
      logger.info(`Queue paused: ${queueName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}:`, error);
      throw error;
    }
  }

  async resumeQueue(queueName) {
    await this.initialize();
    
    try {
      await queueManager.resumeQueue(queueName);
      logger.info(`Queue resumed: ${queueName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}:`, error);
      throw error;
    }
  }

  async cleanQueue(queueName, grace = 0, status = 'completed') {
    await this.initialize();
    
    try {
      const jobs = await queueManager.cleanQueue(queueName, grace, status);
      logger.info(`Cleaned ${jobs.length} ${status} jobs from ${queueName}`);
      return jobs;
    } catch (error) {
      logger.error(`Failed to clean queue ${queueName}:`, error);
      throw error;
    }
  }

  // Utility Methods
  isInitialized() {
    return this.isInitialized;
  }

  async shutdown() {
    if (this.isInitialized) {
      try {
        await queueManager.shutdown();
        this.isInitialized = false;
        logger.info('Queue service shutdown completed');
      } catch (error) {
        logger.error('Error during queue service shutdown:', error);
        throw error;
      }
    }
  }
}

module.exports = new QueueService();