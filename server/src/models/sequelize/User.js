const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');

class User extends Model {
  /**
   * Initialize the User model
   * @param {Sequelize} sequelize - Sequelize instance
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
          len: [3, 255],
        },
      },
      username: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 30],
          is: /^[a-zA-Z0-9_-]+$/,
        },
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [60, 60], // bcrypt hash length
        },
      },
      role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user',
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refresh_tokens: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      preferences: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      email_verification_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password_reset_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password_reset_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      two_factor_secret: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      two_factor_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      backup_codes: {
        type: DataTypes.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      two_factor_enabled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      backup_codes_generated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      indexes: [
        {
          unique: true,
          fields: ['email'],
        },
        {
          unique: true,
          fields: ['username'],
        },
        {
          fields: ['is_active'],
        },
        {
          fields: ['role'],
        },
        {
          fields: ['email_verification_token'],
          sparse: true,
        },
        {
          fields: ['password_reset_token'],
          sparse: true,
        },
        {
          fields: ['two_factor_enabled'],
        },
        {
          fields: ['two_factor_enabled_at'],
        },
      ],
      hooks: {
        beforeCreate: async (user) => {
          if (user.changed('password_hash')) {
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            user.password_hash = await bcrypt.hash(user.password_hash, saltRounds);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password_hash')) {
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            user.password_hash = await bcrypt.hash(user.password_hash, saltRounds);
          }
        },
      },
    });

    return User;
  }

  /**
   * Hash password with bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @returns {Promise<boolean>} Password match result
   */
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validatePassword(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert user to safe object (without sensitive data)
   * @returns {Object} Safe user object
   */
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      role: this.role,
      is_active: this.is_active,
      email_verified: this.email_verified,
      last_login_at: this.last_login_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      preferences: this.preferences,
      two_factor_enabled: this.two_factor_enabled,
      two_factor_enabled_at: this.two_factor_enabled_at,
      backup_codes_count: this.backup_codes ? this.backup_codes.length : 0,
    };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin() {
    this.last_login_at = new Date();
    await this.save();
  }

  /**
   * Add refresh token to user
   * @param {string} token - Refresh token
   */
  async addRefreshToken(token) {
    const refreshTokens = this.refresh_tokens || [];

    // Keep only the last 5 refresh tokens to prevent unlimited accumulation
    if (refreshTokens.length >= 5) {
      refreshTokens.splice(0, refreshTokens.length - 4);
    }

    refreshTokens.push({
      token,
      created_at: new Date(),
      is_active: true,
    });

    this.refresh_tokens = refreshTokens;
    await this.save();
  }

  /**
   * Remove refresh token from user
   * @param {string} token - Refresh token to remove
   */
  async removeRefreshToken(token) {
    this.refresh_tokens = (this.refresh_tokens || []).filter(rt => rt.token !== token);
    await this.save();
  }

  /**
   * Clear all refresh tokens (for logout all devices)
   */
  async clearRefreshTokens() {
    this.refresh_tokens = [];
    await this.save();
  }

  /**
   * Check if user has valid refresh token
   * @param {string} token - Refresh token to check
   * @returns {boolean} Token validity
   */
  hasValidRefreshToken(token) {
    return (this.refresh_tokens || []).some(rt => rt.token === token && rt.is_active);
  }

  /**
   * Check if user has admin role
   * @returns {boolean} Admin status
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Set email verification token
   * @param {string} token - Verification token
   */
  async setEmailVerificationToken(token) {
    this.email_verification_token = token;
    await this.save();
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token
   * @returns {boolean} Verification success
   */
  async verifyEmail(token) {
    if (this.email_verification_token === token) {
      this.email_verified = true;
      this.email_verification_token = null;
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Set password reset token
   * @param {string} token - Reset token
   * @param {Date} expires - Token expiration
   */
  async setPasswordResetToken(token, expires) {
    this.password_reset_token = token;
    this.password_reset_expires = expires;
    await this.save();
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {boolean} Reset success
   */
  async resetPassword(token, newPassword) {
    if (this.password_reset_token === token &&
        this.password_reset_expires &&
        this.password_reset_expires > new Date()) {

      this.password_hash = newPassword; // Will be hashed by hook
      this.password_reset_token = null;
      this.password_reset_expires = null;
      this.refresh_tokens = []; // Clear all sessions
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Enable two-factor authentication
   * @param {string} encryptedSecret - Encrypted TOTP secret
   * @param {string[]} hashedBackupCodes - Array of hashed backup codes
   */
  async enableTwoFactor(encryptedSecret, hashedBackupCodes) {
    this.two_factor_secret = encryptedSecret;
    this.two_factor_enabled = true;
    this.backup_codes = hashedBackupCodes;
    this.two_factor_enabled_at = new Date();
    this.backup_codes_generated_at = new Date();
    await this.save();
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor() {
    this.two_factor_secret = null;
    this.two_factor_enabled = false;
    this.backup_codes = [];
    this.two_factor_enabled_at = null;
    this.backup_codes_generated_at = null;
    await this.save();
  }

  /**
   * Update backup codes
   * @param {string[]} hashedBackupCodes - New array of hashed backup codes
   */
  async updateBackupCodes(hashedBackupCodes) {
    this.backup_codes = hashedBackupCodes;
    this.backup_codes_generated_at = new Date();
    await this.save();
  }

  /**
   * Remove used backup code
   * @param {number} index - Index of the used backup code
   */
  async removeBackupCode(index) {
    if (this.backup_codes && index >= 0 && index < this.backup_codes.length) {
      this.backup_codes.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Check if user has 2FA enabled
   * @returns {boolean} 2FA status
   */
  hasTwoFactorEnabled() {
    return this.two_factor_enabled && this.two_factor_secret;
  }

  /**
   * Get decrypted TOTP secret (use with caution)
   * @param {Function} decryptFunction - Decryption function
   * @returns {string|null} Decrypted secret
   */
  getDecryptedSecret(decryptFunction) {
    if (!this.two_factor_secret) {
      return null;
    }
    try {
      return decryptFunction(this.two_factor_secret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user has backup codes available
   * @returns {boolean} Backup codes availability
   */
  hasBackupCodes() {
    return this.backup_codes && this.backup_codes.length > 0;
  }

  /**
   * Get backup codes count
   * @returns {number} Number of remaining backup codes
   */
  getBackupCodesCount() {
    return this.backup_codes ? this.backup_codes.length : 0;
  }
}

module.exports = User;