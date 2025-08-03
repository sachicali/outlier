const databaseManager = require('./database');
const MigrationRunner = require('../utils/migrationRunner');
const { repositoryFactory } = require('../repositories');
const logger = require('../utils/logger');

/**
 * Initialize database connection, run migrations, and set up repositories
 * Provides graceful fallback to in-memory mode for development
 */
async function initializeDatabase() {
  try {
    logger.info('Initializing database...');

    // Step 1: Initialize database connection
    const connected = await databaseManager.initialize();

    if (connected) {
      logger.info('Database connection established');

      // Step 2: Initialize models and associations
      await databaseManager.initializeModels();
      logger.info('Database models initialized');

      // Step 3: Run migrations (optional - controlled by environment)
      if (process.env.RUN_MIGRATIONS === 'true') {
        logger.info('Running database migrations...');
        const migrationRunner = new MigrationRunner(databaseManager.sequelize);
        await migrationRunner.migrate();
        logger.info('Database migrations completed');
      } else if (process.env.NODE_ENV === 'development' && process.env.AUTO_SYNC === 'true') {
        // In development, optionally auto-sync schema
        logger.info('Auto-syncing database schema...');
        await databaseManager.syncDatabase(false);
        logger.info('Database schema synchronized');
      }

      // Step 4: Initialize repositories with database models
      await repositoryFactory.initialize();
      logger.info('Repositories initialized with database support');

      return {
        connected: true,
        mode: 'database',
        database: databaseManager.getConfig().database,
        host: databaseManager.getConfig().host,
      };

    } else {
      // Database not configured or connection failed
      logger.warn('Database not available, initializing fallback mode');

      // Initialize repositories without database
      await repositoryFactory.initialize();
      logger.info('Repositories initialized in fallback mode');

      return {
        connected: false,
        mode: 'in-memory',
        reason: 'Database not configured or connection failed',
      };
    }

  } catch (error) {
    logger.error('Database initialization failed:', error);

    // Fallback to in-memory mode
    try {
      logger.warn('Falling back to in-memory mode...');
      await repositoryFactory.initialize();
      logger.info('Repositories initialized in fallback mode');

      return {
        connected: false,
        mode: 'in-memory',
        reason: `Database error: ${error.message}`,
      };
    } catch (fallbackError) {
      logger.error('Fallback initialization failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Get database migration status
 * @returns {Promise<Object>} Migration status
 */
async function getMigrationStatus() {
  if (!databaseManager.isConnected) {
    return {
      available: false,
      reason: 'Database not connected',
    };
  }

  try {
    const migrationRunner = new MigrationRunner(databaseManager.sequelize);
    const status = await migrationRunner.getStatus();

    return {
      available: true,
      ...status,
    };
  } catch (error) {
    logger.error('Error getting migration status:', error);
    return {
      available: false,
      reason: error.message,
    };
  }
}

/**
 * Run database migrations
 * @returns {Promise<Object>} Migration result
 */
async function runMigrations() {
  if (!databaseManager.isConnected) {
    throw new Error('Database not connected');
  }

  try {
    const migrationRunner = new MigrationRunner(databaseManager.sequelize);
    await migrationRunner.migrate();

    return {
      success: true,
      message: 'Migrations completed successfully',
    };
  } catch (error) {
    logger.error('Migration failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Rollback last migration
 * @returns {Promise<Object>} Rollback result
 */
async function rollbackMigration() {
  if (!databaseManager.isConnected) {
    throw new Error('Database not connected');
  }

  try {
    const migrationRunner = new MigrationRunner(databaseManager.sequelize);
    await migrationRunner.rollback();

    return {
      success: true,
      message: 'Rollback completed successfully',
    };
  } catch (error) {
    logger.error('Rollback failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Reset database (rollback all migrations)
 * @returns {Promise<Object>} Reset result
 */
async function resetDatabase() {
  if (!databaseManager.isConnected) {
    throw new Error('Database not connected');
  }

  try {
    const migrationRunner = new MigrationRunner(databaseManager.sequelize);
    await migrationRunner.reset();

    return {
      success: true,
      message: 'Database reset completed successfully',
    };
  } catch (error) {
    logger.error('Database reset failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Gracefully close database connections
 */
async function closeDatabase() {
  try {
    await databaseManager.close();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }
}

module.exports = {
  initializeDatabase,
  getMigrationStatus,
  runMigrations,
  rollbackMigration,
  resetDatabase,
  closeDatabase,
  databaseManager,
};