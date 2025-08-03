const { body, param, query, validationResult } = require('express-validator');
const { sanitize } = require('express-validator');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Input Validation and Sanitization Middleware
 * Provides comprehensive validation rules and sanitization for all API endpoints
 */

// Common validation patterns
const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,30}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  apiKeyName: /^[a-zA-Z0-9_-]{1,50}$/,
  channelId: /^UC[a-zA-Z0-9_-]{22}$/,
  videoId: /^[a-zA-Z0-9_-]{11}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
};

// Rate limiting for validation endpoints (prevent abuse)
const validationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 validation requests per minute
  message: {
    error: 'Too many validation requests',
    message: 'Please slow down and try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware to handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Log validation failures for security monitoring
    logger.warn('Input validation failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      errors: errors.array(),
      userId: req.user?.id,
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
}

/**
 * Common sanitization middleware
 */
const commonSanitizers = [
  // Trim whitespace
  body('*').trim(),
  // Escape HTML entities to prevent XSS
  body('*').escape(),
  // Normalize email
  body('email').normalizeEmail().optional(),
  // Remove null bytes
  body('*').customSanitizer(value => {
    if (typeof value === 'string') {
      return value.replace(/\0/g, '');
    }
    return value;
  }),
];

/**
 * Authentication validation rules
 */
const authValidation = {
  register: [
    validationRateLimit,
    ...commonSanitizers,
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(VALIDATION_PATTERNS.username)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .custom(async (value) => {
        // Additional check for reserved usernames
        const reserved = ['admin', 'root', 'system', 'api', 'null', 'undefined'];
        if (reserved.includes(value.toLowerCase())) {
          throw new Error('Username is reserved');
        }
        return true;
      }),

    body('email')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail()
      .isLength({ max: 254 })
      .withMessage('Email is too long'),

    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),

    handleValidationErrors,
  ],

  login: [
    validationRateLimit,
    ...commonSanitizers,
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ max: 254 })
      .withMessage('Username is too long'),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ max: 128 })
      .withMessage('Password is too long'),

    handleValidationErrors,
  ],

  changePassword: [
    ...commonSanitizers,
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),

    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('New password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

    body('confirmNewPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      }),

    handleValidationErrors,
  ],
};

/**
 * API Key validation rules
 */
const apiKeyValidation = {
  create: [
    ...commonSanitizers,
    body('name')
      .isLength({ min: 1, max: 50 })
      .withMessage('API key name must be between 1 and 50 characters')
      .matches(VALIDATION_PATTERNS.apiKeyName)
      .withMessage('API key name can only contain letters, numbers, hyphens, and underscores'),

    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters'),

    body('scopes')
      .isArray({ min: 1 })
      .withMessage('At least one scope is required')
      .custom((scopes) => {
        const validScopes = ['read', 'write', 'admin'];
        const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
        if (invalidScopes.length > 0) {
          throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
        }
        return true;
      }),

    body('rateLimit')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Rate limit must be between 1 and 10000 requests per hour'),

    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiration date must be a valid ISO 8601 date')
      .custom((value) => {
        const expiryDate = new Date(value);
        const now = new Date();
        if (expiryDate <= now) {
          throw new Error('Expiration date must be in the future');
        }
        return true;
      }),

    handleValidationErrors,
  ],

  update: [
    ...commonSanitizers,
    param('keyId')
      .matches(VALIDATION_PATTERNS.uuid)
      .withMessage('Invalid API key ID format'),

    body('name')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('API key name must be between 1 and 50 characters')
      .matches(VALIDATION_PATTERNS.apiKeyName)
      .withMessage('API key name can only contain letters, numbers, hyphens, and underscores'),

    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters'),

    body('scopes')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one scope is required')
      .custom((scopes) => {
        const validScopes = ['read', 'write', 'admin'];
        const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
        if (invalidScopes.length > 0) {
          throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
        }
        return true;
      }),

    body('rateLimit')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Rate limit must be between 1 and 10000 requests per hour'),

    handleValidationErrors,
  ],
};

/**
 * Outlier analysis validation rules
 */
