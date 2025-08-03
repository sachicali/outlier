const { databaseManager } = require('../config/initializeDatabase');
const redis = require('redis');
const axios = require('axios');
const si = require('systeminformation');
const { metricsUtils } = require('./metrics');
const logger = require('../utils/logger');

// Health check status constants
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
};

// Individual health checkers
const healthCheckers = {
  // Database health check
  database: async () => {
    try {
      const start = Date.now();
      const dbHealth = await databaseManager.getHealthStatus();
      const duration = Date.now() - start;

      metricsUtils.recordDatabaseOperation('health_check', 'system', 'success', duration / 1000);

      return {
        status: dbHealth.connected ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
        details: {
          connected: dbHealth.connected,
          pool: dbHealth.pool,
          responseTime: duration,
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      metricsUtils.recordDatabaseOperation('health_check', 'system', 'error');
      logger.error('Database health check failed:', error);

      return {
        status: HEALTH_STATUS.UNHEALTHY,
        details: {
          connected: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        },
      };
    }
  },

  // Redis health check
  redis: async () => {
    let client;
    try {
      const start = Date.now();
      client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      await client.connect();
      await client.ping();
      const duration = Date.now() - start;

      metricsUtils.recordRedisOperation('health_check', 'success', duration / 1000);

      return {
        status: HEALTH_STATUS.HEALTHY,
        details: {
          connected: true,
          responseTime: duration,
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      metricsUtils.recordRedisOperation('health_check', 'error');
      logger.error('Redis health check failed:', error);

      return {
        status: HEALTH_STATUS.UNHEALTHY,
        details: {
          connected: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        },
      };
    } finally {
      if (client && client.isReady) {
        await client.disconnect();
      }
    }
  },

  // YouTube API health check
  youtubeApi: async () => {
    if (!process.env.YOUTUBE_API_KEY) {
      return {
        status: HEALTH_STATUS.DEGRADED,
        details: {
          configured: false,
          message: 'YouTube API key not configured',
          lastChecked: new Date().toISOString(),
        },
      };
    }

    try {
      const start = Date.now();
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: 'test',
          maxResults: 1,
          key: process.env.YOUTUBE_API_KEY,
        },
        timeout: 10000,
      });

      const duration = Date.now() - start;
      metricsUtils.recordYouTubeAPICall('health_check', 'success', 100, duration / 1000);

      return {
        status: HEALTH_STATUS.HEALTHY,
        details: {
          configured: true,
          responseTime: duration,
          quotaUsed: 100,
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      metricsUtils.recordYouTubeAPICall('health_check', 'error', 100);
      logger.error('YouTube API health check failed:', error);

      const isQuotaExceeded = error.response?.status === 403 &&
                              error.response?.data?.error?.message?.includes('quota');

      return {
        status: isQuotaExceeded ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.UNHEALTHY,
        details: {
          configured: true,
          error: error.message,
          statusCode: error.response?.status,
          quotaExceeded: isQuotaExceeded,
          lastChecked: new Date().toISOString(),
        },
      };
    }
  },

  // System resources health check
  system: async () => {
    try {
      const [cpu, memory, disk] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
      ]);

      const cpuUsage = cpu.currentLoad;
      const memoryUsage = (memory.used / memory.total) * 100;
      const diskUsage = disk.length > 0 ? (disk[0].used / disk[0].size) * 100 : 0;

      // Determine status based on resource usage
      let status = HEALTH_STATUS.HEALTHY;
      if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) {
        status = HEALTH_STATUS.UNHEALTHY;
      } else if (cpuUsage > 75 || memoryUsage > 75 || diskUsage > 75) {
        status = HEALTH_STATUS.DEGRADED;
      }

      return {
        status,
        details: {
          cpu: {
            usage: parseFloat(cpuUsage.toFixed(2)),
            cores: cpu.cpus.length,
          },
          memory: {
            used: memory.used,
            total: memory.total,
            usage: parseFloat(memoryUsage.toFixed(2)),
          },
          disk: disk.length > 0 ? {
            used: disk[0].used,
            total: disk[0].size,
            usage: parseFloat(diskUsage.toFixed(2)),
            filesystem: disk[0].fs,
          } : null,
          uptime: process.uptime(),
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('System health check failed:', error);

      return {
        status: HEALTH_STATUS.DEGRADED,
        details: {
          error: error.message,
          uptime: process.uptime(),
          lastChecked: new Date().toISOString(),
        },
      };
    }
  },

  // Application-specific health check
  application: async () => {
    try {
      // Check if critical services are initialized
      const checks = {
        database: databaseManager ? 'initialized' : 'not_initialized',
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.npm_package_version || 'unknown',
        pid: process.pid,
        nodeVersion: process.version,
      };

      const hasErrors = Object.values(checks).includes('not_initialized');

      return {
        status: hasErrors ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.HEALTHY,
        details: {
          ...checks,
          startTime: process.uptime(),
          lastChecked: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Application health check failed:', error);

      return {
        status: HEALTH_STATUS.UNHEALTHY,
        details: {
          error: error.message,
          lastChecked: new Date().toISOString(),
        },
      };
    }
  },
};

// Comprehensive health check orchestrator
const performHealthCheck = async (includeDetailed = false) => {
  const startTime = Date.now();
  const checks = {};
  const promises = Object.entries(healthCheckers).map(async ([name, checker]) => {
    try {
      const result = await checker();
      checks[name] = result;
    } catch (error) {
      logger.error(`Health check failed for ${name}:`, error);
      checks[name] = {
        status: HEALTH_STATUS.UNHEALTHY,
        details: {
          error: error.message,
          lastChecked: new Date().toISOString(),
        },
      };
    }
  });

  await Promise.all(promises);

  // Determine overall health status
  const statuses = Object.values(checks).map(check => check.status);
  let overallStatus = HEALTH_STATUS.HEALTHY;

  if (statuses.includes(HEALTH_STATUS.UNHEALTHY)) {
    overallStatus = HEALTH_STATUS.UNHEALTHY;
  } else if (statuses.includes(HEALTH_STATUS.DEGRADED)) {
    overallStatus = HEALTH_STATUS.DEGRADED;
  }

  const duration = Date.now() - startTime;

  // Log health check results
  logger.info('Health check completed', {
    overallStatus,
    duration,
    checks: Object.keys(checks).reduce((acc, key) => {
      acc[key] = checks[key].status;
      return acc;
    }, {}),
  });

  const result = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    duration,
    checks: includeDetailed ? checks : Object.keys(checks).reduce((acc, key) => {
      acc[key] = { status: checks[key].status };
      return acc;
    }, {}),
  };

  // Record metrics
  metricsUtils.recordError('health_check', overallStatus === HEALTH_STATUS.HEALTHY ? 'info' : 'warning');

  return result;
};

// Liveness probe (basic health check)
const livenessProbe = async () => {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  };
};

// Readiness probe (comprehensive check)
const readinessProbe = async () => {
  const health = await performHealthCheck(false);

  return {
    ready: health.status === HEALTH_STATUS.HEALTHY,
    status: health.status,
    timestamp: health.timestamp,
    checks: health.checks,
  };
};

// Deep health check for troubleshooting
const deepHealthCheck = async () => {
  return performHealthCheck(true);
};

// Express route handlers
const healthRoutes = {
  // Basic health check
  health: async (req, res) => {
    try {
      const health = await performHealthCheck(false);
      const statusCode = health.status === HEALTH_STATUS.HEALTHY ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check endpoint failed:', error);
      res.status(500).json({
        status: HEALTH_STATUS.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  },

  // Liveness probe
  liveness: async (req, res) => {
    try {
      const liveness = await livenessProbe();
      res.status(200).json(liveness);
    } catch (error) {
      logger.error('Liveness probe failed:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  },

  // Readiness probe
  readiness: async (req, res) => {
    try {
      const readiness = await readinessProbe();
      const statusCode = readiness.ready ? 200 : 503;

      res.status(statusCode).json(readiness);
    } catch (error) {
      logger.error('Readiness probe failed:', error);
      res.status(500).json({
        ready: false,
        status: HEALTH_STATUS.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  },

  // Deep health check
  deep: async (req, res) => {
    try {
      const health = await deepHealthCheck();
      const statusCode = health.status === HEALTH_STATUS.HEALTHY ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Deep health check failed:', error);
      res.status(500).json({
        status: HEALTH_STATUS.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  },
};

module.exports = {
  healthCheckers,
  performHealthCheck,
  livenessProbe,
  readinessProbe,
  deepHealthCheck,
  healthRoutes,
  HEALTH_STATUS,
};