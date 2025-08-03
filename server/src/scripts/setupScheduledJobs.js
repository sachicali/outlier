#!/usr/bin/env node

const cron = require('node-cron');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');
const { JOB_TYPES } = require('../queues/jobTypes');

class ScheduledJobsManager {
  constructor() {
    this.scheduledJobs = new Map();
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('Initializing scheduled jobs manager...');
      
      // Initialize queue service
      await queueService.initialize();
      
      // Setup scheduled jobs
      await this.setupScheduledJobs();
      
      this.isRunning = true;
      logger.info('Scheduled jobs manager initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize scheduled jobs manager:', error);
      throw error;
    }
  }

  async setupScheduledJobs() {
    const jobs = [
      {
        name: 'cleanup-old-analyses',
        schedule: '0 2 * * *', // Daily at 2 AM
        job: this.scheduleCleanupOldAnalyses.bind(this),
        enabled: process.env.ENABLE_CLEANUP_JOBS !== 'false',
      },
      {
        name: 'cleanup-failed-jobs',
        schedule: '0 3 * * *', // Daily at 3 AM
        job: this.scheduleCleanupFailedJobs.bind(this),
        enabled: process.env.ENABLE_CLEANUP_JOBS !== 'false',
      },
      {
        name: 'refresh-cache',
        schedule: '0 */6 * * *', // Every 6 hours
        job: this.scheduleRefreshCache.bind(this),
        enabled: process.env.ENABLE_CACHE_REFRESH !== 'false',
      },
      {
        name: 'cleanup-expired-cache',
        schedule: '30 1 * * *', // Daily at 1:30 AM
        job: this.scheduleCleanupExpiredCache.bind(this),
        enabled: process.env.ENABLE_CACHE_CLEANUP !== 'false',
      },
      {
        name: 'weekly-digest-emails',
        schedule: '0 9 * * 1', // Mondays at 9 AM
        job: this.scheduleWeeklyDigestEmails.bind(this),
        enabled: process.env.ENABLE_EMAIL_DIGEST !== 'false',
      },
      {
        name: 'sync-youtube-data',
        schedule: '0 */12 * * *', // Every 12 hours
        job: this.scheduleSyncYouTubeData.bind(this),
        enabled: process.env.ENABLE_YOUTUBE_SYNC !== 'false',
      },
      {
        name: 'generate-reports',
        schedule: '0 4 * * *', // Daily at 4 AM
        job: this.scheduleGenerateReports.bind(this),
        enabled: process.env.ENABLE_REPORT_GENERATION !== 'false',
      },
      {
        name: 'archive-old-data',
        schedule: '0 1 1 * *', // First day of month at 1 AM
        job: this.scheduleArchiveOldData.bind(this),
        enabled: process.env.ENABLE_DATA_ARCHIVING !== 'false',
      },
    ];

    for (const jobConfig of jobs) {
      if (jobConfig.enabled) {
        try {
          const scheduledJob = cron.schedule(jobConfig.schedule, async () => {
            logger.info(`Running scheduled job: ${jobConfig.name}`);
            try {
              await jobConfig.job();
              logger.info(`Scheduled job completed: ${jobConfig.name}`);
            } catch (error) {
              logger.error(`Scheduled job failed: ${jobConfig.name}`, error);
            }
          }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'UTC',
          });

          this.scheduledJobs.set(jobConfig.name, {
            job: scheduledJob,
            schedule: jobConfig.schedule,
            enabled: true,
          });

          logger.info(`Scheduled job registered: ${jobConfig.name} (${jobConfig.schedule})`);
        } catch (error) {
          logger.error(`Failed to schedule job ${jobConfig.name}:`, error);
        }
      } else {
        logger.info(`Scheduled job disabled: ${jobConfig.name}`);
      }
    }
  }

  async scheduleCleanupOldAnalyses() {
    try {
      const olderThanDays = parseInt(process.env.CLEANUP_ANALYSES_OLDER_THAN_DAYS) || 90;
      const batchSize = parseInt(process.env.CLEANUP_BATCH_SIZE) || 100;
      
      await queueService.scheduleCleanupOldAnalyses(olderThanDays, batchSize, {
        priority: 10,
      });
      
      logger.info(`Cleanup old analyses job scheduled (older than ${olderThanDays} days)`);
    } catch (error) {
      logger.error('Failed to schedule cleanup old analyses job:', error);
    }
  }

  async scheduleCleanupFailedJobs() {
    try {
      const olderThanHours = parseInt(process.env.CLEANUP_FAILED_JOBS_OLDER_THAN_HOURS) || 24;
      
      const job = await queueService.addJob(
        'data-cleanup',
        JOB_TYPES.CLEANUP_FAILED_JOBS,
        {
          olderThanHours,
          maxJobs: 1000,
        },
        {
          priority: 10,
        }
      );
      
      logger.info(`Cleanup failed jobs scheduled (older than ${olderThanHours} hours)`);
    } catch (error) {
      logger.error('Failed to schedule cleanup failed jobs:', error);
    }
  }

  async scheduleRefreshCache() {
    try {
      await queueService.scheduleRefreshCache('all', false, {
        priority: 25,
      });
      
      logger.info('Cache refresh job scheduled');
    } catch (error) {
      logger.error('Failed to schedule cache refresh job:', error);
    }
  }

  async scheduleCleanupExpiredCache() {
    try {
      const maxAge = parseInt(process.env.CACHE_MAX_AGE_SECONDS) || 86400; // 24 hours
      
      const job = await queueService.addJob(
        'data-cleanup',
        JOB_TYPES.CLEANUP_EXPIRED_CACHE,
        {
          pattern: '*',
          maxAge,
        },
        {
          priority: 10,
        }
      );
      
      logger.info('Cleanup expired cache job scheduled');
    } catch (error) {
      logger.error('Failed to schedule cleanup expired cache job:', error);
    }
  }

  async scheduleWeeklyDigestEmails() {
    try {
      // This would typically query for users who have opted in for digest emails
      // For now, we'll skip if no user management system is in place
      logger.info('Weekly digest emails would be scheduled here');
      
      // Example implementation:
      // const users = await getUsersOptedInForDigest();
      // for (const user of users) {
      //   const weekStart = new Date();
      //   weekStart.setDate(weekStart.getDate() - 7);
      //   const weekEnd = new Date();
      //   
      //   await queueService.sendWeeklyDigestEmail(
      //     user.id,
      //     weekStart.toISOString(),
      //     weekEnd.toISOString(),
      //     { priority: 25 }
      //   );
      // }
    } catch (error) {
      logger.error('Failed to schedule weekly digest emails:', error);
    }
  }

  async scheduleSyncYouTubeData() {
    try {
      const job = await queueService.addJob(
        'scheduled-tasks',
        JOB_TYPES.SYNC_YOUTUBE_DATA,
        {
          syncType: 'recent',
          maxItems: 100,
        },
        {
          priority: 25,
        }
      );
      
      logger.info('YouTube data sync job scheduled');
    } catch (error) {
      logger.error('Failed to schedule YouTube data sync job:', error);
    }
  }

  async scheduleGenerateReports() {
    try {
      const job = await queueService.addJob(
        'scheduled-tasks',
        JOB_TYPES.GENERATE_REPORTS,
        {
          reportType: 'daily',
          dateRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          priority: 25,
        }
      );
      
      logger.info('Generate reports job scheduled');
    } catch (error) {
      logger.error('Failed to schedule generate reports job:', error);
    }
  }

  async scheduleArchiveOldData() {
    try {
      const olderThanDays = parseInt(process.env.ARCHIVE_DATA_OLDER_THAN_DAYS) || 365;
      const archivePath = process.env.ARCHIVE_PATH || '/tmp/archive';
      
      const job = await queueService.addJob(
        'data-cleanup',
        JOB_TYPES.ARCHIVE_OLD_DATA,
        {
          olderThanDays,
          archivePath,
        },
        {
          priority: 5,
        }
      );
      
      logger.info(`Archive old data job scheduled (older than ${olderThanDays} days)`);
    } catch (error) {
      logger.error('Failed to schedule archive old data job:', error);
    }
  }

  getScheduledJobsStatus() {
    const status = {};
    
    for (const [name, config] of this.scheduledJobs) {
      status[name] = {
        schedule: config.schedule,
        enabled: config.enabled,
        running: config.job.running,
        lastRun: config.job.lastDate,
        nextRun: config.job.nextDate,
      };
    }
    
    return status;
  }

  async stopAllJobs() {
    logger.info('Stopping all scheduled jobs...');
    
    for (const [name, config] of this.scheduledJobs) {
      try {
        config.job.stop();
        logger.info(`Stopped scheduled job: ${name}`);
      } catch (error) {
        logger.warn(`Failed to stop scheduled job ${name}:`, error);
      }
    }
    
    this.scheduledJobs.clear();
    this.isRunning = false;
  }

  async shutdown() {
    logger.info('Shutting down scheduled jobs manager...');
    
    await this.stopAllJobs();
    
    if (queueService.isInitialized()) {
      await queueService.shutdown();
    }
    
    logger.info('Scheduled jobs manager shutdown completed');
  }
}

// Start scheduled jobs manager if this script is run directly
if (require.main === module) {
  const scheduledJobsManager = new ScheduledJobsManager();
  
  scheduledJobsManager.initialize().then(() => {
    logger.info('🕰️ Scheduled jobs system started successfully');
    logger.info(`📝 Scheduled jobs: ${scheduledJobsManager.scheduledJobs.size}`);
    
    // Log status every hour
    setInterval(() => {
      const status = scheduledJobsManager.getScheduledJobsStatus();
      logger.info('Scheduled jobs status:', status);
    }, 60 * 60 * 1000);
    
    // Setup graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down scheduled jobs...`);
      
      try {
        await scheduledJobsManager.shutdown();
        logger.info('Scheduled jobs shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  }).catch(error => {
    logger.error('Failed to start scheduled jobs system:', error);
    process.exit(1);
  });
}

module.exports = ScheduledJobsManager;