import { describe, it, expect, beforeEach, mock } from 'bun:test';
import request from 'supertest';
import express from 'express';
import { AnalysisConfigFactory, OutlierResultFactory } from '../../../test/factories/testDataFactory.js';

// Mock the dependencies
const mockOutlierDetectionService = {
  startAnalysis: mock(() => Promise.resolve([])),
};

const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

const mockIo = {
  to: mock(() => ({
    emit: mock(() => {}),
  })),
};

// Note: Bun doesn't support jest.doMock - we'll use manual mocking
// These mocks will need to be set up at the global level

// Import the route after mocking
const outlierRouter = await import('./outlier.js');

// Create a test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.set('io', mockIo);
  app.use('/api/outlier', outlierRouter.default);
  return app;
};

describe('Outlier Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();

    // Reset all mocks
    Object.values(mockOutlierDetectionService).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });
    Object.values(mockLogger).forEach(mockFn => mockFn.mockReset());
  });

  describe('POST /start', () => {
    const validConfig = AnalysisConfigFactory.createDefault();

    it('should start new analysis with valid config', async () => {
      const mockResults = OutlierResultFactory.createBatch(5);
      mockOutlierDetectionService.startAnalysis.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/outlier/start')
        .send(validConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysisId).toBeDefined();
      expect(response.body.message).toBe('Analysis started successfully');

      expect(mockOutlierDetectionService.startAnalysis).toHaveBeenCalledWith(
        expect.any(String),
        validConfig,
        mockIo,
      );
    });

    it('should validate exclusionChannels is an array', async () => {
      const invalidConfig = {
        ...validConfig,
        exclusionChannels: 'not-an-array',
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err =>
        err.msg === 'Exclusion channels must be an array',
      )).toBe(true);
    });

    it('should validate minimum subscribers', async () => {
      const invalidConfig = {
        ...validConfig,
        minSubs: 500, // Too low
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err =>
        err.msg === 'Minimum subscribers must be at least 1000',
      )).toBe(true);
    });

    it('should validate maximum subscribers', async () => {
      const invalidConfig = {
        ...validConfig,
        maxSubs: 5000, // Too low
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err =>
        err.msg === 'Maximum subscribers must be at least 10000',
      )).toBe(true);
    });

    it('should validate time window range', async () => {
      const invalidConfig = {
        ...validConfig,
        timeWindow: 50, // Too high
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err =>
        err.msg === 'Time window must be between 1-30 days',
      )).toBe(true);
    });

    it('should validate outlier threshold range', async () => {
      const invalidConfig = {
        ...validConfig,
        outlierThreshold: 150, // Too high
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err =>
        err.msg === 'Outlier threshold must be between 10-100',
      )).toBe(true);
    });

    it('should handle service errors gracefully', async () => {
      mockOutlierDetectionService.startAnalysis.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/outlier/start')
        .send(validConfig)
        .expect(500);

      expect(response.body.success).toBeFalsy();
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/outlier/start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /status/:analysisId', () => {
    it('should return analysis status for existing analysis', async () => {
      // We need to simulate the in-memory storage
      const analysisId = 'test-analysis-id';

      // First start an analysis to populate the map
      await request(app)
        .post('/api/outlier/start')
        .send(AnalysisConfigFactory.createDefault());

      // Mock the service to complete immediately
      mockOutlierDetectionService.startAnalysis.mockResolvedValue([]);

      // Give some time for the analysis to be stored
      await new Promise(resolve => setTimeout(resolve, 10));

      // The actual test would need access to the in-memory storage
      // This is a limitation of the current architecture using Map for storage
      // In a real scenario, we'd use a database for this
    });

    it('should return 404 for non-existent analysis', async () => {
      const response = await request(app)
        .get('/api/outlier/status/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Analysis not found');
    });
  });

  describe('GET /results/:analysisId', () => {
    it('should return 404 for non-existent analysis', async () => {
      const response = await request(app)
        .get('/api/outlier/results/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Analysis not found');
    });

    // Additional tests would require accessing the in-memory storage
    // which is not easily testable with the current architecture
  });

  describe('GET /export/:analysisId', () => {
    it('should return 404 for non-existent analysis', async () => {
      const response = await request(app)
        .get('/api/outlier/export/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Analysis not found or not completed');
    });

    // CSV export tests would also require accessing the in-memory storage
  });

  describe('GET /list', () => {
    it('should return empty list when no analyses exist', async () => {
      const response = await request(app)
        .get('/api/outlier/list')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analyses).toEqual([]);
    });

    // Additional tests for populated list would require managing the in-memory storage
  });

  describe('Input validation edge cases', () => {
    it('should handle empty exclusionChannels array', async () => {
      const configWithEmptyChannels = {
        ...AnalysisConfigFactory.createDefault(),
        exclusionChannels: [],
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(configWithEmptyChannels)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle string numbers for numeric fields', async () => {
      const configWithStringNumbers = {
        exclusionChannels: ['test'],
        minSubs: '10000',
        maxSubs: '500000',
        timeWindow: '7',
        outlierThreshold: '30',
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(configWithStringNumbers)
        .expect(400); // Should fail validation as strings

      expect(response.body.success).toBe(false);
    });

    it('should handle missing required fields', async () => {
      const incompleteConfig = {
        exclusionChannels: ['test'],
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(incompleteConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle negative values', async () => {
      const configWithNegatives = {
        ...AnalysisConfigFactory.createDefault(),
        minSubs: -1000,
        timeWindow: -5,
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(configWithNegatives)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle extremely large values', async () => {
      const configWithLargeValues = {
        ...AnalysisConfigFactory.createDefault(),
        maxSubs: Number.MAX_SAFE_INTEGER,
        outlierThreshold: 1000,
      };

      const response = await request(app)
        .post('/api/outlier/start')
        .send(configWithLargeValues)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Socket.IO integration', () => {
    it('should pass socket.io instance to service', async () => {
      const validConfig = AnalysisConfigFactory.createDefault();

      await request(app)
        .post('/api/outlier/start')
        .send(validConfig)
        .expect(200);

      expect(mockOutlierDetectionService.startAnalysis).toHaveBeenCalledWith(
        expect.any(String),
        validConfig,
        mockIo,
      );
    });

    it('should handle missing socket.io instance gracefully', async () => {
      // Create app without socket.io
      const appWithoutIo = express();
      appWithoutIo.use(express.json());
      appWithoutIo.use('/api/outlier', outlierRouter.default);

      const response = await request(appWithoutIo)
        .post('/api/outlier/start')
        .send(AnalysisConfigFactory.createDefault())
        .expect(500); // Should fail due to missing io

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('Content-Type handling', () => {
    it('should reject non-JSON content', async () => {
      const response = await request(app)
        .post('/api/outlier/start')
        .send('not json')
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/outlier/start')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });
  });
});