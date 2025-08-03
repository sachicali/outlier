const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to add correlation ID to each request
 * Useful for tracing requests across logs and services
 */
function correlationIdMiddleware(req, res, next) {
  // Generate or use existing correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();

  // Store in request for use in other middleware/routes
  req.correlationId = correlationId;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

module.exports = correlationIdMiddleware;