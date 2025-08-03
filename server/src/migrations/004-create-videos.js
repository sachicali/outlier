/**
 * Migration: Create videos table
 * This migration creates the videos table for storing YouTube video information and outlier data
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('videos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'channels',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      youtube_video_id: {
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
      thumbnail_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      duration: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      view_count: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
      },
      like_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      comment_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      category_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      default_language: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      default_audio_language: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      caption: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      definition: {
        type: Sequelize.ENUM('sd', 'hd'),
        allowNull: true,
      },
      licensed_content: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      outlier_score: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      brand_fit_score: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
      },
      is_outlier: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      outlier_threshold: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      engagement_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      extracted_games: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
      },
      is_excluded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      exclusion_reason: {
        type: Sequelize.STRING,
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
    await queryInterface.addIndex('videos', ['youtube_video_id'], { unique: true });
    await queryInterface.addIndex('videos', ['channel_id']);
    await queryInterface.addIndex('videos', ['published_at']);
    await queryInterface.addIndex('videos', ['view_count']);
    await queryInterface.addIndex('videos', ['outlier_score']);
    await queryInterface.addIndex('videos', ['brand_fit_score']);
    await queryInterface.addIndex('videos', ['is_outlier']);
    await queryInterface.addIndex('videos', ['is_excluded']);
    await queryInterface.addIndex('videos', ['category_id']);
    await queryInterface.addIndex('videos', ['duration_seconds']);
    await queryInterface.addIndex('videos', ['engagement_rate']);

    // GIN indexes for array and JSONB fields
    await queryInterface.addIndex('videos', ['tags'], {
      using: 'gin',
    });
    await queryInterface.addIndex('videos', ['extracted_games'], {
      using: 'gin',
    });
    await queryInterface.addIndex('videos', ['metadata'], {
      using: 'gin',
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('videos', ['is_outlier', 'outlier_score']);
    await queryInterface.addIndex('videos', ['channel_id', 'published_at']);
    await queryInterface.addIndex('videos', ['published_at', 'is_outlier']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('videos', ['youtube_video_id']);
    await queryInterface.removeIndex('videos', ['channel_id']);
    await queryInterface.removeIndex('videos', ['published_at']);
    await queryInterface.removeIndex('videos', ['view_count']);
    await queryInterface.removeIndex('videos', ['outlier_score']);
    await queryInterface.removeIndex('videos', ['brand_fit_score']);
    await queryInterface.removeIndex('videos', ['is_outlier']);
    await queryInterface.removeIndex('videos', ['is_excluded']);
    await queryInterface.removeIndex('videos', ['category_id']);
    await queryInterface.removeIndex('videos', ['duration_seconds']);
    await queryInterface.removeIndex('videos', ['engagement_rate']);
    await queryInterface.removeIndex('videos', ['tags']);
    await queryInterface.removeIndex('videos', ['extracted_games']);
    await queryInterface.removeIndex('videos', ['metadata']);
    await queryInterface.removeIndex('videos', ['is_outlier', 'outlier_score']);
    await queryInterface.removeIndex('videos', ['channel_id', 'published_at']);
    await queryInterface.removeIndex('videos', ['published_at', 'is_outlier']);

    // Drop ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_videos_definition";');

    // Drop table
    await queryInterface.dropTable('videos');
  },
};