const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { sentryUtils } = require('./sentry');
const { performHealthCheck } = require('./healthChecks');
const { quotaTracker } = require('./quotaTracker');
const { metricsUtils } = require('./metrics');

// Alert levels
const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
};

// Alert channels configuration
const ALERT_CHANNELS = {
  slack: {
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
  email: {
    enabled: !!process.env.SMTP_HOST,
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO?.split(',') || [],
  },
  webhook: {
    enabled: !!process.env.ALERT_WEBHOOK_URL,
    url: process.env.ALERT_WEBHOOK_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.ALERT_WEBHOOK_AUTH && {
        'Authorization': process.env.ALERT_WEBHOOK_AUTH,
      }),
    },
  },
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  errorRate: {
    warning: parseFloat(process.env.ERROR_RATE_WARNING_THRESHOLD) || 5.0, // 5%
    critical: parseFloat(process.env.ERROR_RATE_CRITICAL_THRESHOLD) || 10.0, // 10%
  },
  responseTime: {
    warning: parseInt(process.env.RESPONSE_TIME_WARNING_THRESHOLD) || 5000, // 5s
    critical: parseInt(process.env.RESPONSE_TIME_CRITICAL_THRESHOLD) || 10000, // 10s
  },
  cpuUsage: {
    warning: parseFloat(process.env.CPU_USAGE_WARNING_THRESHOLD) || 80.0, // 80%
    critical: parseFloat(process.env.CPU_USAGE_CRITICAL_THRESHOLD) || 95.0, // 95%
  },
  memoryUsage: {
    warning: parseFloat(process.env.MEMORY_USAGE_WARNING_THRESHOLD) || 80.0, // 80%
    critical: parseFloat(process.env.MEMORY_USAGE_CRITICAL_THRESHOLD) || 95.0, // 95%
  },
  diskUsage: {
    warning: parseFloat(process.env.DISK_USAGE_WARNING_THRESHOLD) || 80.0, // 80%
    critical: parseFloat(process.env.DISK_USAGE_CRITICAL_THRESHOLD) || 90.0, // 90%
  },
  quotaUsage: {
    warning: parseFloat(process.env.QUOTA_USAGE_WARNING_THRESHOLD) || 80.0, // 80%
    critical: parseFloat(process.env.QUOTA_USAGE_CRITICAL_THRESHOLD) || 95.0, // 95%
  },
};

class AlertManager {
  constructor() {
    this.alertHistory = new Map();
    this.silencedAlerts = new Set();
    this.initialized = false;
  }

  initialize() {
    // Set up periodic checks
    this.setupPeriodicChecks();
    this.initialized = true;

    logger.info('Alert manager initialized', {
      channels: Object.keys(ALERT_CHANNELS).filter(ch => ALERT_CHANNELS[ch].enabled),
      thresholds: ALERT_THRESHOLDS,
    });
  }

