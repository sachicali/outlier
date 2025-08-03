const crypto = require('crypto');
const { body, query, param } = require('express-validator');
const logger = require('../utils/logger');

/**
 * API Security Middleware
 * Provides request signing, API versioning, webhook signature validation,
 * and SQL injection prevention
 */

/**
 * Request signing for sensitive operations
 */
class RequestSigner {
  constructor(secretKey = process.env.API_SIGNING_SECRET) {
    this.secretKey = secretKey || crypto.randomBytes(32).toString('hex');
    this.algorithm = 'sha256';
    this.timestampTolerance = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate signature for a request
   */
  generateSignature(method, path, body, timestamp, nonce) {
    const payload = [
      method.toUpperCase(),
      path,
      typeof body === 'object' ? JSON.stringify(body) : (body || ''),
      timestamp.toString(),
      nonce,
    ].join('|');

    return crypto
      .createHmac(this.algorithm, this.secretKey)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify request signature
   */
  verifySignature(signature, method, path, body, timestamp, nonce) {
    const expectedSignature = this.generateSignature(method, path, body, timestamp, nonce);

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Generate signed request headers
   */
  generateHeaders(method, path, body) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = this.generateSignature(method, path, body, timestamp, nonce);

    return {
      'X-API-Timestamp': timestamp.toString(),
      'X-API-Nonce': nonce,
      'X-API-Signature': signature,
    };
  }
}

const requestSigner = new RequestSigner();

/**
 * Middleware to require request signing for sensitive operations
 */
function requireRequestSigning(options = {}) {
  const {
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    requireForPaths = ['/api/auth', '/api/apikeys'],
    maxTimestampAge = 5 * 60 * 1000, // 5 minutes
  } = options;

  return (req, res, next) => {
    // Skip signing for safe methods unless explicitly required
    if (skipMethods.includes(req.method) && !requireForPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    try {
      const signature = req.get('X-API-Signature');
      const timestamp = req.get('X-API-Timestamp');
      const nonce = req.get('X-API-Nonce');

      if (!signature || !timestamp || !nonce) {
        logger.warn('Missing request signature headers', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userId: req.user?.id,
        });

        return res.status(400).json({
          error: 'Request signing required',
          message: 'This endpoint requires signed requests',
        });
      }

      // Verify timestamp to prevent replay attacks
      const requestTime = parseInt(timestamp, 10);
      const now = Date.now();

      if (isNaN(requestTime) || Math.abs(now - requestTime) > maxTimestampAge) {
        logger.warn('Request signature timestamp out of range', {
          ip: req.ip,
          path: req.path,
          requestTime,
          currentTime: now,
          userId: req.user?.id,
        });

        return res.status(400).json({
          error: 'Invalid timestamp',
          message: 'Request timestamp is too old or in the future',
        });
      }

      // Verify signature
      const isValidSignature = requestSigner.verifySignature(
        signature,
        req.method,
        req.path,
        req.body,
        requestTime,
        nonce,
      );

      if (!isValidSignature) {
        logger.warn('Invalid request signature', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userId: req.user?.id,
          signature: signature.substring(0, 8) + '...',
        });

        return res.status(401).json({
          error: 'Invalid signature',
          message: 'Request signature verification failed',
        });
      }

      // Store nonce to prevent replay attacks (in production, use Redis)
      req.signatureVerified = true;
      req.requestNonce = nonce;

      next();
    } catch (error) {
      logger.error('Request signature verification error:', error);
      res.status(500).json({
        error: 'Signature verification failed',
        message: 'An error occurred during signature verification',
      });
    }
  };
}

/**
 * API Versioning Support
 */
class APIVersionManager {
  constructor() {
    this.versions = new Map();
    this.defaultVersion = '1.0';
    this.supportedVersions = ['1.0'];
    this.deprecatedVersions = new Map();
  }

  /**
   * Register a version
   */
  registerVersion(version, config = {}) {
    this.versions.set(version, {
      version,
      deprecated: config.deprecated || false,
      sunsetDate: config.sunsetDate || null,
      minClientVersion: config.minClientVersion || null,
      features: config.features || [],
      ...config,
    });

    if (!this.supportedVersions.includes(version)) {
      this.supportedVersions.push(version);
    }
  }

