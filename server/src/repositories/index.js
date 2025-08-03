const databaseManager = require('../config/database');
const AnalysisRepository = require('./AnalysisRepository');
const ChannelRepository = require('./ChannelRepository');

/**
 * Repository factory that provides access to all repositories
 * Automatically handles database vs fallback mode based on connection status
 */
class RepositoryFactory {
  constructor() {
    this.repositories = {};
    this.initialized = false;
  }

  /**
   * Initialize repositories with models (if database is connected)
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Check if database is connected
      const isConnected = databaseManager.isConnected;

      if (isConnected) {
        // Get models from sequelize instance
        const models = databaseManager.sequelize.models;

        // Initialize repositories with models
        this.repositories.analysis = new AnalysisRepository(models.Analysis);
        this.repositories.channel = new ChannelRepository(models.Channel);

        console.log('Repositories initialized with database models');
      } else {
        // Initialize repositories without models (fallback mode)
        this.repositories.analysis = new AnalysisRepository();
        this.repositories.channel = new ChannelRepository();

        console.log('Repositories initialized in fallback mode (no database)');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing repositories:', error);

      // Fallback to in-memory mode
      this.repositories.analysis = new AnalysisRepository();
      this.repositories.channel = new ChannelRepository();

      this.initialized = true;
    }
  }

  /**
   * Get analysis repository
   * @returns {AnalysisRepository} Analysis repository instance
   */
  getAnalysisRepository() {
    if (!this.initialized) {
      throw new Error('Repositories not initialized. Call initialize() first.');
    }
    return this.repositories.analysis;
  }

  /**
   * Get channel repository
   * @returns {ChannelRepository} Channel repository instance
   */
  getChannelRepository() {
    if (!this.initialized) {
      throw new Error('Repositories not initialized. Call initialize() first.');
    }
    return this.repositories.channel;
  }

  /**
   * Get all repositories
   * @returns {Object} All repository instances
   */
  getAllRepositories() {
    if (!this.initialized) {
      throw new Error('Repositories not initialized. Call initialize() first.');
    }
    return { ...this.repositories };
  }

  /**
   * Check if repositories are using database or fallback mode
   * @returns {boolean} True if using database, false if using fallback
   */
  isUsingDatabase() {
    return databaseManager.isConnected;
  }

  /**
   * Get database health status
   * @returns {Promise<Object>} Database health status
   */
  async getHealthStatus() {
    return await databaseManager.getHealthStatus();
  }
}

// Export singleton instance
const repositoryFactory = new RepositoryFactory();

// Convenience exports for direct access
module.exports = {
  repositoryFactory,

  // Direct access methods (will initialize if needed)
  async getAnalysisRepository() {
    if (!repositoryFactory.initialized) {
      await repositoryFactory.initialize();
    }
    return repositoryFactory.getAnalysisRepository();
  },

  async getChannelRepository() {
    if (!repositoryFactory.initialized) {
      await repositoryFactory.initialize();
    }
    return repositoryFactory.getChannelRepository();
  },

  async getAllRepositories() {
    if (!repositoryFactory.initialized) {
      await repositoryFactory.initialize();
    }
    return repositoryFactory.getAllRepositories();
  },

  // Re-export classes for testing
  AnalysisRepository,
  ChannelRepository,
};