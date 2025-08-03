const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const queueService = require('../services/queueService');
const { authenticate, requireScopes } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { JOB_QUEUES, JOB_TYPES } = require('../queues/jobTypes');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to ensure queue service is initialized
const ensureQueueService = async (req, res, next) => {
  try {
    if (!queueService.isInitialized()) {
      await queueService.initialize();
    }
    next();
  } catch (error) {
    logger.error('Failed to initialize queue service:', error);
    res.status(503).json({
      success: false,
      message: 'Queue service unavailable',
      error: error.message,
    });
  }
};

// Get queue statistics
router.get('/stats',
  authenticate,
  requirePermission('queue:read'),
  requireScopes(['read']),
  ensureQueueService,
  [
    query('queue').optional().isIn(Object.values(JOB_QUEUES)),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queue } = req.query;
      const stats = await queueService.getQueueStats(queue);

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve queue statistics',
        error: error.message,
      });
    }
  });

// Get job status
router.get('/jobs/:queueName/:jobId',
  authenticate,
  requirePermission('queue:read'),
  requireScopes(['read']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
    param('jobId').isString().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName, jobId } = req.params;
      const jobStatus = await queueService.getJobStatus(queueName, jobId);

      if (jobStatus.status === 'not_found') {
        return res.status(404).json({
          success: false,
          message: 'Job not found',
        });
      }

      res.json({
        success: true,
        job: jobStatus,
      });
    } catch (error) {
      logger.error('Failed to get job status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve job status',
        error: error.message,
      });
    }
  });

// Start YouTube analysis job
router.post('/jobs/youtube-analysis',
  authenticate,
  requirePermission('analysis:write'),
  requireScopes(['write']),
  ensureQueueService,
  [
    body('analysisId').isUUID().withMessage('Analysis ID must be a valid UUID'),
    body('config').isObject().withMessage('Config must be an object'),
    body('config.exclusionChannels').isArray().withMessage('Exclusion channels must be an array'),
    body('config.minSubs').isInt({ min: 1000 }).withMessage('Minimum subscribers must be at least 1000'),
    body('config.maxSubs').isInt({ min: 10000 }).withMessage('Maximum subscribers must be at least 10000'),
    body('config.timeWindow').isInt({ min: 1, max: 30 }).withMessage('Time window must be between 1-30 days'),
    body('priority').optional().isInt({ min: 1, max: 100 }),
    body('delay').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { analysisId, config, priority, delay } = req.body;
      const userId = req.user.id;
      const socketRoom = `analysis-${analysisId}`;

      const job = await queueService.startYouTubeAnalysis(
        analysisId,
        config,
        userId,
        { priority, delay, socketRoom }
      );

      res.json({
        success: true,
        job,
        message: 'YouTube analysis job queued successfully',
      });
    } catch (error) {
      logger.error('Failed to queue YouTube analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to queue YouTube analysis',
        error: error.message,
      });
    }
  });

// Start batch channel analysis job
router.post('/jobs/batch-analysis',
  authenticate,
  requirePermission('analysis:write'),
  requireScopes(['write']),
  ensureQueueService,
  [
    body('channels').isArray().withMessage('Channels must be an array'),
    body('config').isObject().withMessage('Config must be an object'),
    body('analysisId').isUUID().withMessage('Analysis ID must be a valid UUID'),
    body('priority').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { channels, config, analysisId, priority } = req.body;
      const userId = req.user.id;

      const job = await queueService.processBatchChannelAnalysis(
        channels,
        config,
        analysisId,
        userId,
        { priority }
      );

      res.json({
        success: true,
        job,
        message: 'Batch channel analysis job queued successfully',
      });
    } catch (error) {
      logger.error('Failed to queue batch analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to queue batch analysis',
        error: error.message,
      });
    }
  });

// Send analysis complete email
router.post('/jobs/email/analysis-complete',
  authenticate,
  requirePermission('email:send'),
  requireScopes(['write']),
  ensureQueueService,
  [
    body('analysisId').isUUID().withMessage('Analysis ID must be a valid UUID'),
    body('results').isArray().withMessage('Results must be an array'),
    body('customMessage').optional().isString(),
    body('delay').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { analysisId, results, customMessage, delay } = req.body;
      const userId = req.user.id;

      const job = await queueService.sendAnalysisCompleteEmail(
        userId,
        analysisId,
        results,
        customMessage,
        { delay }
      );

      res.json({
        success: true,
        job,
        message: 'Analysis complete email queued successfully',
      });
    } catch (error) {
      logger.error('Failed to queue analysis complete email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to queue analysis complete email',
        error: error.message,
      });
    }
  });

