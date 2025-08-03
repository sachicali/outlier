const { body, param, validationResult } = require('express-validator');
const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * API Key management controller
 * Handles CRUD operations for user API keys
 */
class ApiKeyController {
  /**
   * API key creation validation rules
   */
  static createValidation = [
    body('name')
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
      .withMessage('Name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, underscores, and periods'),
    body('scopes')
      .isArray({ min: 1 })
      .withMessage('At least one scope is required')
      .custom((scopes) => {
        const validScopes = ['read', 'write', 'admin'];
        const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
        if (invalidScopes.length > 0) {
          throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
        }
        return true;
      }),
    body('expiresIn')
      .optional()
      .isInt({ min: 3600000, max: 31536000000 }) // 1 hour to 1 year in milliseconds
      .withMessage('Expiration must be between 1 hour and 1 year'),
  ];

  /**
   * API key update validation rules
   */
  static updateValidation = [
    param('keyId')
      .isUUID()
      .withMessage('Valid API key ID is required'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
      .withMessage('Name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, underscores, and periods'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('rateLimit')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Rate limit must be between 1 and 10000 requests per hour'),
  ];

  /**
   * Get all API keys for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserApiKeys(req, res) {
    try {
      const userId = req.user.id;
      const apiKeys = authService.getUserApiKeys(userId);

      res.json({
        apiKeys,
        total: apiKeys.length,
      });
    } catch (error) {
      logger.error('Get API keys error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Failed to retrieve API keys',
        message: 'An error occurred while retrieving your API keys',
      });
    }
  }

  /**
   * Create a new API key
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createApiKey(req, res) {
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

      const { name, scopes, expiresIn } = req.body;
      const userId = req.user.id;

      // Check if user already has maximum number of API keys
      const existingKeys = authService.getUserApiKeys(userId);
      const maxKeysPerUser = parseInt(process.env.MAX_API_KEYS_PER_USER) || 10;

      if (existingKeys.length >= maxKeysPerUser) {
        return res.status(429).json({
          error: 'API key limit reached',
          message: `You can have a maximum of ${maxKeysPerUser} API keys`,
        });
      }

      // Validate scope permissions based on user role
      if (scopes.includes('admin') && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only admin users can create API keys with admin scope',
        });
      }

      // Create API key
      const apiKey = await authService.createApiKey(userId, {
        name,
        scopes,
        expiresIn,
      });

      logger.info(`API key created: ${name}`, {
        userId: userId,
        keyId: apiKey.id,
        scopes: scopes,
        ip: req.ip,
      });

      res.status(201).json({
        message: 'API key created successfully',
        apiKey: {
          ...apiKey,
          // Note: The plaintext key is only returned once during creation
          key: apiKey.key,
        },
      });
    } catch (error) {
      logger.error('Create API key error', {
        error: error.message,
        userId: req.user?.id,
        name: req.body.name,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'API key creation failed',
        message: error.message,
      });
    }
  }

  /**
   * Get a specific API key
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getApiKey(req, res) {
    try {
      const { keyId } = req.params;
      const userId = req.user.id;

      const apiKeys = authService.getUserApiKeys(userId);
      const apiKey = apiKeys.find(key => key.id === keyId);

      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The requested API key was not found',
        });
      }

      res.json({
        apiKey,
      });
    } catch (error) {
      logger.error('Get API key error', {
        error: error.message,
        userId: req.user?.id,
        keyId: req.params.keyId,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Failed to retrieve API key',
        message: 'An error occurred while retrieving the API key',
      });
    }
  }

  /**
   * Update an API key
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateApiKey(req, res) {
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

      const { keyId } = req.params;
      const { name, isActive, rateLimit } = req.body;
      const userId = req.user.id;

      // Get the API key to update
      const apiKeys = authService.getUserApiKeys(userId);
      const apiKey = apiKeys.find(key => key.id === keyId);

      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The requested API key was not found',
        });
      }

      // Update the API key (simplified - would need actual database update)
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (isActive !== undefined) updates.isActive = isActive;
      if (rateLimit !== undefined) updates.rateLimit = rateLimit;

      logger.info(`API key updated: ${apiKey.name}`, {
        userId: userId,
        keyId: keyId,
        updates: updates,
        ip: req.ip,
      });

      res.json({
        message: 'API key updated successfully',
        apiKey: {
          ...apiKey,
          ...updates,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Update API key error', {
        error: error.message,
        userId: req.user?.id,
        keyId: req.params.keyId,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'API key update failed',
        message: error.message,
      });
    }
  }

  /**
   * Delete an API key
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteApiKey(req, res) {
    try {
      const { keyId } = req.params;
      const userId = req.user.id;

      await authService.deleteApiKey(userId, keyId);

      logger.info('API key deleted', {
        userId: userId,
        keyId: keyId,
        ip: req.ip,
      });

      res.json({
        message: 'API key deleted successfully',
      });
    } catch (error) {
      logger.error('Delete API key error', {
        error: error.message,
        userId: req.user?.id,
        keyId: req.params.keyId,
        ip: req.ip,
      });

      if (error.message === 'API key not found') {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The requested API key was not found',
        });
      }

      res.status(500).json({
        error: 'API key deletion failed',
        message: 'An error occurred while deleting the API key',
      });
    }
  }

  /**
   * Regenerate an API key (deactivate old, create new)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async regenerateApiKey(req, res) {
    try {
      const { keyId } = req.params;
      const userId = req.user.id;

      // Get the existing API key
      const apiKeys = authService.getUserApiKeys(userId);
      const existingKey = apiKeys.find(key => key.id === keyId);

      if (!existingKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The requested API key was not found',
        });
      }

      // Delete the old key
      await authService.deleteApiKey(userId, keyId);

      // Create a new key with the same properties
      const newApiKey = await authService.createApiKey(userId, {
        name: existingKey.name,
        scopes: existingKey.scopes,
        expiresIn: existingKey.expiresAt ?
          existingKey.expiresAt.getTime() - Date.now() : null,
      });

      logger.info(`API key regenerated: ${existingKey.name}`, {
        userId: userId,
        oldKeyId: keyId,
        newKeyId: newApiKey.id,
        ip: req.ip,
      });

      res.json({
        message: 'API key regenerated successfully',
        apiKey: newApiKey,
      });
    } catch (error) {
      logger.error('Regenerate API key error', {
        error: error.message,
        userId: req.user?.id,
        keyId: req.params.keyId,
        ip: req.ip,
      });

      res.status(400).json({
        error: 'API key regeneration failed',
        message: error.message,
      });
    }
  }

  /**
   * Get API key usage statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getApiKeyStats(req, res) {
    try {
      const { keyId } = req.params;
      const userId = req.user.id;

      const apiKeys = authService.getUserApiKeys(userId);
      const apiKey = apiKeys.find(key => key.id === keyId);

      if (!apiKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The requested API key was not found',
        });
      }

      // In a real implementation, you would fetch usage statistics from your analytics system
      const stats = {
        totalRequests: apiKey.usageCount || 0,
        lastUsed: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        rateLimit: apiKey.rateLimit,
        currentPeriodUsage: 0, // Would be calculated from actual usage data
        remainingRequests: apiKey.rateLimit,
      };

      res.json({
        keyId: apiKey.id,
        name: apiKey.name,
        stats,
      });
    } catch (error) {
      logger.error('Get API key stats error', {
        error: error.message,
        userId: req.user?.id,
        keyId: req.params.keyId,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Failed to retrieve API key statistics',
        message: 'An error occurred while retrieving statistics',
      });
    }
  }

  /**
   * Admin endpoint: Get all API keys in the system
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllApiKeys(req, res) {
    try {
      // This would require admin role (handled by middleware)
      const { page = 1, limit = 20, _userId, _isActive } = req.query;

      // In a real implementation, you would query the database with pagination
      // For now, we'll simulate with the in-memory data
      let allKeys = [];

      // Get all API keys from all users (admin function)
      // This is simplified - in reality you'd query the database

      res.json({
        apiKeys: allKeys,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allKeys.length,
          totalPages: Math.ceil(allKeys.length / limit),
        },
      });
    } catch (error) {
      logger.error('Get all API keys error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Failed to retrieve API keys',
        message: 'An error occurred while retrieving API keys',
      });
    }
  }

  /**
   * Get API key scopes and permissions information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getScopesInfo(req, res) {
    try {
      const scopesInfo = {
        availableScopes: [
          {
            scope: 'read',
            description: 'Read access to analysis results and channel data',
            permissions: ['View analysis results', 'Access channel information'],
          },
          {
            scope: 'write',
            description: 'Write access to create and modify analyses',
            permissions: ['Create new analyses', 'Modify existing analyses', 'All read permissions'],
          },
          {
            scope: 'admin',
            description: 'Administrative access to all system features',
            permissions: ['All write permissions', 'User management', 'System configuration'],
          },
        ],
        userRole: req.user.role,
        allowedScopes: req.user.role === 'admin' ?
          ['read', 'write', 'admin'] :
          ['read', 'write'],
      };

      res.json(scopesInfo);
    } catch (error) {
      logger.error('Get scopes info error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        error: 'Failed to retrieve scopes information',
        message: 'An error occurred while retrieving scopes information',
      });
    }
  }
}

module.exports = ApiKeyController;