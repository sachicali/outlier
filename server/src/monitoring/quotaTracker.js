const redis = require('redis');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { metricsUtils } = require('./metrics');
const { sentryUtils } = require('./sentry');

// YouTube API quota costs for different operations
const QUOTA_COSTS = {
  // Search operations
  'search.list': 100,
  'search.list.part.snippet': 100,

  // Video operations
  'videos.list': 1,
  'videos.list.part.snippet': 2,
  'videos.list.part.statistics': 2,
  'videos.list.part.contentDetails': 2,
  'videos.list.part.status': 2,

  // Channel operations
  'channels.list': 1,
  'channels.list.part.snippet': 2,
  'channels.list.part.statistics': 2,
  'channels.list.part.contentDetails': 2,

  // Playlist operations
  'playlistItems.list': 1,
  'playlistItems.list.part.snippet': 2,
  'playlistItems.list.part.contentDetails': 2,

  // Comment operations
  'commentThreads.list': 1,
  'comments.list': 1,

  // Default costs
  'default': 1,
};

// Daily quota limits
const DAILY_QUOTA_LIMITS = {
  total: parseInt(process.env.YOUTUBE_DAILY_QUOTA_LIMIT) || 10000,
  warning: parseInt(process.env.YOUTUBE_QUOTA_WARNING_THRESHOLD) || 8000,
  critical: parseInt(process.env.YOUTUBE_QUOTA_CRITICAL_THRESHOLD) || 9500,
};

class QuotaTracker {
  constructor() {
    this.redisClient = null;
    this.initialized = false;
    this.currentUsage = 0;
    this.lastReset = new Date();
  }

  async initialize() {
    try {
      // Initialize Redis client
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis client error in quota tracker:', err);
      });

      await this.redisClient.connect();

      // Load current usage from Redis
      await this.loadCurrentUsage();

      // Set up daily reset schedule (at midnight UTC)
      this.setupDailyReset();

