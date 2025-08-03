const prometheus = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'youtube-outlier-discovery',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
});

// Enable the collection of default metrics
prometheus.collectDefaultMetrics({
  register,
  prefix: 'outlier_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics for business logic
const metrics = {
  // HTTP Request metrics
  httpRequestsTotal: new prometheus.Counter({
    name: 'outlier_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  }),

  httpRequestDuration: new prometheus.Histogram({
    name: 'outlier_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register],
  }),

  // YouTube API metrics
  youtubeApiCallsTotal: new prometheus.Counter({
    name: 'outlier_youtube_api_calls_total',
    help: 'Total number of YouTube API calls',
    labelNames: ['operation', 'status'],
    registers: [register],
  }),

  youtubeApiQuotaUsed: new prometheus.Counter({
    name: 'outlier_youtube_api_quota_used_total',
    help: 'Total YouTube API quota used',
    labelNames: ['operation'],
    registers: [register],
  }),

  youtubeApiResponseTime: new prometheus.Histogram({
    name: 'outlier_youtube_api_response_time_seconds',
    help: 'YouTube API response time in seconds',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  }),

  youtubeApiRateLimit: new prometheus.Gauge({
    name: 'outlier_youtube_api_rate_limit_remaining',
    help: 'Remaining YouTube API rate limit',
    registers: [register],
  }),

  // Analysis metrics
  analysisRequestsTotal: new prometheus.Counter({
    name: 'outlier_analysis_requests_total',
    help: 'Total number of analysis requests',
    labelNames: ['type', 'status'],
    registers: [register],
  }),

  analysisProcessingTime: new prometheus.Histogram({
    name: 'outlier_analysis_processing_time_seconds',
    help: 'Time taken to process analysis requests',
    labelNames: ['type'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [register],
  }),

  channelsAnalyzed: new prometheus.Counter({
    name: 'outlier_channels_analyzed_total',
    help: 'Total number of channels analyzed',
    registers: [register],
  }),

  videosAnalyzed: new prometheus.Counter({
    name: 'outlier_videos_analyzed_total',
    help: 'Total number of videos analyzed',
    registers: [register],
  }),

  outliersFound: new prometheus.Counter({
    name: 'outlier_videos_found_total',
    help: 'Total number of outlier videos found',
    labelNames: ['threshold_type'],
    registers: [register],
  }),

  // Database metrics
  databaseConnectionsActive: new prometheus.Gauge({
    name: 'outlier_database_connections_active',
    help: 'Number of active database connections',
    registers: [register],
  }),

  databaseQueryDuration: new prometheus.Histogram({
    name: 'outlier_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
  }),

  databaseQueriesTotal: new prometheus.Counter({
    name: 'outlier_database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table', 'status'],
    registers: [register],
  }),

  // Redis metrics
  redisConnectionsActive: new prometheus.Gauge({
    name: 'outlier_redis_connections_active',
    help: 'Number of active Redis connections',
    registers: [register],
  }),

  redisOperationsTotal: new prometheus.Counter({
    name: 'outlier_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'],
    registers: [register],
  }),

  redisOperationDuration: new prometheus.Histogram({
    name: 'outlier_redis_operation_duration_seconds',
    help: 'Redis operation duration in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
  }),

  // Authentication metrics
  authenticationAttempts: new prometheus.Counter({
    name: 'outlier_authentication_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['status', 'method'],
    registers: [register],
  }),

  activeUsers: new prometheus.Gauge({
    name: 'outlier_active_users',
    help: 'Number of currently active users',
    registers: [register],
  }),

  // WebSocket metrics
  websocketConnections: new prometheus.Gauge({
    name: 'outlier_websocket_connections_active',
    help: 'Number of active WebSocket connections',
    registers: [register],
  }),

  websocketMessages: new prometheus.Counter({
    name: 'outlier_websocket_messages_total',
    help: 'Total number of WebSocket messages',
    labelNames: ['type', 'direction'],
    registers: [register],
  }),

  // Error metrics
  errorsTotal: new prometheus.Counter({
    name: 'outlier_errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'severity'],
    registers: [register],
  }),

  // System metrics
  systemInfo: new prometheus.Gauge({
    name: 'outlier_system_info',
    help: 'System information',
    labelNames: ['version', 'node_version', 'platform'],
    registers: [register],
  }),

  memoryUsage: new prometheus.Gauge({
    name: 'outlier_memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type'],
    registers: [register],
  }),

  // Business metrics
  revenueImpact: new prometheus.Counter({
    name: 'outlier_revenue_impact_total',
    help: 'Estimated revenue impact from discovered outliers',
    labelNames: ['currency'],
    registers: [register],
  }),

  userEngagement: new prometheus.Histogram({
    name: 'outlier_user_engagement_duration_seconds',
    help: 'User engagement duration in seconds',
    buckets: [10, 30, 60, 300, 600, 1800, 3600],
    registers: [register],
  }),
};

// Initialize system info metric
metrics.systemInfo.set(
  {
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    platform: process.platform,
  },
  1,
);

// Utility functions for metrics
const metricsUtils = {
  // Record HTTP request
  recordHttpRequest: (method, route, statusCode, duration) => {
    const labels = { method, route, status_code: statusCode };
    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDuration.observe(labels, duration);
  },

  // Record YouTube API call
  recordYouTubeAPICall: (operation, status, quotaCost = 0, duration = 0) => {
    metrics.youtubeApiCallsTotal.inc({ operation, status });
    if (quotaCost > 0) {
      metrics.youtubeApiQuotaUsed.inc({ operation }, quotaCost);
    }
    if (duration > 0) {
      metrics.youtubeApiResponseTime.observe({ operation }, duration);
    }
  },

  // Record analysis operation
  recordAnalysis: (type, status, processingTime = 0, channelsCount = 0, videosCount = 0, outliersCount = 0) => {
    metrics.analysisRequestsTotal.inc({ type, status });
    if (processingTime > 0) {
      metrics.analysisProcessingTime.observe({ type }, processingTime);
    }
    if (channelsCount > 0) {
      metrics.channelsAnalyzed.inc(channelsCount);
    }
    if (videosCount > 0) {
      metrics.videosAnalyzed.inc(videosCount);
    }
    if (outliersCount > 0) {
      metrics.outliersFound.inc({ threshold_type: 'standard' }, outliersCount);
    }
  },

  // Record database operation
  recordDatabaseOperation: (operation, table, status, duration = 0) => {
    metrics.databaseQueriesTotal.inc({ operation, table, status });
    if (duration > 0) {
      metrics.databaseQueryDuration.observe({ operation, table }, duration);
    }
  },

  // Record Redis operation
  recordRedisOperation: (operation, status, duration = 0) => {
    metrics.redisOperationsTotal.inc({ operation, status });
    if (duration > 0) {
      metrics.redisOperationDuration.observe({ operation }, duration);
    }
  },

  // Record authentication attempt
  recordAuthAttempt: (status, method = 'jwt') => {
    metrics.authenticationAttempts.inc({ status, method });
  },

  // Record error
  recordError: (type, severity = 'error') => {
    metrics.errorsTotal.inc({ type, severity });
  },

  // Update active connections
  updateActiveConnections: (database = 0, redis = 0, websocket = 0) => {
    if (database >= 0) metrics.databaseConnectionsActive.set(database);
    if (redis >= 0) metrics.redisConnectionsActive.set(redis);
    if (websocket >= 0) metrics.websocketConnections.set(websocket);
  },

  // Update memory usage
  updateMemoryUsage: () => {
    const memUsage = process.memoryUsage();
    metrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    metrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    metrics.memoryUsage.set({ type: 'external' }, memUsage.external);
    metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
  },

  // Create a timer for operations
  createTimer: (histogramMetric, labels = {}) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = (Date.now() - start) / 1000;
        histogramMetric.observe(labels, duration);
        return duration;
      },
    };
  },

  // Get metrics for export
  getMetrics: () => {
    return register.metrics();
  },

  // Get register for middleware
  getRegister: () => {
    return register;
  },
};

// Update memory usage periodically
setInterval(() => {
  metricsUtils.updateMemoryUsage();
}, 30000); // Every 30 seconds

// Express middleware for automatic HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    metricsUtils.recordHttpRequest(req.method, route, res.statusCode, duration);
  });

  next();
};

module.exports = {
  metrics,
  metricsUtils,
  metricsMiddleware,
  register,
};