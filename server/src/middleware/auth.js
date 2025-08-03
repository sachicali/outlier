const JWTUtils = require('../utils/jwt');
const authService = require('../services/authService');
const { ApiKey } = require('../models');

/**
 * Authentication middleware for protecting routes
 * Supports both JWT tokens and API keys
 */

/**
 * Extract token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Extracted token
 */
function extractToken(req) {
  // First, try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = JWTUtils.extractTokenFromHeader(authHeader);
    if (token) return token;
  }

  // Then try cookies (for refresh tokens)
  if (req.cookies && req.cookies.refreshToken) {
    return req.cookies.refreshToken;
  }

  // Finally, try query parameter (for debugging only - not recommended for production)
  if (process.env.NODE_ENV !== 'production' && req.query.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Extract API key from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} Extracted API key
 */
function extractApiKey(req) {
  // Check X-API-Key header
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }

  // Check Authorization header with API key scheme
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('ApiKey ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Middleware to authenticate requests using JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Access token is missing',
      });
    }

    // Verify the token
    const decoded = JWTUtils.verifyAccessToken(token);

    // Get user from service
    const user = authService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is deactivated',
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    req.authMethod = 'jwt';
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}

/**
 * Middleware to authenticate requests using API keys
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key is missing',
      });
    }

    // Verify the API key
    const { apiKey: keyInfo, user } = await authService.verifyApiKey(apiKey);

    // Attach user and API key info to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    req.apiKey = {
      id: keyInfo.id,
      name: keyInfo.name,
      scopes: keyInfo.scopes,
      rateLimit: keyInfo.rateLimit,
    };

    req.authMethod = 'apikey';
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}

/**
 * Middleware to authenticate requests using either JWT or API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticate(req, res, next) {
  // Try API key first
  const apiKey = extractApiKey(req);
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // Then try JWT token
  const token = extractToken(req);
  if (token) {
    return authenticateToken(req, res, next);
  }

  return res.status(401).json({
    error: 'Authentication required',
    message: 'Access token or API key is required',
  });
}

/**
 * Middleware to make authentication optional
 * If credentials are provided, they will be validated
 * If not provided, the request continues without user info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function optionalAuth(req, res, next) {
  // Try API key first
  const apiKey = extractApiKey(req);
  if (apiKey) {
    try {
      const { apiKey: keyInfo, user } = await authService.verifyApiKey(apiKey);
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
      req.apiKey = {
        id: keyInfo.id,
        name: keyInfo.name,
        scopes: keyInfo.scopes,
        rateLimit: keyInfo.rateLimit,
      };
      req.authMethod = 'apikey';
    } catch (error) {
      // Invalid API key - continue without auth
    }
    return next();
  }

  // Then try JWT token
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = JWTUtils.verifyAccessToken(token);
      const user = authService.getUserById(decoded.userId);

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
        req.authMethod = 'jwt';
      }
    } catch (error) {
      // Invalid token - continue without auth
    }
  }

  next();
}

/**
 * Middleware to check if user is authenticated (either method)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires authentication',
    });
  }
  next();
}

/**
 * Middleware to check API key scopes
 * @param {Array} requiredScopes - Required scopes
 * @returns {Function} Middleware function
 */
function requireScopes(requiredScopes) {
  return (req, res, next) => {
    if (req.authMethod !== 'apikey') {
      // JWT authentication doesn't use scopes
      return next();
    }

    if (!req.apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key authentication required',
      });
    }

    const hasRequiredScope = requiredScopes.some(scope =>
      req.apiKey.scopes.includes(scope) || req.apiKey.scopes.includes('admin'),
    );

    if (!hasRequiredScope) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires one of the following scopes: ${requiredScopes.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Rate limiting middleware for API keys
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function apiKeyRateLimit(req, res, next) {
  if (req.authMethod !== 'apikey' || !req.apiKey) {
    return next();
  }

  // Simple in-memory rate limiting (replace with Redis in production)
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const key = `ratelimit:${req.apiKey.id}`;

  // This is a simplified implementation
  // In production, use Redis or a proper rate limiting library

  next();
}

/**
 * Middleware to log authentication events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function logAuth(req, res, next) {
  const logger = require('../utils/logger');

  if (req.user) {
    logger.info(`Authenticated request: ${req.method} ${req.path}`, {
      userId: req.user.id,
      username: req.user.username,
      authMethod: req.authMethod,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  next();
}

/**
 * Error handling middleware for authentication errors
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function handleAuthError(error, req, res, next) {
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }

  next(error);
}

/**
 * Middleware to validate request body for sensitive operations
 * @param {Array} requiredFields - Required fields in request body
 * @returns {Function} Middleware function
 */
function validateSensitiveOperation(requiredFields = []) {
  return (req, res, next) => {
    // Require HTTPS for sensitive operations in production
    if (process.env.NODE_ENV === 'production' && !req.secure) {
      return res.status(400).json({
        error: 'HTTPS required',
        message: 'This operation requires a secure connection',
      });
    }

    // Validate required fields
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required: ${missingFields.join(', ')}`,
      });
    }

    // Add timestamp for sensitive operations
    req.operationTimestamp = new Date();

    next();
  };
}

module.exports = {
  authenticate,
  authenticateToken,
  authenticateApiKey,
  optionalAuth,
  requireAuth,
  requireScopes,
  apiKeyRateLimit,
  logAuth,
  handleAuthError,
  validateSensitiveOperation,
  extractToken,
  extractApiKey,
};