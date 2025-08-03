const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');

/**
 * Two-Factor Authentication Service
 * Implements TOTP-based 2FA with QR codes and backup codes
 * Uses secure encryption for storing secrets and codes
 */
class TwoFactorService {
  constructor() {
    // Encryption key from environment (should be 32 bytes/256 bits)
    this.encryptionKey = process.env.TWO_FACTOR_ENCRYPTION_KEY || this.generateEncryptionKey();
    this.appName = process.env.APP_NAME || 'YouTube Outlier Discovery';
    
    // Rate limiting for 2FA attempts
    this.attemptLimits = new Map(); // userId -> { attempts, lastAttempt, lockedUntil }
    this.maxAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.attemptWindow = 60 * 1000; // 1 minute window
    
    // Cleanup old rate limit data every hour
    setInterval(() => this.cleanupRateLimits(), 60 * 60 * 1000);
  }

  /**
   * Generate a secure encryption key if none provided
   * @returns {string} 256-bit encryption key
   */
  generateEncryptionKey() {
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('Generated temporary 2FA encryption key. Set TWO_FACTOR_ENCRYPTION_KEY in production!');
    return key;
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Text to encrypt
   * @returns {string} Encrypted text with IV
   */
  encrypt(text) {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedText - Encrypted text
   * @returns {string} Decrypted text
   */
  decrypt(encryptedText) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate TOTP secret and QR code for setup
   * @param {string} email - User's email address
   * @param {string} username - User's username
   * @returns {Promise<Object>} Setup data with secret and QR code
   */
  async generateSetupData(email, username) {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${email})`,
        issuer: this.appName,
        length: 32, // 256-bit secret for enhanced security
      });

      // Generate QR code data URL
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      });

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url,
      };
    } catch (error) {
      logger.error('Error generating 2FA setup data:', error);
      throw new Error('Failed to generate 2FA setup data');
    }
  }

  /**
   * Verify TOTP token
   * @param {string} token - 6-digit TOTP token
   * @param {string} secret - Base32 encoded secret
   * @param {number} window - Time window for token validation (default: 2)
   * @returns {boolean} Token validity
   */
  verifyToken(token, secret, window = 2) {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(secret)) {
        throw new Error('Too many failed attempts. Please try again later.');
      }

      const isValid = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window, // Allow 2 time steps (±60 seconds)
      });

      // Reset rate limit on successful verification
      if (isValid) {
        this.resetRateLimit(secret);
      } else {
        this.recordFailedAttempt(secret);
      }

      return isValid;
    } catch (error) {
      this.recordFailedAttempt(secret);
      logger.error('Error verifying TOTP token:', error);
      return false;
    }
  }

  /**
   * Generate backup codes
   * @param {number} count - Number of backup codes to generate (default: 10)
   * @returns {string[]} Array of backup codes
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup code for storage
   * @param {string} code - Backup code
   * @returns {string} Hashed code
   */
  hashBackupCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify backup code
   * @param {string} inputCode - User-provided backup code
   * @param {string[]} hashedCodes - Array of hashed backup codes
   * @returns {Object} Verification result with index if valid
   */
  verifyBackupCode(inputCode, hashedCodes) {
    const inputHash = this.hashBackupCode(inputCode.toUpperCase());
    const index = hashedCodes.findIndex(hashedCode => hashedCode === inputHash);
    
    return {
      isValid: index !== -1,
      index: index,
    };
  }

  /**
   * Check rate limiting for 2FA attempts
   * @param {string} identifier - User identifier (secret or user ID)
   * @returns {boolean} Whether attempt is allowed
   */
  checkRateLimit(identifier) {
    const now = Date.now();
    const attempts = this.attemptLimits.get(identifier);

    if (!attempts) {
      return true; // No previous attempts
    }

    // Check if still locked out
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      return false;
    }

    // Reset if outside attempt window
    if (now - attempts.lastAttempt > this.attemptWindow) {
      this.attemptLimits.delete(identifier);
      return true;
    }

    // Check if exceeded max attempts
    return attempts.attempts < this.maxAttempts;
  }

  /**
   * Record failed 2FA attempt
   * @param {string} identifier - User identifier
   */
  recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = this.attemptLimits.get(identifier) || { attempts: 0, lastAttempt: now };

    attempts.attempts++;
    attempts.lastAttempt = now;

    // Lock out if exceeded max attempts
    if (attempts.attempts >= this.maxAttempts) {
      attempts.lockedUntil = now + this.lockoutDuration;
      logger.warn(`2FA rate limit exceeded for identifier: ${identifier.substring(0, 8)}...`);
    }

    this.attemptLimits.set(identifier, attempts);
  }

  /**
   * Reset rate limiting on successful verification
   * @param {string} identifier - User identifier
   */
  resetRateLimit(identifier) {
    this.attemptLimits.delete(identifier);
  }

  /**
   * Clean up old rate limiting data
   */
  cleanupRateLimits() {
    const now = Date.now();
    const cutoff = now - this.lockoutDuration;

    for (const [identifier, attempts] of this.attemptLimits.entries()) {
      if (attempts.lastAttempt < cutoff && (!attempts.lockedUntil || attempts.lockedUntil < now)) {
        this.attemptLimits.delete(identifier);
      }
    }
  }

  /**
   * Generate current TOTP token (for testing/admin purposes)
   * @param {string} secret - Base32 encoded secret
   * @returns {string} Current TOTP token
   */
  generateCurrentToken(secret) {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32',
    });
  }

  /**
   * Validate backup codes format
   * @param {string[]} codes - Array of backup codes
   * @returns {Object} Validation result
   */
  validateBackupCodes(codes) {
    const errors = [];

    if (!Array.isArray(codes)) {
      errors.push('Backup codes must be an array');
      return { isValid: false, errors };
    }

    if (codes.length < 8 || codes.length > 20) {
      errors.push('Must have between 8 and 20 backup codes');
    }

    for (const code of codes) {
      if (typeof code !== 'string' || !/^[A-F0-9]{8}$/.test(code)) {
        errors.push('Each backup code must be 8 hexadecimal characters');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get remaining lockout time for rate limited identifier
   * @param {string} identifier - User identifier
   * @returns {number} Remaining lockout time in milliseconds (0 if not locked)
   */
  getRemainingLockoutTime(identifier) {
    const attempts = this.attemptLimits.get(identifier);
    if (!attempts || !attempts.lockedUntil) {
      return 0;
    }

    const remaining = attempts.lockedUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Format backup codes for display
   * @param {string[]} codes - Raw backup codes
   * @returns {string[]} Formatted codes (grouped)
   */
  formatBackupCodes(codes) {
    return codes.map(code => {
      // Format as XXXX-XXXX for readability
      return code.substring(0, 4) + '-' + code.substring(4);
    });
  }

  /**
   * Sanitize backup code input (remove spaces, dashes, etc.)
   * @param {string} code - User input
   * @returns {string} Sanitized code
   */
  sanitizeBackupCode(code) {
    return code.replace(/[\s-]/g, '').toUpperCase();
  }
}

// Export singleton instance
module.exports = new TwoFactorService();