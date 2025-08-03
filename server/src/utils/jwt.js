const jwt = require('jsonwebtoken');

/**
 * JWT utility functions for token management
 * Implements secure token generation, verification, and management
 */
class JWTUtils {
  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {Object} options - Token options
   * @returns {string} Signed JWT token
   */
  static generateAccessToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      issuer: process.env.JWT_ISSUER || 'outlier-discovery',
      audience: process.env.JWT_AUDIENCE || 'outlier-api',
      algorithm: 'HS256',
    };

    const tokenOptions = { ...defaultOptions, ...options };

    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required');
    }

    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, tokenOptions);
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload (usually just userId)
   * @param {Object} options - Token options
   * @returns {string} Signed JWT token
   */
  static generateRefreshToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'outlier-discovery',
      audience: process.env.JWT_AUDIENCE || 'outlier-api',
      algorithm: 'HS256',
    };

    const tokenOptions = { ...defaultOptions, ...options };

    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, tokenOptions);
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Object} Decoded token payload
   */
  static verifyAccessToken(token, options = {}) {
    if (!token) {
      throw new Error('Token is required');
    }

    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required');
    }

    const defaultOptions = {
      issuer: process.env.JWT_ISSUER || 'outlier-discovery',
      audience: process.env.JWT_AUDIENCE || 'outlier-api',
      algorithms: ['HS256'],
    };

    const verifyOptions = { ...defaultOptions, ...options };

    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET, verifyOptions);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Access token not active yet');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Object} Decoded token payload
   */
  static verifyRefreshToken(token, options = {}) {
    if (!token) {
      throw new Error('Refresh token is required');
    }

    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    const defaultOptions = {
      issuer: process.env.JWT_ISSUER || 'outlier-discovery',
      audience: process.env.JWT_AUDIENCE || 'outlier-api',
      algorithms: ['HS256'],
    };

    const verifyOptions = { ...defaultOptions, ...options };

    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, verifyOptions);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Refresh token not active yet');
      } else {
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (for inspection)
   * @param {string} token - JWT token to decode
   * @returns {Object} Decoded token (header, payload, signature)
   */
  static decodeToken(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Get token expiration date
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date or null if no expiration
   */
  static getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if token is expired
   */
  static isTokenExpired(token) {
    try {
      const expirationDate = this.getTokenExpiration(token);
      if (!expirationDate) {
        return false; // No expiration set
      }
      return new Date() >= expirationDate;
    } catch (error) {
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Get time until token expires (in seconds)
   * @param {string} token - JWT token
   * @returns {number} Seconds until expiration, -1 if expired, null if no expiration
   */
  static getTimeUntilExpiration(token) {
    try {
      const expirationDate = this.getTokenExpiration(token);
      if (!expirationDate) {
        return null; // No expiration set
      }

      const timeUntilExpiration = Math.floor((expirationDate.getTime() - Date.now()) / 1000);
      return Math.max(timeUntilExpiration, -1);
    } catch (error) {
      return -1; // Consider invalid tokens as expired
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token or null
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Create token pair (access + refresh)
   * @param {Object} userPayload - User data for access token
   * @param {Object} refreshPayload - Data for refresh token (usually just userId)
   * @returns {Object} Token pair
   */
  static createTokenPair(userPayload, refreshPayload) {
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken(refreshPayload);

    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      tokenType: 'Bearer',
    };
  }

  /**
   * Validate token format (basic JWT structure check)
   * @param {string} token - Token to validate
   * @returns {boolean} True if token has valid JWT format
   */
  static isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    try {
      // Try to decode each part
      JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token payload without verification (unsafe - for debugging only)
   * @param {string} token - JWT token
   * @returns {Object|null} Token payload or null if invalid
   */
  static getTokenPayload(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate secure random string for token secrets
   * @param {number} length - Length of the random string
   * @returns {string} Random string
   */
  static generateSecretKey(length = 64) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate JWT secret strength
   * @param {string} secret - Secret to validate
   * @returns {Object} Validation result
   */
  static validateSecretStrength(secret) {
    const errors = [];

    if (!secret) {
      errors.push('Secret is required');
    } else {
      if (secret.length < 32) {
        errors.push('Secret should be at least 32 characters long');
      }

      if (!/[A-Z]/.test(secret)) {
        errors.push('Secret should contain uppercase letters');
      }

      if (!/[a-z]/.test(secret)) {
        errors.push('Secret should contain lowercase letters');
      }

      if (!/[0-9]/.test(secret)) {
        errors.push('Secret should contain numbers');
      }

      if (!/[^A-Za-z0-9]/.test(secret)) {
        errors.push('Secret should contain special characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculateSecretStrength(secret),
    };
  }

  /**
   * Calculate secret strength score
   * @param {string} secret - Secret to analyze
   * @returns {Object} Strength analysis
   */
  static calculateSecretStrength(secret) {
    if (!secret) {
      return { score: 0, level: 'none' };
    }

    let score = 0;

    // Length score
    if (secret.length >= 32) score += 25;
    else if (secret.length >= 16) score += 15;
    else if (secret.length >= 8) score += 5;

    // Character variety score
    if (/[a-z]/.test(secret)) score += 15;
    if (/[A-Z]/.test(secret)) score += 15;
    if (/[0-9]/.test(secret)) score += 15;
    if (/[^A-Za-z0-9]/.test(secret)) score += 20;

    // Entropy bonus
    const uniqueChars = new Set(secret).size;
    score += Math.min(uniqueChars, 10);

    let level;
    if (score >= 80) level = 'strong';
    else if (score >= 60) level = 'medium';
    else if (score >= 40) level = 'weak';
    else level = 'very-weak';

    return { score, level };
  }
}

module.exports = JWTUtils;