  setupPeriodicChecks() {
    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.checkSystemHealth();
    });

    // Quota check every hour
    cron.schedule('0 * * * *', () => {
      this.checkQuotaUsage();
    });

    // Performance metrics check every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      this.checkPerformanceMetrics();
    });

    // Error rate check every 15 minutes
    cron.schedule('*/15 * * * *', () => {
      this.checkErrorRates();
    });
  }

  async sendAlert(alertId, level, title, message, details = {}) {
    // Check if alert is silenced
    if (this.silencedAlerts.has(alertId)) {
      logger.debug(`Alert silenced: ${alertId}`);
      return;
    }

    // Check for duplicate alerts (within 1 hour)
    const lastAlert = this.alertHistory.get(alertId);
    const now = Date.now();
    if (lastAlert && (now - lastAlert.timestamp) < 3600000) { // 1 hour
      logger.debug(`Duplicate alert suppressed: ${alertId}`);
      return;
    }

    // Record alert
    this.alertHistory.set(alertId, {
      level,
      title,
      message,
      details,
      timestamp: now,
    });

    // Clean up old alerts (keep last 24 hours)
    this.cleanupAlertHistory();

    // Send to configured channels
    const alertData = {
      id: alertId,
      level,
      title,
      message,
      details,
      timestamp: new Date(now).toISOString(),
      service: 'youtube-outlier-discovery',
      environment: process.env.NODE_ENV || 'development',
    };

    // Send to Sentry
    sentryUtils.captureMessage(`Alert: ${title}`, level === 'critical' ? 'error' : 'warning', {
      extra: {
        alertId,
        alertLevel: level,
        alertDetails: details,
      },
      business: {
        domain: 'alerting',
        alertId,
        level,
      },
    });

    // Send to external channels
    await Promise.allSettled([
      this.sendToSlack(alertData),
      this.sendToEmail(alertData),
      this.sendToWebhook(alertData),
    ]);

    logger.warn(`Alert sent: ${title}`, {
      alertId,
      level,
      message,
      details,
    });
  }

  async sendToSlack(alertData) {
    if (!ALERT_CHANNELS.slack.enabled) return;

    try {
      const color = {
        info: '#36a64f',
        warning: '#ff9500',
        critical: '#ff0000',
        emergency: '#8b0000',
      }[alertData.level] || '#36a64f';

      const payload = {
        username: 'Outlier Discovery Monitor',
        icon_emoji: ':warning:',
        attachments: [{
          color,
          title: alertData.title,
          text: alertData.message,
          fields: [
            {
              title: 'Level',
              value: alertData.level.toUpperCase(),
              short: true,
            },
            {
              title: 'Service',
              value: alertData.service,
              short: true,
            },
            {
              title: 'Environment',
              value: alertData.environment,
              short: true,
            },
            {
              title: 'Time',
              value: alertData.timestamp,
              short: true,
            },
            ...Object.entries(alertData.details).map(([key, value]) => ({
              title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
              short: false,
            })),
          ],
          footer: 'YouTube Outlier Discovery',
          ts: Math.floor(Date.parse(alertData.timestamp) / 1000),
        }],
      };

      await axios.post(ALERT_CHANNELS.slack.webhookUrl, payload);
      logger.debug('Alert sent to Slack successfully');
    } catch (error) {
      logger.error('Failed to send alert to Slack:', error);
    }
  }

  async sendToEmail(alertData) {
    if (!ALERT_CHANNELS.email.enabled) return;

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter(ALERT_CHANNELS.email.smtp);

      const html = `
        <h2>🚨 ${alertData.title}</h2>
        <p><strong>Level:</strong> <span style="color: ${alertData.level === 'critical' ? 'red' : 'orange'}">${alertData.level.toUpperCase()}</span></p>
        <p><strong>Message:</strong> ${alertData.message}</p>
        <p><strong>Service:</strong> ${alertData.service}</p>
        <p><strong>Environment:</strong> ${alertData.environment}</p>
        <p><strong>Time:</strong> ${alertData.timestamp}</p>
        
        ${Object.keys(alertData.details).length > 0 ? `
          <h3>Details:</h3>
          <ul>
            ${Object.entries(alertData.details).map(([key, value]) =>
    `<li><strong>${key}:</strong> ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</li>`,
  ).join('')}
          </ul>
        ` : ''}
        
        <hr>
        <p><small>Alert ID: ${alertData.id}</small></p>
      `;

      await transporter.sendMail({
        from: ALERT_CHANNELS.email.from,
        to: ALERT_CHANNELS.email.to,
        subject: `[${alertData.level.toUpperCase()}] ${alertData.title}`,
        html,
      });

      logger.debug('Alert sent to email successfully');
    } catch (error) {
      logger.error('Failed to send alert to email:', error);
    }
  }

  async sendToWebhook(alertData) {
    if (!ALERT_CHANNELS.webhook.enabled) return;

    try {
      await axios.post(
        ALERT_CHANNELS.webhook.url,
        alertData,
        { headers: ALERT_CHANNELS.webhook.headers },
      );
      logger.debug('Alert sent to webhook successfully');
    } catch (error) {
      logger.error('Failed to send alert to webhook:', error);
    }
  }

  async checkSystemHealth() {
    try {
      const health = await performHealthCheck(true);

      if (health.status === 'unhealthy') {
        await this.sendAlert(
          'system_health_critical',
          ALERT_LEVELS.CRITICAL,
          'System Health Critical',
          'One or more critical system components are unhealthy',
          {
            overallStatus: health.status,
            failedChecks: Object.entries(health.checks)
              .filter(([, check]) => check.status === 'unhealthy')
              .map(([name]) => name),
            healthSummary: health.checks,
          },
        );
      } else if (health.status === 'degraded') {
        await this.sendAlert(
          'system_health_warning',
          ALERT_LEVELS.WARNING,
          'System Health Degraded',
          'System performance is degraded',
          {
            overallStatus: health.status,
            degradedChecks: Object.entries(health.checks)
              .filter(([, check]) => check.status === 'degraded')
              .map(([name]) => name),
          },
        );
      }
    } catch (error) {
      logger.error('Failed to check system health for alerting:', error);
    }
  }

  async checkQuotaUsage() {
    try {
      const quotaStatus = await quotaTracker.getQuotaStatus();

      if (quotaStatus.percentage >= ALERT_THRESHOLDS.quotaUsage.critical) {
        await this.sendAlert(
          'quota_usage_critical',
          ALERT_LEVELS.CRITICAL,
          'YouTube API Quota Critical',
          `API quota usage is critically high: ${quotaStatus.percentage}%`,
          {
            currentUsage: quotaStatus.current,
            limit: quotaStatus.limit,
            remaining: quotaStatus.remaining,
            percentage: quotaStatus.percentage,
            nextReset: quotaStatus.nextReset,
          },
        );
      } else if (quotaStatus.percentage >= ALERT_THRESHOLDS.quotaUsage.warning) {
        await this.sendAlert(
          'quota_usage_warning',
          ALERT_LEVELS.WARNING,
          'YouTube API Quota Warning',
          `API quota usage is high: ${quotaStatus.percentage}%`,
          {
            currentUsage: quotaStatus.current,
            limit: quotaStatus.limit,
            remaining: quotaStatus.remaining,
            percentage: quotaStatus.percentage,
            nextReset: quotaStatus.nextReset,
          },
        );
      }
    } catch (error) {
      logger.error('Failed to check quota usage for alerting:', error);
    }
  }

  async checkPerformanceMetrics() {
    try {
      // This would typically query your metrics store
      // For now, we'll simulate with basic checks

      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (memPercent >= ALERT_THRESHOLDS.memoryUsage.critical) {
        await this.sendAlert(
          'memory_usage_critical',
          ALERT_LEVELS.CRITICAL,
          'Memory Usage Critical',
          `Memory usage is critically high: ${memPercent.toFixed(1)}%`,
          {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            percentage: memPercent.toFixed(1),
          },
        );
      } else if (memPercent >= ALERT_THRESHOLDS.memoryUsage.warning) {
        await this.sendAlert(
          'memory_usage_warning',
          ALERT_LEVELS.WARNING,
          'Memory Usage Warning',
          `Memory usage is high: ${memPercent.toFixed(1)}%`,
          {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            percentage: memPercent.toFixed(1),
          },
        );
      }
    } catch (error) {
      logger.error('Failed to check performance metrics for alerting:', error);
    }
  }

  async checkErrorRates() {
    // This would typically query your metrics to calculate error rates
    // Implementation depends on your metrics storage system
    logger.debug('Error rate check completed');
  }

  silenceAlert(alertId, duration = 3600000) { // Default 1 hour
    this.silencedAlerts.add(alertId);

    setTimeout(() => {
      this.silencedAlerts.delete(alertId);
      logger.info(`Alert silence expired: ${alertId}`);
    }, duration);

    logger.info(`Alert silenced: ${alertId} for ${duration}ms`);
  }

  cleanupAlertHistory() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const [alertId, alert] of this.alertHistory.entries()) {
      if (alert.timestamp < cutoff) {
        this.alertHistory.delete(alertId);
      }
    }
  }

  getAlertHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentAlerts = [];

    for (const [alertId, alert] of this.alertHistory.entries()) {
      if (alert.timestamp >= cutoff) {
        recentAlerts.push({
          id: alertId,
          ...alert,
        });
      }
    }

    return recentAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  getAlertStatus() {
    return {
      initialized: this.initialized,
      channels: Object.keys(ALERT_CHANNELS).reduce((acc, channel) => {
        acc[channel] = ALERT_CHANNELS[channel].enabled;
        return acc;
      }, {}),
      thresholds: ALERT_THRESHOLDS,
      silencedCount: this.silencedAlerts.size,
      historyCount: this.alertHistory.size,
    };
  }
}

