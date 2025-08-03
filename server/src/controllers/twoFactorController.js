const { body, validationResult } = require('express-validator');
const twoFactorService = require('../services/twoFactorService');
const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * Two-Factor Authentication Controller
 * Handles 2FA setup, verification, and management
 */
class TwoFactorController {
  /**
   * Generate 2FA setup data (QR code and secret)
   * @route POST /api/auth/2fa/setup
   * @access Private
   */
  static async setupGenerate(req, res) {
    try {
      const userId = req.user.userId;
      const user = authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.hasTwoFactorEnabled && user.hasTwoFactorEnabled()) {
        return res.status(400).json({
          success: false,
          message: '2FA is already enabled for this account',
        });
      }

      // Generate setup data
      const setupData = await twoFactorService.generateSetupData(user.email, user.username);

      res.json({
        success: true,
        data: {
          qrCode: setupData.qrCode,
          manualEntryKey: setupData.manualEntryKey,
          appName: process.env.APP_NAME || 'YouTube Outlier Discovery',
        },
        message: 'Scan the QR code with your authenticator app',
      });
    } catch (error) {
      logger.error('2FA setup generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate 2FA setup data',
      });
    }
  }

  /**
   * Verify and enable 2FA
   * @route POST /api/auth/2fa/verify-and-enable
   * @access Private
   */
  static async verifyAndEnable(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { token, secret } = req.body;
      const userId = req.user.userId;
      const user = authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.hasTwoFactorEnabled && user.hasTwoFactorEnabled()) {
        return res.status(400).json({
          success: false,
          message: '2FA is already enabled for this account',
        });
      }

      // Verify the TOTP token
      const isValidToken = twoFactorService.verifyToken(token, secret);
      if (!isValidToken) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Please try again.',
        });
      }

      // Generate backup codes
      const backupCodes = twoFactorService.generateBackupCodes(10);
      const hashedBackupCodes = backupCodes.map(code => twoFactorService.hashBackupCode(code));

      // Encrypt and store the secret
      const encryptedSecret = twoFactorService.encrypt(secret);

      // Enable 2FA for user
      if (user.enableTwoFactor) {
        await user.enableTwoFactor(encryptedSecret, hashedBackupCodes);
      } else {
        // Fallback for in-memory user model
        user.twoFactorSecret = encryptedSecret;
        user.twoFactorEnabled = true;
        user.backupCodes = hashedBackupCodes;
        user.twoFactorEnabledAt = new Date();
        user.updatedAt = new Date();
      }

      // Format backup codes for display
      const formattedBackupCodes = twoFactorService.formatBackupCodes(backupCodes);

      logger.info(`2FA enabled for user: ${user.email}`);

      res.json({
        success: true,
        data: {
          backupCodes: formattedBackupCodes,
          user: user.toSafeObject(),
        },
        message: '2FA has been successfully enabled. Save these backup codes in a secure location.',
      });
    } catch (error) {
      logger.error('2FA enable error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to enable 2FA',
      });
    }
  }

  /**
   * Verify 2FA token during login
   * @route POST /api/auth/2fa/verify
   * @access Public (but requires valid user context)
   */
  static async verify(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { token, identifier, isBackupCode = false } = req.body;

      // Find user by email or username
      const user = Array.from(authService.users.values()).find(
        user => user.email === identifier || user.username === identifier,
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.hasTwoFactorEnabled || !user.hasTwoFactorEnabled()) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled for this account',
        });
      }

      let isValid = false;
      let usedBackupCode = false;
      let backupCodeIndex = -1;

      if (isBackupCode) {
        // Verify backup code
        const sanitizedCode = twoFactorService.sanitizeBackupCode(token);
        const backupCodes = user.backupCodes || [];
        const verification = twoFactorService.verifyBackupCode(sanitizedCode, backupCodes);
        
        if (verification.isValid) {
          isValid = true;
          usedBackupCode = true;
          backupCodeIndex = verification.index;

          // Remove used backup code
          if (user.removeBackupCode) {
            await user.removeBackupCode(backupCodeIndex);
          } else {
            // Fallback for in-memory model
            user.backupCodes.splice(backupCodeIndex, 1);
          }

          logger.info(`Backup code used for user: ${user.email}, remaining: ${user.backupCodes.length}`);
        }
      } else {
        // Verify TOTP token
        const secret = user.getDecryptedSecret 
          ? user.getDecryptedSecret(twoFactorService.decrypt.bind(twoFactorService))
          : twoFactorService.decrypt(user.twoFactorSecret);

        if (secret) {
          isValid = twoFactorService.verifyToken(token, secret);
        }
      }

      if (!isValid) {
        const remainingLockout = twoFactorService.getRemainingLockoutTime(user.id);
        return res.status(400).json({
          success: false,
          message: remainingLockout > 0 
            ? `Too many failed attempts. Try again in ${Math.ceil(remainingLockout / 1000)} seconds.`
            : 'Invalid verification code. Please try again.',
          remainingLockout,
        });
      }

      // Generate tokens for successful 2FA verification
      const { accessToken, refreshToken } = authService.generateTokens(user);
      user.addRefreshToken(refreshToken);
      user.updateLastLogin();

      res.json({
        success: true,
        data: {
          user: user.toSafeObject(),
          accessToken,
          refreshToken,
          usedBackupCode,
          remainingBackupCodes: user.getBackupCodesCount ? user.getBackupCodesCount() : user.backupCodes.length,
        },
        message: usedBackupCode 
          ? 'Login successful with backup code' 
          : 'Login successful with 2FA verification',
      });
    } catch (error) {
      logger.error('2FA verification error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify 2FA code',
      });
    }
  }

  /**
   * Disable 2FA (requires password confirmation)
   * @route POST /api/auth/2fa/disable
   * @access Private
   */
  static async disable(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { password } = req.body;
      const userId = req.user.userId;
      const user = authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.hasTwoFactorEnabled || !user.hasTwoFactorEnabled()) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled for this account',
        });
      }

      // Verify password
      const isValidPassword = await user.verifyPassword
        ? await user.verifyPassword(password)
        : await authService.constructor.verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Invalid password',
        });
      }

      // Disable 2FA
      if (user.disableTwoFactor) {
        await user.disableTwoFactor();
      } else {
        // Fallback for in-memory model
        user.twoFactorSecret = null;
        user.twoFactorEnabled = false;
        user.backupCodes = [];
        user.twoFactorEnabledAt = null;
        user.updatedAt = new Date();
      }

      logger.info(`2FA disabled for user: ${user.email}`);

      res.json({
        success: true,
        data: {
          user: user.toSafeObject(),
        },
        message: '2FA has been successfully disabled',
      });
    } catch (error) {
      logger.error('2FA disable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
      });
    }
  }

  /**
   * Regenerate backup codes
   * @route POST /api/auth/2fa/regenerate-backup-codes
   * @access Private
   */
  static async regenerateBackupCodes(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { password } = req.body;
      const userId = req.user.userId;
      const user = authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.hasTwoFactorEnabled || !user.hasTwoFactorEnabled()) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled for this account',
        });
      }

      // Verify password
      const isValidPassword = await user.verifyPassword
        ? await user.verifyPassword(password)
        : await authService.constructor.verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Invalid password',
        });
      }

      // Generate new backup codes
      const backupCodes = twoFactorService.generateBackupCodes(10);
      const hashedBackupCodes = backupCodes.map(code => twoFactorService.hashBackupCode(code));

      // Update backup codes
      if (user.updateBackupCodes) {
        await user.updateBackupCodes(hashedBackupCodes);
      } else {
        // Fallback for in-memory model
        user.backupCodes = hashedBackupCodes;
        user.backupCodesGeneratedAt = new Date();
        user.updatedAt = new Date();
      }

      // Format backup codes for display
      const formattedBackupCodes = twoFactorService.formatBackupCodes(backupCodes);

      logger.info(`Backup codes regenerated for user: ${user.email}`);

      res.json({
        success: true,
        data: {
          backupCodes: formattedBackupCodes,
          user: user.toSafeObject(),
        },
        message: 'New backup codes have been generated. Save them in a secure location.',
      });
    } catch (error) {
      logger.error('2FA backup codes regeneration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to regenerate backup codes',
      });
    }
  }

  /**
   * Get 2FA status for current user
   * @route GET /api/auth/2fa/status
   * @access Private
   */
  static async getStatus(req, res) {
    try {
      const userId = req.user.userId;
      const user = authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const has2FA = user.hasTwoFactorEnabled ? user.hasTwoFactorEnabled() : !!user.twoFactorEnabled;
      const backupCodesCount = user.getBackupCodesCount 
        ? user.getBackupCodesCount() 
        : (user.backupCodes ? user.backupCodes.length : 0);

      res.json({
        success: true,
        data: {
          enabled: has2FA,
          enabledAt: user.twoFactorEnabledAt || user.two_factor_enabled_at,
          backupCodesCount,
          hasBackupCodes: backupCodesCount > 0,
        },
      });
    } catch (error) {
      logger.error('2FA status check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get 2FA status',
      });
    }
  }

  /**
   * Validation middleware for 2FA operations
   */
  static setupValidation = [
    // No specific validation needed for setup generation
  ];

  static verifyAndEnableValidation = [
    body('token')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('Token must be a 6-digit number'),
    body('secret')
      .isLength({ min: 16, max: 64 })
      .isAlphanumeric()
      .withMessage('Invalid secret format'),
  ];

  static verifyValidation = [
    body('token')
      .notEmpty()
      .withMessage('Verification code is required')
      .custom((value, { req }) => {
        if (req.body.isBackupCode) {
          // Backup code validation (8 alphanumeric characters)
          if (!/^[A-F0-9\s-]{8,10}$/i.test(value)) {
            throw new Error('Invalid backup code format');
          }
        } else {
          // TOTP token validation (6 digits)
          if (!/^\d{6}$/.test(value)) {
            throw new Error('TOTP code must be 6 digits');
          }
        }
        return true;
      }),
    body('identifier')
      .notEmpty()
      .withMessage('User identifier (email or username) is required'),
    body('isBackupCode')
      .optional()
      .isBoolean()
      .withMessage('isBackupCode must be a boolean'),
  ];

  static disableValidation = [
    body('password')
      .notEmpty()
      .withMessage('Password is required to disable 2FA'),
  ];

  static regenerateBackupCodesValidation = [
    body('password')
      .notEmpty()
      .withMessage('Password is required to regenerate backup codes'),
  ];
}

module.exports = TwoFactorController;