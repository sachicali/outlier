const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

/**
 * Security Monitoring and Auditing System
 * Provides security event logging, failed login tracking, suspicious activity detection,
 * and comprehensive audit trail functionality
 */

// In-memory stores (in production, use Redis or database)
const securityEvents = new Map();
const failedLoginAttempts = new Map();
const suspiciousActivities = new Map();
const auditTrail = [];

// Configuration
const SECURITY_CONFIG = {
  maxFailedLogins: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  suspiciousActivityThreshold: 10,
  auditTrailMaxSize: 10000,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  alertThresholds: {
    failedLogins: 3,
    suspiciousRequests: 5,
    rateLimitViolations: 10
  }
};

/**
 * Security Event Types
 */
const SECURITY_EVENT_TYPES = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  API_KEY_CREATED: 'api_key_created',
  API_KEY_REVOKED: 'api_key_revoked',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_REQUEST: 'suspicious_request',
  CSRF_VIOLATION: 'csrf_violation',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PRIVILEGE_ESCALATION: 'privilege_escalation',
  DATA_EXPORT: 'data_export',
  CONFIGURATION_CHANGE: 'configuration_change',
  WEBHOOK_VALIDATION_FAILED: 'webhook_validation_failed',
  REQUEST_SIGNATURE_FAILED: 'request_signature_failed'
};

/**
 * Security Event Severity Levels
 */
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Security Event Logger
 */
class SecurityEventLogger {
  constructor() {
    this.events = securityEvents;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, SECURITY_CONFIG.cleanupInterval);
  }

  /**
   * Log a security event
   */
  logEvent(type, details, severity = SEVERITY_LEVELS.MEDIUM, req = null) {
    const event = {
      id: this.generateEventId(),
      type,
      severity,
      timestamp: new Date(),
      details: {
        ...details,
        ip: req?.ip || req?.security?.ip,
        userAgent: req?.get('User-Agent') || req?.security?.userAgent,
        userId: req?.user?.id,
        sessionId: req?.sessionID || req?.security?.sessionId,
        path: req?.path,
        method: req?.method,
        origin: req?.get('Origin'),
        referer: req?.get('Referer')
      }
    };

    // Store event
    this.events.set(event.id, event);

    // Log to Winston logger
    const logLevel = this.getLogLevel(severity);
    logger[logLevel](`Security Event: ${type}`, event);

    // Check for alert conditions
    this.checkAlertConditions(type, event);

    return event.id;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get log level based on severity
   */
  getLogLevel(severity) {
    switch (severity) {
      case SEVERITY_LEVELS.CRITICAL:
        return 'error';
      case SEVERITY_LEVELS.HIGH:
        return 'error';
      case SEVERITY_LEVELS.MEDIUM:
        return 'warn';
      case SEVERITY_LEVELS.LOW:
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Check for alert conditions
   */
  checkAlertConditions(type, event) {
    // Count recent events of the same type from the same IP
    const recentEvents = this.getRecentEvents(
      60 * 60 * 1000, // Last hour
      { type, ip: event.details.ip }
    );

    if (recentEvents.length >= SECURITY_CONFIG.alertThresholds[type]) {
      this.triggerAlert(type, event, recentEvents);
    }
  }

  /**
   * Trigger security alert
   */
  triggerAlert(type, event, relatedEvents) {
    const alert = {
      id: this.generateEventId(),
      type: 'SECURITY_ALERT',
      alertType: type,
      severity: SEVERITY_LEVELS.HIGH,
      timestamp: new Date(),
      triggerEvent: event,
      relatedEvents: relatedEvents.map(e => e.id),
      details: {
        eventCount: relatedEvents.length,
        timeWindow: '1 hour',
        ip: event.details.ip,
        userId: event.details.userId
      }
    };

    this.events.set(alert.id, alert);
    logger.error('Security Alert Triggered', alert);

    // In production, send to monitoring system or notification service
    this.sendAlert(alert);
  }

  /**
   * Send alert to monitoring system
   */
  sendAlert(alert) {
    // Placeholder for external alert system integration
    // e.g., send to Slack, email, PagerDuty, etc.
    logger.error('SECURITY ALERT', {
      alertId: alert.id,
      type: alert.alertType,
      severity: alert.severity,
      details: alert.details
    });
  }

  /**
   * Get recent events
   */
  getRecentEvents(timeWindow, filters = {}) {
    const cutoffTime = Date.now() - timeWindow;
    const events = [];

    for (const event of this.events.values()) {
      if (event.timestamp.getTime() > cutoffTime) {
        let matches = true;
        
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'type' && event.type !== value) {
            matches = false;
            break;
          }
          if (key === 'ip' && event.details.ip !== value) {
            matches = false;
            break;
          }
          if (key === 'userId' && event.details.userId !== value) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          events.push(event);
        }
      }
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Cleanup old events
   */
  cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // Keep events for 24 hours
    
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp.getTime() < cutoffTime) {
        this.events.delete(id);
      }
    }
  }

  /**
   * Get event statistics
   */
  getStatistics(timeWindow = 60 * 60 * 1000) {
    const events = this.getRecentEvents(timeWindow);
    const stats = {
      totalEvents: events.length,
      eventsByType: {},
      eventsBySeverity: {},
      eventsByIP: {},
      timeWindow: timeWindow / (60 * 1000) + ' minutes'
    };

    for (const event of events) {
      // Count by type
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by IP
      const ip = event.details.ip;
      if (ip) {
        stats.eventsByIP[ip] = (stats.eventsByIP[ip] || 0) + 1;
      }
    }

    return stats;
  }
}

