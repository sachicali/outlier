/**
 * Migration: Create users table
 * This migration creates the users table with authentication and profile fields
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      username: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('user', 'admin'),
        defaultValue: 'user',
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refresh_tokens: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
      },
      preferences: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      email_verification_token: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      password_reset_token: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex('users', ['email'], { unique: true });
    await queryInterface.addIndex('users', ['username'], { unique: true });
    await queryInterface.addIndex('users', ['is_active']);
    await queryInterface.addIndex('users', ['role']);
    await queryInterface.addIndex('users', ['email_verification_token'], {
      sparse: true,
      where: { email_verification_token: { [Sequelize.Op.ne]: null } },
    });
    await queryInterface.addIndex('users', ['password_reset_token'], {
      sparse: true,
      where: { password_reset_token: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('users', ['email']);
    await queryInterface.removeIndex('users', ['username']);
    await queryInterface.removeIndex('users', ['is_active']);
    await queryInterface.removeIndex('users', ['role']);
    await queryInterface.removeIndex('users', ['email_verification_token']);
    await queryInterface.removeIndex('users', ['password_reset_token']);

    // Drop ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');

    // Drop table
    await queryInterface.dropTable('users');
  },
};