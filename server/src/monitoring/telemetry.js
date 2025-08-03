const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const opentelemetry = require('@opentelemetry/api');

// Create a resource to identify the service
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'youtube-outlier-discovery',
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Configure Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

// Initialize the SDK
const sdk = new NodeSDK({
  resource,
  spanProcessor: process.env.NODE_ENV === 'development'
    ? new SimpleSpanProcessor(jaegerExporter)
    : new BatchSpanProcessor(jaegerExporter),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable fs instrumentation to reduce noise
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      // Configure HTTP instrumentation
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health checks and static assets
          return req.url?.includes('/health') ||
                 req.url?.includes('/favicon.ico') ||
                 req.url?.includes('/metrics');
        },
      },
      // Configure Express instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      // Configure database instrumentations
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
    }),
  ],
});

// Custom tracer for business logic
const tracer = opentelemetry.trace.getTracer('youtube-outlier-discovery', '1.0.0');

// Utility functions for custom tracing
const tracing = {
  // Create a span for business operations
  createSpan: (name, attributes = {}) => {
    return tracer.startSpan(name, {
      attributes: {
        'service.operation': name,
        ...attributes,
      },
    });
  },

  // Wrap async functions with tracing
  traceAsyncFunction: async (name, fn, attributes = {}) => {
    const span = tracing.createSpan(name, attributes);

    try {
      const result = await fn(span);
      span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  },

  // Add custom attributes to current span
  addAttributes: (attributes) => {
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  },

  // Add events to current span
  addEvent: (name, attributes = {}) => {
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  },

  // YouTube API specific tracing
  traceYouTubeAPICall: async (operation, fn, quota = 0) => {
    return tracing.traceAsyncFunction(`youtube.api.${operation}`, fn, {
      'youtube.operation': operation,
      'youtube.quota_cost': quota,
      'external.service': 'youtube-api',
    });
  },

  // Database operation tracing
  traceDatabaseOperation: async (operation, table, fn) => {
    return tracing.traceAsyncFunction(`db.${operation}`, fn, {
      'db.operation': operation,
      'db.table': table,
      'db.system': 'postgresql',
    });
  },

  // Analysis operation tracing
  traceAnalysisOperation: async (operation, channelId, fn) => {
    return tracing.traceAsyncFunction(`analysis.${operation}`, fn, {
      'analysis.operation': operation,
      'analysis.channel_id': channelId,
      'business.domain': 'outlier_detection',
    });
  },

  // Get correlation ID from current context
  getCorrelationId: () => {
    const span = opentelemetry.trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return spanContext.traceId;
    }
    return null;
  },

  // Create child span
  createChildSpan: (name, attributes = {}) => {
    const activeSpan = opentelemetry.trace.getActiveSpan();
    if (activeSpan) {
      return tracer.startSpan(name, {
        parent: activeSpan,
        attributes,
      });
    }
    return tracing.createSpan(name, attributes);
  },
};

// Middleware to add correlation ID from tracing
const tracingMiddleware = (req, res, next) => {
  // If we don't have a correlation ID, try to get it from tracing
  if (!req.correlationId) {
    const traceId = tracing.getCorrelationId();
    if (traceId) {
      req.correlationId = traceId.substring(0, 8); // Use first 8 chars of trace ID
    }
  }

  // Add custom attributes to the current span
  tracing.addAttributes({
    'http.request.correlation_id': req.correlationId,
    'http.request.user_agent': req.get('User-Agent'),
    'http.request.ip': req.ip,
  });

  next();
};

// Initialize OpenTelemetry (should be called before importing other modules)
function initializeTelemetry() {
  if (process.env.OTEL_ENABLED !== 'false') {
    try {
      sdk.start();
      console.log('OpenTelemetry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
    }
  }
}

// Graceful shutdown
function shutdownTelemetry() {
  return sdk.shutdown();
}

module.exports = {
  initializeTelemetry,
  shutdownTelemetry,
  tracing,
  tracingMiddleware,
  tracer,
};