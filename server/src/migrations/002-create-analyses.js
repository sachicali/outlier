/**
 * Migration: Create analyses table
 * This migration creates the analyses table for storing analysis configurations and results
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analyses', {
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
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      results: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      summary: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processing_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      total_channels_analyzed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      total_videos_analyzed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      total_outliers_found: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      exclusion_games_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
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
    await queryInterface.addIndex('analyses', ['user_id']);
    await queryInterface.addIndex('analyses', ['status']);
    await queryInterface.addIndex('analyses', ['created_at']);
    await queryInterface.addIndex('analyses', ['is_public']);
    await queryInterface.addIndex('analyses', ['started_at']);
    await queryInterface.addIndex('analyses', ['completed_at']);

    // GIN indexes for JSONB and array fields
    await queryInterface.addIndex('analyses', ['config'], {
      using: 'gin',
    });
    await queryInterface.addIndex('analyses', ['tags'], {
      using: 'gin',
    });
    await queryInterface.addIndex('analyses', ['metadata'], {
      using: 'gin',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('analyses', ['user_id']);
    await queryInterface.removeIndex('analyses', ['status']);
    await queryInterface.removeIndex('analyses', ['created_at']);
    await queryInterface.removeIndex('analyses', ['is_public']);
    await queryInterface.removeIndex('analyses', ['started_at']);
    await queryInterface.removeIndex('analyses', ['completed_at']);
    await queryInterface.removeIndex('analyses', ['config']);
    await queryInterface.removeIndex('analyses', ['tags']);
    await queryInterface.removeIndex('analyses', ['metadata']);

    // Drop ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_analyses_status";');

    // Drop table
    await queryInterface.dropTable('analyses');
  },
};