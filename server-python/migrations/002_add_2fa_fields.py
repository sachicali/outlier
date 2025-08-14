"""
Migration: Add Two-Factor Authentication fields to users table

This migration adds the necessary fields to support 2FA:
- two_factor_enabled: Boolean flag to enable/disable 2FA
- two_factor_secret: Encrypted TOTP secret key
- backup_codes: Encrypted backup codes for account recovery
- two_factor_backup_codes_used: Track which backup codes have been used
- failed_login_attempts: Track failed login attempts for account lockout
- locked_until: Timestamp when account lockout expires

Security considerations:
- All sensitive data (secrets, backup codes) are encrypted at rest
- Failed login tracking helps prevent brute force attacks
- Account lockout mechanism protects against automated attacks
"""

import sqlite3
import psycopg2
from datetime import datetime
import os


def get_database_connection():
    """Get database connection based on environment"""
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        if database_url.startswith('postgresql://'):
            return psycopg2.connect(database_url)
        elif database_url.startswith('sqlite://'):
            db_path = database_url.replace('sqlite://', '')
            return sqlite3.connect(db_path)
    
    # Default to SQLite for development
    return sqlite3.connect('outlier_development.db')


def migrate_up():
    """Apply the migration"""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        # Check if we're using PostgreSQL or SQLite
        is_postgresql = hasattr(conn, 'get_dsn_parameters')
        
        if is_postgresql:
            # PostgreSQL migration
            migrations = [
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS backup_codes TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS two_factor_backup_codes_used JSONB DEFAULT '[]';
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS password_reset_token TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
                """
            ]
        else:
            # SQLite migration
            migrations = [
                """
                ALTER TABLE users 
                ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN two_factor_secret TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN backup_codes TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN two_factor_backup_codes_used TEXT DEFAULT '[]';
                """,
                """
                ALTER TABLE users 
                ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN locked_until TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN password_reset_token TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN password_reset_expires TEXT NULL;
                """,
                """
                ALTER TABLE users 
                ADD COLUMN last_login TEXT NULL;
                """
            ]
        
        # Execute migrations
        for migration in migrations:
            try:
                cursor.execute(migration)
                print(f"✓ Executed: {migration.strip()[:50]}...")
            except Exception as e:
                # Skip if column already exists
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"⚠ Skipped (already exists): {migration.strip()[:50]}...")
                else:
                    raise
        
        # Create indexes for performance
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled);",
            "CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts ON users(failed_login_attempts);",
            "CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);",
            "CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);"
        ]
        
        for index in indexes:
            try:
                cursor.execute(index)
                print(f"✓ Created index: {index.split('idx_')[1].split(' ON')[0]}")
            except Exception as e:
                print(f"⚠ Index creation failed: {e}")
        
        # Create migration tracking table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Record this migration
        cursor.execute("""
            INSERT OR REPLACE INTO schema_migrations (version) 
            VALUES ('002_add_2fa_fields');
        """)
        
        conn.commit()
        print("✓ Migration 002_add_2fa_fields completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def migrate_down():
    """Rollback the migration"""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        # Check if we're using PostgreSQL or SQLite
        is_postgresql = hasattr(conn, 'get_dsn_parameters')
        
        if is_postgresql:
            # PostgreSQL rollback
            rollbacks = [
                "ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled;",
                "ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;",
                "ALTER TABLE users DROP COLUMN IF EXISTS backup_codes;",
                "ALTER TABLE users DROP COLUMN IF EXISTS two_factor_backup_codes_used;",
                "ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;",
                "ALTER TABLE users DROP COLUMN IF EXISTS locked_until;",
                "ALTER TABLE users DROP COLUMN IF EXISTS password_reset_token;",
                "ALTER TABLE users DROP COLUMN IF EXISTS password_reset_expires;",
                "ALTER TABLE users DROP COLUMN IF EXISTS last_login;"
            ]
        else:
            # SQLite doesn't support DROP COLUMN directly
            print("⚠ SQLite doesn't support dropping columns. Manual intervention required.")
            print("To rollback, you would need to:")
            print("1. Create a new table without the 2FA columns")
            print("2. Copy data from the old table")
            print("3. Drop the old table and rename the new one")
            return
        
        # Execute rollbacks
        for rollback in rollbacks:
            try:
                cursor.execute(rollback)
                print(f"✓ Rolled back: {rollback.strip()[:50]}...")
            except Exception as e:
                print(f"⚠ Rollback failed: {e}")
        
        # Remove migration record
        cursor.execute("""
            DELETE FROM schema_migrations 
            WHERE version = '002_add_2fa_fields';
        """)
        
        conn.commit()
        print("✓ Migration 002_add_2fa_fields rolled back successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Rollback failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def check_migration_status():
    """Check if this migration has been applied"""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT version FROM schema_migrations 
            WHERE version = '002_add_2fa_fields';
        """)
        result = cursor.fetchone()
        return result is not None
    except:
        return False
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'up':
            migrate_up()
        elif command == 'down':
            migrate_down()
        elif command == 'status':
            status = check_migration_status()
            print(f"Migration 002_add_2fa_fields: {'Applied' if status else 'Not applied'}")
        else:
            print("Usage: python 002_add_2fa_fields.py [up|down|status]")
    else:
        # Default to applying the migration
        if not check_migration_status():
            print("Applying migration 002_add_2fa_fields...")
            migrate_up()
        else:
            print("Migration 002_add_2fa_fields already applied")