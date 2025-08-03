const logger = require('../utils/logger');
const { isOperationalError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';

  // Enhanced error logging with correlation ID and structured data
  const errorLog = {
    correlationId,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    errorType: err.constructor.name,
    statusCode: err.statusCode || 500,
    isOperational: isOperationalError(err),
    ...(err.errorCode && { errorCode: err.errorCode }),
    ...(err.details && { details: err.details }),
    ...(req.body && Object.keys(req.body).length > 0 && {
      requestBody: JSON.stringify(req.body).substring(0, 1000), // Limit size
    }),
    ...(req.params && Object.keys(req.params).length > 0 && { params: req.params }),
    ...(req.query && Object.keys(req.query).length > 0 && { query: req.query }),
  };

  // Log at appropriate level based on error type
  if (err.statusCode && err.statusCode < 500) {
    logger.warn(errorLog);
  } else {
    logger.error(errorLog);
  }

  // Default error
  let error = { ...err };
  error.message = err.message;

  // YouTube API errors
  if (err.code === 403 && err.message.includes('quota')) {
    error.message = 'YouTube API quota exceeded. Please try again later.';
    error.statusCode = 429;
  }

  // Rate limit errors
  if (err.code === 'RATE_LIMITED') {
    error.message = 'Rate limit exceeded. Please slow down your requests.';
    error.statusCode = 429;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error.message = 'Invalid input data';
    error.statusCode = 400;
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED') {
    error.message = 'Database connection failed';
    error.statusCode = 503;
  }

  // Enhanced error response with correlation ID
  const response = {
    success: false,
    error: error.message || 'Internal Server Error',
    correlationId,
    timestamp: new Date().toISOString(),
    ...(err.errorCode && { errorCode: err.errorCode }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details,
    }),
  };

  // Add retry information for retryable errors
  if (err.retryable) {
    response.retryable = true;
    if (err.retryAfter) {
      res.set('Retry-After', err.retryAfter);
      response.retryAfter = err.retryAfter;
    }
  }

  res.status(error.statusCode || 500).json(response);
};

module.exports = errorHandler;
