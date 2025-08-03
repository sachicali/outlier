const { Worker } = require('bullmq');
const logger = require('../utils/logger');
const queueManager = require('../queues/queueManager');
const redisConnection = require('../queues/redisConnection');
const { JOB_QUEUES } = require('../queues/jobTypes');

// Import processors
const youtubeAnalysisProcessor = require('./processors/youtubeAnalysisProcessor');
const batchProcessor = require('./processors/batchProcessor');
const scheduledProcessor = require('./processors/scheduledProcessor');
const emailProcessor = require('./processors/emailProcessor');
const cleanupProcessor = require('./processors/cleanupProcessor');

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.isShuttingDown = false;
    this.redisConnection = null;
  }

  async initialize() {
    try {
      logger.info('Initializing worker manager...');
      
      // Connect to Redis
      this.redisConnection = await redisConnection.connect();
      
      // Initialize queue manager
      await queueManager.initialize();
      
      // Create workers for each queue
      await this.createWorkers();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('Worker manager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize worker manager:', error);
      throw error;
    }
  }

  async createWorkers() {
    const workerConfigs = [
      {
        queueName: JOB_QUEUES.YOUTUBE_ANALYSIS,
        processor: this.createYouTubeAnalysisProcessor(),
        concurrency: 3,
        options: {
          connection: this.redisConnection,
          removeOnComplete: 100,
          removeOnFail: 50,
          settings: {
            stalledInterval: 30000,
            maxStalledCount: 1,
          },
        },
      },
      {
        queueName: JOB_QUEUES.BATCH_PROCESSING,
        processor: this.createBatchProcessor(),
        concurrency: 2,
        options: {
          connection: this.redisConnection,
          removeOnComplete: 50,
          removeOnFail: 25,
          settings: {
            stalledInterval: 60000,
            maxStalledCount: 1,
          },
        },
      },
      {
        queueName: JOB_QUEUES.SCHEDULED_TASKS,
        processor: this.createScheduledProcessor(),
        concurrency: 1,
        options: {
          connection: this.redisConnection,
          removeOnComplete: 10,
          removeOnFail: 10,
          settings: {
            stalledInterval: 120000,
            maxStalledCount: 2,
          },
        },
      },
      {
        queueName: JOB_QUEUES.EMAIL_NOTIFICATIONS,
        processor: this.createEmailProcessor(),
        concurrency: 5,
        options: {
          connection: this.redisConnection,
          removeOnComplete: 20,
          removeOnFail: 50,
          settings: {
            stalledInterval: 30000,
            maxStalledCount: 3,
          },
        },
      },
      {
        queueName: JOB_QUEUES.DATA_CLEANUP,
        processor: this.createCleanupProcessor(),
        concurrency: 1,
        options: {
          connection: this.redisConnection,
          removeOnComplete: 5,
          removeOnFail: 5,
          settings: {
            stalledInterval: 300000, // 5 minutes
            maxStalledCount: 1,
          },
        },
      },
    ];

    for (const config of workerConfigs) {
      try {
        const worker = new Worker(
          config.queueName,
          config.processor,
          {
            ...config.options,
            concurrency: config.concurrency,
          }
        );

        // Setup worker event handlers
        this.setupWorkerEvents(worker, config.queueName);
        
        this.workers.set(config.queueName, worker);
        logger.info(`Created worker for queue: ${config.queueName} (concurrency: ${config.concurrency})`);
      } catch (error) {
        logger.error(`Failed to create worker for queue ${config.queueName}:`, error);
        throw error;
      }
    }
  }

  createYouTubeAnalysisProcessor() {
    return async (job) => {
      logger.info(`Processing YouTube analysis job:`, {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });

      try {
        const result = await youtubeAnalysisProcessor.process(job);
        
        logger.info(`YouTube analysis job completed:`, {
          jobId: job.id,
          jobName: job.name,
          processingTime: Date.now() - job.processedOn,
        });

        return result;
      } catch (error) {
        logger.error(`YouTube analysis job failed:`, {
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade + 1,
          error: error.message,
        });
        throw error;
      }
    };
  }

  createBatchProcessor() {
    return async (job) => {
      logger.info(`Processing batch job:`, {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await batchProcessor.process(job);
        
        logger.info(`Batch job completed:`, {
          jobId: job.id,
          jobName: job.name,
          processingTime: Date.now() - job.processedOn,
        });

        return result;
      } catch (error) {
        logger.error(`Batch job failed:`, {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
        });
        throw error;
      }
    };
  }

  createScheduledProcessor() {
    return async (job) => {
      logger.info(`Processing scheduled job:`, {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await scheduledProcessor.process(job);
        
        logger.info(`Scheduled job completed:`, {
          jobId: job.id,
          jobName: job.name,
          processingTime: Date.now() - job.processedOn,
        });

        return result;
      } catch (error) {
        logger.error(`Scheduled job failed:`, {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
        });
        throw error;
      }
    };
  }

  createEmailProcessor() {
    return async (job) => {
      logger.info(`Processing email job:`, {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await emailProcessor.process(job);
        
        logger.info(`Email job completed:`, {
          jobId: job.id,
          jobName: job.name,
          processingTime: Date.now() - job.processedOn,
        });

        return result;
      } catch (error) {
        logger.error(`Email job failed:`, {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
        });
        throw error;
      }
    };
  }

  createCleanupProcessor() {
    return async (job) => {
      logger.info(`Processing cleanup job:`, {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await cleanupProcessor.process(job);
        
        logger.info(`Cleanup job completed:`, {
          jobId: job.id,
          jobName: job.name,
          processingTime: Date.now() - job.processedOn,
        });

        return result;
      } catch (error) {
        logger.error(`Cleanup job failed:`, {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
        });
        throw error;
      }
    };
  }

  setupWorkerEvents(worker, queueName) {
    worker.on('ready', () => {
      logger.info(`Worker ready for queue: ${queueName}`);
    });

    worker.on('active', (job) => {
      logger.debug(`Job started:`, {
        queueName,
        jobId: job.id,
        jobName: job.name,
      });
    });

    worker.on('completed', (job, result) => {
      logger.info(`Job completed:`, {
        queueName,
        jobId: job.id,
        jobName: job.name,
        processingTime: Date.now() - job.processedOn,
        resultSize: JSON.stringify(result).length,
      });
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job failed:`, {
        queueName,
        jobId: job?.id,
        jobName: job?.name,
        attempt: job?.attemptsMade,
        error: err.message,
        stack: err.stack,
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn(`Job stalled:`, {
        queueName,
        jobId,
      });
    });

    worker.on('progress', (job, progress) => {
      logger.debug(`Job progress:`, {
        queueName,
        jobId: job.id,
        jobName: job.name,
        progress,
      });
    });

    worker.on('error', (err) => {
      logger.error(`Worker error for ${queueName}:`, {
        error: err.message,
        stack: err.stack,
      });
    });

    worker.on('closing', () => {
      logger.info(`Worker closing for queue: ${queueName}`);
    });

    worker.on('closed', () => {
      logger.info(`Worker closed for queue: ${queueName}`);
    });
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress...');
        return;
      }
      
      this.isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close all workers
        const closePromises = Array.from(this.workers.values()).map(async (worker) => {
          try {
            await worker.close();
          } catch (error) {
            logger.warn('Error closing worker:', error.message);
          }
        });

        await Promise.all(closePromises);
        logger.info('All workers closed');

        // Shutdown queue manager
        await queueManager.shutdown();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception in worker:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection in worker:', {
        reason,
        promise,
      });
      shutdown('unhandledRejection');
    });
  }

  async getWorkerStats() {
    const stats = {};
    
    for (const [queueName, worker] of this.workers) {
      try {
        stats[queueName] = {
          isRunning: worker.isRunning(),
          processingJobs: worker.running,
          concurrency: worker.opts.concurrency,
        };
      } catch (error) {
        stats[queueName] = { error: error.message };
      }
    }

    return stats;
  }

  async pauseWorker(queueName) {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.pause();
      logger.info(`Worker paused for queue: ${queueName}`);
      return true;
    }
    return false;
  }

  async resumeWorker(queueName) {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.resume();
      logger.info(`Worker resumed for queue: ${queueName}`);
      return true;
    }
    return false;
  }

  async shutdown() {
    if (!this.isShuttingDown) {
      await this.setupGracefulShutdown();
    }
  }
}

// Start worker manager if this file is run directly
if (require.main === module) {
  const workerManager = new WorkerManager();
  
  workerManager.initialize().then(() => {
    logger.info('🚀 Worker system started successfully');
    logger.info(`📊 Workers created: ${workerManager.workers.size}`);
    logger.info(`🔗 Redis connection: ${redisConnection.isReady() ? 'Ready' : 'Not Ready'}`);
    
    // Log worker status every 30 seconds
    setInterval(async () => {
      try {
        const stats = await workerManager.getWorkerStats();
        logger.debug('Worker status:', stats);
      } catch (error) {
        logger.warn('Error getting worker stats:', error.message);
      }
    }, 30000);
    
  }).catch(error => {
    logger.error('Failed to start worker system:', error);
    process.exit(1);
  });
}

module.exports = WorkerManager;