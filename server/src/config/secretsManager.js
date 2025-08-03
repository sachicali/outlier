const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Secrets Management Module
 * Provides secure configuration, secret rotation, environment validation,
 * and health checks for sensitive configuration data
 */

class SecretsManager {
  constructor() {
    this.secrets = new Map();
    this.validators = new Map();
    this.rotationCallbacks = new Map();
    this.initialized = false;
    this.encryptionKey = null;
    this.secretsFile = path.join(__dirname, '../../../.secrets.enc');
  }

  /**
   * Initialize the secrets manager
   */
  async initialize() {
    try {
      // Generate or load encryption key
      await this.initializeEncryption();

      // Load environment variables with validation
      await this.loadEnvironmentVariables();

      // Load encrypted secrets file if it exists
      await this.loadSecretsFile();

      // Validate all required secrets
      await this.validateSecrets();

      this.initialized = true;
      logger.info('Secrets manager initialized successfully');

      return true;
    } catch (error) {
      logger.error('Failed to initialize secrets manager:', error);
      throw error;
    }
  }

  /**
   * Initialize encryption for secrets storage
   */
  async initializeEncryption() {
    const keyPath = path.join(__dirname, '../../../.encryption.key');

    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyPath);
      this.encryptionKey = keyData;
    } catch (error) {
      // Generate new key if none exists
      this.encryptionKey = crypto.randomBytes(32);

      // Save key securely (in production, use a key management service)
      await fs.writeFile(keyPath, this.encryptionKey, { mode: 0o600 });
      logger.info('New encryption key generated for secrets');
    }
  }

  /**
   * Encrypt a value
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a value
   */
  decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const _iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Load and validate environment variables
   */
  async loadEnvironmentVariables() {
    const requiredEnvVars = {
      // Database
      DATABASE_URL: {
        validator: this.validateDatabaseUrl.bind(this),
        sensitive: true,
        description: 'Database connection URL',
      },

      // JWT Secrets
      JWT_SECRET: {
        validator: this.validateJWTSecret.bind(this),
        sensitive: true,
        description: 'JWT signing secret',
      },
      JWT_REFRESH_SECRET: {
        validator: this.validateJWTSecret.bind(this),
        sensitive: true,
        description: 'JWT refresh token secret',
      },

      // API Keys
      YOUTUBE_API_KEY: {
        validator: this.validateAPIKey.bind(this),
        sensitive: true,
        description: 'YouTube Data API key',
      },

      // Redis
      REDIS_URL: {
        validator: this.validateRedisUrl.bind(this),
        sensitive: false,
        optional: true,
        description: 'Redis connection URL',
      },

      // Application
      NODE_ENV: {
        validator: this.validateNodeEnv.bind(this),
        sensitive: false,
        description: 'Node.js environment',
      },
      PORT: {
        validator: this.validatePort.bind(this),
        sensitive: false,
        optional: true,
        description: 'Server port',
      },

      // CORS
      CORS_ORIGIN: {
        validator: this.validateCorsOrigin.bind(this),
        sensitive: false,
        description: 'CORS allowed origin',
      },

      // Rate Limiting
      API_RATE_WINDOW: {
        validator: this.validateNumber.bind(this),
        sensitive: false,
        optional: true,
        description: 'API rate limiting window in milliseconds',
      },
      API_RATE_LIMIT: {
        validator: this.validateNumber.bind(this),
        sensitive: false,
        optional: true,
        description: 'API rate limit per window',
      },

      // Security
      BCRYPT_ROUNDS: {
        validator: this.validateBcryptRounds.bind(this),
        sensitive: false,
        optional: true,
        description: 'Bcrypt hashing rounds',
      },
      SESSION_SECRET: {
        validator: this.validateSessionSecret.bind(this),
        sensitive: true,
        description: 'Session signing secret',
      },
    };

    for (const [key, config] of Object.entries(requiredEnvVars)) {
      const value = process.env[key];

      if (!value && !config.optional) {
        throw new Error(`Required environment variable ${key} is not set`);
      }

      if (value) {
        try {
          await config.validator(value);
          this.setSecret(key, value, config.sensitive);
        } catch (error) {
          throw new Error(`Invalid ${key}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Load encrypted secrets file
   */
  async loadSecretsFile() {
    try {
      const encryptedData = await fs.readFile(this.secretsFile, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const secrets = JSON.parse(decryptedData);

      for (const [key, value] of Object.entries(secrets)) {
        this.setSecret(key, value, true);
      }

      logger.info('Encrypted secrets file loaded');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load secrets file:', error);
      }
    }
  }

  /**
   * Save secrets to encrypted file
   */
  async saveSecretsFile() {
    try {
      const sensitiveSecrets = {};

      for (const [key, secret] of this.secrets.entries()) {
        if (secret.sensitive && !process.env[key]) {
          sensitiveSecrets[key] = secret.value;
        }
      }

      const encryptedData = this.encrypt(JSON.stringify(sensitiveSecrets));
      await fs.writeFile(this.secretsFile, encryptedData, { mode: 0o600 });

      logger.info('Secrets file saved');
    } catch (error) {
      logger.error('Failed to save secrets file:', error);
      throw error;
    }
  }

  /**
   * Set a secret value
   */
  setSecret(key, value, sensitive = true) {
    this.secrets.set(key, {
      value,
      sensitive,
      lastUpdated: new Date(),
      accessCount: 0,
    });
  }

  /**
   * Get a secret value
   */
  getSecret(key) {
    const secret = this.secrets.get(key);
    if (!secret) {
      return null;
    }

    secret.accessCount++;
    secret.lastAccessed = new Date();

    return secret.value;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(key, newValue, callback) {
    const oldValue = this.getSecret(key);

    if (!oldValue) {
      throw new Error(`Secret ${key} not found`);
    }

    try {
      // Validate new value
      const validator = this.validators.get(key);
      if (validator) {
        await validator(newValue);
      }

      // Set new value
      this.setSecret(key, newValue, this.secrets.get(key).sensitive);

      // Execute rotation callback if provided
      if (callback) {
        await callback(oldValue, newValue);
      }

      // Save to file
      await this.saveSecretsFile();

      logger.info(`Secret ${key} rotated successfully`);

      return true;
    } catch (error) {
      // Rollback on failure
      this.setSecret(key, oldValue, this.secrets.get(key).sensitive);
      throw error;
    }
  }

  /**
   * Generate a new secret value
   */
  generateSecret(type = 'hex', length = 32) {
    switch (type) {
    case 'hex':
      return crypto.randomBytes(length).toString('hex');
    case 'base64':
      return crypto.randomBytes(length).toString('base64');
    case 'uuid':
      return crypto.randomUUID();
    case 'jwt':
      return crypto.randomBytes(64).toString('base64url');
    default:
      throw new Error(`Unknown secret type: ${type}`);
    }
  }

  /**
   * Validation functions
   */
  async validateDatabaseUrl(url) {
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      throw new Error('Database URL must be a PostgreSQL connection string');
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid database URL format');
    }
  }

  async validateJWTSecret(secret) {
    if (secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    // Check for weak secrets
    const weakSecrets = ['secret', 'password', '12345', 'test'];
    if (weakSecrets.includes(secret.toLowerCase())) {
      throw new Error('JWT secret is too weak');
    }
  }

  async validateAPIKey(key) {
    if (!key || key.length < 20) {
      throw new Error('API key appears to be invalid or too short');
    }
  }

  async validateRedisUrl(url) {
    if (!url.startsWith('redis://') && !url.startsWith('rediss://')) {
      throw new Error('Redis URL must start with redis:// or rediss://');
    }

    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid Redis URL format');
    }
  }

  async validateNodeEnv(env) {
    const validEnvs = ['development', 'production', 'test', 'staging'];
    if (!validEnvs.includes(env)) {
      throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
    }
  }

  async validatePort(port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error('Port must be a number between 1 and 65535');
    }
  }

  async validateCorsOrigin(origin) {
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return;
    }

    try {
      new URL(origin);
    } catch (error) {
      throw new Error('CORS origin must be a valid URL');
    }
  }

  async validateNumber(value) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error('Value must be a valid number');
    }
  }

  async validateBcryptRounds(rounds) {
    const num = parseInt(rounds, 10);
    if (isNaN(num) || num < 8 || num > 20) {
      throw new Error('Bcrypt rounds must be between 8 and 20');
    }
  }

  async validateSessionSecret(secret) {
    if (secret.length < 32) {
      throw new Error('Session secret must be at least 32 characters long');
    }
  }

  /**
   * Health check for secrets
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      checks: {},
      timestamp: new Date().toISOString(),
      secretsCount: this.secrets.size,
    };

    try {
      // Check if all required secrets are present
      const requiredSecrets = ['DATABASE_URL', 'JWT_SECRET', 'YOUTUBE_API_KEY'];

      for (const key of requiredSecrets) {
        const secret = this.secrets.get(key);
        health.checks[key] = {
          present: !!secret,
          lastUpdated: secret?.lastUpdated,
          accessCount: secret?.accessCount,
        };

        if (!secret) {
          health.status = 'unhealthy';
        }
      }

      // Check encryption key
      health.checks.encryptionKey = {
        present: !!this.encryptionKey,
        keySize: this.encryptionKey?.length,
      };

      if (!this.encryptionKey) {
        health.status = 'unhealthy';
      }

      // Check secrets file
      try {
        await fs.access(this.secretsFile);
        health.checks.secretsFile = { accessible: true };
      } catch (error) {
        health.checks.secretsFile = { accessible: false, error: error.message };
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }

  /**
   * Get secrets audit information (safe for logging)
   */
  getAuditInfo() {
    const audit = {
      totalSecrets: this.secrets.size,
      sensitiveSecrets: 0,
      secrets: {},
    };

    for (const [key, secret] of this.secrets.entries()) {
      if (secret.sensitive) {
        audit.sensitiveSecrets++;
      }

      audit.secrets[key] = {
        sensitive: secret.sensitive,
        lastUpdated: secret.lastUpdated,
        lastAccessed: secret.lastAccessed,
        accessCount: secret.accessCount,
        hasValue: !!secret.value,
      };
    }

    return audit;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    try {
      await this.saveSecretsFile();
      this.secrets.clear();
      this.validators.clear();
      this.rotationCallbacks.clear();
      logger.info('Secrets manager shutdown complete');
    } catch (error) {
      logger.error('Error during secrets manager shutdown:', error);
    }
  }

  /**
   * Check if secrets manager is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get configuration value (alias for getSecret)
   */
  get(key) {
    return this.getSecret(key);
  }

  /**
   * Set configuration value (alias for setSecret)
   */
  set(key, value, sensitive = true) {
    return this.setSecret(key, value, sensitive);
  }
}

// Create singleton instance
const secretsManager = new SecretsManager();

/**
 * Middleware to ensure secrets are initialized
 */
function ensureSecretsInitialized(req, res, next) {
  if (!secretsManager.isInitialized()) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Configuration not initialized',
    });
  }
  next();
}

/**
 * Admin-only endpoint for secrets health check
 */
async function secretsHealthCheck(req, res) {
  try {
    // Ensure only admins can access this endpoint
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }

    const health = await secretsManager.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('Secrets health check failed:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message,
    });
  }
}

module.exports = {
  secretsManager,
  ensureSecretsInitialized,
  secretsHealthCheck,
  SecretsManager,
};