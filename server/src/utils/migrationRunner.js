const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Simple migration runner for database schema management
 * Provides up/down migration support with rollback capabilities
 */
class MigrationRunner {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.migrationsPath = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Initialize migrations table to track applied migrations
   */
  async initializeMigrationsTable() {
    const queryInterface = this.sequelize.getQueryInterface();

    try {
      await queryInterface.createTable('schema_migrations', {
        name: {
          type: this.sequelize.Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
        },
        applied_at: {
          type: this.sequelize.Sequelize.DATE,
          allowNull: false,
          defaultValue: this.sequelize.Sequelize.NOW,
        },
      });
      logger.info('Created schema_migrations table');
    } catch (error) {
      if (error.name === 'SequelizeDatabaseError' && error.message.includes('already exists')) {
        // Table already exists, that's fine
        logger.debug('schema_migrations table already exists');
      } else {
        throw error;
      }
    }
  }

  /**
   * Get list of migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort();
    } catch (error) {
      logger.error('Error reading migrations directory:', error);
      throw error;
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    try {
      const results = await this.sequelize.query(
        'SELECT name FROM schema_migrations ORDER BY name',
        { type: this.sequelize.QueryTypes.SELECT },
      );
      return results.map(row => row.name);
    } catch (error) {
      logger.error('Error fetching applied migrations:', error);
      throw error;
    }
  }

  /**
   * Record migration as applied
   */
  async recordMigration(migrationName) {
    await this.sequelize.query(
      'INSERT INTO schema_migrations (name) VALUES (?)',
      {
        replacements: [migrationName],
        type: this.sequelize.QueryTypes.INSERT,
      },
    );
  }

  /**
   * Remove migration record
   */
  async removeMigrationRecord(migrationName) {
    await this.sequelize.query(
      'DELETE FROM schema_migrations WHERE name = ?',
      {
        replacements: [migrationName],
        type: this.sequelize.QueryTypes.DELETE,
      },
    );
  }

  /**
   * Load and execute a migration file
   */
  async loadMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(migrationPath)];
      return require(migrationPath);
    } catch (error) {
      logger.error(`Error loading migration ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  async migrate() {
    await this.initializeMigrationsTable();

    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    const pendingMigrations = migrationFiles.filter(
      file => !appliedMigrations.includes(file),
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to run');
      return;
    }

    logger.info(`Running ${pendingMigrations.length} pending migrations...`);

    const transaction = await this.sequelize.transaction();

    try {
      for (const filename of pendingMigrations) {
        logger.info(`Running migration: ${filename}`);

        const migration = await this.loadMigration(filename);
        const queryInterface = this.sequelize.getQueryInterface();

        await migration.up(queryInterface, this.sequelize.Sequelize);
        await this.recordMigration(filename);

        logger.info(`✓ Applied migration: ${filename}`);
      }

      await transaction.commit();
      logger.info('All migrations completed successfully');

    } catch (error) {
      await transaction.rollback();
      logger.error('Migration failed, rolling back transaction:', error);
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  async rollback() {
    await this.initializeMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    logger.info(`Rolling back migration: ${lastMigration}`);

    const transaction = await this.sequelize.transaction();

    try {
      const migration = await this.loadMigration(lastMigration);
      const queryInterface = this.sequelize.getQueryInterface();

      await migration.down(queryInterface, this.sequelize.Sequelize);
      await this.removeMigrationRecord(lastMigration);

      await transaction.commit();
      logger.info(`✓ Rolled back migration: ${lastMigration}`);

    } catch (error) {
      await transaction.rollback();
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Rollback multiple migrations
   */
  async rollbackTo(targetMigration) {
    await this.initializeMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    const targetIndex = appliedMigrations.indexOf(targetMigration);

    if (targetIndex === -1) {
      throw new Error(`Migration ${targetMigration} not found in applied migrations`);
    }

    const migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();

    if (migrationsToRollback.length === 0) {
      logger.info('Already at target migration, no rollback needed');
      return;
    }

    logger.info(`Rolling back ${migrationsToRollback.length} migrations to ${targetMigration}...`);

    const transaction = await this.sequelize.transaction();

    try {
      for (const migrationName of migrationsToRollback) {
        logger.info(`Rolling back migration: ${migrationName}`);

        const migration = await this.loadMigration(migrationName);
        const queryInterface = this.sequelize.getQueryInterface();

        await migration.down(queryInterface, this.sequelize.Sequelize);
        await this.removeMigrationRecord(migrationName);

        logger.info(`✓ Rolled back migration: ${migrationName}`);
      }

      await transaction.commit();
      logger.info(`Successfully rolled back to migration: ${targetMigration}`);

    } catch (error) {
      await transaction.rollback();
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    await this.initializeMigrationsTable();

    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    const status = migrationFiles.map(filename => ({
      name: filename,
      applied: appliedMigrations.includes(filename),
    }));

    return {
      total: migrationFiles.length,
      applied: appliedMigrations.length,
      pending: migrationFiles.length - appliedMigrations.length,
      migrations: status,
    };
  }

  /**
   * Reset database (rollback all migrations)
   */
  async reset() {
    await this.initializeMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      logger.info('No migrations to reset');
      return;
    }

    logger.info(`Resetting database (rolling back ${appliedMigrations.length} migrations)...`);

    const transaction = await this.sequelize.transaction();

    try {
      // Rollback in reverse order
      for (const migrationName of appliedMigrations.reverse()) {
        logger.info(`Rolling back migration: ${migrationName}`);

        const migration = await this.loadMigration(migrationName);
        const queryInterface = this.sequelize.getQueryInterface();

        await migration.down(queryInterface, this.sequelize.Sequelize);
        await this.removeMigrationRecord(migrationName);

        logger.info(`✓ Rolled back migration: ${migrationName}`);
      }

      await transaction.commit();
      logger.info('Database reset completed');

    } catch (error) {
      await transaction.rollback();
      logger.error('Database reset failed:', error);
      throw error;
    }
  }
}

module.exports = MigrationRunner;