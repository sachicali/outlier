// Main monitoring initialization and orchestration
const { initializeTelemetry, shutdownTelemetry, tracing, tracingMiddleware } = require('./telemetry');
const { initializeSentry, shutdownSentry, sentryRequestMiddleware, sentryTracingMiddleware, sentryErrorHandler } = require('./sentry');
const { metricsMiddleware, register } = require('./metrics');
const { healthRoutes } = require('./healthChecks');
const { quotaTracker } = require('./quotaTracker');
const { alertManager, alertRoutes } = require('./alerting');
const logger = require('../utils/logger');

class MonitoringSystem {
  constructor() {
    this.initialized = false;
    this.components = {
      telemetry: false,
      sentry: false,
      metrics: true, // Always available
      quotaTracker: false,
      alertManager: false,
    };
  }

  async initialize() {
    logger.info('Initializing monitoring system...');

    try {
      // Initialize OpenTelemetry first (must be done before importing other modules)
      if (process.env.OTEL_ENABLED !== 'false') {
        initializeTelemetry();
        this.components.telemetry = true;
        logger.info('✓ OpenTelemetry initialized');
      } else {
        logger.info('- OpenTelemetry disabled');
      }

      // Initialize Sentry
      if (process.env.SENTRY_DSN) {
        initializeSentry();
        this.components.sentry = true;
        logger.info('✓ Sentry initialized');
      } else {
        logger.info('- Sentry not configured');
      }

      // Initialize quota tracker
      if (process.env.REDIS_URL) {
        await quotaTracker.initialize();
        this.components.quotaTracker = true;
        logger.info('✓ Quota tracker initialized');
      } else {
        logger.info('- Quota tracker disabled (Redis not configured)');
      }

      // Initialize alert manager
      alertManager.initialize();
      this.components.alertManager = true;
      logger.info('✓ Alert manager initialized');

      this.initialized = true;
      logger.info('Monitoring system initialization completed', {
        components: this.components,
      });

      // Send initialization success event
      if (this.components.sentry) {
        const { sentryUtils } = require('./sentry');
        sentryUtils.captureMessage('Monitoring system initialized', 'info', {
          extra: {
            components: this.components,
          },
          business: {
            domain: 'monitoring',
            operation: 'initialize',
          },
        });
      }

    } catch (error) {
      logger.error('Failed to initialize monitoring system:', error);

      if (this.components.sentry) {
        const { sentryUtils } = require('./sentry');
        sentryUtils.captureException(error, {
          business: {
            domain: 'monitoring',
            operation: 'initialize',
          },
        });
      }

      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down monitoring system...');

    try {
      // Shutdown components in reverse order
      if (this.components.quotaTracker) {
        await quotaTracker.shutdown();
        logger.info('✓ Quota tracker shutdown');
      }

      if (this.components.sentry) {
        await shutdownSentry();
        logger.info('✓ Sentry shutdown');
      }

      if (this.components.telemetry) {
        await shutdownTelemetry();
        logger.info('✓ OpenTelemetry shutdown');
      }

      logger.info('Monitoring system shutdown completed');

    } catch (error) {
      logger.error('Error during monitoring system shutdown:', error);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      components: this.components,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // Express middleware setup
  setupMiddleware(app) {
    logger.info('Setting up monitoring middleware...');

    // Sentry middleware (must be first)
    if (this.components.sentry) {
      app.use(sentryRequestMiddleware());
      app.use(sentryTracingMiddleware());
    }

    // Metrics middleware
    app.use(metricsMiddleware);

    // Tracing middleware
    if (this.components.telemetry) {
      app.use(tracingMiddleware);
    }

    logger.info('Monitoring middleware setup completed');
  }

  // Express routes setup
  setupRoutes(app) {
    logger.info('Setting up monitoring routes...');

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
      } catch (error) {
        logger.error('Failed to generate metrics:', error);
        res.status(500).end('Error generating metrics');
      }
    });

    // Health check routes
    app.get('/health', healthRoutes.health);
    app.get('/health/liveness', healthRoutes.liveness);
    app.get('/health/readiness', healthRoutes.readiness);
    app.get('/health/deep', healthRoutes.deep);

    // Alert management routes
    app.get('/monitoring/alerts/history', alertRoutes.history);
    app.get('/monitoring/alerts/status', alertRoutes.status);
    app.post('/monitoring/alerts/silence', alertRoutes.silence);
    app.post('/monitoring/alerts/test', alertRoutes.test);

    // Quota status route
    app.get('/monitoring/quota', async (req, res) => {
      try {
        if (!this.components.quotaTracker) {
          return res.status(503).json({
            success: false,
            error: 'Quota tracker not available',
          });
        }

        const status = await quotaTracker.getQuotaStatus();
        res.json({
          success: true,
          data: status,
        });
      } catch (error) {
        logger.error('Failed to get quota status:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Quota history route
    app.get('/monitoring/quota/history', async (req, res) => {
      try {
        if (!this.components.quotaTracker) {
          return res.status(503).json({
            success: false,
            error: 'Quota tracker not available',
          });
        }

        const days = parseInt(req.query.days) || 7;
        const history = await quotaTracker.getUsageHistory(days);
        res.json({
          success: true,
          data: history,
        });
      } catch (error) {
        logger.error('Failed to get quota history:', error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Monitoring system status
    app.get('/monitoring/status', (req, res) => {
      res.json({
        success: true,
        data: this.getStatus(),
      });
    });

    logger.info('Monitoring routes setup completed');
  }

  // Error handler setup (must be last)
  setupErrorHandling(app) {
    if (this.components.sentry) {
      app.use(sentryErrorHandler());
    }
    logger.info('Monitoring error handling setup completed');
  }
}

// Create singleton instance
const monitoringSystem = new MonitoringSystem();

// Utility functions for business logic integration
const monitoring = {
  // Trace YouTube API calls
  traceYouTubeAPI: async (operation, fn, quota = 0) => {
    if (monitoringSystem.components.telemetry) {
      return tracing.traceYouTubeAPICall(operation, fn, quota);
    }
    return fn();
  },

  // Trace database operations
  traceDatabase: async (operation, table, fn) => {
    if (monitoringSystem.components.telemetry) {
      return tracing.traceDatabaseOperation(operation, table, fn);
    }
    return fn();
  },

  // Trace analysis operations
  traceAnalysis: async (operation, channelId, fn) => {
    if (monitoringSystem.components.telemetry) {
      return tracing.traceAnalysisOperation(operation, channelId, fn);
    }
    return fn();
  },

  // Record quota usage
  recordQuotaUsage: (operation, cost, context = {}) => {
    if (monitoringSystem.components.quotaTracker) {
      return quotaTracker.recordUsage(operation, cost, context);
    }
  },

  // Check quota before operation
  canUseQuota: async (operation, cost) => {
    if (monitoringSystem.components.quotaTracker) {
      return quotaTracker.canMakeRequest(operation, cost);
    }
    return { allowed: true }; // Allow if quota tracker not available
  },

  // Capture exceptions
  captureException: (error, context = {}) => {
    if (monitoringSystem.components.sentry) {
      const { sentryUtils } = require('./sentry');
      sentryUtils.captureException(error, context);
    }
  },

  // Capture messages
  captureMessage: (message, level = 'info', context = {}) => {
    if (monitoringSystem.components.sentry) {
      const { sentryUtils } = require('./sentry');
      sentryUtils.captureMessage(message, level, context);
    }
  },

  // Add breadcrumb
  addBreadcrumb: (message, category = 'custom', level = 'info', data = {}) => {
    if (monitoringSystem.components.sentry) {
      const { sentryUtils } = require('./sentry');
      sentryUtils.addBreadcrumb(message, category, level, data);
    }
  },

  // Get system status
  getStatus: () => monitoringSystem.getStatus(),
};

module.exports = {
  monitoringSystem,
  monitoring,
  tracing,
  quotaTracker,
  alertManager,
};