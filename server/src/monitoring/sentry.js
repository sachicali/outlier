const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Initialize Sentry
function initializeSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new ProfilingIntegration(),
      // Database integration
      new Sentry.Integrations.Postgres(),
      // HTTP integration
      new Sentry.Integrations.Http({ tracing: true }),
      // Express integration
      new Sentry.Integrations.Express({ app: undefined }), // Will be set later
    ],

    // Capture unhandled rejections and exceptions
    captureUnhandledException: true,
    captureUnhandledRejection: true,

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request && event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive data from request body
      if (event.request && event.request.data) {
        if (typeof event.request.data === 'string') {
          try {
            const parsed = JSON.parse(event.request.data);
            if (parsed.password) delete parsed.password;
            if (parsed.apiKey) delete parsed.apiKey;
            event.request.data = JSON.stringify(parsed);
          } catch (e) {
            // If parsing fails, redact the entire body for safety
            event.request.data = '[REDACTED]';
          }
        }
      }

      // Add correlation ID if available
      if (hint.originalException && hint.originalException.correlationId) {
        event.tags = event.tags || {};
        event.tags.correlationId = hint.originalException.correlationId;
      }

      return event;
    },

    // Set user context
    initialScope: {
      tags: {
        component: 'backend',
      },
    },
  });

  console.log('Sentry initialized successfully');
}

// Enhanced error reporting utilities
const sentryUtils = {
  // Capture exception with context
  captureException: (error, context = {}) => {
    Sentry.withScope((scope) => {
      // Add user context if available
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email,
          username: context.user.username,
        });
      }

      // Add request context
      if (context.request) {
        scope.setTag('url', context.request.url);
        scope.setTag('method', context.request.method);
        scope.setTag('ip', context.request.ip);
        scope.setTag('userAgent', context.request.get('User-Agent'));
      }

      // Add correlation ID
      if (context.correlationId) {
        scope.setTag('correlationId', context.correlationId);
      }

      // Add custom context
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }

      // Add business context
      if (context.business) {
        scope.setContext('business', context.business);
      }

      Sentry.captureException(error);
    });
  },

  // Capture message with context
  captureMessage: (message, level = 'info', context = {}) => {
    Sentry.withScope((scope) => {
      scope.setLevel(level);

      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.correlationId) {
        scope.setTag('correlationId', context.correlationId);
      }

      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }

      Sentry.captureMessage(message);
    });
  },

  // Add breadcrumb for tracing user actions
  addBreadcrumb: (message, category = 'custom', level = 'info', data = {}) => {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  },

  // YouTube API specific error handling
  captureYouTubeAPIError: (error, operation, quota = 0, context = {}) => {
    sentryUtils.captureException(error, {
      ...context,
      extra: {
        ...context.extra,
        youtubeOperation: operation,
        quotaCost: quota,
        apiType: 'youtube-data-api',
      },
      business: {
        domain: 'youtube_integration',
        operation,
        quotaCost: quota,
      },
    });
  },

  // Database error handling
  captureDatabaseError: (error, operation, table, context = {}) => {
    sentryUtils.captureException(error, {
      ...context,
      extra: {
        ...context.extra,
        dbOperation: operation,
        dbTable: table,
        dbSystem: 'postgresql',
      },
      business: {
        domain: 'database',
        operation,
        table,
      },
    });
  },

  // Analysis error handling
  captureAnalysisError: (error, operation, channelId, context = {}) => {
    sentryUtils.captureException(error, {
      ...context,
      extra: {
        ...context.extra,
        analysisOperation: operation,
        channelId,
      },
      business: {
        domain: 'outlier_analysis',
        operation,
        channelId,
      },
    });
  },

  // Performance tracking
  startTransaction: (name, op = 'custom') => {
    return Sentry.startTransaction({
      name,
      op,
    });
  },

  // Set user context
  setUser: (user) => {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  },

  // Clear user context
  clearUser: () => {
    Sentry.setUser(null);
  },
};

// Express middleware for request context
const sentryRequestMiddleware = () => {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email', 'username'],
    ip: true,
    request: ['method', 'url', 'headers', 'data'],
  });
};

// Express middleware for tracing
const sentryTracingMiddleware = () => {
  return Sentry.Handlers.tracingHandler();
};

// Express error handler
const sentryErrorHandler = () => {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only handle errors that should be reported to Sentry
      return error.statusCode >= 500 || !error.statusCode;
    },
  });
};

// Graceful shutdown
function shutdownSentry() {
  return Sentry.close(2000);
}

module.exports = {
  initializeSentry,
  shutdownSentry,
  sentryUtils,
  sentryRequestMiddleware,
  sentryTracingMiddleware,
  sentryErrorHandler,
  Sentry,
};