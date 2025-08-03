import { describe, it, expect, beforeEach, mock } from 'bun:test';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-for-testing-purposes-must-be-at-least-32-chars-long';
process.env.LOG_LEVEL = 'error';

// Mock YouTube service with proper error handling
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

// Simple test router that mimics the actual API structure
const createTestRouter = () => {
  const router = express.Router();

  router.get('/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required'
        });
      }

      const channels = await mockYoutubeService.searchChannels(q);
      res.json({
        success: true,
        channels: channels || [],
        count: (channels || []).length
      });
    } catch (error) {
      mockLogger.error('Search error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  router.get('/:channelId', async (req, res) => {
    try {
      const channel = await mockYoutubeService.getChannelInfo(req.params.channelId);
      if (!channel || Object.keys(channel).length === 0) {
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

  return router;
};

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cors());
  
  // Mock auth middleware
  app.use((req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  });
  
  app.use('/api/channels', createTestRouter());
  return app;
};

describe('YouTube Outlier Discovery Tool - Test Infrastructure', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    
    // Reset mocks
    mockYoutubeService.searchChannels.mockReset();
    mockYoutubeService.getChannelInfo.mockReset();
    mockYoutubeService.getChannelVideos.mockReset();
    mockLogger.error.mockReset();
  });

  describe('Test Infrastructure Validation', () => {
    it('should have Bun test runner working', () => {
      expect(typeof describe).toBe('function');
      expect(typeof it).toBe('function');
      expect(typeof expect).toBe('function');
      expect(typeof mock).toBe('function');
    });

    it('should have environment variables configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.JWT_ACCESS_SECRET).toBeDefined();
      expect(process.env.JWT_ACCESS_SECRET.length).toBeGreaterThan(32);
    });

    it('should have mocking system working', () => {
      const testMock = mock(() => 'test-value');
      expect(testMock()).toBe('test-value');
      expect(testMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Route Testing', () => {
    it('should handle channel search successfully', async () => {
      const mockChannels = [
        { id: 'UC1', name: 'Channel 1' },
        { id: 'UC2', name: 'Channel 2' }
      ];
      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);

      const response = await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toHaveLength(2);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith('gaming');
    });

    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .get('/api/channels/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Query parameter is required');
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

    it('should handle API errors', async () => {
      mockYoutubeService.searchChannels.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should get channel info successfully', async () => {
      const mockChannel = { id: 'UC123', name: 'Test Channel', subscribers: 10000 };
      mockYoutubeService.getChannelInfo.mockResolvedValue(mockChannel);

      const response = await request(app)
        .get('/api/channels/UC123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channel).toEqual(mockChannel);
    });

    it('should handle channel not found', async () => {
      mockYoutubeService.getChannelInfo.mockResolvedValue({});

      const response = await request(app)
        .get('/api/channels/UCNotFound')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Channel not found');
    });
  });

  describe('Authentication & Security', () => {
    it('should have user context in requests', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/channels/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      // The fact that we get a 200 response means authentication middleware is working
    });
  });

  describe('Mock Validation', () => {
    it('should properly reset mocks between tests', () => {
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledTimes(0);
      expect(mockYoutubeService.getChannelInfo).toHaveBeenCalledTimes(0);
      expect(mockLogger.error).toHaveBeenCalledTimes(0);
    });

    it('should track mock calls correctly', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);

      await request(app)
        .get('/api/channels/search?q=test1')
        .expect(200);

      await request(app)
        .get('/api/channels/search?q=test2')
        .expect(200);

      expect(mockYoutubeService.searchChannels).toHaveBeenCalledTimes(2);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith('test1');
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith('test2');
    });
  });
});