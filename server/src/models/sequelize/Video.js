const { DataTypes, Model } = require('sequelize');

class Video extends Model {
  /**
   * Initialize the Video model
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
      channel_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'channels',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      youtube_video_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          len: [11, 11], // YouTube video IDs are exactly 11 characters
        },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 500],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      thumbnail_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
      },
      duration: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'ISO 8601 duration format (e.g., PT4M13S)',
      },
      duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      view_count: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      like_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      comment_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      category_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      default_language: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      default_audio_language: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      caption: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      definition: {
        type: DataTypes.ENUM('sd', 'hd'),
        allowNull: true,
      },
      licensed_content: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      outlier_score: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: {
          min: 0,
        },
        comment: 'Views per subscriber ratio * 100',
      },
      brand_fit_score: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        validate: {
          min: 0,
          max: 10,
        },
      },
      is_outlier: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      outlier_threshold: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Threshold used when marking as outlier',
      },
      engagement_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 100,
        },
      },
      extracted_games: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      is_excluded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      exclusion_reason: {
        type: DataTypes.STRING,
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
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
      },
    }, {
      sequelize,
      modelName: 'Video',
      tableName: 'videos',
      indexes: [
        {
          unique: true,
          fields: ['youtube_video_id'],
        },
        {
          fields: ['channel_id'],
        },
        {
          fields: ['published_at'],
        },
        {
          fields: ['view_count'],
        },
        {
          fields: ['outlier_score'],
        },
        {
          fields: ['brand_fit_score'],
        },
        {
          fields: ['is_outlier'],
        },
        {
          fields: ['is_excluded'],
        },
        {
          fields: ['category_id'],
        },
        {
          fields: ['duration_seconds'],
        },
        {
          fields: ['engagement_rate'],
        },
        {
          using: 'gin',
          fields: ['tags'],
        },
        {
          using: 'gin',
          fields: ['extracted_games'],
        },
        {
          using: 'gin',
          fields: ['metadata'],
        },
        // Composite indexes for common queries
        {
          fields: ['is_outlier', 'outlier_score'],
        },
        {
          fields: ['channel_id', 'published_at'],
        },
        {
          fields: ['published_at', 'is_outlier'],
        },
      ],
      hooks: {
        beforeSave: (video) => {
          video.last_fetched_at = new Date();
          video.fetch_count += 1;

          // Parse duration to seconds if needed
          if (video.duration && !video.duration_seconds) {
            video.duration_seconds = Video.parseDurationToSeconds(video.duration);
          }

          // Calculate engagement rate
          if (video.view_count > 0 && video.like_count > 0) {
            video.engagement_rate = (video.like_count / video.view_count) * 100;
          }
        },
      },
    });

    return Video;
  }

  /**
   * Create or update video from YouTube API data
   * @param {Object} youtubeData - YouTube API video data
   * @param {string} channelId - Channel UUID
   * @returns {Promise<Video>} Video instance
   */
  static async createOrUpdateFromYouTube(youtubeData, channelId) {
    const videoData = {
      channel_id: channelId,
      youtube_video_id: youtubeData.id,
      title: youtubeData.snippet?.title || 'Unknown',
      description: youtubeData.snippet?.description || null,
      thumbnail_url: youtubeData.snippet?.thumbnails?.high?.url || null,
      duration: youtubeData.contentDetails?.duration || null,
      duration_seconds: Video.parseDurationToSeconds(youtubeData.contentDetails?.duration),
      published_at: new Date(youtubeData.snippet?.publishedAt),
      view_count: parseInt(youtubeData.statistics?.viewCount) || 0,
      like_count: parseInt(youtubeData.statistics?.likeCount) || 0,
      comment_count: parseInt(youtubeData.statistics?.commentCount) || 0,
      tags: youtubeData.snippet?.tags || [],
      category_id: youtubeData.snippet?.categoryId || null,
      default_language: youtubeData.snippet?.defaultLanguage || null,
      default_audio_language: youtubeData.snippet?.defaultAudioLanguage || null,
      caption: youtubeData.contentDetails?.caption === 'true',
      definition: youtubeData.contentDetails?.definition || null,
      licensed_content: youtubeData.contentDetails?.licensedContent || false,
      metadata: {
        youtube_data: youtubeData,
        fetched_at: new Date(),
      },
    };

    const [video] = await this.upsert(videoData, {
      returning: true,
      conflictFields: ['youtube_video_id'],
    });

    return video;
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} duration - ISO 8601 duration (e.g., PT4M13S)
   * @returns {number} Duration in seconds
   */
  static parseDurationToSeconds(duration) {
    if (!duration) return null;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Calculate outlier score
   * @param {number} subscriberCount - Channel subscriber count
   * @returns {number} Outlier score
   */
  calculateOutlierScore(subscriberCount) {
    if (subscriberCount <= 0) return 0;
    return (this.view_count / subscriberCount) * 100;
  }

  /**
   * Calculate brand fit score
   * @returns {number} Brand fit score (0-10)
   */
  calculateBrandFitScore() {
    const title = this.title.toLowerCase();
    const description = (this.description || '').toLowerCase();

    let score = 5; // Base score

    // Positive indicators
    if (title.includes('funny') || title.includes('moments')) score += 1;
    if (title.includes('reaction') || title.includes('react')) score += 0.5;
    if (title.includes('family') || title.includes('kid')) score += 1;
    if (title.match(/[!?]{2,}/)) score += 0.5; // Excited punctuation
    if (title.match(/[A-Z]{3,}/)) score += 0.5; // Caps for emphasis

    // Negative indicators
    if (title.includes('adult') || title.includes('mature')) score -= 2;
    if (title.includes('horror') && !title.includes('funny')) score -= 1;
    if (description.includes('18+') || description.includes('mature')) score -= 2;

    // Duration factors
    if (this.duration_seconds) {
      if (this.duration_seconds > 60 && this.duration_seconds < 600) score += 0.5; // 1-10 minutes is good
      if (this.duration_seconds > 1800) score -= 1; // Very long videos
    }

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Extract game names from title and description
   * @returns {Array<string>} Extracted game names
   */
  extractGameNames() {
    const games = new Set();
    const text = `${this.title} ${this.description || ''}`.toLowerCase();

    // Common game patterns
    const gamePatterns = [
      /doors?/gi,
      /99 nights? in the forest/gi,
      /dead shelter/gi,
      /dead rails/gi,
      /squid game/gi,
      /prison run/gi,
      /sprunki/gi,
      /piggy/gi,
      /brookhaven/gi,
      /murder mystery/gi,
      /arsenal/gi,
      /adopt me/gi,
      /tower of hell/gi,
      /flee the facility/gi,
      /natural disaster/gi,
      /rainbow friends/gi,
      /backrooms/gi,
      /among us/gi,
      /minecraft/gi,
      /roblox/gi,
    ];

    gamePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => games.add(match.toLowerCase()));
      }
    });

    return Array.from(games);
  }

  /**
   * Update outlier analysis results
   * @param {number} subscriberCount - Channel subscriber count
   * @param {number} threshold - Outlier threshold
   * @param {Array<string>} exclusionGames - Games to exclude
   */
  async updateOutlierAnalysis(subscriberCount, threshold, exclusionGames = []) {
    // Calculate scores
    this.outlier_score = this.calculateOutlierScore(subscriberCount);
    this.brand_fit_score = this.calculateBrandFitScore();
    this.extracted_games = this.extractGameNames();

    // Check if excluded
    this.is_excluded = this.checkExclusion(exclusionGames);

    // Mark as outlier if meets criteria
    this.is_outlier = this.outlier_score >= threshold &&
                      this.brand_fit_score >= 6 &&
                      !this.is_excluded;

    this.outlier_threshold = threshold;

    await this.save();
  }

  /**
   * Check if video should be excluded based on games
   * @param {Array<string>} exclusionGames - Games to exclude
   * @returns {boolean} Whether video is excluded
   */
  checkExclusion(exclusionGames = []) {
    if (exclusionGames.length === 0) return false;

    const content = `${this.title} ${this.description || ''}`.toLowerCase();

    for (const game of exclusionGames) {
      if (content.includes(game.toLowerCase())) {
        this.exclusion_reason = `Contains excluded game: ${game}`;
        return true;
      }
    }

    this.exclusion_reason = null;
    return false;
  }

  /**
   * Get video URL
   * @returns {string} YouTube video URL
   */
  getVideoUrl() {
    return `https://youtube.com/watch?v=${this.youtube_video_id}`;
  }

  /**
   * Get formatted view count
   * @returns {string} Formatted view count
   */
  getFormattedViewCount() {
    const count = this.view_count;
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Get formatted duration
   * @returns {string} Formatted duration (e.g., "4:13")
   */
  getFormattedDuration() {
    if (!this.duration_seconds) return 'N/A';

    const hours = Math.floor(this.duration_seconds / 3600);
    const minutes = Math.floor((this.duration_seconds % 3600) / 60);
    const seconds = this.duration_seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Get safe object for API responses
   * @returns {Object} Safe video object
   */
  toSafeObject() {
    return {
      id: this.id,
      youtube_video_id: this.youtube_video_id,
      title: this.title,
      description: this.description,
      thumbnail_url: this.thumbnail_url,
      duration: this.getFormattedDuration(),
      duration_seconds: this.duration_seconds,
      published_at: this.published_at,
      view_count: this.view_count,
      formatted_view_count: this.getFormattedViewCount(),
      like_count: this.like_count,
      comment_count: this.comment_count,
      tags: this.tags,
      category_id: this.category_id,
      outlier_score: this.outlier_score,
      brand_fit_score: this.brand_fit_score,
      is_outlier: this.is_outlier,
      engagement_rate: this.engagement_rate,
      extracted_games: this.extracted_games,
      is_excluded: this.is_excluded,
      exclusion_reason: this.exclusion_reason,
      video_url: this.getVideoUrl(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = Video;