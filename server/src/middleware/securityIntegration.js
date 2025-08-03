/**
 * Security Integration Module
 * Integrates all security middleware and provides a unified security configuration
 */

const { secretsManager } = require('../config/secretsManager');
const { initializeRateLimiting, addRateLimitHeaders, createAdvancedRateLimit } = require('./advancedRateLimit');
const {
  authValidation,
  apiKeyValidation,
  outlierValidation,
  channelValidation,
  requestSizeLimit,
  validateContentType,
  xssProtection,
} = require('./inputValidation');
const {
  applySecurityHeaders,
  csrfTokenGeneration,
  csrfProtection,
  apiSecurityHeaders,
  addSecurityMetadata,
} = require('./securityHeaders');
const {
  apiVersioning,
  preventSQLInjection,
  addAPIMetadata,
  formatAPIResponse,
} = require('./apiSecurity');
const {
  securityMonitoring,
  failedLoginProtection,
  auditLogging,
  getSecurityDashboard,
} = require('./securityMonitoring');
const logger = require('../utils/logger');

/**
 * Security configuration based on environment
 */
function getSecurityConfig() {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  return {
    environment: env,
    isProduction,

    // Rate limiting configuration
    rateLimiting: {
      enabled: true,
      useRedis: isProduction,
      globalLimits: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: isProduction ? 1000 : 10000, // More restrictive in production
      },
      authLimits: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        skipSuccessfulRequests: true,
      },
    },

    // Input validation configuration
    validation: {
      enabled: true,
      strictMode: isProduction,
      maxRequestSize: '10mb',
      allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded'],
    },

    // CSRF protection configuration
    csrf: {
      enabled: true,
      skipMethods: ['GET', 'HEAD', 'OPTIONS'],
      requireForAPI: isProduction,
      strictIPCheck: isProduction,
    },

    // Security headers configuration
    headers: {
      enabled: true,
      hsts: isProduction,
      csp: {
        reportOnly: !isProduction,
      },
    },

    // Monitoring configuration
    monitoring: {
      enabled: true,
      suspiciousActivityDetection: true,
      auditLogging: true,
      failedLoginTracking: true,
    },

    // API security configuration
    apiSecurity: {
      versioning: true,
      sqlInjectionPrevention: true,
      requestSigning: isProduction, // Only require in production
      webhookValidation: true,
    },
  };
}

/**
 * Initialize all security middleware
 */
async function initializeSecurity() {
  try {
    logger.info('Initializing security systems...');

    // Initialize secrets manager
    await secretsManager.initialize();
    logger.info('✓ Secrets manager initialized');

    // Initialize rate limiting
    const rateLimitInfo = await initializeRateLimiting();
    logger.info(`✓ Rate limiting initialized (Redis: ${rateLimitInfo.redisEnabled})`);

    logger.info('✓ All security systems initialized successfully');

    return {
      success: true,
      config: getSecurityConfig(),
      secretsInitialized: secretsManager.isInitialized(),
      rateLimitingEnabled: rateLimitInfo.redisEnabled,
    };
  } catch (error) {
    logger.error('Failed to initialize security systems:', error);
    throw error;
  }
}

/**
 * Apply core security middleware to Express app
 */
function applyCoreSecurity(app) {
  const config = getSecurityConfig();

  logger.info('Applying core security middleware...');

  // 1. Security metadata (should be first)
  app.use(addSecurityMetadata);

  // 2. Request size limiting
  app.use(requestSizeLimit(config.validation.maxRequestSize));

  // 3. Content type validation
  app.use(validateContentType(config.validation.allowedContentTypes));

  // 4. Security headers
  if (config.headers.enabled) {
    app.use(applySecurityHeaders(config.environment));
    app.use(apiSecurityHeaders);
  }

  // 5. Rate limit headers
  app.use(addRateLimitHeaders);

  // 6. XSS protection
  app.use(xssProtection);

  // 7. SQL injection prevention
  if (config.apiSecurity.sqlInjectionPrevention) {
    app.use(preventSQLInjection);
  }

  // 8. Security monitoring
  if (config.monitoring.enabled) {
    app.use(securityMonitoring);
  }

  // 9. API metadata
  app.use(addAPIMetadata);

  // 10. API versioning
  if (config.apiSecurity.versioning) {
    app.use('/api', apiVersioning);
  }

  logger.info('✓ Core security middleware applied');
}

/**
 * Apply authentication security middleware
 */
