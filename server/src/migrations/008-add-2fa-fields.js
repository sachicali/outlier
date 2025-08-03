/**
 * Migration: Add 2FA fields to users table
 * Adds two-factor authentication support with TOTP secrets and backup codes
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 2FA columns to users table
    await queryInterface.addColumn('users', 'two_factor_secret', {
      type: Sequelize.TEXT, // Encrypted TOTP secret
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'backup_codes', {
      type: Sequelize.JSONB, // Array of encrypted backup codes
      defaultValue: [],
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'two_factor_enabled_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'backup_codes_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add indexes for performance
    await queryInterface.addIndex('users', ['two_factor_enabled']);
    await queryInterface.addIndex('users', ['two_factor_enabled_at']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('users', ['two_factor_enabled']);
    await queryInterface.removeIndex('users', ['two_factor_enabled_at']);

    // Remove columns
    await queryInterface.removeColumn('users', 'two_factor_secret');
    await queryInterface.removeColumn('users', 'two_factor_enabled');
    await queryInterface.removeColumn('users', 'backup_codes');
    await queryInterface.removeColumn('users', 'two_factor_enabled_at');
    await queryInterface.removeColumn('users', 'backup_codes_generated_at');
  },
};