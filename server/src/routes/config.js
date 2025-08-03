const express = require('express');
const router = express.Router();
const contentConfig = require('../config/contentConfig');
const logger = require('../utils/logger');

/**
 * @route GET /api/config/content
 * @desc Get current content configuration
 * @access Public (consider adding authentication in production)
 */
router.get('/content', async (req, res) => {
  try {
    const config = await contentConfig.loadConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Error fetching content configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
    });
  }
});

/**
 * @route GET /api/config/content/search-queries
 * @desc Get current search queries
 * @access Public
 */
router.get('/content/search-queries', async (req, res) => {
  try {
    const searchQueries = await contentConfig.getSearchQueries();
    res.json({
      success: true,
      data: searchQueries,
    });
  } catch (error) {
    logger.error('Error fetching search queries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch search queries',
    });
  }
});

/**
 * @route GET /api/config/content/game-patterns
 * @desc Get current game patterns
 * @access Public
 */
router.get('/content/game-patterns', async (req, res) => {
  try {
    const gamePatterns = await contentConfig.getGamePatterns();
    res.json({
      success: true,
      data: gamePatterns,
    });
  } catch (error) {
    logger.error('Error fetching game patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch game patterns',
    });
  }
});

/**
 * @route PUT /api/config/content
 * @desc Update content configuration
 * @access Private (requires authentication - add auth middleware in production)
 */
router.put('/content', async (req, res) => {
  try {
    const newConfig = req.body;

    // Validate required fields
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration data',
      });
    }

    await contentConfig.updateConfig(newConfig);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    logger.error('Error updating content configuration:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update configuration',
    });
  }
});

/**
 * @route PUT /api/config/content/search-queries
 * @desc Update search queries only
 * @access Private
 */
router.put('/content/search-queries', async (req, res) => {
  try {
    const { searchQueries } = req.body;

    if (!Array.isArray(searchQueries)) {
      return res.status(400).json({
        success: false,
        error: 'searchQueries must be an array',
      });
    }

    // Get current config and update search queries
    const currentConfig = await contentConfig.loadConfig();
    currentConfig.searchQueries = searchQueries;

    await contentConfig.updateConfig(currentConfig);

    res.json({
      success: true,
      message: 'Search queries updated successfully',
    });
  } catch (error) {
    logger.error('Error updating search queries:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update search queries',
    });
  }
});

/**
 * @route PUT /api/config/content/game-patterns
 * @desc Update game patterns only
 * @access Private
 */
router.put('/content/game-patterns', async (req, res) => {
  try {
    const { gamePatterns } = req.body;

    if (!Array.isArray(gamePatterns)) {
      return res.status(400).json({
        success: false,
        error: 'gamePatterns must be an array',
      });
    }

    // Validate pattern structure
    for (const pattern of gamePatterns) {
      if (!pattern.pattern) {
        return res.status(400).json({
          success: false,
          error: 'Each game pattern must have a pattern field',
        });
      }
    }

    // Get current config and update game patterns
    const currentConfig = await contentConfig.loadConfig();
    currentConfig.gamePatterns = gamePatterns;

    await contentConfig.updateConfig(currentConfig);

    res.json({
      success: true,
      message: 'Game patterns updated successfully',
    });
  } catch (error) {
    logger.error('Error updating game patterns:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update game patterns',
    });
  }
});

/**
 * @route POST /api/config/content/reset
 * @desc Reset configuration to defaults
 * @access Private
 */
router.post('/content/reset', async (req, res) => {
  try {
    const defaultConfig = contentConfig.getDefaultConfig();
    await contentConfig.updateConfig(defaultConfig);

    res.json({
      success: true,
      message: 'Configuration reset to defaults',
    });
  } catch (error) {
    logger.error('Error resetting configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset configuration',
    });
  }
});

/**
 * @route GET /api/config/content/path
 * @desc Get configuration file path for external editing
 * @access Private
 */
router.get('/content/path', (req, res) => {
  try {
    const configPath = contentConfig.getConfigPath();
    res.json({
      success: true,
      data: {
        configPath,
        message: 'Configuration file can be edited directly and will be automatically reloaded',
      },
    });
  } catch (error) {
    logger.error('Error getting configuration path:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration path',
    });
  }
});

module.exports = router;