// Schedule cleanup job
router.post('/jobs/cleanup/old-analyses',
  authenticate,
  requirePermission('admin:system'),
  requireScopes(['admin']),
  ensureQueueService,
  [
    body('olderThanDays').isInt({ min: 1, max: 365 }).withMessage('olderThanDays must be between 1-365'),
    body('batchSize').optional().isInt({ min: 10, max: 1000 }),
    body('delay').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { olderThanDays, batchSize, delay } = req.body;

      const job = await queueService.scheduleCleanupOldAnalyses(
        olderThanDays,
        batchSize,
        { delay }
      );

      res.json({
        success: true,
        job,
        message: 'Cleanup job scheduled successfully',
      });
    } catch (error) {
      logger.error('Failed to schedule cleanup job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule cleanup job',
        error: error.message,
      });
    }
  });

// Retry failed job
router.post('/jobs/:queueName/:jobId/retry',
  authenticate,
  requirePermission('queue:write'),
  requireScopes(['write']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
    param('jobId').isString().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName, jobId } = req.params;
      const success = await queueService.retryJob(queueName, jobId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Job not found or cannot be retried',
        });
      }

      res.json({
        success: true,
        message: 'Job retried successfully',
      });
    } catch (error) {
      logger.error('Failed to retry job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retry job',
        error: error.message,
      });
    }
  });

// Remove job
router.delete('/jobs/:queueName/:jobId',
  authenticate,
  requirePermission('queue:write'),
  requireScopes(['write']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
    param('jobId').isString().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName, jobId } = req.params;
      const success = await queueService.removeJob(queueName, jobId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Job not found',
        });
      }

      res.json({
        success: true,
        message: 'Job removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove job',
        error: error.message,
      });
    }
  });

// Pause queue (admin only)
router.post('/queues/:queueName/pause',
  authenticate,
  requirePermission('admin:system'),
  requireScopes(['admin']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName } = req.params;
      await queueService.pauseQueue(queueName);

      res.json({
        success: true,
        message: `Queue ${queueName} paused successfully`,
      });
    } catch (error) {
      logger.error('Failed to pause queue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pause queue',
        error: error.message,
      });
    }
  });

// Resume queue (admin only)
router.post('/queues/:queueName/resume',
  authenticate,
  requirePermission('admin:system'),
  requireScopes(['admin']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName } = req.params;
      await queueService.resumeQueue(queueName);

      res.json({
        success: true,
        message: `Queue ${queueName} resumed successfully`,
      });
    } catch (error) {
      logger.error('Failed to resume queue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resume queue',
        error: error.message,
      });
    }
  });

// Clean queue (admin only)
router.post('/queues/:queueName/clean',
  authenticate,
  requirePermission('admin:system'),
  requireScopes(['admin']),
  ensureQueueService,
  [
    param('queueName').isIn(Object.values(JOB_QUEUES)),
    body('grace').optional().isInt({ min: 0 }),
    body('status').optional().isIn(['completed', 'failed', 'active', 'waiting']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { queueName } = req.params;
      const { grace = 0, status = 'completed' } = req.body;
      
      const cleanedJobs = await queueService.cleanQueue(queueName, grace, status);

      res.json({
        success: true,
        message: `Cleaned ${cleanedJobs.length} ${status} jobs from ${queueName}`,
        cleanedCount: cleanedJobs.length,
      });
    } catch (error) {
      logger.error('Failed to clean queue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean queue',
        error: error.message,
      });
    }
  });

// Get queue health status
router.get('/health',
  authenticate,
  requirePermission('queue:read'),
  requireScopes(['read']),
  async (req, res) => {
    try {
      const isInitialized = queueService.isInitialized();
      const stats = isInitialized ? await queueService.getQueueStats() : null;
      
      const health = {
        status: isInitialized ? 'healthy' : 'unhealthy',
        initialized: isInitialized,
        timestamp: new Date().toISOString(),
        queues: stats ? Object.keys(stats).length : 0,
      };

      if (stats) {
        health.queueSummary = Object.entries(stats).reduce((summary, [queueName, queueStats]) => {
          summary[queueName] = {
            waiting: queueStats.counts?.waiting || 0,
            active: queueStats.counts?.active || 0,
            completed: queueStats.counts?.completed || 0,
            failed: queueStats.counts?.failed || 0,
          };
          return summary;
        }, {});
      }

      res.json({
        success: true,
        health,
      });
    } catch (error) {
      logger.error('Failed to get queue health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve queue health',
        error: error.message,
      });
    }
  });

module.exports = router;