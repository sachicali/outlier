/**
 * Migration: Create junction tables for many-to-many relationships
 * This migration creates the junction tables for analyses-channels and analyses-videos relationships
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create analysis_channels junction table
    await queryInterface.createTable('analysis_channels', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      analysis_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'analyses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      analyzed_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      videos_analyzed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      outliers_found: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      avg_outlier_score: {
        type: Sequelize.DECIMAL(8, 2),
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
    });

    // Create analysis_videos junction table (for outlier videos)
    await queryInterface.createTable('analysis_videos', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      analysis_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'analyses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      video_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'videos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      outlier_score_at_analysis: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        comment: 'Outlier score when this video was identified as outlier',
      },
      brand_fit_score_at_analysis: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
      },
      views_at_analysis: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'View count when this video was analyzed',
      },
      rank_in_analysis: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Rank of this outlier in the analysis results',
      },
      analysis_notes: {
        type: Sequelize.TEXT,
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
    });

    // Add indexes for analysis_channels
    await queryInterface.addIndex('analysis_channels', ['analysis_id']);
    await queryInterface.addIndex('analysis_channels', ['channel_id']);
    await queryInterface.addIndex('analysis_channels', ['analyzed_at']);
    await queryInterface.addIndex('analysis_channels', ['outliers_found']);
    await queryInterface.addIndex('analysis_channels', ['avg_outlier_score']);

    // Unique constraint to prevent duplicate analysis-channel pairs
    await queryInterface.addIndex('analysis_channels', ['analysis_id', 'channel_id'], {
      unique: true,
    });

    // GIN index for metadata
    await queryInterface.addIndex('analysis_channels', ['metadata'], {
      using: 'gin',
    });

    // Add indexes for analysis_videos
    await queryInterface.addIndex('analysis_videos', ['analysis_id']);
    await queryInterface.addIndex('analysis_videos', ['video_id']);
    await queryInterface.addIndex('analysis_videos', ['outlier_score_at_analysis']);
    await queryInterface.addIndex('analysis_videos', ['rank_in_analysis']);
    await queryInterface.addIndex('analysis_videos', ['views_at_analysis']);

    // Unique constraint to prevent duplicate analysis-video pairs
    await queryInterface.addIndex('analysis_videos', ['analysis_id', 'video_id'], {
      unique: true,
    });

    // GIN index for metadata
    await queryInterface.addIndex('analysis_videos', ['metadata'], {
      using: 'gin',
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('analysis_videos', ['analysis_id', 'outlier_score_at_analysis']);
    await queryInterface.addIndex('analysis_videos', ['analysis_id', 'rank_in_analysis']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes for analysis_videos
    await queryInterface.removeIndex('analysis_videos', ['analysis_id']);
    await queryInterface.removeIndex('analysis_videos', ['video_id']);
    await queryInterface.removeIndex('analysis_videos', ['outlier_score_at_analysis']);
    await queryInterface.removeIndex('analysis_videos', ['rank_in_analysis']);
    await queryInterface.removeIndex('analysis_videos', ['views_at_analysis']);
    await queryInterface.removeIndex('analysis_videos', ['analysis_id', 'video_id']);
    await queryInterface.removeIndex('analysis_videos', ['metadata']);
    await queryInterface.removeIndex('analysis_videos', ['analysis_id', 'outlier_score_at_analysis']);
    await queryInterface.removeIndex('analysis_videos', ['analysis_id', 'rank_in_analysis']);

    // Remove indexes for analysis_channels
    await queryInterface.removeIndex('analysis_channels', ['analysis_id']);
    await queryInterface.removeIndex('analysis_channels', ['channel_id']);
    await queryInterface.removeIndex('analysis_channels', ['analyzed_at']);
    await queryInterface.removeIndex('analysis_channels', ['outliers_found']);
    await queryInterface.removeIndex('analysis_channels', ['avg_outlier_score']);
    await queryInterface.removeIndex('analysis_channels', ['analysis_id', 'channel_id']);
    await queryInterface.removeIndex('analysis_channels', ['metadata']);

    // Drop tables
    await queryInterface.dropTable('analysis_videos');
    await queryInterface.dropTable('analysis_channels');
  },
};