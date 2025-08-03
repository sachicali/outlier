/**
 * Migration: Add OAuth provider fields to users table
 * This migration adds fields for storing OAuth provider information
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add OAuth provider fields to users table
    await queryInterface.addColumn('users', 'oauth_providers', {
      type: Sequelize.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'OAuth providers linked to this account (google, github, etc.)',
    });

    await queryInterface.addColumn('users', 'profile_picture_url', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'URL to user profile picture from OAuth provider',
    });

    await queryInterface.addColumn('users', 'account_linked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the account was first linked with an OAuth provider',
    });

    // Add index for OAuth provider queries
    await queryInterface.addIndex('users', {
      fields: ['oauth_providers'],
      using: 'gin',
      name: 'users_oauth_providers_gin_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('users', 'users_oauth_providers_gin_idx');

    // Remove columns
    await queryInterface.removeColumn('users', 'oauth_providers');
    await queryInterface.removeColumn('users', 'profile_picture_url');
    await queryInterface.removeColumn('users', 'account_linked_at');
  },
};