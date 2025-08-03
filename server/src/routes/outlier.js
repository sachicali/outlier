const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const outlierDetectionService = require('../services/outlierDetectionService');
const queueService = require('../services/queueService');
const { authenticate, requireScopes } = require('../middleware/auth');
const { requirePermission, requireOwnershipOrAdmin } = require('../middleware/rbac');
const { getAnalysisRepository } = require('../repositories');
const logger = require('../utils/logger');

const router = express.Router();

// Get repository instance
let analysisRepository;
getAnalysisRepository().then(repo => {
  analysisRepository = repo;
}).catch(error => {
  logger.error('Error initializing analysis repository:', error);
});

// Start new outlier analysis
router.post('/start',
  authenticate,
  requirePermission('analysis:write'),
  requireScopes(['write']), // For API key access
  [
    body('exclusionChannels').isArray().withMessage('Exclusion channels must be an array'),
    body('minSubs').isInt({ min: 1000 }).withMessage('Minimum subscribers must be at least 1000'),
    body('maxSubs').isInt({ min: 10000 }).withMessage('Maximum subscribers must be at least 10000'),
    body('timeWindow').isInt({ min: 1, max: 30 }).withMessage('Time window must be between 1-30 days'),
    body('outlierThreshold').isInt({ min: 10, max: 100 }).withMessage('Outlier threshold must be between 10-100'),
  ], async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const analysisId = uuidv4();
      const config = req.body;
      const io = req.app.get('io');

      // Create analysis record in database
      const analysisData = {
        id: analysisId,
        user_id: req.user?.id || null,
        name: config.name || `Analysis ${new Date().toISOString()}`,
        description: config.description || null,
        config,
        status: 'pending',
      };

      try {
        await analysisRepository.createAnalysis(analysisData);
      } catch (error) {
        logger.error('Error creating analysis record:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create analysis record',
        });
      }

      // Determine if we should use queue system or direct processing
      const useQueue = process.env.USE_QUEUE_SYSTEM === 'true' || config.useQueue;
      
      if (useQueue) {
        try {
          // Use queue system for background processing
          const job = await queueService.startYouTubeAnalysis(
            analysisId,
            config,
            req.user?.id,
            {
              priority: config.priority || 75,
              socketRoom: `analysis-${analysisId}`,
            }
          );
          
          logger.info(`Analysis ${analysisId} queued with job ID: ${job.jobId}`);
        } catch (queueError) {
          logger.warn(`Failed to queue analysis, falling back to direct processing:`, queueError);
          
          // Fallback to direct processing
          outlierDetectionService.startAnalysis(analysisId, config, io)
            .then(results => {
              logger.info(`Analysis ${analysisId} completed successfully (direct)`);
            })
            .catch(error => {
              logger.error(`Analysis ${analysisId} failed (direct):`, error);
            });
        }
      } else {
        // Use direct processing (original behavior)
        outlierDetectionService.startAnalysis(analysisId, config, io)
          .then(results => {
            logger.info(`Analysis ${analysisId} completed successfully (direct)`);
          })
          .catch(error => {
            logger.error(`Analysis ${analysisId} failed (direct):`, error);
          });
      }

      res.json({
        success: true,
        analysisId,
        message: 'Analysis started successfully',
      });

    } catch (error) {
      next(error);
    }
  });