  /**
   * Get version from request
   */
  getVersionFromRequest(req) {
    // Check API version header
    let version = req.get('API-Version') || req.get('X-API-Version');

    // Check Accept header
    if (!version) {
      const acceptHeader = req.get('Accept');
      if (acceptHeader) {
        const versionMatch = acceptHeader.match(/application\/vnd\.outlier\.v(\d+(?:\.\d+)?)/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }
    }

    // Check query parameter
    if (!version) {
      version = req.query.version || req.query.v;
    }

    return version || this.defaultVersion;
  }

  /**
   * Validate version
   */
  validateVersion(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Get version info
   */
  getVersionInfo(version) {
    return this.versions.get(version);
  }

  /**
   * Check if version is deprecated
   */
  isDeprecated(version) {
    const versionInfo = this.versions.get(version);
    return versionInfo ? versionInfo.deprecated : false;
  }
}

const apiVersionManager = new APIVersionManager();

// Register default versions
apiVersionManager.registerVersion('1.0', {
  deprecated: false,
  features: ['basic-auth', 'outlier-detection', 'channel-management'],
});

/**
 * API versioning middleware
 */
function apiVersioning(req, res, next) {
  try {
    const requestedVersion = apiVersionManager.getVersionFromRequest(req);

    if (!apiVersionManager.validateVersion(requestedVersion)) {
      return res.status(400).json({
        error: 'Unsupported API version',
        message: `API version ${requestedVersion} is not supported`,
        supportedVersions: apiVersionManager.supportedVersions,
      });
    }

    const versionInfo = apiVersionManager.getVersionInfo(requestedVersion);

    // Add version info to request
    req.apiVersion = requestedVersion;
    req.versionInfo = versionInfo;

    // Add version headers to response
    res.set({
      'API-Version': requestedVersion,
      'API-Supported-Versions': apiVersionManager.supportedVersions.join(', '),
    });

    // Add deprecation warning if applicable
    if (versionInfo && versionInfo.deprecated) {
      res.set('API-Deprecation', 'true');
      if (versionInfo.sunsetDate) {
        res.set('API-Sunset', versionInfo.sunsetDate);
      }

      logger.warn('Deprecated API version used', {
        version: requestedVersion,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
      });
    }

    next();
  } catch (error) {
    logger.error('API versioning error:', error);
    res.status(500).json({
      error: 'API versioning failed',
      message: 'An error occurred during API version processing',
    });
  }
}

/**
 * Webhook signature validation
 */
class WebhookValidator {
  constructor() {
    this.algorithms = ['sha256', 'sha1'];
  }

  /**
   * Generate webhook signature
   */
  generateSignature(payload, secret, algorithm = 'sha256') {
    return crypto
      .createHmac(algorithm, secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  /**
   * Validate webhook signature
   */
  validateSignature(signature, payload, secret, algorithm = 'sha256') {
    const expectedSignature = this.generateSignature(payload, secret, algorithm);
    const providedSignature = signature.replace(`${algorithm}=`, '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex'),
    );
  }

  /**
   * Parse signature header
   */
  parseSignatureHeader(signatureHeader) {
    const signatures = {};

    if (!signatureHeader) {
      return signatures;
    }

    const parts = signatureHeader.split(',');

    for (const part of parts) {
      const [algorithm, signature] = part.trim().split('=');
      if (algorithm && signature) {
        signatures[algorithm] = signature;
      }
    }

    return signatures;
  }
}

const webhookValidator = new WebhookValidator();

/**
 * Webhook signature validation middleware
 */
function validateWebhookSignature(secretKey) {
  return (req, res, next) => {
    try {
      const signatureHeader = req.get('X-Hub-Signature-256') || req.get('X-Signature-256');

      if (!signatureHeader) {
        logger.warn('Missing webhook signature', {
          ip: req.ip,
          path: req.path,
          userAgent: req.get('User-Agent'),
        });

        return res.status(400).json({
          error: 'Missing signature',
          message: 'Webhook signature is required',
        });
      }

      const rawBody = req.rawBody || JSON.stringify(req.body);
      const signatures = webhookValidator.parseSignatureHeader(signatureHeader);

      let validSignature = false;

      // Try each signature algorithm
      for (const [algorithm, signature] of Object.entries(signatures)) {
        if (webhookValidator.algorithms.includes(algorithm)) {
          if (webhookValidator.validateSignature(
            `${algorithm}=${signature}`,
            rawBody,
            secretKey,
            algorithm,
          )) {
            validSignature = true;
            break;
          }
        }
      }

      if (!validSignature) {
        logger.warn('Invalid webhook signature', {
          ip: req.ip,
          path: req.path,
          signatureHeader: signatureHeader.substring(0, 20) + '...',
        });

        return res.status(401).json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
        });
      }

      req.webhookVerified = true;
      next();
    } catch (error) {
      logger.error('Webhook signature validation error:', error);
      res.status(500).json({
        error: 'Signature validation failed',
        message: 'An error occurred during webhook signature validation',
      });
    }
  };
}

/**
 * SQL Injection Prevention
 */
function preventSQLInjection(req, res, next) {
  const sqlInjectionPatterns = [
    /(\b(union|select|insert|delete|drop|create|alter|exec|execute|sp_|xp_)\b)/gi,
    /('|(\\x27)|(\\x2D){2})/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\\x27)|(\'))/gi,
    /(\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52)))/gi,
    /((\%27)|(\'))union/gi,
    /(((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>))/gi,
    /(((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>))/gi,
  ];

  function checkForSQLInjection(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        for (const pattern of sqlInjectionPatterns) {
          if (pattern.test(value)) {
            logger.warn('Potential SQL injection attempt detected', {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              path: req.path,
              field: currentPath,
              value: value.substring(0, 100),
              userId: req.user?.id,
            });

            return res.status(400).json({
              error: 'Invalid input detected',
              message: 'Request contains potentially dangerous SQL patterns',
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForSQLInjection(value, currentPath);
        if (result) return result;
      }
    }
  }

  // Check query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    const result = checkForSQLInjection(req.query);
    if (result) return result;
  }

  // Check request body
  if (req.body && typeof req.body === 'object') {
    const result = checkForSQLInjection(req.body);
    if (result) return result;
  }

  // Check URL parameters
  if (req.params && Object.keys(req.params).length > 0) {
    const result = checkForSQLInjection(req.params);
    if (result) return result;
  }

  next();
}

/**
 * API request metadata middleware
 */
function addAPIMetadata(req, res, next) {
  // Add API-specific metadata
  req.apiMetadata = {
    version: req.apiVersion || '1.0',
    endpoint: req.path,
    method: req.method,
    timestamp: new Date(),
    clientIP: req.ip,
    userAgent: req.get('User-Agent') || '',
    origin: req.get('Origin') || '',
    signatureVerified: req.signatureVerified || false,
    webhookVerified: req.webhookVerified || false,
    requestId: req.get('X-Request-ID') || crypto.randomUUID(),
  };

  // Add request ID to response headers
  res.set('X-Request-ID', req.apiMetadata.requestId);

  next();
}

/**
 * API response formatting middleware
 */
function formatAPIResponse(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    // Add standard API response format
    if (req.path.startsWith('/api/') && res.statusCode < 400) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;

      const formattedResponse = {
        success: true,
        data: responseData,
        meta: {
          version: req.apiVersion || '1.0',
          timestamp: new Date().toISOString(),
          requestId: req.apiMetadata?.requestId,
        },
      };

      return originalSend.call(this, JSON.stringify(formattedResponse));
    }

    return originalSend.call(this, data);
  };

  next();
}

module.exports = {
  RequestSigner,
  requestSigner,
  requireRequestSigning,
  APIVersionManager,
  apiVersionManager,
  apiVersioning,
  WebhookValidator,
  webhookValidator,
  validateWebhookSignature,
  preventSQLInjection,
  addAPIMetadata,
  formatAPIResponse,
};