      this.initialized = true;
      logger.info('YouTube API quota tracker initialized', {
        currentUsage: this.currentUsage,
        dailyLimit: DAILY_QUOTA_LIMITS.total,
      });
    } catch (error) {
      logger.error('Failed to initialize quota tracker:', error);
      sentryUtils.captureException(error, {
        business: {
          domain: 'quota_tracker',
          operation: 'initialize',
        },
      });
    }
  }

  async loadCurrentUsage() {
    try {
      const today = this.getTodayKey();
      const usage = await this.redisClient.get(`youtube_quota:${today}`);
      this.currentUsage = usage ? parseInt(usage) : 0;

      // Load last reset time
      const lastReset = await this.redisClient.get('youtube_quota:last_reset');
      if (lastReset) {
        this.lastReset = new Date(lastReset);
      }
    } catch (error) {
      logger.error('Failed to load quota usage from Redis:', error);
      this.currentUsage = 0;
    }
  }

  getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  async recordUsage(operation, cost = null, context = {}) {
    if (!this.initialized) {
      logger.warn('Quota tracker not initialized, cannot record usage');
      return;
    }

    try {
      // Calculate cost
      const quotaCost = cost || this.getOperationCost(operation);

      // Update current usage
      this.currentUsage += quotaCost;

      // Store in Redis with TTL (expire at end of day)
      const today = this.getTodayKey();
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const ttlSeconds = Math.ceil((todayEnd.getTime() - Date.now()) / 1000);

      await this.redisClient.setEx(`youtube_quota:${today}`, ttlSeconds, this.currentUsage.toString());

      // Record detailed usage log
      const usageRecord = {
        operation,
        cost: quotaCost,
        timestamp: new Date().toISOString(),
        totalUsage: this.currentUsage,
        ...context,
      };

      await this.redisClient.lPush(
        `youtube_quota:log:${today}`,
        JSON.stringify(usageRecord),
      );

      // Set TTL for log
      await this.redisClient.expire(`youtube_quota:log:${today}`, ttlSeconds);

      // Update metrics
      metricsUtils.recordYouTubeAPICall(operation, 'success', quotaCost);

      // Log usage
      logger.info(`YouTube API quota used: ${operation}`, {
        operation,
        cost: quotaCost,
        totalUsage: this.currentUsage,
        remainingQuota: DAILY_QUOTA_LIMITS.total - this.currentUsage,
        ...context,
      });

      // Check for quota alerts
      await this.checkQuotaAlerts();

    } catch (error) {
      logger.error('Failed to record quota usage:', error);
      sentryUtils.captureException(error, {
        extra: {
          operation,
          cost,
          context,
        },
        business: {
          domain: 'quota_tracker',
          operation: 'record_usage',
        },
      });
    }
  }

  getOperationCost(operation) {
    // Try exact match first
    if (QUOTA_COSTS[operation]) {
      return QUOTA_COSTS[operation];
    }

    // Try partial matches
    for (const [key, cost] of Object.entries(QUOTA_COSTS)) {
      if (operation.includes(key.split('.')[0])) {
        return cost;
      }
    }

    // Default cost
    return QUOTA_COSTS.default;
  }

  async checkQuotaAlerts() {
    const percentage = (this.currentUsage / DAILY_QUOTA_LIMITS.total) * 100;

    if (this.currentUsage >= DAILY_QUOTA_LIMITS.critical) {
      // Critical alert
      const message = `YouTube API quota critical: ${this.currentUsage}/${DAILY_QUOTA_LIMITS.total} (${percentage.toFixed(1)}%)`;
      logger.error(message, {
        currentUsage: this.currentUsage,
        dailyLimit: DAILY_QUOTA_LIMITS.total,
        percentage,
        alertLevel: 'critical',
      });

      sentryUtils.captureMessage(message, 'error', {
        extra: {
          currentUsage: this.currentUsage,
          dailyLimit: DAILY_QUOTA_LIMITS.total,
          percentage,
        },
        business: {
          domain: 'quota_management',
          alertLevel: 'critical',
        },
      });

    } else if (this.currentUsage >= DAILY_QUOTA_LIMITS.warning) {
      // Warning alert
      const message = `YouTube API quota warning: ${this.currentUsage}/${DAILY_QUOTA_LIMITS.total} (${percentage.toFixed(1)}%)`;
      logger.warn(message, {
        currentUsage: this.currentUsage,
        dailyLimit: DAILY_QUOTA_LIMITS.total,
        percentage,
        alertLevel: 'warning',
      });

      sentryUtils.captureMessage(message, 'warning', {
        extra: {
          currentUsage: this.currentUsage,
          dailyLimit: DAILY_QUOTA_LIMITS.total,
          percentage,
        },
        business: {
          domain: 'quota_management',
          alertLevel: 'warning',
        },
      });
    }
  }

  async getQuotaStatus() {
    const percentage = (this.currentUsage / DAILY_QUOTA_LIMITS.total) * 100;
    const remaining = DAILY_QUOTA_LIMITS.total - this.currentUsage;

    return {
      current: this.currentUsage,
      limit: DAILY_QUOTA_LIMITS.total,
      remaining,
      percentage: parseFloat(percentage.toFixed(2)),
      status: this.getQuotaStatusLevel(),
      lastReset: this.lastReset.toISOString(),
      nextReset: this.getNextResetTime(),
    };
  }

  getQuotaStatusLevel() {
    if (this.currentUsage >= DAILY_QUOTA_LIMITS.critical) {
      return 'critical';
    } else if (this.currentUsage >= DAILY_QUOTA_LIMITS.warning) {
      return 'warning';
    } else {
      return 'ok';
    }
  }

  getNextResetTime() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  async canMakeRequest(operation, cost = null) {
    const requestCost = cost || this.getOperationCost(operation);
    const wouldExceed = (this.currentUsage + requestCost) > DAILY_QUOTA_LIMITS.total;

    return {
      allowed: !wouldExceed,
      currentUsage: this.currentUsage,
      requestCost,
      remaining: DAILY_QUOTA_LIMITS.total - this.currentUsage,
      wouldExceed,
    };
  }

  async getUsageHistory(days = 7) {
    if (!this.initialized) {
      return [];
    }

    try {
      const history = [];
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];

        const usage = await this.redisClient.get(`youtube_quota:${dateKey}`);
        const logs = await this.redisClient.lRange(`youtube_quota:log:${dateKey}`, 0, -1);

        history.push({
          date: dateKey,
          totalUsage: usage ? parseInt(usage) : 0,
          requestCount: logs.length,
          requests: logs.map(log => JSON.parse(log)).reverse(),
        });
      }

      return history.reverse(); // Oldest first
    } catch (error) {
      logger.error('Failed to get quota usage history:', error);
      return [];
    }
  }

  setupDailyReset() {
    // Reset quota at midnight UTC
    cron.schedule('0 0 * * *', async () => {
      logger.info('Performing daily YouTube API quota reset');

      try {
        this.currentUsage = 0;
        this.lastReset = new Date();

        // Store reset time in Redis
        await this.redisClient.set('youtube_quota:last_reset', this.lastReset.toISOString());

        logger.info('YouTube API quota reset completed', {
          resetTime: this.lastReset.toISOString(),
        });

        // Log to Sentry for tracking
        sentryUtils.captureMessage('YouTube API quota reset completed', 'info', {
          business: {
            domain: 'quota_management',
            operation: 'daily_reset',
          },
        });

      } catch (error) {
        logger.error('Failed to reset YouTube API quota:', error);
        sentryUtils.captureException(error, {
          business: {
            domain: 'quota_management',
            operation: 'daily_reset',
          },
        });
      }
    }, {
      timezone: 'UTC',
    });
  }

  async shutdown() {
    if (this.redisClient && this.redisClient.isReady) {
      await this.redisClient.disconnect();
    }
  }
}

// Create singleton instance
const quotaTracker = new QuotaTracker();

// Middleware to check quota before API calls
const quotaMiddleware = (operation, cost = null) => {
  return async (req, res, next) => {
    try {
      const canMake = await quotaTracker.canMakeRequest(operation, cost);

      if (!canMake.allowed) {
        logger.warn('YouTube API request blocked due to quota limit', {
          operation,
          currentUsage: canMake.currentUsage,
          requestCost: canMake.requestCost,
          remaining: canMake.remaining,
        });

        return res.status(429).json({
          success: false,
          error: 'YouTube API quota limit reached',
          quota: {
            current: canMake.currentUsage,
            limit: DAILY_QUOTA_LIMITS.total,
            remaining: canMake.remaining,
            resetTime: quotaTracker.getNextResetTime(),
          },
        });
      }

      // Store operation details in request for later recording
      req.youtubeOperation = {
        operation,
        cost: canMake.requestCost,
      };

      next();
    } catch (error) {
      logger.error('Quota middleware error:', error);
      next(); // Continue despite error
    }
  };
};

// Helper to record usage after successful API call
const recordQuotaUsage = (req, additionalContext = {}) => {
  if (req.youtubeOperation) {
    quotaTracker.recordUsage(
      req.youtubeOperation.operation,
      req.youtubeOperation.cost,
      {
        correlationId: req.correlationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        ...additionalContext,
      },
    );
  }
};

module.exports = {
  quotaTracker,
  quotaMiddleware,
  recordQuotaUsage,
  QUOTA_COSTS,
  DAILY_QUOTA_LIMITS,
};