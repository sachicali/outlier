const BaseRepository = require('./BaseRepository');
const { v4: uuidv4 } = require('uuid');

/**
 * Repository for Channel entity
 * Handles channel CRUD operations with fallback to in-memory storage
 */
class ChannelRepository extends BaseRepository {
  constructor(channelModel = null) {
    // In-memory storage for fallback mode
    const fallbackStorage = new Map();
    super(channelModel, fallbackStorage);
    this.fallbackStorage = fallbackStorage;
  }

  /**
   * Create or update channel from YouTube data
   * @param {Object} youtubeData - YouTube API channel data
   * @returns {Promise<Object>} Channel record
   */
  async createOrUpdateFromYouTube(youtubeData) {
    if (this.useDatabase) {
      // Use the model's method if available
      if (this.model.createOrUpdateFromYouTube) {
        const channel = await this.model.createOrUpdateFromYouTube(youtubeData);
        return channel.toJSON ? channel.toJSON() : channel;
      }
    }

    // Fallback implementation
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

    return await this.upsertByYouTubeId(channelData.youtube_channel_id, channelData);
  }

  /**
   * Find channel by YouTube channel ID
   * @param {string} youtubeChannelId - YouTube channel ID
   * @returns {Promise<Object|null>} Channel record or null
   */
  async findByYouTubeId(youtubeChannelId) {
    return await this.findOne({ youtube_channel_id: youtubeChannelId });
  }

  /**
   * Upsert channel by YouTube ID
   * @param {string} youtubeChannelId - YouTube channel ID
   * @param {Object} channelData - Channel data
   * @returns {Promise<Object>} Upserted channel
   */
  async upsertByYouTubeId(youtubeChannelId, channelData) {
    if (this.useDatabase) {
      const result = await this.upsert(channelData, {
        conflictFields: ['youtube_channel_id'],
      });
      return result.record;
    } else {
      return await this.fallbackUpsertByYouTubeId(youtubeChannelId, channelData);
    }
  }

  /**
   * Find channels that meet analysis criteria
   * @param {Object} criteria - Analysis criteria
   * @returns {Promise<Array>} Qualified channels
   */
  async findQualified(criteria = {}) {
    const {
      minSubs = 10000,
      maxSubs = 500000,
      minVideos = 50,
      familySafe = true,
      countries = null,
      excludeKeywords = [],
      limit = 100,
      offset = 0,
    } = criteria;

    if (this.useDatabase) {
      const where = {
        subscriber_count: {
          [this.model.sequelize.Sequelize.Op.gte]: minSubs,
          [this.model.sequelize.Sequelize.Op.lte]: maxSubs,
        },
        video_count: {
          [this.model.sequelize.Sequelize.Op.gte]: minVideos,
        },
      };

      if (familySafe) {
        where.is_family_safe = true;
      }

      if (countries && Array.isArray(countries) && countries.length > 0) {
        where.country = {
          [this.model.sequelize.Sequelize.Op.in]: countries,
        };
      }

      const channels = await this.findAll(where, {
        limit,
        offset,
        order: [['subscriber_count', 'ASC']],
      });

      // Filter out channels with excluded keywords (done in-memory for simplicity)
      if (excludeKeywords.length > 0) {
        return channels.filter(channel => {
          const channelText = `${channel.title} ${channel.description} ${channel.keywords.join(' ')}`.toLowerCase();
          return !excludeKeywords.some(keyword => channelText.includes(keyword.toLowerCase()));
        });
      }

      return channels;
    } else {
      return await this.fallbackFindQualified(criteria);
    }
  }

  /**
   * Update channel statistics
   * @param {string} channelId - Channel ID
   * @param {Object} stats - Channel statistics
   * @returns {Promise<Object|null>} Updated channel
   */
  async updateStatistics(channelId, stats) {
    const updateData = {
      subscriber_count: parseInt(stats.subscriberCount) || 0,
      video_count: parseInt(stats.videoCount) || 0,
      view_count: parseInt(stats.viewCount) || 0,
      last_fetched_at: new Date(),
    };

    return await this.updateById(channelId, updateData);
  }

