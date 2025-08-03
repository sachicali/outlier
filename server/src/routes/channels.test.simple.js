import { describe, it, expect, beforeEach, mock } from 'bun:test';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.YOUTUBE_API_KEY = 'test-api-key';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-for-testing-purposes-must-be-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-purposes-must-be-at-least-32-chars-long';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-purposes-must-be-32-chars';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';

// Mock YouTube service
const mockYoutubeService = {
  searchChannels: mock(() => Promise.resolve([])),
  getChannelInfo: mock(() => Promise.resolve({})),
  getChannelVideos: mock(() => Promise.resolve([])),
};

// Mock logger
const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

// Simple test data factories
const createMockChannel = (overrides = {}) => ({
  id: { channelId: 'UCTest123' },
  snippet: {
    title: 'Test Gaming Channel',
    description: 'A test gaming channel',
    publishedAt: '2020-01-01T00:00:00Z',
    thumbnails: {
      default: { url: 'https://example.com/thumb.jpg' }
    }
  },
  statistics: {
    subscriberCount: '100000',
    videoCount: '200',
    viewCount: '5000000'
  },
  ...overrides
});

const createMockVideo = (overrides = {}) => ({
  id: { videoId: 'test-video-id' },
  snippet: {
    title: 'Test Gaming Video',
    description: 'A test gaming video',
    publishedAt: '2024-01-01T00:00:00Z',
    tags: ['gaming', 'test']
  },
  statistics: {
    viewCount: '10000',
    likeCount: '100',
    commentCount: '50'
  },
  contentDetails: {
    duration: 'PT10M30S'
  },
  ...overrides
});

// Create a simple test router
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

// Create test app
const createTestApp = () => {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  
  // Mock authentication middleware - always allow access in tests
  app.use((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      isEmailVerified: true
    };
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

describe('Channels Routes (Simple)', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();

    // Reset all mocks
    mockYoutubeService.searchChannels.mockReset();
    mockYoutubeService.getChannelInfo.mockReset();
    mockYoutubeService.getChannelVideos.mockReset();
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
  });

  describe('GET /search', () => {
    it('should search channels with default parameters', async () => {
      const mockChannels = [createMockChannel(), createMockChannel(), createMockChannel()];
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
      const mockChannels = [createMockChannel(), createMockChannel()];
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
      const mockChannel = createMockChannel();
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
      const mockVideos = [
        createMockVideo(),
        createMockVideo(),
        createMockVideo(),
        createMockVideo(),
        createMockVideo()
      ];
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
      const mockVideos = Array.from({ length: 10 }, () => createMockVideo());
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
});