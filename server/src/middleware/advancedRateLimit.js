const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');
const logger = require('../utils/logger');

/**
 * Advanced Rate Limiting Middleware
 * Provides sophisticated rate limiting with Redis backend, per-user limits,
 * API key quotas, and configurable policies
 */

// Redis client for distributed rate limiting
let redisClient;
let redisStore;

/**
 * Initialize Redis connection for rate limiting
 */
async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true,
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis rate limit client error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis rate limit client connected');
    });

    await redisClient.connect();

    // Create Redis store for rate limiting
    redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });

    return true;
  } catch (error) {
    logger.warn('Failed to initialize Redis for rate limiting, falling back to memory store:', error);
    return false;
  }
}

// In-memory fallback store
const memoryStore = new Map();

/**
 * Memory-based rate limiting store (fallback)
 */
class MemoryRateLimitStore {
  constructor() {
    this.store = memoryStore;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  async get(key) {
    const data = this.store.get(key);
    if (!data) return { totalHits: 0, resetTime: new Date() };

    if (Date.now() > data.resetTime) {
      this.store.delete(key);
      return { totalHits: 0, resetTime: new Date() };
    }

    return data;
  }

  async set(key, value, windowMs) {
    const resetTime = Date.now() + windowMs;
    this.store.set(key, { ...value, resetTime });
  }

  async increment(key, windowMs) {
    const existing = await this.get(key);
    const newValue = {
      totalHits: existing.totalHits + 1,
      resetTime: existing.resetTime.getTime() < Date.now() ? Date.now() + windowMs : existing.resetTime,
    };

    await this.set(key, newValue, windowMs);
    return newValue;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const memoryRateLimitStore = new MemoryRateLimitStore();

/**
 * Get the appropriate rate limit store
 */
function getRateLimitStore() {
  return redisStore || memoryRateLimitStore;
}

/**
 * Generate rate limit key based on user, IP, and endpoint
 */
function generateRateLimitKey(req, keyType = 'ip') {
  const baseKey = 'rate_limit';

  switch (keyType) {
  case 'user':
    return `${baseKey}:user:${req.user?.id || 'anonymous'}`;
  case 'apikey':
    return `${baseKey}:apikey:${req.apiKey?.id}`;
  case 'ip':
    return `${baseKey}:ip:${req.ip}`;
  case 'endpoint':
    return `${baseKey}:endpoint:${req.route?.path || req.path}:${req.user?.id || req.ip}`;
  default:
    return `${baseKey}:${keyType}:${req.ip}`;
  }
}

/**
 * Standard rate limit configurations
 */
const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - strict limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    message: {
      error: 'Too many authentication attempts',
      message: 'Please wait before trying again',
      retryAfter: 15 * 60, // seconds
    },
  },

  // Registration - very strict
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registration attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Registration limit exceeded',
      message: 'Too many registration attempts from this IP',
    },
  },

  // Password reset - moderate limits
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 password reset attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Password reset limit exceeded',
      message: 'Too many password reset attempts',
    },
  },

  // API endpoints - generous for authenticated users
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes for authenticated users
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'API rate limit exceeded',
      message: 'Too many requests, please slow down',
    },
  },

  // API endpoints for unauthenticated users - more restrictive
  apiPublic: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes for unauthenticated users
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'API rate limit exceeded',
      message: 'Too many requests, please authenticate for higher limits',
    },
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Upload rate limit exceeded',
      message: 'Too many upload attempts',
    },
  },

  // Analysis endpoints - resource intensive
  analysis: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 analyses per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Analysis rate limit exceeded',
      message: 'Too many analysis requests, please wait before starting another',
    },
  },
};

/**
 * Create rate limiter with custom configuration
 */
function createRateLimiter(config, keyGenerator) {
  return rateLimit({
    store: getRateLimitStore(),
    keyGenerator: keyGenerator || ((req) => generateRateLimitKey(req, 'ip')),
    handler: (req, res) => {
      // Log rate limit exceeded events
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        limit: config.max,
        windowMs: config.windowMs,
      });

      res.status(429).json(config.message);
    },
    ...config,
  });
}

/**
 * Per-user rate limiting
 */
const userRateLimit = createRateLimiter(
  RATE_LIMIT_CONFIGS.api,
  (req) => generateRateLimitKey(req, 'user'),
);

/**
 * API key-based rate limiting with custom quotas
 */
function apiKeyRateLimit(req, res, next) {
  if (req.authMethod !== 'apikey' || !req.apiKey) {
    return next();
  }

  const customLimit = req.apiKey.rateLimit || 1000; // Default to 1000 requests per hour
  const keyId = req.apiKey.id;
  const windowMs = 60 * 60 * 1000; // 1 hour

  const customConfig = {
    windowMs,
    max: customLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'API key rate limit exceeded',
      message: `This API key is limited to ${customLimit} requests per hour`,
      quota: {
        limit: customLimit,
        remaining: 0, // Will be calculated
        resetTime: Date.now() + windowMs,
      },
    },
  };

  const limiter = createRateLimiter(
    customConfig,
    (req) => generateRateLimitKey(req, 'apikey'),
  );

  limiter(req, res, next);
}

/**
 * Endpoint-specific rate limiting
 */
function endpointRateLimit(endpointConfig) {
  return createRateLimiter(
    endpointConfig,
    (req) => generateRateLimitKey(req, 'endpoint'),
  );
}