function applyAuthSecurity(app) {
  const config = getSecurityConfig();

  logger.info('Applying authentication security middleware...');

  // Failed login protection
  if (config.monitoring.failedLoginTracking) {
    app.use('/api/auth/login', failedLoginProtection);
  }

  // CSRF token generation for auth endpoints
  if (config.csrf.enabled) {
    app.get('/api/auth/csrf-token', csrfTokenGeneration, (req, res) => {
      res.json({
        success: true,
        csrfToken: res.locals.csrfToken,
        timestamp: res.locals.csrfTimestamp,
      });
    });

    // CSRF protection for state-changing auth operations
    app.use('/api/auth/register', csrfProtection(config.csrf));
    app.use('/api/auth/login', csrfProtection(config.csrf));
    app.use('/api/auth/change-password', csrfProtection(config.csrf));
    app.use('/api/auth/logout', csrfProtection(config.csrf));
  }

  // Rate limiting for auth endpoints
  app.use('/api/auth/login', createAdvancedRateLimit('auth'));
  app.use('/api/auth/register', createAdvancedRateLimit('register'));
  app.use('/api/auth/forgot-password', createAdvancedRateLimit('passwordReset'));

  logger.info('✓ Authentication security middleware applied');
}

/**
 * Apply API security middleware
 */
function applyAPISecurity(app) {
  const config = getSecurityConfig();

  logger.info('Applying API security middleware...');

  // Rate limiting for different API endpoints
  app.use('/api/outlier/start', createAdvancedRateLimit('analysis'));
  app.use('/api/apikeys', createAdvancedRateLimit('api'));
  app.use('/api', createAdvancedRateLimit('api'));

  // Audit logging for sensitive operations
  if (config.monitoring.auditLogging) {
    app.use('/api/outlier/start', auditLogging('START_ANALYSIS', 'outlier_analysis'));
    app.use('/api/outlier/export/*', auditLogging('EXPORT_DATA', 'analysis_results'));
    app.use('/api/apikeys', auditLogging('API_KEY_OPERATION', 'api_key'));
    app.use('/api/auth/change-password', auditLogging('CHANGE_PASSWORD', 'user_account'));
  }

  // Format API responses
  app.use('/api', formatAPIResponse);

  logger.info('✓ API security middleware applied');
}

/**
 * Apply admin security middleware
 */
function applyAdminSecurity(app) {
  const config = getSecurityConfig();

  logger.info('Applying admin security middleware...');

  // Security dashboard endpoint (admin only)
  app.get('/api/admin/security/dashboard', getSecurityDashboard);

  // Secrets health check (admin only)
  const { secretsHealthCheck } = require('../config/secretsManager');
  app.get('/api/admin/security/secrets-health', secretsHealthCheck);

  // Audit logging for admin operations
  if (config.monitoring.auditLogging) {
    app.use('/api/admin/*', auditLogging('ADMIN_OPERATION', 'admin_panel'));
  }

  logger.info('✓ Admin security middleware applied');
}

/**
 * Get validation rules for specific endpoints
 */
function getValidationRules() {
  return {
    auth: authValidation,
    apiKey: apiKeyValidation,
    outlier: outlierValidation,
    channel: channelValidation,
  };
}

/**
 * Security health check
 */
async function securityHealthCheck() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check secrets manager
    if (secretsManager.isInitialized()) {
      health.checks.secretsManager = await secretsManager.healthCheck();
    } else {
      health.checks.secretsManager = { status: 'not_initialized' };
      health.status = 'degraded';
    }

    // Check rate limiting (placeholder - would check Redis connection in production)
    health.checks.rateLimiting = { status: 'operational' };

    // Check security middleware status
    health.checks.middleware = {
      status: 'operational',
      componentsLoaded: [
        'inputValidation',
        'rateLimiting',
        'securityHeaders',
        'apiSecurity',
        'monitoring',
      ],
    };

    return health;
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Graceful security shutdown
 */
async function shutdownSecurity() {
  try {
    logger.info('Shutting down security systems...');

    // Shutdown secrets manager
    await secretsManager.shutdown();

    // Cleanup rate limiting resources
    const { cleanupRateLimiting } = require('./advancedRateLimit');
    await cleanupRateLimiting();

    logger.info('✓ Security systems shut down successfully');
  } catch (error) {
    logger.error('Error during security shutdown:', error);
  }
}

/**
 * Get security statistics
 */
function getSecurityStats() {
  const { getCSRFTokenStats } = require('./securityHeaders');
  const { securityEventLogger } = require('./securityMonitoring');

  return {
    timestamp: new Date().toISOString(),
    csrf: getCSRFTokenStats(),
    securityEvents: securityEventLogger.getStatistics(),
    config: getSecurityConfig(),
  };
}

module.exports = {
  initializeSecurity,
  applyCoreSecurity,
  applyAuthSecurity,
  applyAPISecurity,
  applyAdminSecurity,
  getValidationRules,
  securityHealthCheck,
  shutdownSecurity,
  getSecurityStats,
  getSecurityConfig,
};