const securityEventLogger = new SecurityEventLogger();

/**
 * Failed Login Tracking
 */
class FailedLoginTracker {
  constructor() {
    this.attempts = failedLoginAttempts;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, SECURITY_CONFIG.cleanupInterval);
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(identifier, req) {
    const key = `${identifier}:${req.ip}`;
    const now = Date.now();
    
    let attempts = this.attempts.get(key) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
      lockoutUntil: null,
      attempts: []
    };

    attempts.count++;
    attempts.lastAttempt = now;
    attempts.attempts.push({
      timestamp: now,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Check if account should be locked
    if (attempts.count >= SECURITY_CONFIG.maxFailedLogins) {
      attempts.lockoutUntil = now + SECURITY_CONFIG.lockoutDuration;
      
      securityEventLogger.logEvent(
        SECURITY_EVENT_TYPES.LOGIN_FAILURE,
        {
          identifier,
          failedAttempts: attempts.count,
          lockedOut: true,
          lockoutDuration: SECURITY_CONFIG.lockoutDuration / 1000 + ' seconds'
        },
        SEVERITY_LEVELS.HIGH,
        req
      );
    } else {
      securityEventLogger.logEvent(
        SECURITY_EVENT_TYPES.LOGIN_FAILURE,
        {
          identifier,
          failedAttempts: attempts.count,
          lockedOut: false
        },
        SEVERITY_LEVELS.MEDIUM,
        req
      );
    }

    this.attempts.set(key, attempts);
    return attempts;
  }

  /**
   * Check if account is locked
   */
  isLocked(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.attempts.get(key);
    
    if (!attempts || !attempts.lockoutUntil) {
      return false;
    }

    const now = Date.now();
    if (now > attempts.lockoutUntil) {
      // Lockout period has expired
      this.clearAttempts(identifier, ip);
      return false;
    }

    return true;
  }

  /**
   * Get remaining lockout time
   */
  getLockoutTime(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.attempts.get(key);
    
    if (!attempts || !attempts.lockoutUntil) {
      return 0;
    }

    const remaining = attempts.lockoutUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Clear failed attempts (successful login)
   */
  clearAttempts(identifier, ip) {
    const key = `${identifier}:${ip}`;
    this.attempts.delete(key);
  }

  /**
   * Cleanup old attempts
   */
  cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [key, attempts] of this.attempts.entries()) {
      if (attempts.lastAttempt < cutoffTime) {
        this.attempts.delete(key);
      }
    }
  }
}

const failedLoginTracker = new FailedLoginTracker();

/**
 * Suspicious Activity Detector
 */
