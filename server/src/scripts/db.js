#!/usr/bin/env node

/**
 * Database CLI utility for migrations and management
 * Usage: node scripts/db.js <command> [options]
 *
 * Commands:
 *   migrate     - Run pending migrations
 *   rollback    - Rollback last migration
 *   reset       - Reset database (rollback all)
 *   status      - Show migration status
 *   create      - Create a new migration (not implemented)
 */

const { Command } = require('commander');
const {
  initializeDatabase,
  getMigrationStatus,
  runMigrations,
  rollbackMigration,
  resetDatabase,
  closeDatabase,
  databaseManager,
} = require('../config/initializeDatabase');
// Fallback logger for CLI usage
const logger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

const program = new Command();

program
  .name('db')
  .description('Database management CLI')
  .version('1.0.0');

program
  .command('migrate')
  .description('Run pending database migrations')
  .action(async () => {
    try {
      console.log('Initializing database connection...');
      await initializeDatabase();

      console.log('Running migrations...');
      const result = await runMigrations();

      if (result.success) {
        console.log('✅ Migrations completed successfully');
      } else {
        console.error('❌ Migration failed:', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error running migrations:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('rollback')
  .description('Rollback the last migration')
  .action(async () => {
    try {
      console.log('Initializing database connection...');
      await initializeDatabase();

      console.log('Rolling back last migration...');
      const result = await rollbackMigration();

      if (result.success) {
        console.log('✅ Rollback completed successfully');
      } else {
        console.error('❌ Rollback failed:', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error rolling back migration:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('reset')
  .description('Reset database (rollback all migrations)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.yes) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise(resolve => {
          readline.question('⚠️  This will reset the entire database. Are you sure? (y/N): ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Reset cancelled');
          return;
        }
      }

      console.log('Initializing database connection...');
      await initializeDatabase();

      console.log('Resetting database...');
      const result = await resetDatabase();

      if (result.success) {
        console.log('✅ Database reset completed successfully');
      } else {
        console.error('❌ Database reset failed:', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error resetting database:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      console.log('Initializing database connection...');
      await initializeDatabase();

      console.log('Checking migration status...');
      const status = await getMigrationStatus();

      if (!status.available) {
        console.log('❌ Migration status not available:', status.reason);
        return;
      }

      console.log('📊 Migration Status:');
      console.log(`   Total migrations: ${status.total}`);
      console.log(`   Applied: ${status.applied}`);
      console.log(`   Pending: ${status.pending}`);
      console.log('');

      if (status.migrations && status.migrations.length > 0) {
        console.log('📋 Migration List:');
        status.migrations.forEach(migration => {
          const icon = migration.applied ? '✅' : '⏳';
          console.log(`   ${icon} ${migration.name}`);
        });
      }
    } catch (error) {
      console.error('❌ Error checking migration status:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('sync')
  .description('Sync database schema without migrations (development only)')
  .option('--force', 'Force recreate tables (WARNING: will delete data)')
  .action(async (options) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Schema sync is not allowed in production. Use migrations instead.');
        process.exit(1);
      }

      if (options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise(resolve => {
          readline.question('⚠️  Force sync will delete all data. Are you sure? (y/N): ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Sync cancelled');
          return;
        }
      }

      console.log('Initializing database connection...');
      await initializeDatabase();

      console.log('Syncing database schema...');
      await databaseManager.syncDatabase(options.force);

      console.log('✅ Database schema synchronized');
    } catch (error) {
      console.error('❌ Error syncing database:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('test-connection')
  .description('Test database connection')
  .action(async () => {
    try {
      console.log('Testing database connection...');
      const dbStatus = await initializeDatabase();

      if (dbStatus.connected) {
        console.log('✅ Database connection successful');
        console.log(`   Mode: ${dbStatus.mode}`);
        console.log(`   Database: ${dbStatus.database}`);
        console.log(`   Host: ${dbStatus.host}`);
      } else {
        console.log('⚠️  Database connection failed, using fallback mode');
        console.log(`   Reason: ${dbStatus.reason}`);
      }
    } catch (error) {
      console.error('❌ Error testing connection:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

// Handle errors and cleanup
process.on('SIGINT', async () => {
  console.log('\\n⏸️  Process interrupted');
  await closeDatabase();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error);
  await closeDatabase();
  process.exit(1);
});

program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}