const { Queue, QueueScheduler, QueueEvents } = require('bullmq');
const redisConnection = require('./redisConnection');
const logger = require('../utils/logger');

class QueueManager {
  constructor() {
    this.queues = new Map();
    this.schedulers = new Map();
    this.events = new Map();
    this.redisConnection = null;
  }

  async initialize() {
    try {
      // Connect to Redis
      this.redisConnection = await redisConnection.connect();
      logger.info('Queue manager initialized with Redis connection');

      // Create queues
      await this.createQueues();
      
      // Setup queue events
      this.setupQueueEvents();
      
      logger.info('Queue manager fully initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize queue manager:', error);
      throw error;
    }
  }

  async createQueues() {
    const queueConfigs = [
      {
        name: 'youtube-analysis',
        options: {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        },
      },
      {
        name: 'batch-processing',
        options: {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: 50,
            removeOnFail: 25,
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        },
      },
      {
        name: 'scheduled-tasks',
        options: {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 10,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        },
      },
      {
        name: 'email-notifications',
        options: {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: 20,
            removeOnFail: 50,
            attempts: 3,
            backoff: {
              type: 'fixed',
              delay: 30000,
            },
          },
        },
      },
      {
        name: 'data-cleanup',
        options: {
          connection: this.redisConnection,
          defaultJobOptions: {
            removeOnComplete: 5,
            removeOnFail: 5,
            attempts: 2,
            backoff: {
              type: 'fixed',
              delay: 60000,
            },
          },
        },
      },
    ];

    for (const { name, options } of queueConfigs) {
      // Create queue
      const queue = new Queue(name, options);
      this.queues.set(name, queue);

      // Create scheduler for delayed/repeated jobs
      const scheduler = new QueueScheduler(name, {
        connection: this.redisConnection,
      });
      this.schedulers.set(name, scheduler);

      // Create queue events listener
      const queueEvents = new QueueEvents(name, {
        connection: this.redisConnection,
      });
      this.events.set(name, queueEvents);

      logger.info(`Created queue: ${name}`);
    }
  }

  setupQueueEvents() {
    this.events.forEach((queueEvents, queueName) => {
      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger.info(`Job completed in ${queueName}:`, {
          jobId,
          returnValue: returnvalue,
        });
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger.error(`Job failed in ${queueName}:`, {
          jobId,
          reason: failedReason,
        });
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        logger.debug(`Job progress in ${queueName}:`, {
          jobId,
          progress: data,
        });
      });

      queueEvents.on('stalled', ({ jobId }) => {
        logger.warn(`Job stalled in ${queueName}:`, { jobId });
      });
    });
  }

  getQueue(name) {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue '${name}' not found`);
    }
    return queue;
  }

  async addJob(queueName, jobName, data, options = {}) {
    try {
      const queue = this.getQueue(queueName);
      
      const jobOptions = {
        ...options,
        // Add correlation ID for tracking
        jobId: options.jobId || `${jobName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const job = await queue.add(jobName, data, jobOptions);
      
      logger.info(`Job added to ${queueName}:`, {
        jobId: job.id,
        jobName,
        priority: options.priority,
        delay: options.delay,
      });

      return job;
    } catch (error) {
      logger.error(`Failed to add job to ${queueName}:`, error);
      throw error;
    }
  }

  async addBulkJobs(queueName, jobs) {
    try {
      const queue = this.getQueue(queueName);
      const addedJobs = await queue.addBulk(jobs);
      
      logger.info(`Added ${addedJobs.length} jobs to ${queueName}`);
      return addedJobs;
    } catch (error) {
      logger.error(`Failed to add bulk jobs to ${queueName}:`, error);
      throw error;
    }
  }

  async getJob(queueName, jobId) {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getJob(jobId);
    } catch (error) {
      logger.error(`Failed to get job ${jobId} from ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueStats(queueName) {
    try {
      const queue = this.getQueue(queueName);
      
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
        queue.getPaused(),
      ]);

      return {
        name: queueName,
        counts: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: paused.length,
        },
        jobs: {
          waiting: waiting.slice(0, 10), // Sample of jobs
          active: active.slice(0, 10),
          failed: failed.slice(0, 10),
        },
      };
    } catch (error) {
      logger.error(`Failed to get stats for ${queueName}:`, error);
      throw error;
    }
  }

  async getAllQueueStats() {
    const stats = {};
    
    for (const queueName of this.queues.keys()) {
      try {
        stats[queueName] = await this.getQueueStats(queueName);
      } catch (error) {
        stats[queueName] = { error: error.message };
      }
    }

    return stats;
  }

  async pauseQueue(queueName) {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      logger.info(`Queue paused: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}:`, error);
      throw error;
    }
  }

  async resumeQueue(queueName) {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      logger.info(`Queue resumed: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}:`, error);
      throw error;
    }
  }

  async removeJob(queueName, jobId) {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.remove();
        logger.info(`Job removed: ${jobId} from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to remove job ${jobId} from ${queueName}:`, error);
      throw error;
    }
  }

  async retryJob(queueName, jobId) {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.retry();
        logger.info(`Job retried: ${jobId} from ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to retry job ${jobId} from ${queueName}:`, error);
      throw error;
    }
  }

  async cleanQueue(queueName, grace = 0, status = 'completed') {
    try {
      const queue = this.getQueue(queueName);
      const jobs = await queue.clean(grace, status);
      logger.info(`Cleaned ${jobs.length} ${status} jobs from ${queueName}`);
      return jobs;
    } catch (error) {
      logger.error(`Failed to clean queue ${queueName}:`, error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down queue manager...');
    
    try {
      // Close all queue events
      for (const [name, queueEvents] of this.events) {
        await queueEvents.close();
        logger.debug(`Closed queue events for: ${name}`);
      }

      // Close all schedulers
      for (const [name, scheduler] of this.schedulers) {
        await scheduler.close();
        logger.debug(`Closed scheduler for: ${name}`);
      }

      // Close all queues
      for (const [name, queue] of this.queues) {
        await queue.close();
        logger.debug(`Closed queue: ${name}`);
      }

      // Disconnect Redis
      await redisConnection.disconnect();
      
      // Clear maps
      this.queues.clear();
      this.schedulers.clear();
      this.events.clear();
      
      logger.info('Queue manager shutdown completed');
    } catch (error) {
      logger.error('Error during queue manager shutdown:', error);
      throw error;
    }
  }
}

module.exports = new QueueManager();