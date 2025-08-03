/**
 * Custom error classes for better error handling and categorization
 */

class BaseError extends Error {
  constructor(message, statusCode = 500, isOperational = true, errorCode = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
    };
  }
}

class YouTubeAPIError extends BaseError {
  constructor(message, details = {}) {
    let statusCode = 500;
    let errorCode = 'YOUTUBE_API_ERROR';

    // Handle specific YouTube API error codes
    if (details.code === 403) {
      if (message.includes('quota')) {
        statusCode = 429;
        errorCode = 'YOUTUBE_QUOTA_EXCEEDED';
        message = 'YouTube API quota exceeded. Please try again later.';
      } else if (message.includes('key')) {
        statusCode = 401;
        errorCode = 'YOUTUBE_INVALID_KEY';
        message = 'Invalid YouTube API key provided.';
      } else {
        statusCode = 403;
        errorCode = 'YOUTUBE_FORBIDDEN';
        message = 'YouTube API access forbidden.';
      }
    } else if (details.code === 400) {
      statusCode = 400;
      errorCode = 'YOUTUBE_BAD_REQUEST';
      message = 'Invalid request to YouTube API.';
    } else if (details.code === 404) {
      statusCode = 404;
      errorCode = 'YOUTUBE_NOT_FOUND';
      message = 'Requested YouTube resource not found.';
    }

    super(message, statusCode, true, errorCode);
    this.details = details;
    this.retryable = this.isRetryable();
  }

  isRetryable() {
    return ['YOUTUBE_QUOTA_EXCEEDED', 'YOUTUBE_API_ERROR'].includes(this.errorCode) &&
           this.statusCode >= 500;
  }
}

class ValidationError extends BaseError {
  constructor(message, field = null, value = null) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

class NetworkError extends BaseError {
  constructor(message, originalError = null) {
    let errorCode = 'NETWORK_ERROR';
    let statusCode = 503;

    if (originalError) {
      if (originalError.code === 'ECONNREFUSED') {
        errorCode = 'CONNECTION_REFUSED';
        message = 'Unable to connect to external service.';
      } else if (originalError.code === 'ETIMEDOUT') {
        errorCode = 'CONNECTION_TIMEOUT';
        message = 'Request timed out. Please try again.';
      } else if (originalError.code === 'ENOTFOUND') {
        errorCode = 'DNS_ERROR';
        message = 'Service temporarily unavailable.';
      }
    }

    super(message, statusCode, true, errorCode);
    this.originalError = originalError;
    this.retryable = true;
  }
}

class RateLimitError extends BaseError {
  constructor(message = 'Rate limit exceeded. Please slow down your requests.', retryAfter = null) {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
    this.retryable = true;
  }
}

class DatabaseError extends BaseError {
  constructor(message, operation = null) {
    super(message, 503, true, 'DATABASE_ERROR');
    this.operation = operation;
    this.retryable = true;
  }
}

class AuthenticationError extends BaseError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.retryable = false;
  }
}

class AuthorizationError extends BaseError {
  constructor(message = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.retryable = false;
  }
}

class NotFoundError extends BaseError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
    this.resource = resource;
    this.retryable = false;
  }
}

class AnalysisError extends BaseError {
  constructor(message, analysisId = null) {
    super(message, 500, true, 'ANALYSIS_ERROR');
    this.analysisId = analysisId;
    this.retryable = false;
  }
}

class ConfigurationError extends BaseError {
  constructor(message) {
    super(message, 500, false, 'CONFIGURATION_ERROR');
    this.retryable = false;
  }
}

/**
 * Factory function to create appropriate error instances
 */
function createError(type, message, details = {}) {
  switch (type.toLowerCase()) {
  case 'youtube':
  case 'youtube_api':
    return new YouTubeAPIError(message, details);
  case 'validation':
    return new ValidationError(message, details.field, details.value);
  case 'network':
    return new NetworkError(message, details.originalError);
  case 'rate_limit':
    return new RateLimitError(message, details.retryAfter);
  case 'database':
    return new DatabaseError(message, details.operation);
  case 'authentication':
    return new AuthenticationError(message);
  case 'authorization':
    return new AuthorizationError(message);
  case 'not_found':
    return new NotFoundError(details.resource || 'Resource');
  case 'analysis':
    return new AnalysisError(message, details.analysisId);
  case 'configuration':
    return new ConfigurationError(message);
  default:
    return new BaseError(message, details.statusCode, details.isOperational, details.errorCode);
  }
}

/**
 * Check if an error is operational (expected) vs programming error
 */
function isOperationalError(error) {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

module.exports = {
  BaseError,
  YouTubeAPIError,
  ValidationError,
  NetworkError,
  RateLimitError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  AnalysisError,
  ConfigurationError,
  createError,
  isOperationalError,
};