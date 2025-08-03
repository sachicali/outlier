const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const JWTUtils = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Authentication controller
 * Handles user registration, login, logout, and token management
 */
class AuthController {
  /**
   * User registration validation rules
   */
  static registerValidation = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('username')
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
  ];

  /**
   * Login validation rules
   */
  static loginValidation = [
    body('identifier')
      .notEmpty()
      .withMessage('Email or username is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ];

  /**
   * Password change validation rules
   */
  static changePasswordValidation = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('confirmNewPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('New password confirmation does not match new password');
        }
        return true;
      }),
  ];

  /**
   * Email validation rules
   */
  static emailValidation = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ];

  /**
   * Token validation rules
   */
  static tokenValidation = [
    body('token')
      .isLength({ min: 32 })
      .matches(/^[a-f0-9]+$/i)
      .withMessage('Valid token is required'),
  ];

  /**
   * Password reset validation rules
   */
  static passwordResetValidation = [
    body('token')
      .isLength({ min: 32 })
      .matches(/^[a-f0-9]+$/i)
      .withMessage('Valid token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('confirmNewPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('New password confirmation does not match new password');
        }
        return true;
      }),
  ];

  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async register(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { email, username, password } = req.body;

      // Register user
      const result = await authService.register({
        email,
        username,
        password,
        role: 'user', // Default role for registration
      });

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`User registered successfully: ${username}`, {
        userId: result.user.id,
        email: result.user.email,
        requiresEmailVerification: result.requiresEmailVerification,
        ip: req.ip,
      });

      const response = {
        message: 'User registered successfully',
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      };

      // Add email verification info if required
      if (result.requiresEmailVerification) {
        response.emailVerification = {
          required: true,
          message: 'Please check your email and click the verification link to complete your account setup',
        };
      }

      res.status(201).json(response);
    } catch (error) {
      logger.error('Registration failed', {
        error: error.message,
        email: req.body.email,
        username: req.body.username,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Registration failed',
        message: error.message,
      });
    }
  }

  /**
   * User login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async login(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { identifier, password, rememberMe } = req.body;

      // Authenticate user
      const result = await authService.login({ identifier, password });

      // Set cookie expiration based on remember me option
      const cookieMaxAge = rememberMe ?
        30 * 24 * 60 * 60 * 1000 : // 30 days
        7 * 24 * 60 * 60 * 1000;   // 7 days

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge,
      });

      logger.info(`User logged in successfully: ${result.user.username}`, {
        userId: result.user.id,
        email: result.user.email,
        requiresEmailVerification: result.requiresEmailVerification,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response = {
        message: 'Login successful',
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      };

      // Add email verification warning if required
      if (result.requiresEmailVerification) {
        response.emailVerification = {
          required: true,
          message: 'Please verify your email address for full access to features',
        };
      }

      res.json(response);
    } catch (error) {
      logger.warn('Login attempt failed', {
        error: error.message,
        identifier: req.body.identifier,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Use generic error message to prevent user enumeration
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials',
      });
    }
  }

  /**
   * Refresh access token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async refresh(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token required',
          message: 'Refresh token is missing',
        });
      }

      // Refresh tokens
      const result = await authService.refreshToken(refreshToken);

      // Set new refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`Token refreshed successfully: ${result.user.username}`, {
        userId: result.user.id,
        ip: req.ip,
      });

      res.json({
        message: 'Token refreshed successfully',
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      });
    } catch (error) {
      logger.warn('Token refresh failed', {
        error: error.message,
        ip: req.ip,
      });

      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');

      res.status(401).json({
        error: 'Token refresh failed',
        message: error.message,
      });
    }
  }

  /**
   * User logout
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async logout(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;
      const userId = req.user?.id;

      if (userId && refreshToken) {
        await authService.logout(userId, refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      logger.info(`User logged out: ${req.user?.username || 'unknown'}`, {
        userId: userId,
        ip: req.ip,
      });

      res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      // Still clear cookie and return success to avoid confusion
      res.clearCookie('refreshToken');
      res.json({
        message: 'Logout successful',
      });
    }
  }

  /**
   * Logout from all devices
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async logoutAll(req, res) {
    try {
      const userId = req.user.id;

      await authService.logoutAll(userId);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      logger.info(`User logged out from all devices: ${req.user.username}`, {
        userId: userId,
        ip: req.ip,
      });

      res.json({
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      logger.error('Logout all error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Logout failed',
        message: 'An error occurred while logging out',
      });
    }
  }

  /**
   * Confirm email address change
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async confirmEmailChange(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid token format',
          details: errors.array(),
        });
      }

      const { token } = req.body;

      const updatedUser = await authService.confirmEmailChange(token);

      logger.info('Email change confirmed', {
        userId: updatedUser.id,
        newEmail: updatedUser.email,
        ip: req.ip,
      });

      res.json({
        message: 'Email address changed successfully',
        user: updatedUser,
      });
    } catch (error) {
      logger.error('Email change confirmation error', {
        error: error.message,
        token: req.body?.token?.substring(0, 8) + '...',
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Email change failed',
        message: error.message,
      });
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProfile(req, res) {
    try {
      const user = authService.getUserById(req.user.id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User profile not found',
        });
      }

      res.json({
        user: user.toSafeObject(),
      });
    } catch (error) {
      logger.error('Get profile error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Profile retrieval failed',
        message: 'An error occurred while retrieving profile',
      });
    }
  }

  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProfile(req, res) {
    try {
      const { username, email } = req.body;
      const userId = req.user.id;

      const updatedUser = await authService.updateProfile(userId, {
        username,
        email,
      });

      logger.info(`Profile updated: ${req.user.username}`, {
        userId: userId,
        changes: { username, email },
        ip: req.ip,
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      logger.error('Profile update error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Profile update failed',
        message: error.message,
      });
    }
  }

  /**
   * Change user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changePassword(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Prepare security context for notification
      const securityContext = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      };

      await authService.changePassword(userId, currentPassword, newPassword, securityContext);

      // Clear refresh token cookie to force re-login
      res.clearCookie('refreshToken');

      logger.info(`Password changed: ${req.user.username}`, {
        userId: userId,
        ip: req.ip,
      });

      res.json({
        message: 'Password changed successfully. Please log in again.',
      });
    } catch (error) {
      logger.error('Password change error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Password change failed',
        message: error.message,
      });
    }
  }

  /**
   * Verify token endpoint (for client-side token validation)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async verifyToken(req, res) {
    try {
      // If we reach here, the token is valid (middleware already verified it)
      res.json({
        valid: true,
        user: req.user,
        expiresIn: JWTUtils.getTimeUntilExpiration(
          JWTUtils.extractTokenFromHeader(req.headers.authorization),
        ),
      });
    } catch (error) {
      res.status(401).json({
        valid: false,
        error: 'Token verification failed',
        message: error.message,
      });
    }
  }

  /**
   * Get authentication status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAuthStatus(req, res) {
    try {
      if (req.user) {
        res.json({
          authenticated: true,
          user: req.user,
          authMethod: req.authMethod,
        });
      } else {
        res.json({
          authenticated: false,
          user: null,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Status check failed',
        message: 'An error occurred while checking authentication status',
      });
    }
  }

  /**
   * Verify email with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async verifyEmail(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { token } = req.body;

      // Verify email
      const user = await authService.verifyEmail(token);

      logger.info(`Email verified successfully: ${user.email}`, {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        message: 'Email verified successfully',
        user: user,
      });
    } catch (error) {
      logger.warn('Email verification failed', {
        error: error.message,
        token: req.body.token,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Email verification failed',
        message: error.message,
      });
    }
  }

  /**
   * Resend verification email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resendVerificationEmail(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { email } = req.body;

      // Resend verification email
      const result = await authService.resendVerificationEmail(email);

      logger.info(`Verification email resent: ${email}`, {
        email: email,
        ip: req.ip,
      });

      res.json(result);
    } catch (error) {
      logger.warn('Resend verification email failed', {
        error: error.message,
        email: req.body.email,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Resend verification failed',
        message: error.message,
      });
    }
  }

  /**
   * Request password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async requestPasswordReset(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { email } = req.body;

      // Request password reset
      const result = await authService.requestPasswordReset(email);

      logger.info(`Password reset requested: ${email}`, {
        email: email,
        ip: req.ip,
      });

      // Always return success message for security (don't reveal if user exists)
      res.json(result);
    } catch (error) {
      logger.warn('Password reset request failed', {
        error: error.message,
        email: req.body.email,
        ip: req.ip,
      });

      // Return generic message for security
      res.json({
        message: 'If an account with this email exists, a password reset link has been sent',
        email: req.body.email,
      });
    }
  }

  /**
   * Reset password with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resetPassword(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: errors.array(),
        });
      }

      const { token, newPassword } = req.body;

      // Reset password
      const result = await authService.resetPassword(token, newPassword);

      logger.info(`Password reset successfully: ${result.user.email}`, {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip,
      });

      res.json({
        message: result.message,
        user: result.user,
      });
    } catch (error) {
      logger.warn('Password reset failed', {
        error: error.message,
        token: req.body.token,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'Password reset failed',
        message: error.message,
      });
    }
  }
}

module.exports = AuthController;