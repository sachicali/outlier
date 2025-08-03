const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * ApiKey model for per-user API key management
 * Implements secure API key generation and management
 */
class ApiKey {
  constructor(apiKeyData) {
    this.id = apiKeyData.id || uuidv4();
    this.userId = apiKeyData.userId;
    this.name = apiKeyData.name;
    this.keyHash = apiKeyData.keyHash;
    this.keyPrefix = apiKeyData.keyPrefix;
    this.scopes = apiKeyData.scopes || ['read']; // ['read', 'write', 'admin']
    this.isActive = apiKeyData.isActive !== undefined ? apiKeyData.isActive : true;
    this.createdAt = apiKeyData.createdAt || new Date();
    this.updatedAt = apiKeyData.updatedAt || new Date();
    this.lastUsedAt = apiKeyData.lastUsedAt;
    this.expiresAt = apiKeyData.expiresAt;
    this.usageCount = apiKeyData.usageCount || 0;
    this.rateLimit = apiKeyData.rateLimit || 1000; // requests per hour
  }

  /**
   * Generate a new API key
   * @returns {Object} Generated API key with plaintext key and hash
   */
  static generateApiKey() {
    // Generate a secure random key
    const key = crypto.randomBytes(32).toString('hex');
    const prefix = 'ak_' + crypto.randomBytes(8).toString('hex');
    const fullKey = `${prefix}.${key}`;

    // Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    return {
      key: fullKey,
      keyHash,
      keyPrefix: prefix,
    };
  }

  /**
   * Hash an API key for comparison
   * @param {string} key - API key to hash
   * @returns {string} Hashed key
   */
  static hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Validate API key format
   * @param {string} key - API key to validate
   * @returns {boolean} Validation result
   */
  static validateKeyFormat(key) {
    // Expected format: ak_xxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
    const keyRegex = /^ak_[a-f0-9]{16}\.[a-f0-9]{64}$/;
    return keyRegex.test(key);
  }

  /**
   * Validate API key name
   * @param {string} name - Name to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validateName(name) {
    const errors = [];

    if (!name || name.trim().length === 0) {
      errors.push('API key name is required');
    }

    if (name && name.length > 100) {
      errors.push('API key name must be no more than 100 characters long');
    }

    if (name && !/^[a-zA-Z0-9\s\-_\.]+$/.test(name)) {
      errors.push('API key name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate scopes
   * @param {Array} scopes - Scopes to validate
   * @returns {Object} Validation result
   */
  static validateScopes(scopes) {
    const validScopes = ['read', 'write', 'admin'];
    const errors = [];

    if (!Array.isArray(scopes) || scopes.length === 0) {
      errors.push('At least one scope is required');
    } else {
      const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        errors.push(`Invalid scopes: ${invalidScopes.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert API key to safe object (without sensitive data)
   * @returns {Object} Safe API key object
   */
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      keyPrefix: this.keyPrefix,
      scopes: this.scopes,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      expiresAt: this.expiresAt,
      usageCount: this.usageCount,
      rateLimit: this.rateLimit,
    };
  }

  /**
   * Update last used timestamp and increment usage count
   */
  updateUsage() {
    this.lastUsedAt = new Date();
    this.usageCount += 1;
    this.updatedAt = new Date();
  }

  /**
   * Check if API key is expired
   * @returns {boolean} Expiration status
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * Check if API key has specific scope
   * @param {string} scope - Scope to check
   * @returns {boolean} Scope availability
   */
  hasScope(scope) {
    return this.scopes.includes(scope) || this.scopes.includes('admin');
  }

  /**
   * Check if API key can perform admin operations
   * @returns {boolean} Admin capability
   */
  canAdmin() {
    return this.hasScope('admin');
  }

  /**
   * Check if API key can write
   * @returns {boolean} Write capability
   */
  canWrite() {
    return this.hasScope('write') || this.hasScope('admin');
  }

  /**
   * Check if API key can read
   * @returns {boolean} Read capability
   */
  canRead() {
    return this.hasScope('read') || this.hasScope('write') || this.hasScope('admin');
  }

  /**
   * Deactivate API key
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Activate API key
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Set expiration date
   * @param {Date} expirationDate - Expiration date
   */
  setExpiration(expirationDate) {
    this.expiresAt = expirationDate;
    this.updatedAt = new Date();
  }

  /**
   * Update rate limit
   * @param {number} limit - New rate limit
   */
  setRateLimit(limit) {
    if (limit && limit > 0) {
      this.rateLimit = limit;
      this.updatedAt = new Date();
    }
  }
}

module.exports = ApiKey;