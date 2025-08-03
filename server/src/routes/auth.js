const express = require('express');
const passport = require('../config/passport');
const AuthController = require('../controllers/authController');
const OAuthController = require('../controllers/oauthController');
const TwoFactorController = require('../controllers/twoFactorController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

/**
 * Authentication routes
 * Handles user registration, login, logout, and profile management
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  AuthController.registerValidation,
  AuthController.register,
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login',
  AuthController.loginValidation,
  AuthController.login,
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post('/refresh', AuthController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Private
 */
router.post('/logout',
  optionalAuth, // Allow logout even with invalid token
  AuthController.logout,
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all',
  authenticate,
  AuthController.logoutAll,
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  AuthController.getProfile,
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  requirePermission('profile:write'),
  AuthController.updateProfile,
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  AuthController.changePasswordValidation,
  requirePermission('profile:write'),
  AuthController.changePassword,
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.get('/verify',
  authenticate,
  AuthController.verifyToken,
);

/**
 * @route   GET /api/auth/status
 * @desc    Get authentication status
 * @access  Public (optional auth)
 */
router.get('/status',
  optionalAuth,
  AuthController.getAuthStatus,
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post('/verify-email',
  AuthController.tokenValidation,
  AuthController.verifyEmail,
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post('/resend-verification',
  AuthController.emailValidation,
  AuthController.resendVerificationEmail,
);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/request-password-reset',
  AuthController.emailValidation,
  AuthController.requestPasswordReset,
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  AuthController.passwordResetValidation,
  AuthController.resetPassword,
);

/**
 * @route   POST /api/auth/confirm-email-change
 * @desc    Confirm email address change with token
 * @access  Public
 */
router.post('/confirm-email-change',
  AuthController.tokenValidation,
  AuthController.confirmEmailChange,
);

/**
 * @route   GET /api/auth/email-verification-status
 * @desc    Get email verification status for current user
 * @access  Private
 */
router.get('/email-verification-status',
  authenticate,
  (req, res) => {
    res.json({
      isEmailVerified: req.user.isEmailVerified,
      emailVerifiedAt: req.user.emailVerifiedAt,
      email: req.user.email,
      requiresVerification: !req.user.isEmailVerified,
    });
  },
);

// OAuth Routes

/**
 * @route   GET /api/auth/oauth/config
 * @desc    Get OAuth provider configuration
 * @access  Public
 */
router.get('/oauth/config', OAuthController.getProviderConfig);

/**
 * @route   GET /api/auth/oauth/connections
 * @desc    Get user's OAuth connections
 * @access  Private
 */
router.get('/oauth/connections',
  authenticate,
  OAuthController.getConnections,
);

/**
 * @route   DELETE /api/auth/oauth/:provider
 * @desc    Unlink OAuth provider
 * @access  Private
 */
router.delete('/oauth/:provider',
  authenticate,
  requirePermission('profile:write'),
  OAuthController.unlinkProvider,
);

// Google OAuth Routes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  /**
   * @route   GET /api/auth/google
   * @desc    Initiate Google OAuth flow
   * @access  Public
   */
  router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }),
  );

  /**
   * @route   GET /api/auth/google/callback
   * @desc    Google OAuth callback
   * @access  Public
   */
  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/api/auth/oauth/failure/google' }),
    OAuthController.handleOAuthCallback,
  );

  /**
   * @route   GET /api/auth/oauth/failure/google
   * @desc    Google OAuth failure callback
   * @access  Public
   */
  router.get('/oauth/failure/google', OAuthController.handleOAuthFailure);
}

// GitHub OAuth Routes
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  /**
   * @route   GET /api/auth/github
   * @desc    Initiate GitHub OAuth flow
   * @access  Public
   */
  router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] }),
  );

  /**
   * @route   GET /api/auth/github/callback
   * @desc    GitHub OAuth callback
   * @access  Public
   */
  router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/api/auth/oauth/failure/github' }),
    OAuthController.handleOAuthCallback,
  );

  /**
   * @route   GET /api/auth/oauth/failure/github
   * @desc    GitHub OAuth failure callback
   * @access  Public
   */
  router.get('/oauth/failure/github', OAuthController.handleOAuthFailure);
}

// Two-Factor Authentication Routes

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Generate 2FA setup data (QR code and secret)
 * @access  Private
 */
router.post('/2fa/setup',
  authenticate,
  requirePermission('profile:write'),
  TwoFactorController.setupValidation,
  TwoFactorController.setupGenerate,
);

/**
 * @route   POST /api/auth/2fa/verify-and-enable
 * @desc    Verify TOTP token and enable 2FA
 * @access  Private
 */
router.post('/2fa/verify-and-enable',
  authenticate,
  requirePermission('profile:write'),
  TwoFactorController.verifyAndEnableValidation,
  TwoFactorController.verifyAndEnable,
);

/**
 * @route   POST /api/auth/2fa/verify
 * @desc    Verify 2FA token during login
 * @access  Public
 */
router.post('/2fa/verify',
  TwoFactorController.verifyValidation,
  TwoFactorController.verify,
);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable 2FA (requires password)
 * @access  Private
 */
router.post('/2fa/disable',
  authenticate,
  requirePermission('profile:write'),
  TwoFactorController.disableValidation,
  TwoFactorController.disable,
);

/**
 * @route   POST /api/auth/2fa/regenerate-backup-codes
 * @desc    Regenerate backup codes
 * @access  Private
 */
router.post('/2fa/regenerate-backup-codes',
  authenticate,
  requirePermission('profile:write'),
  TwoFactorController.regenerateBackupCodesValidation,
  TwoFactorController.regenerateBackupCodes,
);

/**
 * @route   GET /api/auth/2fa/status
 * @desc    Get 2FA status for current user
 * @access  Private
 */
router.get('/2fa/status',
  authenticate,
  TwoFactorController.getStatus,
);

module.exports = router;