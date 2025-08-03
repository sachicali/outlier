const express = require('express');
const emailService = require('../services/emailService');
const { authenticate, requireScopes } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

/**
 * Health check routes
 * Provides system health and service status information
 */

/**
 * @route   GET /api/health
 * @desc    Basic health check
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * @route   GET /api/health/email
 * @desc    Email service health check
 * @access  Private (Admin only)
 */
router.get('/email',
  authenticate,
  requirePermission('admin:read'),
  async (req, res) => {
    try {
      const isAvailable = emailService.isAvailable();
      const canConnect = isAvailable ? await emailService.verifyConnection() : false;
      const tokenStats = emailService.getTokenStats();

      res.json({
        service: 'email',
        status: isAvailable && canConnect ? 'healthy' : 'unhealthy',
        details: {
          configured: isAvailable,
          connected: canConnect,
          smtpHost: process.env.SMTP_HOST || 'not configured',
          smtpPort: process.env.SMTP_PORT || 'not configured',
          verificationTokens: tokenStats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        service: 'email',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   GET /api/health/services
 * @desc    Comprehensive service health check
 * @access  Private (Admin only)
 */
router.get('/services',
  authenticate,
  requirePermission('admin:read'),
  async (req, res) => {
    try {
      const services = {
        email: {
          name: 'Email Service',
          status: 'unknown',
          details: {},
        },
        database: {
          name: 'Database',
          status: 'memory', // Since we're using in-memory storage
          details: {
            type: 'in-memory',
            users: 'available',
            tokens: 'available',
          },
        },
        authentication: {
          name: 'Authentication Service',
          status: 'healthy',
          details: {
            jwt: 'configured',
            bcrypt: 'available',
            sessions: 'active',
          },
        },
      };

      // Check email service
      try {
        const emailAvailable = emailService.isAvailable();
        const emailConnected = emailAvailable ? await emailService.verifyConnection() : false;
        
        services.email.status = emailAvailable && emailConnected ? 'healthy' : 'degraded';
        services.email.details = {
          configured: emailAvailable,
          connected: emailConnected,
          tokens: emailService.getTokenStats(),
        };
      } catch (error) {
        services.email.status = 'unhealthy';
        services.email.details = { error: error.message };
      }

      const overallStatus = Object.values(services).every(s => s.status === 'healthy') ? 'healthy' : 'degraded';

      res.json({
        status: overallStatus,
        services: services,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

module.exports = router;