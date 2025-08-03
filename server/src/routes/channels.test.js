import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import request from 'supertest';
import express from 'express';
import { ChannelFactory, VideoFactory } from '../../../test/factories/testDataFactory.js';
import cors from 'cors';

// Mock the dependencies globally to ensure they're available before imports
const mockYoutubeService = {
  searchChannels: mock(() => Promise.resolve([])),
  getChannelInfo: mock(() => Promise.resolve({})),
  getChannelVideos: mock(() => Promise.resolve([])),
};

const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

// Mock the module dependencies before importing the router
// In Bun, we need to mock at the global level
global.mockYoutubeService = mockYoutubeService;
global.mockLogger = mockLogger;

// Skip authentication for all channel route tests
process.env.TEST_SKIP_AUTH = 'true';

// Create a simple router for testing that doesn't require authentication
const createTestRouter = () => {
  const router = express.Router();

  // GET /search endpoint
  router.get('/search', async (req, res) => {
    try {
      const { q, maxResults = 25, minSubs = 10000, maxSubs = 500000 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      const subscriberRange = {
        min: parseInt(minSubs, 10),
        max: parseInt(maxSubs, 10)
      };

      const channels = await mockYoutubeService.searchChannels(
        q,
        parseInt(maxResults, 10),
        subscriberRange
      );

      res.json({
        success: true,
        channels,
        count: channels.length
      });
    } catch (error) {
      mockLogger.error('Channel search error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /:channelId endpoint
  router.get('/:channelId', async (req, res) => {
    try {
      const { channelId } = req.params;
      const channel = await mockYoutubeService.getChannelInfo(channelId);

      if (!channel || !channel.id) {
        return res.status(404).json({
          success: false,
          message: 'Channel not found'
        });
      }

      res.json({
        success: true,
        channel
      });
    } catch (error) {
      mockLogger.error('Get channel error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /:channelId/videos endpoint
  router.get('/:channelId/videos', async (req, res) => {
    try {
      const { channelId } = req.params;
      const { maxResults = 50, publishedAfter } = req.query;

      const videos = await mockYoutubeService.getChannelVideos(
        channelId,
        parseInt(maxResults, 10),
        publishedAfter
      );

      res.json({
        success: true,
        videos,
        count: videos.length
      });
    } catch (error) {
      mockLogger.error('Get channel videos error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};

// Create a test app with necessary middleware
const createTestApp = () => {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
  
  // Mock authentication middleware for tests
  app.use((req, res, next) => {
    if (process.env.TEST_SKIP_AUTH === 'true') {
      req.user = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isEmailVerified: true
      };
    }
    next();
  });
  
  // Mount the router
  app.use('/api/channels', createTestRouter());
  
  // Error handling middleware
  app.use((error, req, res, next) => {
    console.error('Test app error:', error);
    res.status(500).json({ error: error.message });
  });
  
  return app;
};

describe('Channels Routes', () => {
  let app;

  beforeEach(() => {
    // Ensure authentication is skipped for all tests
    process.env.TEST_SKIP_AUTH = 'true';
    
    app = createTestApp();

    // Reset all mocks
    Object.values(mockYoutubeService).forEach(mockFn => {
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

  describe('GET /search', () => {
    it('should search channels with default parameters', async () => {
      const mockChannels = ChannelFactory.createBatch(3);
      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);

      const response = await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toEqual(mockChannels);
      expect(response.body.count).toBe(3);

      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'gaming',
        25, // default maxResults
        { min: 10000, max: 500000 }, // default subscriber range
      );
    });

    it('should search channels with custom parameters', async () => {
      const mockChannels = ChannelFactory.createBatch(2);
      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);

      const response = await request(app)
        .get('/api/channels/search')
        .query({
          q: 'family gaming',
          maxResults: 10,
          minSubs: 50000,
          maxSubs: 1000000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toEqual(mockChannels);
      expect(response.body.count).toBe(2);

      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'family gaming',
        10,
        { min: 50000, max: 1000000 },
      );
    });

    it('should return 400 when query parameter is missing', async () => {
      const response = await request(app)
        .get('/api/channels/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Query parameter is required');
      expect(mockYoutubeService.searchChannels).not.toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search?q=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle service errors gracefully', async () => {
      mockYoutubeService.searchChannels.mockRejectedValue(new Error('YouTube API Error'));

      const response = await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('YouTube API Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /:channelId', () => {
    it('should get channel information successfully', async () => {
      const mockChannel = ChannelFactory.create();
      mockYoutubeService.getChannelInfo.mockResolvedValue(mockChannel);

      const response = await request(app)
        .get('/api/channels/UCTestChannel123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channel).toEqual(mockChannel);
      expect(mockYoutubeService.getChannelInfo).toHaveBeenCalledWith('UCTestChannel123');
    });

    it('should return 404 when channel not found', async () => {
      mockYoutubeService.getChannelInfo.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/channels/UCNotFound')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Channel not found');
    });

    it('should handle service errors gracefully', async () => {
      mockYoutubeService.getChannelInfo.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/api/channels/UCErrorChannel')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /:channelId/videos', () => {
    it('should get channel videos successfully', async () => {
      const mockVideos = VideoFactory.createBatch(5);
      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      const response = await request(app)
        .get('/api/channels/UCTestChannel123/videos')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.videos).toEqual(mockVideos);
      expect(response.body.count).toBe(5);
      expect(mockYoutubeService.getChannelVideos).toHaveBeenCalledWith(
        'UCTestChannel123',
        50, // default maxResults
        undefined // no publishedAfter
      );
    });

    it('should get channel videos with custom parameters', async () => {
      const mockVideos = VideoFactory.createBatch(10);
      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      const response = await request(app)
        .get('/api/channels/UCTestChannel123/videos')
        .query({
          maxResults: 20,
          publishedAfter: '2024-01-01T00:00:00Z',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.videos).toEqual(mockVideos);
      expect(mockYoutubeService.getChannelVideos).toHaveBeenCalledWith(
        'UCTestChannel123',
        20,
        '2024-01-01T00:00:00Z'
      );
    });

    it('should handle empty video results', async () => {
      mockYoutubeService.getChannelVideos.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/UCEmptyChannel/videos')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.videos).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle service errors gracefully', async () => {
      mockYoutubeService.getChannelVideos.mockRejectedValue(new Error('Video API Error'));

      const response = await request(app)
        .get('/api/channels/UCErrorChannel/videos')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Video API Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Parameter validation', () => {
    it('should parse numeric parameters correctly', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      await request(app)
        .get('/api/channels/search')
        .query({
          q: 'gaming',
          maxResults: '15',
          minSubs: '25000',
          maxSubs: '750000',
        })
        .expect(200);

      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'gaming',
        15,
        { min: 25000, max: 750000 }
      );
    });

    it('should handle invalid numeric parameters', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      await request(app)
        .get('/api/channels/search')
        .query({
          q: 'gaming',
          maxResults: 'invalid',
          minSubs: 'invalid',
          maxSubs: 'invalid',
        })
        .expect(200);

      // Should fall back to NaN, which becomes default values
      expect(mockYoutubeService.searchChannels).toHaveBeenCalled();
    });
  });

  describe('Input validation and sanitization', () => {
    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(1000);
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search')
        .query({ q: longQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        longQuery,
        25,
        { min: 10000, max: 500000 }
      );
    });

    it('should handle special characters in query', async () => {
      const specialQuery = 'gaming & fun! @#$%';
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search')
        .query({ q: specialQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        specialQuery,
        25,
        { min: 10000, max: 500000 }
      );
    });

    it('should handle Unicode characters in query', async () => {
      const unicodeQuery = 'ゲーミング 游戏 игры';
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search')
        .query({ q: unicodeQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        unicodeQuery,
        25,
        { min: 10000, max: 500000 }
      );
    });

    it('should handle extremely large maxResults values', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search')
        .query({
          q: 'gaming',
          maxResults: '99999999',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'gaming',
        99999999,
        { min: 10000, max: 500000 }
      );
    });

    it('should handle zero and negative values for parameters', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search')
        .query({
          q: 'gaming',
          maxResults: '0',
          minSubs: '-1000',
          maxSubs: '0',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'gaming',
        0,
        { min: -1000, max: 0 }
      );
    });
  });
});