const outlierValidation = {
  start: [
    ...commonSanitizers,
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Analysis name must be between 1 and 100 characters'),

    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    body('exclusionChannels')
      .isArray()
      .withMessage('Exclusion channels must be an array')
      .custom((channels) => {
        if (channels.length > 100) {
          throw new Error('Cannot exclude more than 100 channels');
        }
        const invalidChannels = channels.filter(channel =>
          typeof channel !== 'string' || !VALIDATION_PATTERNS.channelId.test(channel),
        );
        if (invalidChannels.length > 0) {
          throw new Error('All channel IDs must be valid YouTube channel IDs');
        }
        return true;
      }),

    body('minSubs')
      .isInt({ min: 1000, max: 100000000 })
      .withMessage('Minimum subscribers must be between 1,000 and 100,000,000'),

    body('maxSubs')
      .isInt({ min: 10000, max: 100000000 })
      .withMessage('Maximum subscribers must be between 10,000 and 100,000,000')
      .custom((value, { req }) => {
        if (value <= req.body.minSubs) {
          throw new Error('Maximum subscribers must be greater than minimum subscribers');
        }
        return true;
      }),

    body('timeWindow')
      .isInt({ min: 1, max: 30 })
      .withMessage('Time window must be between 1 and 30 days'),

    body('outlierThreshold')
      .isInt({ min: 10, max: 100 })
      .withMessage('Outlier threshold must be between 10 and 100'),

    body('maxResults')
      .optional()
      .isInt({ min: 10, max: 1000 })
      .withMessage('Maximum results must be between 10 and 1000'),

    handleValidationErrors,
  ],

  status: [
    param('analysisId')
      .matches(VALIDATION_PATTERNS.uuid)
      .withMessage('Invalid analysis ID format'),

    handleValidationErrors,
  ],

  results: [
    param('analysisId')
      .matches(VALIDATION_PATTERNS.uuid)
      .withMessage('Invalid analysis ID format'),

    query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be either json or csv'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),

    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),

    handleValidationErrors,
  ],
};

/**
 * Channel validation rules
 */
const channelValidation = {
  add: [
    ...commonSanitizers,
    body('channelId')
      .matches(VALIDATION_PATTERNS.channelId)
      .withMessage('Invalid YouTube channel ID format'),

    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Channel name must be between 1 and 100 characters'),

    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => {
        if (tags.length > 20) {
          throw new Error('Cannot have more than 20 tags');
        }
        const invalidTags = tags.filter(tag =>
          typeof tag !== 'string' || tag.length < 1 || tag.length > 50,
        );
        if (invalidTags.length > 0) {
          throw new Error('All tags must be strings between 1 and 50 characters');
        }
        return true;
      }),

    handleValidationErrors,
  ],

  update: [
    ...commonSanitizers,
    param('channelId')
      .matches(VALIDATION_PATTERNS.channelId)
      .withMessage('Invalid YouTube channel ID format'),

    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Channel name must be between 1 and 100 characters'),

    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => {
        if (tags.length > 20) {
          throw new Error('Cannot have more than 20 tags');
        }
        const invalidTags = tags.filter(tag =>
          typeof tag !== 'string' || tag.length < 1 || tag.length > 50,
        );
        if (invalidTags.length > 0) {
          throw new Error('All tags must be strings between 1 and 50 characters');
        }
        return true;
      }),

    handleValidationErrors,
  ],
};

/**
 * Request size limiting middleware
 */
function requestSizeLimit(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length'), 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength && contentLength > maxBytes) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        contentLength,
        maxBytes,
        userId: req.user?.id,
      });

      return res.status(413).json({
        success: false,
        error: 'Request too large',
        message: `Request size exceeds ${maxSize} limit`,
      });
    }

    next();
  };
}

/**
 * Content type validation middleware
 */
function validateContentType(allowedTypes = ['application/json']) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.get('Content-Type');
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing Content-Type header',
      });
    }

    const baseType = contentType.split(';')[0].trim();
    if (!allowedTypes.includes(baseType)) {
      logger.warn('Invalid content type', {
        ip: req.ip,
        contentType,
        allowedTypes,
        path: req.path,
        userId: req.user?.id,
      });

      return res.status(415).json({
        success: false,
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Utility function to parse size strings like '10mb'
 */
function parseSize(size) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toString().toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const [, number, unit = 'b'] = match;
  return parseInt(number, 10) * units[unit];
}

/**
 * XSS protection middleware for user-generated content
 */
function xssProtection(req, res, next) {
  // Check for potential XSS patterns in request body
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  ];

  function checkForXSS(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            logger.warn('Potential XSS attempt detected', {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              path: req.path,
              field: currentPath,
              value: value.substring(0, 100), // Log first 100 chars
              userId: req.user?.id,
            });

            return res.status(400).json({
              success: false,
              error: 'Invalid input detected',
              message: 'Request contains potentially dangerous content',
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForXSS(value, currentPath);
        if (result) return result;
      }
    }
  }

  if (req.body && typeof req.body === 'object') {
    const xssResult = checkForXSS(req.body);
    if (xssResult) return xssResult;
  }

  next();
}

module.exports = {
  authValidation,
  apiKeyValidation,
  outlierValidation,
  channelValidation,
  handleValidationErrors,
  requestSizeLimit,
  validateContentType,
  xssProtection,
  validationRateLimit,
  VALIDATION_PATTERNS,
};