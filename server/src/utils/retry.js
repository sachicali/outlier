const logger = require('./logger');

/**
 * Retry utility with exponential backoff and jitter
 */
class RetryManager {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelay = options.baseDelay || 1000; // Base delay in ms
    this.maxDelay = options.maxDelay || 30000; // Max delay in ms
    this.exponentialBase = options.exponentialBase || 2;
    this.jitter = options.jitter !== false; // Add jitter by default
    this.retryCondition = options.retryCondition || this.defaultRetryCondition;
  }

  /**
   * Default retry condition - retry on retryable errors and network errors
   */
  defaultRetryCondition(error) {
    // Don't retry on client errors (4xx) except specific cases
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return ['RATE_LIMIT_EXCEEDED', 'YOUTUBE_QUOTA_EXCEEDED'].includes(error.errorCode);
    }

    // Retry on server errors (5xx) and network issues
    if (error.statusCode >= 500 || error.retryable === true) {
      return true;
    }

    // Retry on specific network error codes
    const retryableNetworkCodes = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
      'EAI_AGAIN', 'EPIPE', 'ECONNABORTED',
    ];

    return retryableNetworkCodes.includes(error.code);
  }

  /**
   * Calculate delay for retry attempt with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.exponentialBase, attempt - 1);
    let delay = Math.min(exponentialDelay, this.maxDelay);

    if (this.jitter) {
      // Add random jitter to prevent thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, context = {}) {
    let lastError;
    const { correlationId = 'unknown', operation = 'unknown' } = context;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        logger.debug({
          message: `Attempting ${operation}`,
          correlationId,
          attempt,
          maxAttempts: this.maxAttempts,
        });

        const result = await fn();

        if (attempt > 1) {
          logger.info({
            message: `${operation} succeeded after retry`,
            correlationId,
            attempt,
            maxAttempts: this.maxAttempts,
          });
        }

        return result;

      } catch (error) {
        lastError = error;

        logger.warn({
          message: `${operation} failed on attempt ${attempt}`,
          correlationId,
          attempt,
          maxAttempts: this.maxAttempts,
          error: error.message,
          errorCode: error.errorCode,
          statusCode: error.statusCode,
        });

        // Don't retry if this is the last attempt
        if (attempt === this.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.retryCondition(error)) {
          logger.warn({
            message: `${operation} failed with non-retryable error`,
            correlationId,
            error: error.message,
            errorCode: error.errorCode,
          });
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);

        logger.info({
          message: `Retrying ${operation} in ${delay}ms`,
          correlationId,
          attempt,
          delay,
          nextAttempt: attempt + 1,
        });

        await this.sleep(delay);
      }
    }

    // All attempts failed
    logger.error({
      message: `${operation} failed after ${this.maxAttempts} attempts`,
      correlationId,
      finalError: lastError.message,
      errorCode: lastError.errorCode,
    });

    throw lastError;
  }
}

/**
 * Create retry manager with specific configurations
 */
const createRetryManager = (options) => new RetryManager(options);

/**
 * Predefined retry managers for different scenarios
 */
const retryManagers = {
  // For API calls that might hit rate limits
  api: new RetryManager({
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    exponentialBase: 2,
  }),

  // For database operations
  database: new RetryManager({
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    exponentialBase: 2,
  }),

  // For YouTube API calls (more aggressive due to quotas)
  youtube: new RetryManager({
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 120000, // 2 minutes max
    exponentialBase: 3,
    retryCondition: (error) => {
      // Special handling for YouTube API
      if (error.errorCode === 'YOUTUBE_QUOTA_EXCEEDED') {
        return true; // Always retry quota errors
      }
      if (error.errorCode === 'YOUTUBE_INVALID_KEY') {
        return false; // Never retry invalid key
      }
      if (error.statusCode >= 500) {
        return true; // Retry server errors
      }
      return error.retryable === true;
    },
  }),

  // For network operations
  network: new RetryManager({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBase: 2,
  }),
};

/**
 * Convenience function to retry an operation
 */
async function withRetry(operation, options = {}) {
  const { type = 'api', ...retryOptions } = options;

  let retryManager;
  if (retryManagers[type]) {
    retryManager = retryManagers[type];
  } else {
    retryManager = createRetryManager(retryOptions);
  }

  return retryManager.execute(operation, options);
}

module.exports = {
  RetryManager,
  createRetryManager,
  retryManagers,
  withRetry,
};