/**
 * Progressive rate limiting - increases restrictions for repeated violations
 */
class ProgressiveRateLimit {
  constructor() {
    this.violations = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  getViolationKey(req) {
    return req.user?.id || req.ip;
  }

  recordViolation(req) {
    const key = this.getViolationKey(req);
    const now = Date.now();
    const violations = this.violations.get(key) || [];

    // Remove violations older than 24 hours
    const recentViolations = violations.filter(time => now - time < 24 * 60 * 60 * 1000);
    recentViolations.push(now);

    this.violations.set(key, recentViolations);

    logger.warn('Progressive rate limit violation recorded', {
      key,
      totalViolations: recentViolations.length,
      userId: req.user?.id,
      ip: req.ip,
    });
  }

  getMultiplier(req) {
    const key = this.getViolationKey(req);
    const violations = this.violations.get(key) || [];
    const now = Date.now();

    // Count violations in the last 24 hours
    const recentViolations = violations.filter(time => now - time < 24 * 60 * 60 * 1000);

    // Progressive multiplier: 1x, 2x, 4x, 8x, 16x (max)
    return Math.min(Math.pow(2, recentViolations.length), 16);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, violations] of this.violations.entries()) {
      const recentViolations = violations.filter(time => now - time < 24 * 60 * 60 * 1000);
      if (recentViolations.length === 0) {
        this.violations.delete(key);
      } else {
        this.violations.set(key, recentViolations);
      }
    }
  }
}

const progressiveRateLimit = new ProgressiveRateLimit();

/**
 * Smart rate limiting that adapts based on user behavior
 */
function smartRateLimit(baseConfig) {
  return (req, res, next) => {
    const multiplier = progressiveRateLimit.getMultiplier(req);
    const adjustedConfig = {
      ...baseConfig,
      max: Math.ceil(baseConfig.max / multiplier),
      windowMs: baseConfig.windowMs * multiplier,
    };

    if (multiplier > 1) {
      logger.info('Applying progressive rate limiting', {
        userId: req.user?.id,
        ip: req.ip,
        multiplier,
        originalLimit: baseConfig.max,
        adjustedLimit: adjustedConfig.max,
      });
    }

    const limiter = createRateLimiter(adjustedConfig);

    // Wrap the original handler to record violations
    const originalHandler = limiter.handler;
    limiter.handler = (req, res) => {
      progressiveRateLimit.recordViolation(req);
      originalHandler(req, res);
    };

    limiter(req, res, next);
  };
}

/**
 * Rate limiting headers middleware
 */
function addRateLimitHeaders(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    // Add custom rate limit headers
    if (req.user) {
      res.set('X-RateLimit-User', req.user.id);
    }
    if (req.apiKey) {
      res.set('X-RateLimit-Key', req.apiKey.id);
      res.set('X-RateLimit-Quota', req.apiKey.rateLimit || 1000);
    }

    // Add security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Rate limiting middleware factory
 */
function createAdvancedRateLimit(type, customConfig = {}) {
  const config = { ...RATE_LIMIT_CONFIGS[type], ...customConfig };

  switch (type) {
  case 'user':
    return userRateLimit;
  case 'apikey':
    return apiKeyRateLimit;
  case 'progressive':
    return smartRateLimit(config);
  case 'endpoint':
    return endpointRateLimit(config);
  default:
    return createRateLimiter(config);
  }
}

/**
 * Bypass rate limiting for trusted sources
 */
function trustedSourcesBypass(trustedIPs = [], trustedUsers = []) {
  return (req, res, next) => {
    // Skip rate limiting for trusted IPs
    if (trustedIPs.includes(req.ip)) {
      logger.debug('Rate limiting bypassed for trusted IP', { ip: req.ip });
      return next();
    }

    // Skip rate limiting for trusted users
    if (req.user && trustedUsers.includes(req.user.id)) {
      logger.debug('Rate limiting bypassed for trusted user', { userId: req.user.id });
      return next();
    }

    next();
  };
}

/**
 * Initialize rate limiting system
 */
async function initializeRateLimiting() {
  const redisInitialized = await initializeRedis();

  logger.info('Rate limiting system initialized', {
    redisEnabled: redisInitialized,
    fallbackStore: redisInitialized ? 'Redis' : 'Memory',
  });

  return {
    redisEnabled: redisInitialized,
    store: getRateLimitStore(),
  };
}

/**
 * Cleanup rate limiting resources
 */
async function cleanupRateLimiting() {
  if (redisClient) {
    await redisClient.disconnect();
  }

  if (memoryRateLimitStore.cleanupInterval) {
    clearInterval(memoryRateLimitStore.cleanupInterval);
  }

  if (progressiveRateLimit.cleanupInterval) {
    clearInterval(progressiveRateLimit.cleanupInterval);
  }
}

module.exports = {
  initializeRateLimiting,
  cleanupRateLimiting,
  createAdvancedRateLimit,
  addRateLimitHeaders,
  trustedSourcesBypass,
  apiKeyRateLimit,
  userRateLimit,
  smartRateLimit,
  RATE_LIMIT_CONFIGS,

  // Individual rate limiters
  authRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.auth),
  registerRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.register),
  passwordResetRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.passwordReset),
  apiRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.api),
  apiPublicRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.apiPublic),
  uploadRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.upload),
  analysisRateLimit: createRateLimiter(RATE_LIMIT_CONFIGS.analysis),
};