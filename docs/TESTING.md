# Testing Guide - YouTube Outlier Discovery Tool

This document provides comprehensive information about the testing setup, coverage requirements, and best practices for the YouTube Outlier Discovery Tool.

## 🧪 Test Suite Overview

The testing infrastructure uses **Bun's built-in test runner** and includes:

- **Unit Tests**: Individual component and service testing
- **Integration Tests**: Full workflow testing with real API interactions
- **Component Tests**: React component behavior and UI testing
- **API Tests**: REST endpoint validation and error handling
- **Coverage Reporting**: Comprehensive code coverage with thresholds

## 📁 Test Structure

```
test/
├── setup.js                    # Global test configuration
├── mocks/                      
│   └── youtubeApiMocks.js      # Mock YouTube API responses
├── factories/
│   └── testDataFactory.js     # Test data generators
├── integration/
│   └── fullAnalysisWorkflow.test.js  # End-to-end tests
└── coverage/
    ├── testRunner.js           # Custom test runner
    └── coverageThresholds.js   # Coverage validation

server/src/
├── services/
│   ├── outlierDetectionService.test.js
│   └── youtubeService.test.js
└── routes/
    ├── outlier.test.js
    └── channels.test.js

client/components/
└── YouTubeOutlierApp.test.tsx
```

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests with coverage
bun test

# Run specific test suites
bun test:server          # Server-side tests only
bun test:client          # Client-side tests only  
bun test:integration     # Integration tests only
bun test:unit           # Both server and client unit tests

# Development workflow
bun test:watch          # Watch mode for development
bun test:coverage       # Generate coverage reports
```

### Advanced Options

```bash
# Custom test runner with options
bun test/coverage/testRunner.js --skip-client    # Skip client tests
bun test/coverage/testRunner.js --fail-fast      # Stop on first failure
bun test/coverage/testRunner.js --help           # Show all options
```

## 📊 Coverage Requirements

### Global Thresholds
- **Statements**: 80%
- **Branches**: 75%  
- **Functions**: 80%
- **Lines**: 80%

### Critical Components (Higher Requirements)
- **OutlierDetectionService**: 90% statements, 85% branches
- **YouTubeService**: 90% statements, 85% branches
- **API Routes**: 85% statements, 80% branches

### Coverage Reports
Coverage reports are generated in HTML, text, and JSON formats:
- `server/coverage/` - Server-side coverage
- `client/coverage/` - Client-side coverage  
- `coverage/` - Integration test coverage

## 🧩 Test Categories

### 1. Unit Tests

**OutlierDetectionService** (`server/src/services/outlierDetectionService.test.js`)
- Game name extraction logic
- Channel validation criteria
- Brand fit scoring algorithm
- Video exclusion logic
- Outlier score calculations

**YouTubeService** (`server/src/services/youtubeService.test.js`)
- API integration with mocking
- Caching behavior validation
- Error handling scenarios
- Rate limiting responses

### 2. API Tests

**Outlier Routes** (`server/src/routes/outlier.test.js`)
- Analysis workflow endpoints
- Input validation
- Error responses
- Socket.io integration

**Channel Routes** (`server/src/routes/channels.test.js`)
- Channel search functionality
- Video retrieval
- Parameter validation

### 3. Component Tests

**YouTubeOutlierApp** (`client/components/YouTubeOutlierApp.test.tsx`)
- User interaction flows
- State management
- Socket.io real-time updates
- Form validation
- Results display

### 4. Integration Tests

**Full Analysis Workflow** (`test/integration/fullAnalysisWorkflow.test.js`)
- Complete analysis pipeline
- Multi-client socket scenarios
- Error recovery testing
- Performance validation

## 🏭 Test Factories and Mocks

### Data Factories
- `VideoFactory`: Generate realistic video data
- `ChannelFactory`: Create channel test data
- `AnalysisConfigFactory`: Build analysis configurations
- `OutlierResultFactory`: Generate analysis results

### Mock Services
- **YouTube API**: Simulated API responses
- **Redis**: In-memory caching mock
- **Socket.io**: Real-time communication mock
- **Logger**: Silent logging for tests

## 🔧 Test Configuration

### Bun Configuration (`bunfig.toml`)
```toml
[test]
root = "./"
preload = ["./test/setup.js"]
coverage = true
coverageReporter = ["text", "html", "json"]
coverageThreshold = 80
timeout = 30000
```

### Environment Variables
Tests run with isolated environment:
- `NODE_ENV=test`
- `YOUTUBE_API_KEY=test-api-key`
- `REDIS_URL=redis://localhost:6379`

## 📈 Coverage Exclusions

Files excluded from coverage analysis:
- Test files (`**/*.test.js`, `**/*.spec.js`)
- Mock directories (`**/mocks/**`, `**/test/**`)
- Configuration files (`**/config/**`, `**/*config.js`)
- Build output (`**/dist/**`, `**/.next/**`)
- Simple utility files

## 🎯 Critical Paths

High-priority functions requiring comprehensive testing:
- `outlierDetectionService.extractGameNames`
- `outlierDetectionService.calculateBrandFit`
- `youtubeService.getChannelVideos`
- API endpoint handlers

## 🐛 Debugging Tests

### Common Issues

1. **Mock not working**: Ensure mocks are defined before imports
2. **Async test failures**: Use proper `await` and `waitFor` patterns
3. **Socket.io timing**: Add appropriate delays for real-time events
4. **Coverage gaps**: Check exclusions and file paths

### Debug Commands
```bash
# Run single test file
bun test server/src/services/outlierDetectionService.test.js

# Run with verbose output
bun test --verbose

# Run specific test pattern
bun test --grep "should extract game names"
```

## 🚦 CI/CD Integration

### Pre-commit Hooks
- Run unit tests
- Validate coverage thresholds
- Lint code

### Build Pipeline
1. Install dependencies
2. Run full test suite
3. Generate coverage reports
4. Validate coverage thresholds
5. Archive test results

## 📝 Writing New Tests

### Best Practices

1. **Use descriptive test names**
   ```javascript
   it('should extract known game names from title and description', () => {
   ```

2. **Follow AAA pattern**
   ```javascript
   // Arrange
   const mockData = VideoFactory.create();
   
   // Act  
   const result = service.extractGameNames(title, description);
   
   // Assert
   expect(result).toContain('doors');
   ```

3. **Mock external dependencies**
   ```javascript
   mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);
   ```

4. **Test error scenarios**
   ```javascript
   it('should handle API errors gracefully', async () => {
     mockService.mockRejectedValue(new Error('API Error'));
     await expect(service.method()).rejects.toThrow('API Error');
   });
   ```

### Test Template
```javascript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { YourFactory } from '../../../test/factories/testDataFactory.js';

describe('YourComponent', () => {
  beforeEach(() => {
    // Reset mocks
  });

  describe('method name', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = YourFactory.create();
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## 🔍 Performance Testing

### Load Testing
Integration tests include scenarios for:
- Multiple concurrent requests
- Large result sets
- Memory usage validation
- Response time thresholds

### Monitoring
- Test execution time tracking
- Memory consumption analysis
- Coverage report generation time

## 📚 Additional Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Library Docs](https://testing-library.com/)
- [Socket.io Testing Guide](https://socket.io/docs/v4/testing/)

## 🤝 Contributing Tests

When adding new features:

1. Write tests first (TDD approach)
2. Ensure coverage meets thresholds
3. Add integration test scenarios
4. Update test documentation
5. Validate with `bun test` before committing

---

**Need Help?** Check the test setup in `test/setup.js` or run `bun test --help` for more options.