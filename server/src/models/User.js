const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * User model for authentication and authorization
 * Implements secure password hashing and user management
 */
class User {
  constructor(userData) {
    this.id = userData.id || uuidv4();
    this.email = userData.email;
    this.username = userData.username;
    this.passwordHash = userData.passwordHash;
    this.role = userData.role || 'user'; // 'user' or 'admin'
    this.isActive = userData.isActive !== undefined ? userData.isActive : true;
    this.isEmailVerified = userData.isEmailVerified || false;
    this.emailVerifiedAt = userData.emailVerifiedAt || null;
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt || new Date();
    this.lastLoginAt = userData.lastLoginAt;
    this.refreshTokens = userData.refreshTokens || [];
    this.oauthProviders = userData.oauthProviders || {};
    this.profilePictureUrl = userData.profilePictureUrl || null;
    this.accountLinkedAt = userData.accountLinkedAt || null;
  }

  /**
   * Hash password with bcrypt (minimum 12 rounds for security)
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Generate a secure username from OAuth provider data
   * @param {Object} providerData - OAuth provider data
   * @param {string} provider - Provider name
   * @returns {string} Generated username
   */
  static generateUsernameFromOAuth(providerData, provider) {
    let baseUsername = '';
    
    // Try to use provider username first
    if (providerData.username) {
      baseUsername = providerData.username;
    } else if (providerData.name) {
      // Convert display name to username format
      baseUsername = providerData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
    } else {
      // Fallback to email prefix
      baseUsername = providerData.email.split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
    }

    // Ensure minimum length
    if (baseUsername.length < 3) {
      baseUsername = `${provider}user${Math.floor(Math.random() * 1000)}`;
    }

    return baseUsername;
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Password match result
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
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
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Email validation result
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate username format
   * @param {string} username - Username to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validateUsername(username) {
    const errors = [];

    if (!username || username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username && username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
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
      isActive: this.isActive,
      isEmailVerified: this.isEmailVerified,
      emailVerifiedAt: this.emailVerifiedAt,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
      oauthProviders: this.getLinkedProviders(),
      profilePictureUrl: this.profilePictureUrl,
      accountLinkedAt: this.accountLinkedAt,
    };
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin() {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Add refresh token to user
   * @param {string} token - Refresh token
   */
  addRefreshToken(token) {
    // Keep only the last 5 refresh tokens to prevent unlimited accumulation
    if (this.refreshTokens.length >= 5) {
      this.refreshTokens = this.refreshTokens.slice(-4);
    }
    this.refreshTokens.push({
      token,
      createdAt: new Date(),
      isActive: true,
    });
    this.updatedAt = new Date();
  }

  /**
   * Remove refresh token from user
   * @param {string} token - Refresh token to remove
   */
  removeRefreshToken(token) {
    this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
    this.updatedAt = new Date();
  }

  /**
   * Clear all refresh tokens (for logout all devices)
   */
  clearRefreshTokens() {
    this.refreshTokens = [];
    this.updatedAt = new Date();
  }

  /**
   * Check if user has valid refresh token
   * @param {string} token - Refresh token to check
   * @returns {boolean} Token validity
   */
  hasValidRefreshToken(token) {
    return this.refreshTokens.some(rt => rt.token === token && rt.isActive);
  }

  /**
   * Mark email as verified
   */
  verifyEmail() {
    this.isEmailVerified = true;
    this.emailVerifiedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Check if user has admin role
   * @returns {boolean} Admin status
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Check if user requires email verification
   * @returns {boolean} Verification requirement status
   */
  requiresEmailVerification() {
    return !this.isEmailVerified;
  }

  /**
   * Add OAuth provider to user account
   * @param {string} provider - Provider name (google, github, etc.)
   * @param {Object} providerData - Provider-specific data
   */
  addOAuthProvider(provider, providerData) {
    if (!this.oauthProviders) {
      this.oauthProviders = {};
    }
    
    this.oauthProviders[provider] = {
      id: providerData.id,
      email: providerData.email,
      name: providerData.name,
      username: providerData.username,
      profilePictureUrl: providerData.profilePictureUrl,
      linkedAt: new Date(),
      lastUsed: new Date(),
    };

    // Set account linked timestamp if this is the first OAuth provider
    if (!this.accountLinkedAt) {
      this.accountLinkedAt = new Date();
    }

    // Update profile picture if not set
    if (!this.profilePictureUrl && providerData.profilePictureUrl) {
      this.profilePictureUrl = providerData.profilePictureUrl;
    }

    this.updatedAt = new Date();
  }

  /**
   * Remove OAuth provider from user account
   * @param {string} provider - Provider name to remove
   */
  removeOAuthProvider(provider) {
    if (this.oauthProviders && this.oauthProviders[provider]) {
      delete this.oauthProviders[provider];
      this.updatedAt = new Date();
    }
  }

  /**
   * Check if user has a specific OAuth provider linked
   * @param {string} provider - Provider name to check
   * @returns {boolean} Provider link status
   */
  hasOAuthProvider(provider) {
    return !!(this.oauthProviders && this.oauthProviders[provider]);
  }

  /**
   * Get list of linked OAuth providers
   * @returns {string[]} Array of linked provider names
   */
  getLinkedProviders() {
    if (!this.oauthProviders) return [];
    return Object.keys(this.oauthProviders);
  }

  /**
   * Update last used timestamp for OAuth provider
   * @param {string} provider - Provider name
   */
  updateOAuthProviderUsage(provider) {
    if (this.oauthProviders && this.oauthProviders[provider]) {
      this.oauthProviders[provider].lastUsed = new Date();
      this.updatedAt = new Date();
    }
  }

  /**
   * Check if account was created via OAuth (no password)
   * @returns {boolean} OAuth account status
   */
  isOAuthAccount() {
    return !this.passwordHash && this.getLinkedProviders().length > 0;
  }

  /**
   * Validate OAuth provider data structure
   * @param {Object} providerData - Provider data to validate
   * @returns {Object} Validation result
   */
  static validateOAuthData(providerData) {
    const errors = [];

    if (!providerData.id) {
      errors.push('Provider ID is required');
    }

    if (!providerData.email || !this.validateEmail(providerData.email)) {
      errors.push('Valid provider email is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = User;