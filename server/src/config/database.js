const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection with connection pooling
   * Supports fallback to development mode without database
   */
  async initialize() {
    const config = this.getConfig();

    if (!config.database || process.env.NODE_ENV === 'development' && !process.env.FORCE_DB) {
      logger.warn('Database not configured or disabled for development. Running in memory mode.');
      return false;
    }

    try {
      this.sequelize = new Sequelize(config.database, config.username, config.password, {
        host: config.host,
        port: config.port,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,

        // Connection Pool Configuration
        pool: {
          max: parseInt(process.env.DB_POOL_MAX) || 20,
          min: parseInt(process.env.DB_POOL_MIN) || 5,
          acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
          idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
          evict: parseInt(process.env.DB_POOL_EVICT) || 1000,
        },

        // Query Options
        define: {
          underscored: true, // Use snake_case for column names
          freezeTableName: true, // Don't pluralize table names
          timestamps: true, // Add createdAt and updatedAt
          paranoid: true, // Add deletedAt for soft deletes
        },

        // Retry Configuration
        retry: {
          max: 3,
          timeout: 60000,
          match: [
            Sequelize.ConnectionError,
            Sequelize.ConnectionTimedOutError,
            Sequelize.TimeoutError,
          ],
        },

        // SSL Configuration for production
        dialectOptions: process.env.NODE_ENV === 'production' ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        } : {},
      });

      // Test connection
      await this.sequelize.authenticate();
      this.isConnected = true;

      logger.info('Database connection established successfully');
      logger.info(`Connected to: ${config.host}:${config.port}/${config.database}`);

      return true;
    } catch (error) {
      logger.error('Unable to connect to database:', error);

      // In development, allow graceful fallback
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Falling back to in-memory mode for development');
        return false;
      }

      throw error;
    }
  }

  /**
   * Get database configuration from environment variables
   */
  getConfig() {
    return {
      database: process.env.DB_NAME || process.env.DATABASE_URL,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || '',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
    };
  }

  /**
   * Initialize all models and associations
   */
  async initializeModels() {
    if (!this.isConnected) {
      return;
    }

    // Import all models
    const User = require('../models/sequelize/User');
    const Analysis = require('../models/sequelize/Analysis');
    const Channel = require('../models/sequelize/Channel');
    const Video = require('../models/sequelize/Video');
    const ExclusionList = require('../models/sequelize/ExclusionList');

    // Initialize models
    User.init(this.sequelize);
    Analysis.init(this.sequelize);
    Channel.init(this.sequelize);
    Video.init(this.sequelize);
    ExclusionList.init(this.sequelize);

    // Set up associations
    this.setupAssociations();

    logger.info('Models initialized successfully');
  }

  /**
   * Setup model associations
   */
  setupAssociations() {
    const { User, Analysis, Channel, Video, ExclusionList } = this.sequelize.models;

    // User -> Analysis (One-to-Many)
    User.hasMany(Analysis, { foreignKey: 'user_id', as: 'analyses' });
    Analysis.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    // Analysis -> Channel (Many-to-Many through analysis_channels)
    Analysis.belongsToMany(Channel, {
      through: 'analysis_channels',
      foreignKey: 'analysis_id',
      otherKey: 'channel_id',
      as: 'channels',
    });
    Channel.belongsToMany(Analysis, {
      through: 'analysis_channels',
      foreignKey: 'channel_id',
      otherKey: 'analysis_id',
      as: 'analyses',
    });

    // Channel -> Video (One-to-Many)
    Channel.hasMany(Video, { foreignKey: 'channel_id', as: 'videos' });
    Video.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });

    // Analysis -> Video (Many-to-Many through analysis_videos for outliers)
    Analysis.belongsToMany(Video, {
      through: 'analysis_videos',
      foreignKey: 'analysis_id',
      otherKey: 'video_id',
      as: 'outlierVideos',
    });
    Video.belongsToMany(Analysis, {
      through: 'analysis_videos',
      foreignKey: 'video_id',
      otherKey: 'analysis_id',
      as: 'outlierAnalyses',
    });

    // User -> ExclusionList (One-to-Many)
    User.hasMany(ExclusionList, { foreignKey: 'user_id', as: 'exclusionLists' });
    ExclusionList.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  }

  /**
   * Sync database schema (create tables)
   * @param {boolean} force - Force recreate tables
   */
  async syncDatabase(force = false) {
    if (!this.isConnected) {
      logger.warn('Database not connected. Skipping sync.');
      return;
    }

    try {
      await this.sequelize.sync({ force, alter: !force });
      logger.info(`Database synchronized successfully ${force ? '(forced)' : ''}`);
    } catch (error) {
      logger.error('Database sync failed:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    if (!this.isConnected) {
      return {
        status: 'disconnected',
        message: 'Database not connected or disabled',
      };
    }

    try {
      await this.sequelize.authenticate();
      return {
        status: 'healthy',
        message: 'Database connection is active',
        pool: {
          size: this.sequelize.connectionManager.pool.size,
          available: this.sequelize.connectionManager.pool.available,
          using: this.sequelize.connectionManager.pool.using,
          waiting: this.sequelize.connectionManager.pool.pending,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message,
      };
    }
  }

  /**
   * Execute raw SQL query (use with caution)
   */
  async query(sql, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.sequelize.query(sql, options);
  }
}

// Export singleton instance
const databaseManager = new DatabaseManager();
module.exports = databaseManager;