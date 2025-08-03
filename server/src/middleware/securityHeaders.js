const helmet = require('helmet');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Security Headers and CSRF Protection Middleware
 * Provides comprehensive security headers, CSRF token generation/validation,
 * and Content Security Policy configuration
 */

// CSRF token store (in production, use Redis or database)
const csrfTokens = new Map();

// Cleanup old CSRF tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > maxAge) {
      csrfTokens.delete(token);
    }
  }
}, 30 * 60 * 1000);

/**
 * Enhanced Helmet.js configuration
 */
function getHelmetConfig(env = 'development') {
  const isProduction = env === 'production';

  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: [
          '\'self\'',
          '\'unsafe-inline\'', // Required for some CSS frameworks
          'fonts.googleapis.com',
        ],
        fontSrc: [
          '\'self\'',
          'fonts.googleapis.com',
          'fonts.gstatic.com',
        ],
        scriptSrc: [
          '\'self\'',
          ...(isProduction ? [] : ['\'unsafe-eval\'']), // Allow eval in development only
          'apis.google.com',
        ],
        imgSrc: [
          '\'self\'',
          'data:',
          'https://i.ytimg.com', // YouTube thumbnails
          'https://yt3.ggpht.com', // YouTube channel avatars
          'https://www.youtube.com',
        ],
        connectSrc: [
          '\'self\'',
          'wss://localhost:*', // WebSocket connections in development
          'https://www.googleapis.com', // YouTube API
          'https://youtube.googleapis.com',
        ],
        frameSrc: [
          '\'self\'',
          'https://www.youtube.com', // YouTube embeds if needed
        ],
        objectSrc: ['\'none\''],
        baseUri: ['\'self\''],
        formAction: ['\'self\''],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
      reportOnly: !isProduction, // Use report-only mode in development
    },

    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny',
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin'],
    },

    // X-Download-Options
    ieNoOpen: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false,
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // Expect-CT (Certificate Transparency)
    expectCt: isProduction ? {
      maxAge: 86400, // 24 hours
      enforce: true,
    } : false,

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: false, // Disable to allow YouTube API

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  };
}

/**
 * Apply security headers middleware
 */
function applySecurityHeaders(env = 'development') {
  const config = getHelmetConfig(env);
  return helmet(config);
}

/**
 * Generate CSRF token
 */
function generateCSRFToken(sessionId, userAgent, ip) {
  const token = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();

  const tokenData = {
    sessionId,
    userAgent,
    ip,
    createdAt: timestamp,
    used: false,
  };

  csrfTokens.set(token, tokenData);

  // Also create a signed version for double verification
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'fallback-secret')
    .update(`${token}:${sessionId}:${userAgent}:${ip}:${timestamp}`)
    .digest('hex');

  return {
    token,
    signature,
    timestamp,
  };
}

/**
 * Validate CSRF token
 */