class SuspiciousActivityDetector {
  constructor() {
    this.activities = suspiciousActivities;
    this.patterns = [
      {
        name: 'rapid_requests',
        check: this.checkRapidRequests.bind(this),
        threshold: 100, // requests per minute
        severity: SEVERITY_LEVELS.MEDIUM
      },
      {
        name: 'unusual_user_agent',
        check: this.checkUnusualUserAgent.bind(this),
        severity: SEVERITY_LEVELS.LOW
      },
      {
        name: 'suspicious_paths',
        check: this.checkSuspiciousPaths.bind(this),
        severity: SEVERITY_LEVELS.HIGH
      },
      {
        name: 'anomalous_request_size',
        check: this.checkAnomalousRequestSize.bind(this),
        severity: SEVERITY_LEVELS.MEDIUM
      }
    ];
  }

  /**
   * Analyze request for suspicious activity
   */
  analyzeRequest(req) {
    const results = [];
    
    for (const pattern of this.patterns) {
      try {
        const result = pattern.check(req);
        if (result.suspicious) {
          results.push({
            pattern: pattern.name,
            severity: pattern.severity,
            details: result.details
          });

          securityEventLogger.logEvent(
            SECURITY_EVENT_TYPES.SUSPICIOUS_REQUEST,
            {
              pattern: pattern.name,
              ...result.details
            },
            pattern.severity,
            req
          );
        }
      } catch (error) {
        logger.error(`Error checking pattern ${pattern.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Check for rapid requests from same IP
   */
  checkRapidRequests(req) {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    
    let requests = this.activities.get(`rapid_${ip}`) || [];
    
    // Filter to current window
    requests = requests.filter(time => now - time < windowMs);
    requests.push(now);
    
    this.activities.set(`rapid_${ip}`, requests);
    
    if (requests.length > 100) {
      return {
        suspicious: true,
        details: {
          requestCount: requests.length,
          timeWindow: '1 minute',
          ip
        }
      };
    }

    return { suspicious: false };
  }

  /**
   * Check for unusual User-Agent strings
   */
  checkUnusualUserAgent(req) {
    const userAgent = req.get('User-Agent') || '';
    
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python/i,
      /scanner/i,
      /bot/i,
      /crawl/i,
      /hack/i,
      /inject/i,
      /^$/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        return {
          suspicious: true,
          details: {
            userAgent,
            pattern: pattern.toString()
          }
        };
      }
    }

    return { suspicious: false };
  }

  /**
   * Check for suspicious paths
   */
  checkSuspiciousPaths(req) {
    const path = req.path.toLowerCase();
    
    const suspiciousPaths = [
      '/admin',
      '/wp-admin',
      '/phpmyadmin',
      '/.env',
      '/config',
      '/backup',
      '/dump',
      '/.git',
      '/test',
      '/debug'
    ];

    for (const suspiciousPath of suspiciousPaths) {
      if (path.includes(suspiciousPath)) {
        return {
          suspicious: true,
          details: {
            path: req.path,
            suspiciousPath
          }
        };
      }
    }

    return { suspicious: false };
  }

  /**
   * Check for anomalous request sizes
   */
  checkAnomalousRequestSize(req) {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const maxNormalSize = 10 * 1024 * 1024; // 10MB
    const minSuspiciousSize = 50 * 1024 * 1024; // 50MB

    if (contentLength > minSuspiciousSize) {
      return {
        suspicious: true,
        details: {
          contentLength,
          maxNormalSize,
          ratio: contentLength / maxNormalSize
        }
      };
    }

    return { suspicious: false };
  }
}

const suspiciousActivityDetector = new SuspiciousActivityDetector();

/**
 * Audit Trail System
 */
class AuditTrail {
  constructor() {
    this.trail = auditTrail;
    this.maxSize = SECURITY_CONFIG.auditTrailMaxSize;
  }

  /**
   * Log audit event
   */
  logAuditEvent(action, resource, details, req) {
    const auditEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      action,
      resource,
      actor: {
        userId: req?.user?.id,
        username: req?.user?.username,
        role: req?.user?.role,
        ip: req?.ip,
        userAgent: req?.get('User-Agent'),
        sessionId: req?.sessionID
      },
      details,
      requestInfo: {
        method: req?.method,
        path: req?.path,
        query: req?.query,
        apiVersion: req?.apiVersion
      }
    };

    this.trail.push(auditEntry);

    // Maintain max size
    if (this.trail.length > this.maxSize) {
      this.trail.shift();
    }

    logger.info('Audit Event', auditEntry);
    return auditEntry.id;
  }

  /**
   * Generate audit ID
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get audit trail for a user
   */
  getUserAuditTrail(userId, limit = 100) {
    return this.trail
      .filter(entry => entry.actor.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit trail for a resource
   */
  getResourceAuditTrail(resource, limit = 100) {
    return this.trail
      .filter(entry => entry.resource === resource)
      .slice(-limit)
      .reverse();
  }

  /**
   * Search audit trail
   */
  searchAuditTrail(filters = {}, limit = 100) {
    let results = this.trail;

    if (filters.userId) {
      results = results.filter(entry => entry.actor.userId === filters.userId);
    }

    if (filters.action) {
      results = results.filter(entry => entry.action === filters.action);
    }

    if (filters.resource) {
      results = results.filter(entry => entry.resource === filters.resource);
    }

    if (filters.startDate) {
      results = results.filter(entry => entry.timestamp >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      results = results.filter(entry => entry.timestamp <= new Date(filters.endDate));
    }

    return results.slice(-limit).reverse();
  }
}

const auditTrailInstance = new AuditTrail();

/**
 * Middleware functions
 */

/**
 * Security monitoring middleware
 */
function securityMonitoring(req, res, next) {
  // Analyze request for suspicious activity
  const suspiciousResults = suspiciousActivityDetector.analyzeRequest(req);
  
  if (suspiciousResults.length > 0) {
    req.suspiciousActivity = suspiciousResults;
  }

  next();
}

/**
 * Failed login protection middleware
 */
function failedLoginProtection(req, res, next) {
  const identifier = req.body.username || req.body.email || 'unknown';
  
  if (failedLoginTracker.isLocked(identifier, req.ip)) {
    const lockoutTime = failedLoginTracker.getLockoutTime(identifier, req.ip);
    
    return res.status(423).json({
      error: 'Account temporarily locked',
      message: 'Too many failed login attempts',
      lockoutRemaining: Math.ceil(lockoutTime / 1000) + ' seconds'
    });
  }

  // Attach failed login tracker to request for use in auth controller
  req.failedLoginTracker = failedLoginTracker;
  
  next();
}

/**
 * Audit logging middleware
 */
function auditLogging(action, resource) {
  return (req, res, next) => {
    // Store audit info for later use
    req.auditInfo = { action, resource };
    
    // Log the audit event after successful response
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode < 400) {
        auditTrail.logAuditEvent(action, resource, {
          success: true,
          statusCode: res.statusCode,
          responseSize: data ? data.length : 0
        }, req);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Admin audit endpoint
 */
function getSecurityDashboard(req, res) {
  try {
    // Ensure only admins can access
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    const dashboard = {
      timestamp: new Date().toISOString(),
      securityEvents: securityEventLogger.getStatistics(),
      failedLogins: {
        totalAttempts: failedLoginAttempts.size,
        lockedAccounts: Array.from(failedLoginAttempts.values())
          .filter(attempt => attempt.lockoutUntil && attempt.lockoutUntil > Date.now()).length
      },
      auditTrail: {
        totalEntries: auditTrail.trail.length,
        recentEntries: auditTrail.trail.slice(-10)
      },
      suspiciousActivity: {
        totalActivities: suspiciousActivities.size
      }
    };

    res.json(dashboard);
  } catch (error) {
    logger.error('Error generating security dashboard:', error);
    res.status(500).json({
      error: 'Dashboard generation failed',
      message: error.message
    });
  }
}

module.exports = {
  securityEventLogger,
  failedLoginTracker,
  suspiciousActivityDetector,
  auditTrail,
  securityMonitoring,
  failedLoginProtection,
  auditLogging,
  getSecurityDashboard,
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS
};