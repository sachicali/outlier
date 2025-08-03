const express = require('express');
const ApiKeyController = require('../controllers/apiKeyController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireAdmin } = require('../middleware/rbac');

const router = express.Router();

/**
 * API Key management routes
 * Handles CRUD operations for user API keys
 */

/**
 * @route   GET /api/apikeys
 * @desc    Get all API keys for current user
 * @access  Private
 */
router.get('/',
  authenticate,
  requirePermission('apikey:read'),
  ApiKeyController.getUserApiKeys,
);

/**
 * @route   POST /api/apikeys
 * @desc    Create a new API key
 * @access  Private
 */
router.post('/',
  authenticate,
  ApiKeyController.createValidation,
  requirePermission('apikey:write'),
  ApiKeyController.createApiKey,
);

/**
 * @route   GET /api/apikeys/scopes
 * @desc    Get available scopes and permissions information
 * @access  Private
 */
router.get('/scopes',
  authenticate,
  ApiKeyController.getScopesInfo,
);

/**
 * @route   GET /api/apikeys/:keyId
 * @desc    Get a specific API key
 * @access  Private
 */
router.get('/:keyId',
  authenticate,
  requirePermission('apikey:read'),
  ApiKeyController.getApiKey,
);

/**
 * @route   PUT /api/apikeys/:keyId
 * @desc    Update an API key
 * @access  Private
 */
router.put('/:keyId',
  authenticate,
  ApiKeyController.updateValidation,
  requirePermission('apikey:write'),
  ApiKeyController.updateApiKey,
);

/**
 * @route   DELETE /api/apikeys/:keyId
 * @desc    Delete an API key
 * @access  Private
 */
router.delete('/:keyId',
  authenticate,
  requirePermission('apikey:delete'),
  ApiKeyController.deleteApiKey,
);

/**
 * @route   POST /api/apikeys/:keyId/regenerate
 * @desc    Regenerate an API key (creates new key, deactivates old)
 * @access  Private
 */
router.post('/:keyId/regenerate',
  authenticate,
  requirePermission('apikey:write'),
  ApiKeyController.regenerateApiKey,
);

/**
 * @route   GET /api/apikeys/:keyId/stats
 * @desc    Get API key usage statistics
 * @access  Private
 */
router.get('/:keyId/stats',
  authenticate,
  requirePermission('apikey:read'),
  ApiKeyController.getApiKeyStats,
);

/**
 * Admin routes
 */

/**
 * @route   GET /api/apikeys/admin/all
 * @desc    Get all API keys in the system (admin only)
 * @access  Private (Admin)
 */
router.get('/admin/all',
  authenticate,
  requireAdmin,
  ApiKeyController.getAllApiKeys,
);

module.exports = router;