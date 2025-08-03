/**
 * Migration: Create channels table
 * This migration creates the channels table for storing YouTube channel information
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channels', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      youtube_channel_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      custom_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      thumbnail_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      banner_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      subscriber_count: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
      },
      video_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      view_count: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      default_language: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      keywords: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      is_family_safe: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      primary_category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      topics: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      last_video_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_fetched_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fetch_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      avg_outlier_score: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      brand_fit_score: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
      },
      engagement_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
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
    await queryInterface.addIndex('channels', ['youtube_channel_id'], { unique: true });
    await queryInterface.addIndex('channels', ['title']);
    await queryInterface.addIndex('channels', ['subscriber_count']);
    await queryInterface.addIndex('channels', ['video_count']);
    await queryInterface.addIndex('channels', ['is_verified']);
    await queryInterface.addIndex('channels', ['is_family_safe']);
    await queryInterface.addIndex('channels', ['primary_category']);
    await queryInterface.addIndex('channels', ['country']);
    await queryInterface.addIndex('channels', ['published_at']);
    await queryInterface.addIndex('channels', ['last_video_at']);
    await queryInterface.addIndex('channels', ['last_fetched_at']);
    await queryInterface.addIndex('channels', ['avg_outlier_score']);
    await queryInterface.addIndex('channels', ['brand_fit_score']);

    // GIN indexes for array and JSONB fields
    await queryInterface.addIndex('channels', ['keywords'], {
      using: 'gin',
    });
    await queryInterface.addIndex('channels', ['topics'], {
      using: 'gin',
    });
    await queryInterface.addIndex('channels', ['metadata'], {
      using: 'gin',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('channels', ['youtube_channel_id']);
    await queryInterface.removeIndex('channels', ['title']);
    await queryInterface.removeIndex('channels', ['subscriber_count']);
    await queryInterface.removeIndex('channels', ['video_count']);
    await queryInterface.removeIndex('channels', ['is_verified']);
    await queryInterface.removeIndex('channels', ['is_family_safe']);
    await queryInterface.removeIndex('channels', ['primary_category']);
    await queryInterface.removeIndex('channels', ['country']);
    await queryInterface.removeIndex('channels', ['published_at']);
    await queryInterface.removeIndex('channels', ['last_video_at']);
    await queryInterface.removeIndex('channels', ['last_fetched_at']);
    await queryInterface.removeIndex('channels', ['avg_outlier_score']);
    await queryInterface.removeIndex('channels', ['brand_fit_score']);
    await queryInterface.removeIndex('channels', ['keywords']);
    await queryInterface.removeIndex('channels', ['topics']);
    await queryInterface.removeIndex('channels', ['metadata']);

    // Drop table
    await queryInterface.dropTable('channels');
  },
};