function validateCSRFToken(token, signature, sessionId, userAgent, ip) {
  const tokenData = csrfTokens.get(token);

  if (!tokenData) {
    logger.warn('CSRF token not found', { token: token.substring(0, 8) + '...', ip });
    return false;
  }

  // Check if token has been used (prevent replay attacks)
  if (tokenData.used) {
    logger.warn('CSRF token already used', { token: token.substring(0, 8) + '...', ip });
    csrfTokens.delete(token);
    return false;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'fallback-secret')
    .update(`${token}:${tokenData.sessionId}:${tokenData.userAgent}:${tokenData.ip}:${tokenData.createdAt}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('CSRF token signature mismatch', { token: token.substring(0, 8) + '...', ip });
    csrfTokens.delete(token);
    return false;
  }

  // Verify session context
  if (tokenData.sessionId !== sessionId) {
    logger.warn('CSRF token session mismatch', { token: token.substring(0, 8) + '...', ip });
    csrfTokens.delete(token);
    return false;
  }

  // Verify IP (optional, can be disabled for mobile users)
  const strictIPCheck = process.env.CSRF_STRICT_IP === 'true';
  if (strictIPCheck && tokenData.ip !== ip) {
    logger.warn('CSRF token IP mismatch', {
      token: token.substring(0, 8) + '...',
      expectedIP: tokenData.ip,
      actualIP: ip,
    });
    csrfTokens.delete(token);
    return false;
  }

  // Verify User-Agent (helps prevent cross-site attacks)
  if (tokenData.userAgent !== userAgent) {
    logger.warn('CSRF token User-Agent mismatch', { token: token.substring(0, 8) + '...', ip });
    csrfTokens.delete(token);
    return false;
  }

  // Check token age (1 hour max)
  const maxAge = 60 * 60 * 1000; // 1 hour
  if (Date.now() - tokenData.createdAt > maxAge) {
    logger.warn('CSRF token expired', { token: token.substring(0, 8) + '...', ip });
    csrfTokens.delete(token);
    return false;
  }

  // Mark token as used
  tokenData.used = true;

  // Clean up token after successful use
  setTimeout(() => {
    csrfTokens.delete(token);
  }, 5000); // Keep for 5 seconds for potential cleanup

  return true;
}

/**
 * CSRF token generation endpoint middleware
 */
function csrfTokenGeneration(req, res, next) {
  try {
    const sessionId = req.sessionID || req.user?.id || req.ip;
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress;

    const csrfData = generateCSRFToken(sessionId, userAgent, ip);

    // Add CSRF token to response
    res.locals.csrfToken = csrfData.token;
    res.locals.csrfSignature = csrfData.signature;
    res.locals.csrfTimestamp = csrfData.timestamp;

    // Set CSRF token in header for AJAX requests
    res.set('X-CSRF-Token', csrfData.token);
    res.set('X-CSRF-Signature', csrfData.signature);

    next();
  } catch (error) {
    logger.error('Error generating CSRF token:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate security token',
    });
  }
}

/**
 * CSRF protection middleware
 */
function csrfProtection(options = {}) {
  const {
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = ['/api/auth/csrf-token'],
    requireForAPI = true,
  } = options;

  return (req, res, next) => {
    // Skip CSRF protection for safe methods
    if (skipMethods.includes(req.method)) {
      return next();
    }

    // Skip CSRF protection for specific paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip CSRF protection for API key authentication (optional)
    if (!requireForAPI && req.authMethod === 'apikey') {
      return next();
    }

    try {
      const token = req.get('X-CSRF-Token') || req.body._csrf || req.query._csrf;
      const signature = req.get('X-CSRF-Signature') || req.body._csrfSignature;

      if (!token || !signature) {
        logger.warn('CSRF token missing', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id,
        });

        return res.status(403).json({
          error: 'CSRF token required',
          message: 'Cross-site request forgery protection requires a valid token',
        });
      }

      const sessionId = req.sessionID || req.user?.id || req.ip;
      const userAgent = req.get('User-Agent') || '';
      const ip = req.ip || req.connection.remoteAddress;

      const isValid = validateCSRFToken(token, signature, sessionId, userAgent, ip);

      if (!isValid) {
        logger.warn('CSRF token validation failed', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id,
          token: token.substring(0, 8) + '...',
        });

        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'Cross-site request forgery token is invalid or expired',
        });
      }

      next();
    } catch (error) {
      logger.error('CSRF protection error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'CSRF protection failed',
      });
    }
  };
}

/**
 * Additional security headers for API responses
 */
function apiSecurityHeaders(req, res, next) {
  // Add custom security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Download-Options': 'noopen',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });

  // Remove potentially revealing headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
}

/**
 * Feature Policy/Permissions Policy header
 */
function featurePolicyHeader(req, res, next) {
  const policies = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()',  // Disable FLoC
  ];

  res.set('Permissions-Policy', policies.join(', '));
  next();
}

/**
 * Clear Site Data header for logout
 */
function clearSiteData(types = ['cache', 'cookies', 'storage']) {
  return (req, res, next) => {
    const clearDirectives = types.map(type => `"${type}"`).join(', ');
    res.set('Clear-Site-Data', clearDirectives);
    next();
  };
}

/**
 * Middleware to add security metadata to requests
 */
function addSecurityMetadata(req, res, next) {
  // Add security-related request metadata
  req.security = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || '',
    origin: req.get('Origin') || '',
    referer: req.get('Referer') || '',
    forwardedFor: req.get('X-Forwarded-For') || '',
    protocol: req.protocol,
    secure: req.secure,
    timestamp: new Date(),
    sessionId: req.sessionID || null,
  };

  // Detect potential security threats
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter)\b/i, // SQL injection
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /javascript:/gi, // XSS
    /vbscript:/gi, // XSS
    /on\w+\s*=/gi, // Event handlers
    /\.\.\//g, // Path traversal
    /%2e%2e%2f/gi, // Encoded path traversal
  ];

  const requestString = JSON.stringify({
    path: req.path,
    query: req.query,
    body: req.body,
  });

  req.security.suspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));

  if (req.security.suspicious) {
    logger.warn('Suspicious request pattern detected', {
      ip: req.security.ip,
      userAgent: req.security.userAgent,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });
  }

  next();
}

/**
 * Get CSRF token status
 */
function getCSRFTokenStats() {
  const now = Date.now();
  const stats = {
    totalTokens: csrfTokens.size,
    activeTokens: 0,
    expiredTokens: 0,
    usedTokens: 0,
  };

  for (const [token, data] of csrfTokens.entries()) {
    if (data.used) {
      stats.usedTokens++;
    } else if (now - data.createdAt > 60 * 60 * 1000) {
      stats.expiredTokens++;
    } else {
      stats.activeTokens++;
    }
  }

  return stats;
}

module.exports = {
  applySecurityHeaders,
  csrfTokenGeneration,
  csrfProtection,
  apiSecurityHeaders,
  featurePolicyHeader,
  clearSiteData,
  addSecurityMetadata,
  generateCSRFToken,
  validateCSRFToken,
  getCSRFTokenStats,
  getHelmetConfig,
};