// Create singleton instance
const alertManager = new AlertManager();

// Express routes for alert management
const alertRoutes = {
  // Get alert history
  history: (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const history = alertManager.getAlertHistory(hours);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  },

  // Get alert status
  status: (req, res) => {
    const status = alertManager.getAlertStatus();

    res.json({
      success: true,
      data: status,
    });
  },

  // Silence an alert
  silence: (req, res) => {
    const { alertId, duration } = req.body;

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: 'alertId is required',
      });
    }

    alertManager.silenceAlert(alertId, duration);

    res.json({
      success: true,
      message: `Alert ${alertId} silenced`,
    });
  },

  // Test alert
  test: async (req, res) => {
    const { level = 'info', title = 'Test Alert', message = 'This is a test alert' } = req.body;

    try {
      await alertManager.sendAlert(
        `test_alert_${Date.now()}`,
        level,
        title,
        message,
        {
          testAlert: true,
          triggeredBy: req.correlationId || 'manual',
          timestamp: new Date().toISOString(),
        },
      );

      res.json({
        success: true,
        message: 'Test alert sent',
      });
    } catch (error) {
      logger.error('Failed to send test alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

module.exports = {
  alertManager,
  alertRoutes,
  ALERT_LEVELS,
  ALERT_THRESHOLDS,
};