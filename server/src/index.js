const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Initialize passport configuration
require('./config/passport');

// Initialize monitoring system first
const { monitoringSystem, monitoring } = require('./monitoring');

// Enhanced Security Integration
const {
  initializeSecurity,
  applyCoreSecurity,
  applyAuthSecurity,
  applyAPISecurity,
  applyAdminSecurity,
  securityHealthCheck,
  shutdownSecurity,
} = require('./middleware/securityIntegration');

const outlierRoutes = require('./routes/outlier');
const channelRoutes = require('./routes/channels');
const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apiKeys');
const configRoutes = require('./routes/config');
const healthRoutes = require('./routes/health');
const queueRoutes = require('./routes/queues');
const dashboardRoutes = require('./routes/dashboard');
const favoritesRoutes = require('./routes/favorites');
const errorHandler = require('./middleware/errorHandler');
const correlationIdMiddleware = require('./middleware/correlationId');
const { handleAuthError } = require('./middleware/auth');
const { initializeDatabase, closeDatabase } = require('./config/initializeDatabase');
const { swaggerSetup } = require('./config/swagger');
const logger = require('./utils/logger');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Apply core security middleware (must be early in middleware stack)
applyCoreSecurity(app);

// Setup monitoring middleware (after security)
monitoringSystem.setupMiddleware(app);

// Compression middleware
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware (size limits handled by security middleware)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing middleware
app.use(cookieParser());

// Passport middleware
app.use(passport.initialize());

// Correlation ID middleware (before logging)
app.use(correlationIdMiddleware);

// Logging middleware with correlation ID
app.use(morgan('combined', {
  stream: {
    write: message => logger.info(message.trim(), { correlationId: 'http-access' }),
  },
}));

// Store socket instance for real-time updates
app.set('io', io);

// Apply authentication security middleware
applyAuthSecurity(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/outlier', outlierRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/config', configRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/favorites', favoritesRoutes);

// Setup monitoring routes
monitoringSystem.setupRoutes(app);

// Apply API security middleware
applyAPISecurity(app);

// Apply admin security middleware
applyAdminSecurity(app);

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const { databaseManager } = require('./config/initializeDatabase');
    const dbHealth = await databaseManager.getHealthStatus();
    const securityHealth = await securityHealthCheck();

    const overallStatus = dbHealth.status === 'connected' && securityHealth.status === 'healthy' ? 'OK' : 'DEGRADED';

    res.status(overallStatus === 'OK' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      security: securityHealth,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error.message,
    });
  }
});

// Security health check endpoint (admin only)
app.get('/health/security', async (req, res) => {
  try {
    // Basic admin check (full auth handled by security middleware)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const securityHealth = await securityHealthCheck();
    res.json(securityHealth);
  } catch (error) {
    logger.error('Security health check failed:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message,
    });
  }
});

// Setup API documentation
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  swaggerSetup(app);
  logger.info('API documentation available at /api-docs');
}

// Error handling middleware (should be last)
app.use(handleAuthError);
monitoringSystem.setupErrorHandling(app); // Sentry error handler
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  socket.on('join-analysis', (analysisId) => {
    socket.join(`analysis-${analysisId}`);
    logger.info(`Client ${socket.id} joined analysis room: ${analysisId}`);
  });
});

const PORT = process.env.PORT || 5000;

// Initialize security and database, then start server
async function startServer() {
  try {
    logger.info('Starting YouTube Outlier Discovery Server...');

    // Initialize monitoring system first
    await monitoringSystem.initialize();
    logger.info('Monitoring system initialized');

    // Initialize security systems
    const securityStatus = await initializeSecurity();
    logger.info('Security initialization:', securityStatus);

    // Initialize database
    const dbStatus = await initializeDatabase();
    logger.info(`Database status: ${dbStatus.mode}`, dbStatus);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 CORS origin: ${process.env.CORS_ORIGIN}`);
      logger.info(`💾 Database mode: ${dbStatus.mode}`);
      logger.info(`🔒 Security: ${securityStatus.success ? 'Active' : 'Degraded'}`);
      logger.info(`🛡️  Rate limiting: ${securityStatus.rateLimitingEnabled ? 'Redis' : 'Memory'}`);
      logger.info(`🔑 Secrets: ${securityStatus.secretsInitialized ? 'Initialized' : 'Not initialized'}`);

      // Log security configuration summary
      const config = securityStatus.config;
      logger.info('Security features enabled:', {
        rateLimiting: config.rateLimiting.enabled,
        inputValidation: config.validation.enabled,
        csrfProtection: config.csrf.enabled,
        securityHeaders: config.headers.enabled,
        monitoring: config.monitoring.enabled,
        apiSecurity: config.apiSecurity,
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  try {
    // Shutdown monitoring system
    await monitoringSystem.shutdown();

    // Shutdown security systems
    await shutdownSecurity();

    // Close database connections
    await closeDatabase();

    server.close(() => {
      logger.info('✅ Process terminated gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  try {
    // Shutdown monitoring system
    await monitoringSystem.shutdown();

    // Shutdown security systems
    await shutdownSecurity();

    // Close database connections
    await closeDatabase();

    server.close(() => {
      logger.info('✅ Process terminated gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
