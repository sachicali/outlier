const path = require('path');
const fs = require('fs');

// Initialize logger with fallback for standalone usage
let logger;
try {
  // Check if we're in a proper server environment
  if (process.env.NODE_ENV || process.env.LOG_LEVEL) {
    logger = require('../utils/logger');
  } else {
    throw new Error('Not in server environment');
  }
} catch (error) {
  // Fallback console logger for standalone usage
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
  };
}

class ContentConfigService {
  constructor() {
    this.config = null;
    this.configPath = path.join(__dirname, 'content-patterns.json');
    this.lastModified = null;
  }

  /**
   * Load configuration from file and environment variables
   */
  async loadConfig() {
    try {
      // Check if config file exists, create default if not
      if (!fs.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }

      // Read file stats to check for changes
      const stats = fs.statSync(this.configPath);

      // Only reload if file has been modified or config not loaded
      if (!this.config || this.lastModified !== stats.mtime.getTime()) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
        this.lastModified = stats.mtime.getTime();

        // Override with environment variables if present
        this.applyEnvironmentOverrides();

        if (logger && logger.info) logger.info('Content configuration loaded successfully');
      }

      return this.config;
    } catch (error) {
      if (logger && logger.error) logger.error('Error loading content configuration:', error);

      // Fall back to default config if file loading fails
      if (!this.config) {
        this.config = this.getDefaultConfig();
        if (logger && logger.warn) logger.warn('Using default content configuration due to load error');
      }

      return this.config;
    }
  }

  /**
   * Get search queries with environment variable override
   */
  async getSearchQueries() {
    const config = await this.loadConfig();
    return config.searchQueries;
  }

  /**
   * Get game patterns with environment variable override
   */
  async getGamePatterns() {
    const config = await this.loadConfig();
    return config.gamePatterns;
  }

  /**
   * Get brand fit criteria
   */
  async getBrandFitCriteria() {
    const config = await this.loadConfig();
    return config.brandFit;
  }

  /**
   * Get channel validation criteria
   */
  async getChannelCriteria() {
    const config = await this.loadConfig();
    return config.channelCriteria;
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    // Override search queries from environment
    const envSearchQueries = process.env.CONTENT_SEARCH_QUERIES;
    if (envSearchQueries) {
      try {
        this.config.searchQueries = JSON.parse(envSearchQueries);
        if (logger && logger.info) logger.info('Using search queries from environment variables');
      } catch (error) {
        if (logger && logger.error) logger.error('Invalid JSON in CONTENT_SEARCH_QUERIES environment variable:', error);
      }
    }

    // Override game patterns from environment
    const envGamePatterns = process.env.CONTENT_GAME_PATTERNS;
    if (envGamePatterns) {
      try {
        const patterns = JSON.parse(envGamePatterns);
        this.config.gamePatterns = patterns.map(pattern => ({
          pattern: pattern.pattern,
          flags: pattern.flags || 'gi',
        }));
        if (logger && logger.info) logger.info('Using game patterns from environment variables');
      } catch (error) {
        if (logger && logger.error) logger.error('Invalid JSON in CONTENT_GAME_PATTERNS environment variable:', error);
      }
    }

    // Override outlier threshold
    if (process.env.OUTLIER_THRESHOLD) {
      this.config.outlierThreshold = parseFloat(process.env.OUTLIER_THRESHOLD);
    }

    // Override brand fit threshold
    if (process.env.BRAND_FIT_THRESHOLD) {
      this.config.brandFit.threshold = parseFloat(process.env.BRAND_FIT_THRESHOLD);
    }
  }

  /**
   * Create default configuration file
   */
  async createDefaultConfig() {
    const defaultConfig = this.getDefaultConfig();

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      if (logger && logger.info) logger.info(`Created default content configuration at ${this.configPath}`);
    } catch (error) {
      if (logger && logger.error) logger.error('Error creating default configuration file:', error);
      throw error;
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      description: 'Content discovery configuration for YouTube Outlier Detection',

      // Search queries for discovering adjacent channels
      searchQueries: [
        'roblox piggy funny moments',
        'brookhaven roleplay family',
        'murder mystery 2 roblox',
        'tower of hell roblox rage',
        'arsenal roblox funny',
        'adopt me roblox pets',
        'flee the facility roblox',
        'natural disaster survival roblox',
      ],

      // Game patterns for exclusion detection
      gamePatterns: [
        { pattern: 'doors?', flags: 'gi' },
        { pattern: '99 nights? in the forest', flags: 'gi' },
        { pattern: 'dead shelter', flags: 'gi' },
        { pattern: 'dead rails', flags: 'gi' },
        { pattern: 'squid game', flags: 'gi' },
        { pattern: 'prison run', flags: 'gi' },
        { pattern: 'sprunki', flags: 'gi' },
        { pattern: 'piggy', flags: 'gi' },
        { pattern: 'brookhaven', flags: 'gi' },
        { pattern: 'murder mystery', flags: 'gi' },
        { pattern: 'arsenal', flags: 'gi' },
        { pattern: 'adopt me', flags: 'gi' },
        { pattern: 'tower of hell', flags: 'gi' },
        { pattern: 'flee the facility', flags: 'gi' },
        { pattern: 'natural disaster', flags: 'gi' },
      ],

      // Brand fit scoring criteria
      brandFit: {
        threshold: 6,
        baseScore: 5,
        positiveIndicators: [
          { keywords: ['funny', 'moments'], score: 1 },
          { keywords: ['reaction', 'react'], score: 0.5 },
          { keywords: ['family', 'kid'], score: 1 },
          { pattern: '[!?]{2,}', score: 0.5, description: 'Excited punctuation' },
          { pattern: '[A-Z]{3,}', score: 0.5, description: 'Caps for emphasis' },
        ],
        negativeIndicators: [
          { keywords: ['adult', 'mature'], score: -2 },
          { keywords: ['horror'], score: -1, excludeKeywords: ['funny'] },
          { descriptionKeywords: ['18+', 'mature'], score: -2 },
        ],
      },

      // Channel validation criteria
      channelCriteria: {
        minSubscribers: 10000,
        maxSubscribers: 500000,
        minVideoCount: 50,
        excludeTitleKeywords: ['music', 'news'],
        excludeDescriptionKeywords: [],
      },

      // Analysis thresholds
      outlierThreshold: 20,
      timeWindowDays: 7,
      maxResults: 50,
    };
  }

  /**
   * Update configuration file
   */
  async updateConfig(newConfig) {
    try {
      // Validate the new configuration
      this.validateConfig(newConfig);

      // Add metadata
      newConfig.lastUpdated = new Date().toISOString();

      // Write to file
      fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2));

      // Reload configuration
      this.config = null;
      await this.loadConfig();

      if (logger && logger.info) logger.info('Content configuration updated successfully');
      return true;
    } catch (error) {
      if (logger && logger.error) logger.error('Error updating content configuration:', error);
      throw error;
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config) {
    const required = ['searchQueries', 'gamePatterns', 'brandFit', 'channelCriteria'];

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    if (!Array.isArray(config.searchQueries)) {
      throw new Error('searchQueries must be an array');
    }

    if (!Array.isArray(config.gamePatterns)) {
      throw new Error('gamePatterns must be an array');
    }

    // Validate game patterns structure
    for (const pattern of config.gamePatterns) {
      if (!pattern.pattern) {
        throw new Error('Each game pattern must have a pattern field');
      }
    }

    return true;
  }

  /**
   * Get configuration file path for external access
   */
  getConfigPath() {
    return this.configPath;
  }
}

module.exports = new ContentConfigService();