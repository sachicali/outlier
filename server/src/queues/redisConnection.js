const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        db: 0, // Use database 0 for queues
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis queue connection established');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis queue client ready');
      });

      this.client.on('error', (err) => {
        logger.error('Redis queue connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis queue connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis queue reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis for queues:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis queue connection closed');
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }
}

module.exports = new RedisConnection();