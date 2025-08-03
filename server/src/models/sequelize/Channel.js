const { DataTypes, Model } = require('sequelize');

class Channel extends Model {
  /**
   * Initialize the Channel model
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
      youtube_channel_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          len: [10, 50], // YouTube channel IDs are typically 24 characters
        },
      },
      title: {
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
      custom_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: [1, 100],
        },
      },
      thumbnail_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      banner_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      subscriber_count: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      video_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      view_count: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(2),
        allowNull: true,
        validate: {
          len: [2, 2], // ISO country codes
        },
      },
      default_language: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      keywords: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      is_family_safe: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      primary_category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      topics: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      last_video_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_fetched_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      fetch_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      avg_outlier_score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 999.99,
        },
      },
      brand_fit_score: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        validate: {
          min: 0,
          max: 10,
        },
      },
      engagement_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 100,
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
      },
    }, {
      sequelize,
      modelName: 'Channel',
      tableName: 'channels',
      indexes: [
        {
          unique: true,
          fields: ['youtube_channel_id'],
        },
        {
          fields: ['title'],
        },
        {
          fields: ['subscriber_count'],
        },
        {
          fields: ['video_count'],
        },
        {
          fields: ['is_verified'],
        },
        {
          fields: ['is_family_safe'],
        },
        {
          fields: ['primary_category'],
        },
        {
          fields: ['country'],
        },
        {
          fields: ['published_at'],
        },
        {
          fields: ['last_video_at'],
        },
        {
          fields: ['last_fetched_at'],
        },
        {
          fields: ['avg_outlier_score'],
        },
        {
          fields: ['brand_fit_score'],
        },
        {
          using: 'gin',
          fields: ['keywords'],
        },
        {
          using: 'gin',
          fields: ['topics'],
        },
        {
          using: 'gin',
          fields: ['metadata'],
        },
      ],
      hooks: {
        beforeSave: (channel) => {
          // Update last fetched timestamp
          channel.last_fetched_at = new Date();
          channel.fetch_count += 1;
        },
      },
    });

    return Channel;
  }

  /**
   * Create or update channel from YouTube API data
   * @param {Object} youtubeData - YouTube API channel data
   * @returns {Promise<Channel>} Channel instance
   */
  static async createOrUpdateFromYouTube(youtubeData) {
    const channelData = {
      youtube_channel_id: youtubeData.id,
      title: youtubeData.snippet?.title || 'Unknown',
      description: youtubeData.snippet?.description || null,
      custom_url: youtubeData.snippet?.customUrl || null,
      thumbnail_url: youtubeData.snippet?.thumbnails?.high?.url || null,
      banner_url: youtubeData.brandingSettings?.image?.bannerExternalUrl || null,
      subscriber_count: parseInt(youtubeData.statistics?.subscriberCount) || 0,
      video_count: parseInt(youtubeData.statistics?.videoCount) || 0,
      view_count: parseInt(youtubeData.statistics?.viewCount) || 0,
      published_at: youtubeData.snippet?.publishedAt ? new Date(youtubeData.snippet.publishedAt) : null,
      country: youtubeData.snippet?.country || null,
      default_language: youtubeData.snippet?.defaultLanguage || null,
      keywords: youtubeData.brandingSettings?.channel?.keywords?.split(',').map(k => k.trim()) || [],
      is_verified: youtubeData.status?.isLinked || false,
      primary_category: youtubeData.topicDetails?.topicCategories?.[0] || null,
      topics: youtubeData.topicDetails?.topicCategories || [],
      metadata: {
        youtube_data: youtubeData,
        fetched_at: new Date(),
      },
    };

    const [channel] = await this.upsert(channelData, {
      returning: true,
      conflictFields: ['youtube_channel_id'],
    });

    return channel;
  }

