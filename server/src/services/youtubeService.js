const { google } = require('googleapis');
const redis = require('redis');
const logger = require('../utils/logger');

class YouTubeService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });

    // Initialize Redis client
    this.redis = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.connect();
  }

  async getChannelVideos(channelId, maxResults = 10, publishedAfter = null) {
    const cacheKey = `channel_videos_${channelId}_${maxResults}_${publishedAfter}`;

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for channel videos: ${channelId}`);
        return JSON.parse(cached);
      }

      const response = await this.youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        maxResults: maxResults,
        order: 'date',
        type: 'video',
        publishedAfter: publishedAfter,
      });

      const videoIds = response.data.items.map(item => item.id.videoId);

      // Get video statistics
      const statsResponse = await this.youtube.videos.list({
        part: 'statistics,contentDetails',
        id: videoIds.join(','),
      });

      // Combine video info with stats
      const videosWithStats = response.data.items.map(video => {
        const stats = statsResponse.data.items.find(stat => stat.id === video.id.videoId);
        return {
          ...video,
          statistics: stats?.statistics || {},
          contentDetails: stats?.contentDetails || {},
        };
      });

      // Cache for 6 hours
      await this.redis.setEx(cacheKey, 21600, JSON.stringify(videosWithStats));

      logger.info(`Retrieved ${videosWithStats.length} videos for channel: ${channelId}`);
      return videosWithStats;

    } catch (error) {
      logger.error('Error fetching channel videos:', error);
      throw error;
    }
  }

  async getChannelInfo(channelId) {
    const cacheKey = `channel_info_${channelId}`;

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.youtube.channels.list({
        part: 'snippet,statistics',
        id: channelId,
      });

      if (response.data.items.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const channelData = response.data.items[0];

      // Cache for 24 hours
      await this.redis.setEx(cacheKey, 86400, JSON.stringify(channelData));

      return channelData;

    } catch (error) {
      logger.error('Error fetching channel info:', error);
      throw error;
    }
  }

  async searchChannels(query, maxResults = 25, subscriberRange = { min: 10000, max: 500000 }) {
    try {
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'channel',
        maxResults: maxResults,
        order: 'relevance',
      });

      // Get channel statistics to filter by subscriber count
      const channelIds = response.data.items.map(item => item.id.channelId);
      const statsResponse = await this.youtube.channels.list({
        part: 'statistics',
        id: channelIds.join(','),
      });

      // Filter channels by subscriber count
      const filteredChannels = response.data.items.filter(channel => {
        const stats = statsResponse.data.items.find(stat => stat.id === channel.id.channelId);
        const subCount = parseInt(stats?.statistics?.subscriberCount || 0);
        return subCount >= subscriberRange.min && subCount <= subscriberRange.max;
      });

      logger.info(`Found ${filteredChannels.length} channels matching criteria for query: ${query}`);
      return filteredChannels;

    } catch (error) {
      logger.error('Error searching channels:', error);
      throw error;
    }
  }

  async searchVideos(query, publishedAfter = null, maxResults = 50) {
    const cacheKey = `search_videos_${query}_${publishedAfter}_${maxResults}`;

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: maxResults,
        order: 'viewCount',
        publishedAfter: publishedAfter,
      });

      // Cache for 2 hours
      await this.redis.setEx(cacheKey, 7200, JSON.stringify(response.data.items));

      return response.data.items;

    } catch (error) {
      logger.error('Error searching videos:', error);
      throw error;
    }
  }
}

module.exports = new YouTubeService();
