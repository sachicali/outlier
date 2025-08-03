const { DataTypes, Model } = require('sequelize');

class Analysis extends Model {
  /**
   * Initialize the Analysis model
   * @param {Sequelize} sequelize - Sequelize instance
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true, // Allow anonymous analyses
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 255],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        validate: {
          isValidConfig(value) {
            const required = ['exclusionChannels', 'minSubs', 'maxSubs', 'timeWindow', 'outlierThreshold'];
            const missing = required.filter(key => !(key in value));
            if (missing.length > 0) {
              throw new Error(`Missing required config fields: ${missing.join(', ')}`);
            }
          },
        },
      },
      results: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      summary: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      processing_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      total_channels_analyzed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      total_videos_analyzed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      total_outliers_found: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      exclusion_games_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
      },
    }, {
      sequelize,
      modelName: 'Analysis',
      tableName: 'analyses',
      indexes: [
        {
          fields: ['user_id'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['created_at'],
        },
        {
          fields: ['is_public'],
        },
        {
          fields: ['started_at'],
        },
        {
          fields: ['completed_at'],
        },
        {
          using: 'gin',
          fields: ['config'],
        },
        {
          using: 'gin',
          fields: ['tags'],
        },
        {
          using: 'gin',
          fields: ['metadata'],
        },
      ],
      hooks: {
        beforeUpdate: (analysis) => {
          // Calculate processing time when analysis completes
          if (analysis.changed('status') && analysis.status === 'completed') {
            if (analysis.started_at && !analysis.completed_at) {
              analysis.completed_at = new Date();
            }
            if (analysis.started_at && analysis.completed_at) {
              analysis.processing_time_ms = analysis.completed_at - analysis.started_at;
            }
          }

          // Set started_at when analysis begins processing
          if (analysis.changed('status') && analysis.status === 'processing' && !analysis.started_at) {
            analysis.started_at = new Date();
          }
        },
      },
    });

    return Analysis;
  }

  /**
   * Start the analysis processing
   */
  async startProcessing() {
    this.status = 'processing';
    this.started_at = new Date();
    await this.save();
  }

  /**
   * Mark analysis as completed
   * @param {Array} results - Analysis results
   * @param {Object} summary - Analysis summary
   */
  async complete(results, summary) {
    this.status = 'completed';
    this.completed_at = new Date();
    this.results = results;
    this.summary = summary;

    if (this.started_at) {
      this.processing_time_ms = this.completed_at - this.started_at;
    }

    // Update counters from summary
    if (summary) {
      this.total_outliers_found = summary.totalOutliers || results?.length || 0;
      this.total_channels_analyzed = summary.channelsAnalyzed || 0;
      this.exclusion_games_count = summary.exclusionGames || 0;
    }

    await this.save();
  }

  /**
   * Mark analysis as failed
   * @param {string} errorMessage - Error message
   */
  async fail(errorMessage) {
    this.status = 'failed';
    this.completed_at = new Date();
    this.error_message = errorMessage;

    if (this.started_at) {
      this.processing_time_ms = this.completed_at - this.started_at;
    }

    await this.save();
  }

  /**
   * Get analysis duration in human readable format
   * @returns {string} Duration string
   */
  getDurationString() {
    if (!this.processing_time_ms) {
      return 'N/A';
    }

    const seconds = Math.floor(this.processing_time_ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get analysis status with additional info
   * @returns {Object} Status object
   */
  getStatusInfo() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      started_at: this.started_at,
      completed_at: this.completed_at,
      processing_time: this.getDurationString(),
      progress: this.getProgress(),
      error_message: this.error_message,
      counters: {
        channels_analyzed: this.total_channels_analyzed,
        videos_analyzed: this.total_videos_analyzed,
        outliers_found: this.total_outliers_found,
        exclusion_games: this.exclusion_games_count,
      },
    };
  }

  /**
   * Calculate analysis progress percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    switch (this.status) {
    case 'pending':
      return 0;
    case 'processing':
      // Could be enhanced with more granular progress tracking
      return 50;
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
    }
  }

  /**
   * Export analysis results as CSV-ready data
   * @returns {Array} CSV data array
   */
  getCSVData() {
    if (!this.results || !Array.isArray(this.results)) {
      return [];
    }

    const headers = [
      'Channel Name',
      'Subscribers',
      'Video Title',
      'Views',
      'Outlier Score',
      'Brand Fit',
      'Game/Content',
      'URL',
      'Published Date',
      'Analysis Date',
    ];

    const rows = this.results.map(video => [
      video.channelInfo?.snippet?.title || 'N/A',
      video.channelInfo?.statistics?.subscriberCount || 0,
      video.snippet?.title || 'N/A',
      video.statistics?.viewCount || 0,
      parseFloat(video.outlierScore || 0).toFixed(1),
      parseFloat(video.brandFit || 0).toFixed(1),
      video.snippet?.tags?.[0] || 'N/A',
      `https://youtube.com/watch?v=${video.id?.videoId || ''}`,
      video.snippet?.publishedAt || 'N/A',
      this.created_at?.toISOString() || 'N/A',
    ]);

    return [headers, ...rows];
  }

  /**
   * Get safe object for API responses
   * @returns {Object} Safe analysis object
   */
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      config: this.config,
      summary: this.summary,
      processing_time: this.getDurationString(),
      counters: {
        channels_analyzed: this.total_channels_analyzed,
        videos_analyzed: this.total_videos_analyzed,
        outliers_found: this.total_outliers_found,
        exclusion_games: this.exclusion_games_count,
      },
      is_public: this.is_public,
      tags: this.tags,
      started_at: this.started_at,
      completed_at: this.completed_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = Analysis;