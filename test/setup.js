// Global test setup for YouTube Outlier Discovery Tool
// This file is loaded before all tests run

import { beforeAll, afterAll, beforeEach } from 'bun:test';
import { mock } from 'bun:test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
// First try from server directory, then from current directory
try {
  dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env.test') });
} catch (e) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
  } catch (e2) {
    console.log('Warning: Could not load .env.test file');
  }
}

// Override any missing critical environment variables
process.env.NODE_ENV = 'test';
process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'test-api-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-for-testing-purposes-must-be-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-testing-purposes-must-be-at-least-32-chars-long';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-testing-purposes-must-be-32-chars';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.API_RATE_LIMIT = process.env.API_RATE_LIMIT || '10000';
process.env.API_RATE_WINDOW = process.env.API_RATE_WINDOW || '900000';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
process.env.ENABLE_EMAIL_VERIFICATION = 'false';
process.env.EMAIL_VERIFICATION_REQUIRED = 'false';
process.env.ENABLE_SECURITY_HEADERS = 'false';
process.env.HTTPS_REDIRECT = 'false';

// Global mocks
global.mockRedisClient = {
  get: mock(() => Promise.resolve(null)),
  setEx: mock(() => Promise.resolve('OK')),
  set: mock(() => Promise.resolve('OK')),
  del: mock(() => Promise.resolve(1)),
  exists: mock(() => Promise.resolve(0)),
  expire: mock(() => Promise.resolve(1)),
  ttl: mock(() => Promise.resolve(-1)),
  connect: mock(() => Promise.resolve()),
  disconnect: mock(() => Promise.resolve()),
  quit: mock(() => Promise.resolve()),
  on: mock(() => {}),
  emit: mock(() => {}),
  removeListener: mock(() => {}),
  isReady: true,
  status: 'ready'
};

// Mock winston logger to avoid log noise during tests
global.mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  verbose: mock(() => {}),
  silly: mock(() => {})
};

// Mock database connection
global.mockDatabase = {
  authenticate: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  sync: mock(() => Promise.resolve()),
  transaction: mock((callback) => callback({
    commit: mock(() => Promise.resolve()),
    rollback: mock(() => Promise.resolve())
  }))
};

// Mock JWT utilities
global.mockJWT = {
  sign: mock((payload) => `test-token-${JSON.stringify(payload)}`),
  verify: mock((token) => {
    if (token.startsWith('test-token-')) {
      return JSON.parse(token.replace('test-token-', ''));
    }
    throw new Error('Invalid token');
  }),
  decode: mock((token) => JSON.parse(token.replace('test-token-', '')))
};

// Mock authentication middleware
global.mockAuthMiddleware = {
  requireAuth: (req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      isEmailVerified: true
    };
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = {
      id: 1,
      email: 'admin@test.com',
      username: 'testadmin',
      role: 'admin',
      isEmailVerified: true
    };
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = null;
    next();
  }
};

// Setup global test utilities
global.testUtils = {
  // Helper to create mock YouTube API responses
  createMockYouTubeResponse: (items = []) => ({
    data: {
      items,
      pageInfo: {
        totalResults: items.length,
        resultsPerPage: items.length
      }
    }
  }),

  // Helper to create mock video data
  createMockVideo: (overrides = {}) => ({
    id: { videoId: 'test-video-id' },
    snippet: {
      title: 'Test Video Title',
      description: 'Test video description',
      publishedAt: '2024-01-01T00:00:00Z',
      tags: ['gaming', 'test'],
      ...overrides.snippet
    },
    statistics: {
      viewCount: '10000',
      likeCount: '100',
      commentCount: '50',
      ...overrides.statistics
    },
    contentDetails: {
      duration: 'PT10M30S',
      ...overrides.contentDetails
    },
    ...overrides
  }),

  // Helper to create mock channel data
  createMockChannel: (overrides = {}) => ({
    id: { channelId: 'test-channel-id' },
    snippet: {
      title: 'Test Channel',
      description: 'Test channel description',
      publishedAt: '2020-01-01T00:00:00Z',
      thumbnails: {
        default: { url: 'https://example.com/thumb.jpg' }
      },
      ...overrides.snippet
    },
    statistics: {
      subscriberCount: '100000',
      videoCount: '200',
      viewCount: '5000000',
      ...overrides.statistics
    },
    ...overrides
  }),

  // Helper to create mock analysis config
  createMockAnalysisConfig: (overrides = {}) => ({
    exclusionChannels: ['test-channel-1', 'test-channel-2'],
    minSubs: 10000,
    maxSubs: 500000,
    timeWindow: 7,
    outlierThreshold: 30,
    ...overrides
  }),

  // Helper to wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to create mock Socket.IO instance
  createMockSocketIO: () => ({
    to: mock(() => ({
      emit: mock(() => {})
    })),
    emit: mock(() => {}),
    on: mock(() => {}),
    join: mock(() => {})
  }),

  // Skip authentication for specific tests
  skipAuth: () => {
    process.env.TEST_SKIP_AUTH = 'true';
  },
  
  // Enable authentication for specific tests
  enableAuth: () => {
    delete process.env.TEST_SKIP_AUTH;
  },
  
  // Mock Redis for specific tests
  mockRedis: () => {
    process.env.TEST_MOCK_REDIS = 'true';
  },
  
  // Generate test JWT token
  generateTestToken: (payload = {}) => {
    const defaultPayload = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user'
    };
    return global.mockJWT.sign({ ...defaultPayload, ...payload });
  },
  
  // Generate admin test JWT token
  generateAdminToken: (payload = {}) => {
    const adminPayload = {
      id: 1,
      email: 'admin@test.com',
      username: 'testadmin',
      role: 'admin'
    };
    return global.mockJWT.sign({ ...adminPayload, ...payload });
  }
};

// Setup and cleanup functions
beforeAll(async () => {
  // Initialize any global test setup here
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  // Clean up any global resources
  console.log('🧪 Test suite completed.');
});

// Clean up between tests
beforeEach(() => {
  // Reset all mocks
  const mockObjects = [
    global.mockRedisClient,
    global.mockLogger,
    global.mockDatabase,
    global.mockJWT,
  ];

  mockObjects.forEach(mockObj => {
    if (mockObj) {
      Object.values(mockObj).forEach(mockFn => {
        if (typeof mockFn === 'function' && mockFn.mockReset) {
          mockFn.mockReset();
        }
      });
    }
  });

  // Reset environment-specific overrides
  delete process.env.TEST_SKIP_AUTH;
  delete process.env.TEST_MOCK_REDIS;
});

console.log('🧪 Test setup loaded - Ready for testing!');