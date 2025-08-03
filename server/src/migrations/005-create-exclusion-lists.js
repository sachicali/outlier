/**
 * Migration: Create exclusion_lists table
 * This migration creates the exclusion_lists table for storing game and keyword exclusion lists
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('exclusion_lists', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('game', 'keyword', 'channel', 'category'),
        defaultValue: 'game',
        allowNull: false,
      },
      items: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: [],
      },
      is_global: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      usage_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      source_channels: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      auto_update: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      update_frequency_days: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      last_updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
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
    await queryInterface.addIndex('exclusion_lists', ['user_id']);
    await queryInterface.addIndex('exclusion_lists', ['type']);
    await queryInterface.addIndex('exclusion_lists', ['is_global']);
    await queryInterface.addIndex('exclusion_lists', ['is_active']);
    await queryInterface.addIndex('exclusion_lists', ['auto_update']);
    await queryInterface.addIndex('exclusion_lists', ['last_used_at']);
    await queryInterface.addIndex('exclusion_lists', ['usage_count']);

    // GIN indexes for array and JSONB fields
    await queryInterface.addIndex('exclusion_lists', ['items'], {
      using: 'gin',
    });
    await queryInterface.addIndex('exclusion_lists', ['source_channels'], {
      using: 'gin',
    });
    await queryInterface.addIndex('exclusion_lists', ['tags'], {
      using: 'gin',
    });
    await queryInterface.addIndex('exclusion_lists', ['metadata'], {
      using: 'gin',
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('exclusion_lists', ['is_active', 'type']);
    await queryInterface.addIndex('exclusion_lists', ['is_global', 'is_active']);
    await queryInterface.addIndex('exclusion_lists', ['user_id', 'is_active']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('exclusion_lists', ['user_id']);
    await queryInterface.removeIndex('exclusion_lists', ['type']);
    await queryInterface.removeIndex('exclusion_lists', ['is_global']);
    await queryInterface.removeIndex('exclusion_lists', ['is_active']);
    await queryInterface.removeIndex('exclusion_lists', ['auto_update']);
    await queryInterface.removeIndex('exclusion_lists', ['last_used_at']);
    await queryInterface.removeIndex('exclusion_lists', ['usage_count']);
    await queryInterface.removeIndex('exclusion_lists', ['items']);
    await queryInterface.removeIndex('exclusion_lists', ['source_channels']);
    await queryInterface.removeIndex('exclusion_lists', ['tags']);
    await queryInterface.removeIndex('exclusion_lists', ['metadata']);
    await queryInterface.removeIndex('exclusion_lists', ['is_active', 'type']);
    await queryInterface.removeIndex('exclusion_lists', ['is_global', 'is_active']);
    await queryInterface.removeIndex('exclusion_lists', ['user_id', 'is_active']);

    // Drop ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_exclusion_lists_type";');

    // Drop table
    await queryInterface.dropTable('exclusion_lists');
  },
};