  /**
   * Search channels by title or keywords
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching channels
   */
  async search(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    if (this.useDatabase) {
      const where = {
        [this.model.sequelize.Sequelize.Op.or]: [
          {
            title: {
              [this.model.sequelize.Sequelize.Op.iLike]: `%${query}%`,
            },
          },
          {
            description: {
              [this.model.sequelize.Sequelize.Op.iLike]: `%${query}%`,
            },
          },
          {
            keywords: {
              [this.model.sequelize.Sequelize.Op.contains]: [query],
            },
          },
        ],
      };

      return await this.findAndCountAll(where, {
        limit,
        offset,
        order: [['subscriber_count', 'DESC']],
      });
    } else {
      return await this.fallbackSearch(query, options);
    }
  }

  /**
   * Get channels by subscriber range
   * @param {number} minSubs - Minimum subscribers
   * @param {number} maxSubs - Maximum subscribers
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Channels in range
   */
  async findBySubscriberRange(minSubs, maxSubs, options = {}) {
    const where = {
      subscriber_count: {
        [this.model.sequelize.Sequelize.Op.gte]: minSubs,
        [this.model.sequelize.Sequelize.Op.lte]: maxSubs,
      },
    };

    return await this.findAll(where, options);
  }

  /**
   * Get top channels by outlier score
   * @param {number} limit - Number of channels to return
   * @returns {Promise<Array>} Top channels
   */
  async findTopByOutlierScore(limit = 10) {
    const where = {
      avg_outlier_score: {
        [this.model.sequelize.Sequelize.Op.ne]: null,
      },
    };

    return await this.findAll(where, {
      limit,
      order: [['avg_outlier_score', 'DESC']],
    });
  }

  /**
   * Update outlier metrics for channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Updated channel
   */
  async updateOutlierMetrics(channelId) {
    if (this.useDatabase && this.model.prototype.updateOutlierMetrics) {
      const channel = await this.model.findByPk(channelId);
      if (channel) {
        await channel.updateOutlierMetrics();
        return channel.toJSON ? channel.toJSON() : channel;
      }
    }
    return null;
  }

  /**
   * Get channel statistics
   * @returns {Promise<Object>} Channel statistics
   */
  async getStatistics() {
    if (this.useDatabase) {
      try {
        const [
          total,
          verified,
          familySafe,
          withVideos,
        ] = await Promise.all([
          this.count(),
          this.count({ is_verified: true }),
          this.count({ is_family_safe: true }),
          this.count({
            video_count: {
              [this.model.sequelize.Sequelize.Op.gt]: 0,
            },
          }),
        ]);

        // Get subscriber distribution
        const subscriberRanges = await this.query(`
          SELECT 
            CASE 
              WHEN subscriber_count < 1000 THEN 'Under 1K'
              WHEN subscriber_count < 10000 THEN '1K-10K'
              WHEN subscriber_count < 100000 THEN '10K-100K'
              WHEN subscriber_count < 1000000 THEN '100K-1M'
              ELSE 'Over 1M'
            END as range,
            COUNT(*) as count
          FROM channels 
          GROUP BY range
          ORDER BY MIN(subscriber_count)
        `, {
          type: this.model.sequelize.QueryTypes.SELECT,
        });

        return {
          total,
          verified,
          family_safe: familySafe,
          with_videos: withVideos,
          subscriber_distribution: subscriberRanges,
        };
      } catch (error) {
        throw error;
      }
    } else {
      return await this.fallbackGetStatistics();
    }
  }