// Get analysis status
router.get('/status/:analysisId',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const analysis = await analysisRepository.findById(analysisId);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found',
        });
      }

      // Check ownership (users can only access their own analyses, admins can access all)
      if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        analysis: {
          id: analysis.id,
          status: analysis.status,
          started_at: analysis.started_at,
          completed_at: analysis.completed_at,
          config: analysis.config,
          processing_time_ms: analysis.processing_time_ms,
          total_outliers_found: analysis.total_outliers_found,
          total_channels_analyzed: analysis.total_channels_analyzed,
          error_message: analysis.error_message,
        },
      });
    } catch (error) {
      logger.error('Error fetching analysis status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

// Get analysis results
router.get('/results/:analysisId',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const analysis = await analysisRepository.findById(analysisId);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found',
        });
      }

      // Check ownership (users can only access their own analyses, admins can access all)
      if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      if (analysis.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: `Analysis is ${analysis.status}`,
          status: analysis.status,
        });
      }

      res.json({
        success: true,
        results: analysis.results,
        summary: analysis.summary || {
          totalOutliers: analysis.total_outliers_found,
          channelsAnalyzed: analysis.total_channels_analyzed,
          processingTime: analysis.processing_time_ms,
          config: analysis.config,
        },
      });
    } catch (error) {
      logger.error('Error fetching analysis results:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

// Export results as CSV
router.get('/export/:analysisId',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const analysis = await analysisRepository.findById(analysisId);

      if (!analysis || analysis.status !== 'completed') {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found or not completed',
        });
      }

      // Check ownership (users can only access their own analyses, admins can access all)
      if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Generate CSV
      const headers = [
        'Channel Name',
        'Subscribers',
        'Video Title',
        'Views',
        'Outlier Score',
        'Brand Fit',
        'Game/Content',
        'URL',
        'Published Date',
      ];

      const csvRows = [headers.join(',')];

      if (analysis.results && analysis.results.length > 0) {
        analysis.results.forEach(video => {
          const row = [
            `"${video.channelInfo?.snippet?.title || 'N/A'}"`,
            video.channelInfo?.statistics?.subscriberCount || 0,
            `"${video.snippet?.title || 'N/A'}"`,
            video.statistics?.viewCount || 0,
            video.outlierScore?.toFixed(1) || '0.0',
            video.brandFit?.toFixed(1) || '0.0',
            `"${video.snippet?.tags ? video.snippet.tags[0] : 'N/A'}"`,
            `"https://youtube.com/watch?v=${video.id?.videoId || ''}"`,
            video.snippet?.publishedAt || '',
          ];
          csvRows.push(row.join(','));
        });
      }

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="outliers-${analysisId}.csv"`);
      res.send(csv);
    } catch (error) {
      logger.error('Error exporting analysis results:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

// Export results as Excel
router.get('/export/:analysisId/excel',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const analysis = await analysisRepository.findById(analysisId);

      if (!analysis || analysis.status !== 'completed') {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found or not completed',
        });
      }

      // Check ownership (users can only access their own analyses, admins can access all)
      if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'YouTube Outlier Discovery Tool';
      workbook.lastModifiedBy = 'System';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Analysis Summary', {
        properties: { tabColor: { argb: 'FF4472C4' } }
      });

      // Add summary data
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 30 }
      ];

      const summaryData = [
        { metric: 'Analysis ID', value: analysis.id },
        { metric: 'Status', value: analysis.status },
        { metric: 'Started At', value: analysis.started_at ? new Date(analysis.started_at).toLocaleString() : 'N/A' },
        { metric: 'Completed At', value: analysis.completed_at ? new Date(analysis.completed_at).toLocaleString() : 'N/A' },
        { metric: 'Processing Time (ms)', value: analysis.processing_time_ms || 'N/A' },
        { metric: 'Total Outliers Found', value: analysis.total_outliers_found || 0 },
        { metric: 'Total Channels Analyzed', value: analysis.total_channels_analyzed || 0 },
        { metric: 'Time Window (days)', value: analysis.config?.timeWindow || 'N/A' },
        { metric: 'Min Subscribers', value: analysis.config?.minSubs || 'N/A' },
        { metric: 'Max Subscribers', value: analysis.config?.maxSubs || 'N/A' },
        { metric: 'Outlier Threshold', value: analysis.config?.outlierThreshold || 'N/A' },
        { metric: 'Exclusion Channels', value: analysis.config?.exclusionChannels?.join(', ') || 'None' },
      ];

      summarySheet.addRows(summaryData);

      // Style summary sheet header
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      // Outlier Videos Sheet
      const outliersSheet = workbook.addWorksheet('Outlier Videos', {
        properties: { tabColor: { argb: 'FF70AD47' } }
      });

      // Add outlier videos data
      outliersSheet.columns = [
        { header: 'Channel Name', key: 'channelName', width: 25 },
        { header: 'Subscribers', key: 'subscribers', width: 15 },
        { header: 'Video Title', key: 'videoTitle', width: 40 },
        { header: 'Views', key: 'views', width: 15 },
        { header: 'Outlier Score', key: 'outlierScore', width: 15 },
        { header: 'Brand Fit', key: 'brandFit', width: 12 },
        { header: 'Game/Content', key: 'content', width: 20 },
        { header: 'URL', key: 'url', width: 30 },
        { header: 'Published Date', key: 'publishedAt', width: 20 },
        { header: 'Duration', key: 'duration', width: 12 },
        { header: 'Tags', key: 'tags', width: 30 }
      ];

      if (analysis.results && analysis.results.length > 0) {
        const outlierRows = analysis.results.map(video => ({
          channelName: video.channelInfo?.snippet?.title || 'N/A',
          subscribers: video.channelInfo?.statistics?.subscriberCount || 0,
          videoTitle: video.snippet?.title || 'N/A',
          views: video.statistics?.viewCount || 0,
          outlierScore: video.outlierScore?.toFixed(1) || '0.0',
          brandFit: video.brandFit?.toFixed(1) || '0.0',
          content: video.snippet?.tags ? video.snippet.tags[0] : 'N/A',
          url: `https://youtube.com/watch?v=${video.id?.videoId || ''}`,
          publishedAt: video.snippet?.publishedAt ? new Date(video.snippet.publishedAt).toLocaleDateString() : 'N/A',
          duration: video.contentDetails?.duration || 'N/A',
          tags: video.snippet?.tags?.slice(0, 5).join(', ') || 'N/A'
        }));

        outliersSheet.addRows(outlierRows);
      }

      // Style outliers sheet header
      outliersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      outliersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

      // Channel Statistics Sheet
      const channelsSheet = workbook.addWorksheet('Channel Statistics', {
        properties: { tabColor: { argb: 'FFFFC000' } }
      });

      // Calculate channel statistics
      const channelStats = {};
      if (analysis.results && analysis.results.length > 0) {
        analysis.results.forEach(video => {
          const channelName = video.channelInfo?.snippet?.title || 'Unknown';
          if (!channelStats[channelName]) {
            channelStats[channelName] = {
              channelName,
              subscribers: video.channelInfo?.statistics?.subscriberCount || 0,
              totalVideos: 0,
              totalViews: 0,
              avgOutlierScore: 0,
              avgBrandFit: 0,
              maxOutlierScore: 0
            };
          }
          
          channelStats[channelName].totalVideos++;
          channelStats[channelName].totalViews += parseInt(video.statistics?.viewCount || 0);
          channelStats[channelName].avgOutlierScore += parseFloat(video.outlierScore || 0);
          channelStats[channelName].avgBrandFit += parseFloat(video.brandFit || 0);
          channelStats[channelName].maxOutlierScore = Math.max(
            channelStats[channelName].maxOutlierScore,
            parseFloat(video.outlierScore || 0)
          );
        });

        // Calculate averages
        Object.values(channelStats).forEach(stats => {
          stats.avgOutlierScore = (stats.avgOutlierScore / stats.totalVideos).toFixed(1);
          stats.avgBrandFit = (stats.avgBrandFit / stats.totalVideos).toFixed(1);
          stats.maxOutlierScore = stats.maxOutlierScore.toFixed(1);
        });
      }

      channelsSheet.columns = [
        { header: 'Channel Name', key: 'channelName', width: 25 },
        { header: 'Subscribers', key: 'subscribers', width: 15 },
        { header: 'Outlier Videos Found', key: 'totalVideos', width: 20 },
        { header: 'Total Views', key: 'totalViews', width: 15 },
        { header: 'Avg Outlier Score', key: 'avgOutlierScore', width: 18 },
        { header: 'Max Outlier Score', key: 'maxOutlierScore', width: 18 },
        { header: 'Avg Brand Fit', key: 'avgBrandFit', width: 15 }
      ];

      if (Object.keys(channelStats).length > 0) {
        channelsSheet.addRows(Object.values(channelStats));
      }

      // Style channels sheet header
      channelsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      channelsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

      // Add auto-filter to all sheets
      summarySheet.autoFilter = {
        from: 'A1',
        to: 'B' + (summaryData.length + 1)
      };

      if (analysis.results && analysis.results.length > 0) {
        outliersSheet.autoFilter = {
          from: 'A1',
          to: 'K' + (analysis.results.length + 1)
        };

        if (Object.keys(channelStats).length > 0) {
          channelsSheet.autoFilter = {
            from: 'A1',
            to: 'G' + (Object.keys(channelStats).length + 1)
          };
        }
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="outliers-analysis-${analysisId}.xlsx"`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      logger.error('Error exporting analysis results as Excel:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

// List all analyses
router.get('/list',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res) => {
    try {
      // Filter analyses by user ownership (admins can see all)
      const analyses = await analysisRepository.findByUserId(
        req.user.role === 'admin' ? null : req.user.id
      );

      const userAnalyses = analyses.map(analysis => ({
        id: analysis.id,
        userId: analysis.user_id, // Include userId for admin view
        status: analysis.status,
        startTime: analysis.started_at,
        endTime: analysis.completed_at,
        resultCount: analysis.results ? analysis.results.length : 0,
        config: {
          exclusionChannels: analysis.config?.exclusionChannels || [],
          timeWindow: analysis.config?.timeWindow || 7,
        },
      }));

      res.json({
        success: true,
        analyses: userAnalyses.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)),
      });
    } catch (error) {
      logger.error('Error fetching analyses list:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });

module.exports = router;
