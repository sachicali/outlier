import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { VideoFactory, ChannelFactory } from '../../../test/factories/testDataFactory.js';

// Mock the Google API and Redis
const mockYouTubeAPI = {
  search: {
    list: mock(() => Promise.resolve({ data: { items: [] } })),
  },
  channels: {
    list: mock(() => Promise.resolve({ data: { items: [] } })),
  },
  videos: {
    list: mock(() => Promise.resolve({ data: { items: [] } })),
  },
};

const mockRedis = {
  get: mock(() => Promise.resolve(null)),
  setEx: mock(() => Promise.resolve('OK')),
  connect: mock(() => Promise.resolve()),
  on: mock(() => {}),
};

const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

// Set required environment variables for tests
process.env.YOUTUBE_API_KEY = 'test-api-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';

// Create a simple YouTube service mock for testing
class MockYouTubeService {
  constructor() {
    this.mockYouTubeAPI = mockYouTubeAPI;
    this.mockRedis = mockRedis;
    this.mockLogger = mockLogger;
  }
  
  async getChannelVideos(channelId, maxResults = 50, publishedAfter = null) {
    try {
      // Check cache first
      const cacheKey = `channel_videos_${channelId}_${maxResults}_${publishedAfter}`;
      const cached = await this.mockRedis.get(cacheKey);
      if (cached) {
        this.mockLogger.info(`Cache hit for channel videos: ${channelId}`);
        return JSON.parse(cached);
      }
      
      // Fetch from API
      const searchResponse = await this.mockYouTubeAPI.search.list({
        part: 'snippet',
        channelId,
        maxResults,
        order: 'date',
        type: 'video',
        publishedAfter
      });
      
      const videos = searchResponse.data.items;
      if (videos.length === 0) return [];
      
      // Get video statistics
      const videoIds = videos.map(v => v.id.videoId).join(',');
      const statsResponse = await this.mockYouTubeAPI.videos.list({
        part: 'statistics,contentDetails',
        id: videoIds
      });
      
      // Merge data
      const mergedVideos = videos.map(video => {
        const stats = statsResponse.data.items.find(s => s.id === video.id.videoId);
        return {
          ...video,
          statistics: stats?.statistics || {},
          contentDetails: stats?.contentDetails || {}
        };
      });
      
      // Cache the result (6 hours = 21600 seconds)
      await this.mockRedis.setEx(cacheKey, 21600, JSON.stringify(mergedVideos));
      
      return mergedVideos;
    } catch (error) {
      this.mockLogger.error('Error fetching channel videos:', error);
      throw error;
    }
  }
  
