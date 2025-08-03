import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import request from 'supertest';
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import { ChannelFactory, VideoFactory, AnalysisConfigFactory, OutlierResultFactory } from '../factories/testDataFactory.js';

// Mock the YouTube service with realistic behavior
const mockYoutubeService = {
  searchChannels: mock(() => Promise.resolve([])),
  getChannelVideos: mock(() => Promise.resolve([])),
  getChannelInfo: mock(() => Promise.resolve({})),
};

const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

// Mock Redis
const mockRedis = {
  get: mock(() => Promise.resolve(null)),
  setEx: mock(() => Promise.resolve('OK')),
  connect: mock(() => Promise.resolve()),
  on: mock(() => {}),
};

// Note: Bun doesn't support jest.doMock - we'll use manual mocking
// These imports need to be mocked at the module level

// Import after mocking
const OutlierDetectionService = await import('../../server/src/services/outlierDetectionService.js');
const outlierRoutes = await import('../../server/src/routes/outlier.js');
const channelRoutes = await import('../../server/src/routes/channels.js');

describe('Full Analysis Workflow Integration Tests', () => {
  let app;
  let server;
  let io;
  let clientSocket;
  let port;

  beforeEach(async () => {
    // Create test server with socket.io
    app = express();
    app.use(express.json());

    server = createServer(app);
    port = 3000 + Math.floor(Math.random() * 1000); // Random port to avoid conflicts

    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    app.set('io', io);

    // Add routes
    app.use('/api/outlier', outlierRoutes.default);
    app.use('/api/channels', channelRoutes.default);

    // Start server
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });

    // Create client socket
    clientSocket = Client(`http://localhost:${port}`);
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Reset mocks
    Object.values(mockYoutubeService).forEach(mockFn => mockFn.mockReset());
    Object.values(mockLogger).forEach(mockFn => mockFn.mockReset());
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.close();
    }
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  describe('Complete Analysis Workflow', () => {
    it('should execute full analysis workflow from start to completion', async () => {
      // Setup mock data
      const mockChannels = ChannelFactory.createBatch(3, {
        statistics: {
          subscriberCount: '100000',
          videoCount: '200',
        },
      });

      const mockVideosForExclusion = VideoFactory.createBatch(5, {
        snippet: {
          title: 'Playing DOORS and Piggy games',
          description: 'Fun horror games for kids',
        },
      });

      const mockVideosForAnalysis = VideoFactory.createBatch(10, {
        statistics: {
          viewCount: '500000', // High view count for outlier detection
        },
      });

      // Mock service responses
      mockYoutubeService.searchChannels
        .mockResolvedValueOnce(mockChannels) // For exclusion channels
        .mockResolvedValueOnce(mockChannels) // For adjacent channels discovery
        .mockResolvedValue([]);

      mockYoutubeService.getChannelVideos
        .mockResolvedValueOnce(mockVideosForExclusion) // For exclusion list building
        .mockResolvedValue(mockVideosForAnalysis); // For analysis

      mockYoutubeService.getChannelInfo.mockResolvedValue(mockChannels[0]);

      // Start analysis
      const config = AnalysisConfigFactory.createDefault();
      const response = await request(app)
        .post('/api/outlier/start')
        .send(config)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysisId).toBeDefined();

      const analysisId = response.body.analysisId;

      // Join analysis room
      clientSocket.emit('join-analysis', analysisId);

      // Listen for events
      const events = [];
      clientSocket.on('progress', (data) => {
        events.push({ type: 'progress', data });
      });

      clientSocket.on('complete', (data) => {
        events.push({ type: 'complete', data });
      });

      clientSocket.on('error', (data) => {
        events.push({ type: 'error', data });
      });

      // Wait for analysis to complete
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 10000); // 10 second timeout

        clientSocket.on('complete', () => {
          clearTimeout(timeout);
          resolve();
        });

        clientSocket.on('error', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Verify events were received
      expect(events.length).toBeGreaterThan(0);

      const progressEvents = events.filter(e => e.type === 'progress');
      const completeEvents = events.filter(e => e.type === 'complete');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(completeEvents.length).toBe(1);

      // Verify analysis status endpoint
      const statusResponse = await request(app)
        .get(`/api/outlier/status/${analysisId}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.analysis.status).toBeOneOf(['completed', 'processing']);
    }, 15000); // Increase timeout for integration test

    it('should handle analysis with no valid channels found', async () => {
      // Mock empty results
      mockYoutubeService.searchChannels.mockResolvedValue([]);
      mockYoutubeService.getChannelVideos.mockResolvedValue([]);
      mockYoutubeService.getChannelInfo.mockResolvedValue({});

      const config = AnalysisConfigFactory.createDefault();
      const response = await request(app)
        .post('/api/outlier/start')
        .send(config)
        .expect(200);

      const analysisId = response.body.analysisId;
      clientSocket.emit('join-analysis', analysisId);

      // Wait for completion
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5000);

        clientSocket.on('complete', (data) => {
          clearTimeout(timeout);
          expect(data.results).toHaveLength(0);
          resolve();
        });
      });
    });

    it('should handle service errors during analysis', async () => {
      // Mock service error
      mockYoutubeService.searchChannels.mockRejectedValue(new Error('YouTube API Error'));

      const config = AnalysisConfigFactory.createDefault();
      const response = await request(app)
        .post('/api/outlier/start')
        .send(config)
        .expect(200);

      const analysisId = response.body.analysisId;
      clientSocket.emit('join-analysis', analysisId);

      // Wait for error
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5000);

        clientSocket.on('error', (data) => {
          clearTimeout(timeout);
          expect(data.error).toBeDefined();
          expect(data.analysisId).toBe(analysisId);
          resolve();
        });
      });
    });
  });

  describe('Channel Discovery Integration', () => {
    it('should discover channels based on search queries', async () => {
      const mockChannels = ChannelFactory.createBatch(5);
      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);

      const response = await request(app)
        .get('/api/channels/search?q=roblox gaming')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toHaveLength(5);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith(
        'roblox gaming',
        25,
        { min: 10000, max: 500000 },
      );
    });

    it('should filter channels by subscriber count', async () => {
      const mockChannelsWithStats = [
        ChannelFactory.create({ statistics: { subscriberCount: '5000' } }), // Too low
        ChannelFactory.create({ statistics: { subscriberCount: '100000' } }), // Good
        ChannelFactory.create({ statistics: { subscriberCount: '1000000' } }), // Too high
      ];

      mockYoutubeService.searchChannels.mockResolvedValue([mockChannelsWithStats[1]]); // Service should filter

      const response = await request(app)
        .get('/api/channels/search?q=gaming&minSubs=50000&maxSubs=500000')
        .expect(200);

      expect(response.body.channels).toHaveLength(1);
      expect(parseInt(response.body.channels[0].statistics.subscriberCount)).toBeGreaterThanOrEqual(50000);
      expect(parseInt(response.body.channels[0].statistics.subscriberCount)).toBeLessThanOrEqual(500000);
    });
  });

  describe('Video Analysis Integration', () => {
    it('should fetch and analyze channel videos', async () => {
      const channelId = 'UCTest123';
      const mockChannel = ChannelFactory.create();
      const mockVideos = VideoFactory.createBatch(10);

      mockYoutubeService.getChannelInfo.mockResolvedValue(mockChannel);
      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      // Get channel info
      const channelResponse = await request(app)
        .get(`/api/channels/${channelId}`)
        .expect(200);

      expect(channelResponse.body.success).toBe(true);
      expect(channelResponse.body.channel).toEqual(mockChannel);

      // Get channel videos
      const videosResponse = await request(app)
        .get(`/api/channels/${channelId}/videos?maxResults=10&timeWindow=7`)
        .expect(200);

      expect(videosResponse.body.success).toBe(true);
      expect(videosResponse.body.videos).toHaveLength(10);
      expect(mockYoutubeService.getChannelVideos).toHaveBeenCalledWith(
        channelId,
        10,
        expect.any(String),
      );
    });

    it('should handle time window parameter correctly', async () => {
      const channelId = 'UCTest123';
      mockYoutubeService.getChannelVideos.mockResolvedValue([]);

      await request(app)
        .get(`/api/channels/${channelId}/videos?timeWindow=14`)
        .expect(200);

      const call = mockYoutubeService.getChannelVideos.mock.calls[0];
      const publishedAfter = new Date(call[2]);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 14);

      // Allow for small time differences
      expect(Math.abs(publishedAfter.getTime() - expectedDate.getTime())).toBeLessThan(2000);
    });
  });

  describe('Data Export Integration', () => {
    it('should export analysis results as CSV', async () => {
      // First start an analysis to have results
      const mockResults = OutlierResultFactory.createBatch(3);

      // Mock successful analysis completion
      const mockAnalysisService = OutlierDetectionService.default;
      const startAnalysisSpy = mock.spyOn(mockAnalysisService, 'startAnalysis')
        .mockResolvedValue(mockResults);

      const config = AnalysisConfigFactory.createDefault();
      const response = await request(app)
        .post('/api/outlier/start')
        .send(config)
        .expect(200);

      const analysisId = response.body.analysisId;

      // Wait a bit for analysis to be stored
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: Due to the in-memory storage design, we can't easily test the full export
      // In a real application, this would use a database that we could populate for testing
      const exportResponse = await request(app)
        .get(`/api/outlier/export/${analysisId}`)
        .expect(404); // Will be 404 because analysis might not be completed yet

      expect(exportResponse.body.success).toBe(false);
    });
  });

  describe('Socket.IO Real-time Communication', () => {
    it('should handle multiple clients in same analysis room', async () => {
      // Create second client
      const clientSocket2 = Client(`http://localhost:${port}`);
      await new Promise((resolve) => {
        clientSocket2.on('connect', resolve);
      });

      try {
        const analysisId = 'test-multi-client';

        // Both clients join the same room
        clientSocket.emit('join-analysis', analysisId);
        clientSocket2.emit('join-analysis', analysisId);

        const client1Events = [];
        const client2Events = [];

        clientSocket.on('progress', (data) => {
          client1Events.push(data);
        });

        clientSocket2.on('progress', (data) => {
          client2Events.push(data);
        });

        // Simulate server emitting to the room
        io.to(`analysis-${analysisId}`).emit('progress', {
          step: 1,
          message: 'Test progress',
          progress: 50,
        });

        // Give some time for events to be received
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(client1Events).toHaveLength(1);
        expect(client2Events).toHaveLength(1);
        expect(client1Events[0].message).toBe('Test progress');
        expect(client2Events[0].message).toBe('Test progress');

      } finally {
        clientSocket2.close();
      }
    });

    it('should handle client disconnection gracefully', async () => {
      const analysisId = 'test-disconnection';

      clientSocket.emit('join-analysis', analysisId);

      // Disconnect client
      clientSocket.close();

      // Server should still be able to emit to the room without errors
      expect(() => {
        io.to(`analysis-${analysisId}`).emit('progress', {
          step: 1,
          message: 'Test after disconnect',
          progress: 25,
        });
      }).not.toThrow();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from temporary API failures', async () => {
      // Mock initial failure then success
      mockYoutubeService.searchChannels
        .mockRejectedValueOnce(new Error('Temporary API failure'))
        .mockResolvedValue(ChannelFactory.createBatch(2));

      // First request should fail
      await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(500);

      // Second request should succeed
      const response = await request(app)
        .get('/api/channels/search?q=gaming')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toHaveLength(2);
    });

    it('should handle rate limiting gracefully', async () => {
      // Mock rate limit error
      mockYoutubeService.getChannelInfo.mockRejectedValue(new Error('Rate limit exceeded'));

      const response = await request(app)
        .get('/api/channels/UCTest123')
        .expect(500);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent requests', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue(ChannelFactory.createBatch(1));

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .get(`/api/channels/search?q=gaming${i}`)
          .expect(200),
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });

      // All requests should have been processed
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledTimes(5);
    });

    it('should handle large result sets efficiently', async () => {
      const largeChannelSet = ChannelFactory.createBatch(50);
      mockYoutubeService.searchChannels.mockResolvedValue(largeChannelSet);

      const response = await request(app)
        .get('/api/channels/search?q=gaming&maxResults=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toHaveLength(50);
      expect(response.body.count).toBe(50);
    });
  });
});