  // Fallback methods for in-memory storage
  fallbackCreate(data) {
    const channel = {
      ...data,
      id: data.id || uuidv4(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.fallbackStorage.set(channel.id, channel);
    return Promise.resolve(channel);
  }

  fallbackFindById(id) {
    const channel = this.fallbackStorage.get(id);
    return Promise.resolve(channel || null);
  }

  fallbackFindOne(where) {
    for (const channel of this.fallbackStorage.values()) {
      if (this.matchesWhere(channel, where)) {
        return Promise.resolve(channel);
      }
    }
    return Promise.resolve(null);
  }

  fallbackFindAll(where) {
    const results = [];
    for (const channel of this.fallbackStorage.values()) {
      if (this.matchesWhere(channel, where)) {
        results.push(channel);
      }
    }
    return Promise.resolve(results);
  }

  fallbackUpdateById(id, data) {
    const existing = this.fallbackStorage.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }

    const updated = {
      ...existing,
      ...data,
      updated_at: new Date(),
    };
    this.fallbackStorage.set(id, updated);
    return Promise.resolve(updated);
  }

  fallbackUpsertByYouTubeId(youtubeChannelId, channelData) {
    // Find existing by YouTube ID
    let existing = null;
    for (const channel of this.fallbackStorage.values()) {
      if (channel.youtube_channel_id === youtubeChannelId) {
        existing = channel;
        break;
      }
    }

    if (existing) {
      const updated = {
        ...existing,
        ...channelData,
        updated_at: new Date(),
      };
      this.fallbackStorage.set(existing.id, updated);
      return Promise.resolve(updated);
    } else {
      return this.fallbackCreate(channelData);
    }
  }

  fallbackFindQualified(criteria) {
    const {
      minSubs = 10000,
      maxSubs = 500000,
      minVideos = 50,
      familySafe = true,
      countries = null,
      excludeKeywords = [],
    } = criteria;

    const results = [];
    for (const channel of this.fallbackStorage.values()) {
      // Check subscriber count
      if (channel.subscriber_count < minSubs || channel.subscriber_count > maxSubs) {
        continue;
      }

      // Check video count
      if (channel.video_count < minVideos) {
        continue;
      }

      // Check family safe
      if (familySafe && !channel.is_family_safe) {
        continue;
      }

      // Check country
      if (countries && Array.isArray(countries) && countries.length > 0) {
        if (!channel.country || !countries.includes(channel.country)) {
          continue;
        }
      }

      // Check excluded keywords
      if (excludeKeywords.length > 0) {
        const channelText = `${channel.title} ${channel.description} ${channel.keywords.join(' ')}`.toLowerCase();
        const hasExcludedKeyword = excludeKeywords.some(keyword =>
          channelText.includes(keyword.toLowerCase()),
        );
        if (hasExcludedKeyword) {
          continue;
        }
      }

      results.push(channel);
    }

    return Promise.resolve(results);
  }

  fallbackSearch(query, options) {
    const { limit = 20, offset = 0 } = options;
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const channel of this.fallbackStorage.values()) {
      const title = (channel.title || '').toLowerCase();
      const description = (channel.description || '').toLowerCase();
      const keywords = (channel.keywords || []).join(' ').toLowerCase();

      if (title.includes(lowerQuery) ||
          description.includes(lowerQuery) ||
          keywords.includes(lowerQuery)) {
        results.push(channel);
      }
    }

    // Sort by subscriber count desc
    results.sort((a, b) => b.subscriber_count - a.subscriber_count);

    return Promise.resolve({
      rows: results.slice(offset, offset + limit),
      count: results.length,
      totalPages: Math.ceil(results.length / limit),
      currentPage: Math.floor(offset / limit) + 1,
    });
  }

  fallbackGetStatistics() {
    let total = 0, verified = 0, familySafe = 0, withVideos = 0;
    const subscriberRanges = {
      'Under 1K': 0,
      '1K-10K': 0,
      '10K-100K': 0,
      '100K-1M': 0,
      'Over 1M': 0,
    };

    for (const channel of this.fallbackStorage.values()) {
      total++;
      if (channel.is_verified) verified++;
      if (channel.is_family_safe) familySafe++;
      if (channel.video_count > 0) withVideos++;

      // Subscriber distribution
      const subs = channel.subscriber_count;
      if (subs < 1000) subscriberRanges['Under 1K']++;
      else if (subs < 10000) subscriberRanges['1K-10K']++;
      else if (subs < 100000) subscriberRanges['10K-100K']++;
      else if (subs < 1000000) subscriberRanges['100K-1M']++;
      else subscriberRanges['Over 1M']++;
    }

    return Promise.resolve({
      total,
      verified,
      family_safe: familySafe,
      with_videos: withVideos,
      subscriber_distribution: Object.entries(subscriberRanges).map(([range, count]) => ({
        range,
        count,
      })),
    });
  }

  /**
   * Helper method to check if an object matches where conditions
   * @param {Object} obj - Object to check
   * @param {Object} where - Where conditions
   * @returns {boolean} Whether object matches
   */
  matchesWhere(obj, where) {
    for (const [key, value] of Object.entries(where)) {
      if (obj[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

module.exports = ChannelRepository;