  /**
   * Update channel statistics
   * @param {Object} stats - Channel statistics
   */
  async updateStatistics(stats) {
    this.subscriber_count = parseInt(stats.subscriberCount) || this.subscriber_count;
    this.video_count = parseInt(stats.videoCount) || this.video_count;
    this.view_count = parseInt(stats.viewCount) || this.view_count;
    await this.save();
  }

  /**
   * Calculate and update outlier metrics
   */
  async updateOutlierMetrics() {
    const videos = await this.getVideos({
      where: {
        created_at: {
          [DataTypes.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    if (videos.length > 0) {
      const outlierScores = videos
        .filter(v => v.outlier_score !== null)
        .map(v => parseFloat(v.outlier_score));

      const brandFitScores = videos
        .filter(v => v.brand_fit_score !== null)
        .map(v => parseFloat(v.brand_fit_score));

      if (outlierScores.length > 0) {
        this.avg_outlier_score = outlierScores.reduce((a, b) => a + b, 0) / outlierScores.length;
      }

      if (brandFitScores.length > 0) {
        this.brand_fit_score = brandFitScores.reduce((a, b) => a + b, 0) / brandFitScores.length;
      }

      // Calculate engagement rate (views / subscribers ratio)
      if (this.subscriber_count > 0) {
        const avgViews = videos.reduce((sum, v) => sum + parseInt(v.view_count || 0), 0) / videos.length;
        this.engagement_rate = (avgViews / this.subscriber_count) * 100;
      }

      await this.save();
    }
  }

  /**
   * Check if channel meets criteria for analysis
   * @param {Object} criteria - Analysis criteria
   * @returns {boolean} Whether channel meets criteria
   */
  meetsCriteria(criteria = {}) {
    const {
      minSubs = 10000,
      maxSubs = 500000,
      minVideos = 50,
      familySafe = true,
      countries = null,
      excludeKeywords = [],
    } = criteria;

    // Subscriber count check
    if (this.subscriber_count < minSubs || this.subscriber_count > maxSubs) {
      return false;
    }

    // Video count check
    if (this.video_count < minVideos) {
      return false;
    }

    // Family safe check
    if (familySafe && !this.is_family_safe) {
      return false;
    }

    // Country check
    if (countries && Array.isArray(countries) && countries.length > 0) {
      if (!this.country || !countries.includes(this.country)) {
        return false;
      }
    }

    // Exclude channels with certain keywords
    if (excludeKeywords.length > 0) {
      const channelText = `${this.title} ${this.description} ${this.keywords.join(' ')}`.toLowerCase();
      for (const keyword of excludeKeywords) {
        if (channelText.includes(keyword.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get channel URL
   * @returns {string} YouTube channel URL
   */
  getChannelUrl() {
    if (this.custom_url) {
      return `https://youtube.com/c/${this.custom_url}`;
    }
    return `https://youtube.com/channel/${this.youtube_channel_id}`;
  }

  /**
   * Get formatted subscriber count
   * @returns {string} Formatted subscriber count
   */
  getFormattedSubscriberCount() {
    const count = this.subscriber_count;
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Get safe object for API responses
   * @returns {Object} Safe channel object
   */
  toSafeObject() {
    return {
      id: this.id,
      youtube_channel_id: this.youtube_channel_id,
      title: this.title,
      description: this.description,
      custom_url: this.custom_url,
      thumbnail_url: this.thumbnail_url,
      subscriber_count: this.subscriber_count,
      formatted_subscriber_count: this.getFormattedSubscriberCount(),
      video_count: this.video_count,
      view_count: this.view_count,
      published_at: this.published_at,
      country: this.country,
      keywords: this.keywords,
      is_verified: this.is_verified,
      is_family_safe: this.is_family_safe,
      primary_category: this.primary_category,
      topics: this.topics,
      last_video_at: this.last_video_at,
      avg_outlier_score: this.avg_outlier_score,
      brand_fit_score: this.brand_fit_score,
      engagement_rate: this.engagement_rate,
      channel_url: this.getChannelUrl(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = Channel;