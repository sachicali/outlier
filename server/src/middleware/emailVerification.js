const logger = require('../utils/logger');

/**
 * Email verification middleware
 * Enforces email verification for certain protected routes
 */

/**
 * Middleware to require email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireEmailVerification(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
      });
    }

    // Check if email is verified
    if (!req.user.isEmailVerified) {
      logger.warn('Unverified email access attempt', {
        userId: req.user.id,
        email: req.user.email,
        endpoint: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        error: 'Email verification required',
        message: 'Please verify your email address to access this feature',
        requiresEmailVerification: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Email verification middleware error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Verification check failed',
      message: 'An error occurred while checking email verification status',
    });
  }
}

/**
 * Middleware to warn about unverified email (but allow access)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function warnUnverifiedEmail(req, res, next) {
  try {
    // Check if user is authenticated and email is not verified
    if (req.user && !req.user.isEmailVerified) {
      // Add warning to response headers
      res.set('X-Email-Verification-Warning', 'true');
      res.set('X-Email-Verification-Message', 'Please verify your email address for full access to features');
      
      logger.info('Unverified email warning', {
        userId: req.user.id,
        email: req.user.email,
        endpoint: req.path,
        ip: req.ip,
      });
    }

    next();
  } catch (error) {
    // Don't fail the request for warning middleware
    logger.error('Email verification warning middleware error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
    });

    next();
  }
}

/**
 * Middleware to check if email verification is enabled
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function checkEmailVerificationEnabled(req, res, next) {
  // Email verification is always enabled but we can add feature flags here
  const emailVerificationEnabled = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';
  
  if (!emailVerificationEnabled) {
    // Skip email verification if disabled
    return next();
  }

  // Continue to actual verification check
  next();
}

/**
 * Middleware factory to conditionally require email verification
 * @param {boolean} required - Whether email verification is required
 * @returns {Function} Middleware function
 */
function conditionalEmailVerification(required = true) {
  return (req, res, next) => {
    if (required) {
      return requireEmailVerification(req, res, next);
    } else {
      return warnUnverifiedEmail(req, res, next);
    }
  };
}

/**
 * Middleware to add email verification status to response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function addEmailVerificationStatus(req, res, next) {
  try {
    // Wrap the original json method to add verification status
    const originalJson = res.json;
    
    res.json = function(data) {
      if (req.user && typeof data === 'object' && data !== null) {
        // Add email verification status to response data
        if (!data.emailVerificationStatus) {
          data.emailVerificationStatus = {
            isVerified: req.user.isEmailVerified,
            verifiedAt: req.user.emailVerifiedAt,
            requiresVerification: !req.user.isEmailVerified,
          };
        }
      }
      
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    logger.error('Add email verification status middleware error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
    });

    next();
  }
}

/**
 * Get email verification stats for monitoring
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getEmailVerificationStats(req, res) {
  try {
    // This would typically come from a database query
    // For now, return basic stats
    const stats = {
      totalUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
      verificationRate: 0,
    };

    res.json({
      message: 'Email verification statistics',
      stats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Get email verification stats error', {
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Stats retrieval failed',
      message: 'Failed to retrieve email verification statistics',
    });
  }
}

module.exports = {
  requireEmailVerification,
  warnUnverifiedEmail,
  checkEmailVerificationEnabled,
  conditionalEmailVerification,
  addEmailVerificationStatus,
  getEmailVerificationStats,
};