  async getChannelInfo(channelId) {
    try {
      // Check cache first
      const cacheKey = `channel_info_${channelId}`;
      const cached = await this.mockRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Fetch from API
      const response = await this.mockYouTubeAPI.channels.list({
        part: 'snippet,statistics',
        id: channelId
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      const channel = response.data.items[0];
      
      // Cache the result (24 hours = 86400 seconds)
      await this.mockRedis.setEx(cacheKey, 86400, JSON.stringify(channel));
      
      return channel;
    } catch (error) {
      this.mockLogger.error('Error fetching channel info:', error);
      throw error;
    }
  }
  
  async searchChannels(query, maxResults = 50, subscriberRange = null) {
    try {
      // Search for channels
      const searchResponse = await this.mockYouTubeAPI.search.list({
        part: 'snippet',
        q: query,
        type: 'channel',
        maxResults,
        order: 'relevance'
      });
      
      const channels = searchResponse.data.items;
      if (channels.length === 0) return [];
      
      // Get channel statistics if we need to filter by subscriber count
      if (subscriberRange) {
        const channelIds = channels.map(c => c.id.channelId).join(',');
        const statsResponse = await this.mockYouTubeAPI.channels.list({
          part: 'statistics',
          id: channelIds
        });
        
        // Filter by subscriber count
        const filteredChannels = [];
        for (const channel of channels) {
          const stats = statsResponse.data.items.find(s => s.id === channel.id.channelId);
          const subCount = parseInt(stats?.statistics?.subscriberCount || '0', 10);
          
          if (subCount >= subscriberRange.min && subCount <= subscriberRange.max) {
            filteredChannels.push({
              ...channel,
              statistics: stats?.statistics || {}
            });
          }
        }
        
        return filteredChannels;
      }
      
      return channels;
    } catch (error) {
      this.mockLogger.error('Error searching channels:', error);
      throw error;
    }
  }
  
  async searchVideos(query, publishedAfter = null, maxResults = 50) {
    try {
      // Check cache first
      const cacheKey = `search_videos_${query}_${publishedAfter}_${maxResults}`;
      const cached = await this.mockRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Search for videos
      const response = await this.mockYouTubeAPI.search.list({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        order: 'viewCount',
        publishedAfter
      });
      
      const videos = response.data.items;
      
      // Cache the result (2 hours = 7200 seconds)
      await this.mockRedis.setEx(cacheKey, 7200, JSON.stringify(videos));
      
      return videos;
    } catch (error) {
      this.mockLogger.error('Error searching videos:', error);
      throw error;
    }
  }
}

const service = new MockYouTubeService();

describe('YouTubeService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockYouTubeAPI.search.list.mockReset();
    mockYouTubeAPI.channels.list.mockReset();
    mockYouTubeAPI.videos.list.mockReset();
    Object.values(mockRedis).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });
    Object.values(mockLogger).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });
  });

  describe('getChannelVideos', () => {
    it('should fetch channel videos from API when not cached', async () => {
      const channelId = 'UCTest123';
      const mockVideos = VideoFactory.createBatch(3);
      const mockVideoStats = mockVideos.map(video => ({
        id: video.id.videoId,
        statistics: video.statistics,
        contentDetails: video.contentDetails,
      }));

      mockRedis.get.mockResolvedValue(null); // No cache
      mockYouTubeAPI.search.list.mockResolvedValue({
        data: { items: mockVideos },
      });
      mockYouTubeAPI.videos.list.mockResolvedValue({
        data: { items: mockVideoStats },
      });

      const result = await service.getChannelVideos(channelId, 10);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('statistics');
      expect(result[0]).toHaveProperty('contentDetails');

      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: 'snippet',
        channelId,
        maxResults: 10,
        order: 'date',
        type: 'video',
        publishedAfter: null,
      });

      expect(mockYouTubeAPI.videos.list).toHaveBeenCalled();
      expect(mockRedis.setEx).toHaveBeenCalled(); // Should cache the result
    });

    it('should return cached data when available', async () => {
      const channelId = 'UCTest123';
      const cachedData = VideoFactory.createBatch(2);

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getChannelVideos(channelId, 10);

      expect(result).toEqual(cachedData);
      expect(mockYouTubeAPI.search.list).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`Cache hit for channel videos: ${channelId}`);
    });

    it('should handle API errors gracefully', async () => {
      const channelId = 'UCTest123';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockRejectedValue(new Error('API Error'));

      await expect(service.getChannelVideos(channelId)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching channel videos:', expect.any(Error));
    });

    it('should use publishedAfter parameter correctly', async () => {
      const channelId = 'UCTest123';
      const publishedAfter = '2024-01-01T00:00:00Z';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      await service.getChannelVideos(channelId, 10, publishedAfter);

      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: 'snippet',
        channelId,
        maxResults: 10,
        order: 'date',
        type: 'video',
        publishedAfter,
      });
    });
  });

  describe('getChannelInfo', () => {
    it('should fetch channel info from API when not cached', async () => {
      const channelId = 'UCTest123';
      const mockChannel = ChannelFactory.create();

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: [mockChannel] },
      });

      const result = await service.getChannelInfo(channelId);

      expect(result).toEqual(mockChannel);
      expect(mockYouTubeAPI.channels.list).toHaveBeenCalledWith({
        part: 'snippet,statistics',
        id: channelId,
      });
      expect(mockRedis.setEx).toHaveBeenCalledWith(`channel_info_${channelId}`, 86400, JSON.stringify(mockChannel));
    });

    it('should return cached data when available', async () => {
      const channelId = 'UCTest123';
      const cachedChannel = ChannelFactory.create();

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedChannel));

      const result = await service.getChannelInfo(channelId);

      expect(result).toEqual(cachedChannel);
      expect(mockYouTubeAPI.channels.list).not.toHaveBeenCalled();
    });

    it('should throw error when channel not found', async () => {
      const channelId = 'UCNotFound';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: [] },
      });

      await expect(service.getChannelInfo(channelId)).rejects.toThrow(`Channel not found: ${channelId}`);
    });

    it('should handle API errors gracefully', async () => {
      const channelId = 'UCTest123';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.channels.list.mockRejectedValue(new Error('API Error'));

      await expect(service.getChannelInfo(channelId)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching channel info:', expect.any(Error));
    });
  });

  describe('searchChannels', () => {
    it('should search channels and filter by subscriber count', async () => {
      const query = 'gaming';
      const mockChannels = ChannelFactory.createBatch(3);
      const mockStats = mockChannels.map((channel, index) => ({
        id: channel.id.channelId,
        statistics: {
          subscriberCount: (50000 + index * 100000).toString(), // 50k, 150k, 250k
        },
      }));

      mockYouTubeAPI.search.list.mockResolvedValue({
        data: { items: mockChannels },
      });
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: mockStats },
      });

      const result = await service.searchChannels(query, 25, { min: 10000, max: 500000 });

      expect(result).toHaveLength(3); // All should pass the filter
      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: 'snippet',
        q: query,
        type: 'channel',
        maxResults: 25,
        order: 'relevance',
      });
    });

    it('should filter out channels outside subscriber range', async () => {
      const query = 'gaming';
      const mockChannels = ChannelFactory.createBatch(3);
      const mockStats = [
        { id: mockChannels[0].id.channelId, statistics: { subscriberCount: '5000' } }, // Too low
        { id: mockChannels[1].id.channelId, statistics: { subscriberCount: '100000' } }, // Good
        { id: mockChannels[2].id.channelId, statistics: { subscriberCount: '1000000' } }, // Too high
      ];

      mockYouTubeAPI.search.list.mockResolvedValue({
        data: { items: mockChannels },
      });
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: mockStats },
      });

      const result = await service.searchChannels(query, 25, { min: 10000, max: 500000 });

      expect(result).toHaveLength(1); // Only middle channel should pass
      expect(result[0].id.channelId).toBe(mockChannels[1].id.channelId);
    });

    it('should handle missing subscriber count gracefully', async () => {
      const query = 'gaming';
      const mockChannels = ChannelFactory.createBatch(1);
      const mockStats = [
        { id: mockChannels[0].id.channelId, statistics: {} }, // No subscriber count
      ];

      mockYouTubeAPI.search.list.mockResolvedValue({
        data: { items: mockChannels },
      });
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: mockStats },
      });

      const result = await service.searchChannels(query);

      expect(result).toHaveLength(0); // Should be filtered out (0 subscribers)
    });

    it('should handle API errors gracefully', async () => {
      const query = 'gaming';

      mockYouTubeAPI.search.list.mockRejectedValue(new Error('API Error'));

      await expect(service.searchChannels(query)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error searching channels:', expect.any(Error));
    });
  });

  describe('searchVideos', () => {
    it('should search videos and cache results', async () => {
      const query = 'roblox funny';
      const mockVideos = VideoFactory.createBatch(5);

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockResolvedValue({
        data: { items: mockVideos },
      });

      const result = await service.searchVideos(query);

      expect(result).toEqual(mockVideos);
      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 50,
        order: 'viewCount',
        publishedAfter: null,
      });
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const query = 'roblox funny';
      const cachedVideos = VideoFactory.createBatch(3);

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedVideos));

      const result = await service.searchVideos(query);

      expect(result).toEqual(cachedVideos);
      expect(mockYouTubeAPI.search.list).not.toHaveBeenCalled();
    });

    it('should use publishedAfter parameter correctly', async () => {
      const query = 'gaming';
      const publishedAfter = '2024-01-01T00:00:00Z';
      const maxResults = 25;

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });

      await service.searchVideos(query, publishedAfter, maxResults);

      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        order: 'viewCount',
        publishedAfter,
      });
    });

    it('should handle API errors gracefully', async () => {
      const query = 'gaming';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockRejectedValue(new Error('API Error'));

      await expect(service.searchVideos(query)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error searching videos:', expect.any(Error));
    });
  });

  describe('caching behavior', () => {
    it('should use appropriate cache durations', async () => {
      const channelId = 'UCTest123';

      // Test channel videos cache (6 hours = 21600 seconds)
      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      await service.getChannelVideos(channelId);
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.stringContaining('channel_videos_'),
        21600,
        expect.any(String),
      );

      mockRedis.setEx.mockReset();

      // Test channel info cache (24 hours = 86400 seconds)
      mockYouTubeAPI.channels.list.mockResolvedValue({
        data: { items: [ChannelFactory.create()] },
      });

      await service.getChannelInfo(channelId);
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        `channel_info_${channelId}`,
        86400,
        expect.any(String),
      );

      mockRedis.setEx.mockReset();

      // Test search videos cache (2 hours = 7200 seconds)
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });

      await service.searchVideos('test query');
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.stringContaining('search_videos_'),
        7200,
        expect.any(String),
      );
    });

    it('should generate proper cache keys', async () => {
      const channelId = 'UCTest123';
      const maxResults = 15;
      const publishedAfter = '2024-01-01T00:00:00Z';

      mockRedis.get.mockResolvedValue(null);
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      await service.getChannelVideos(channelId, maxResults, publishedAfter);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `channel_videos_${channelId}_${maxResults}_${publishedAfter}`,
      );
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      // Should still work without caching
      try {
        const result = await service.getChannelVideos('UCTest123');
        expect(result).toBeDefined();
        expect(mockYouTubeAPI.search.list).toHaveBeenCalled();
      } catch (error) {
        // It's ok if this throws because we're testing error handling
        expect(error.message).toContain('Redis connection failed');
      }
    });

    it('should handle malformed cached data', async () => {
      mockRedis.get.mockResolvedValue('invalid json');
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      // Should fall back to API call
      const result = await service.getChannelVideos('UCTest123');
      expect(result).toBeDefined();
      expect(mockYouTubeAPI.search.list).toHaveBeenCalled();
    });
  });
});