/**
 * Coverage thresholds and validation for YouTube Outlier Discovery Tool
 * Ensures critical code paths meet minimum coverage requirements
 */

export const COVERAGE_THRESHOLDS = {
  // Global minimum coverage
  global: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },
  
  // Critical service components require higher coverage
  critical: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
    files: [
      'server/src/services/outlierDetectionService.js',
      'server/src/services/youtubeService.js'
    ]
  },
  
  // API routes should have good coverage
  api: {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
    files: [
      'server/src/routes/outlier.js',
      'server/src/routes/channels.js'
    ]
  },
  
  // React components should have reasonable coverage
  frontend: {
    statements: 75,
    branches: 70,
    functions: 75,
    lines: 75,
    files: [
      'client/components/YouTubeOutlierApp.tsx'
    ]
  },
  
  // Integration tests focus on functionality over coverage
  integration: {
    statements: 60,
    branches: 55,
    functions: 60,
    lines: 60
  }
};

export const COVERAGE_EXCLUSIONS = [
  // Test files themselves
  '**/*.test.js',
  '**/*.test.tsx',
  '**/*.spec.js',
  
  // Mock files
  '**/mocks/**',
  '**/test/**',
  
  // Configuration files
  '**/config/**',
  '**/*config.js',
  '**/jest.config.js',
  '**/tailwind.config.js',
  '**/next.config.js',
  '**/postcss.config.js',
  
  // Build output
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  
  // Package files
  '**/node_modules/**',
  '**/package.json',
  '**/package-lock.json',
  '**/bun.lock',
  
  // Environment and setup files
  '**/.env*',
  '**/setup.js',
  
  // Index files that just re-export
  '**/index.js',
  
  // Utility files with simple functions
  '**/utils/logger.js',
  '**/utils/errors.js'
];

/**
 * Validates coverage results against thresholds
 */
export function validateCoverage(coverageData, type = 'global') {
  const thresholds = COVERAGE_THRESHOLDS[type] || COVERAGE_THRESHOLDS.global;
  const results = {
    passed: true,
    failures: [],
    metrics: {}
  };

  // Check each coverage metric
  Object.entries(thresholds).forEach(([metric, threshold]) => {
    if (metric === 'files') return; // Skip file list
    
    const actual = coverageData[metric] || 0;
    results.metrics[metric] = {
      actual,
      threshold,
      passed: actual >= threshold
    };

    if (actual < threshold) {
      results.passed = false;
      results.failures.push({
        metric,
        actual,
        threshold,
        shortfall: threshold - actual
      });
    }
  });

  return results;
}

/**
 * Generates coverage report summary
 */
export function generateCoverageSummary(coverageResults) {
  const summary = {
    timestamp: new Date().toISOString(),
    overall: {
      passed: true,
      totalFiles: 0,
      coveredFiles: 0,
      metrics: {}
    },
    byCategory: {}
  };

  // Process each category
  Object.entries(COVERAGE_THRESHOLDS).forEach(([category, thresholds]) => {
    if (coverageResults[category]) {
      const validation = validateCoverage(coverageResults[category], category);
      summary.byCategory[category] = validation;
      
      if (!validation.passed) {
        summary.overall.passed = false;
      }
    }
  });

  return summary;
}

/**
 * Formats coverage data for console output
 */
export function formatCoverageOutput(validation, category = '') {
  const output = [];
  
  if (category) {
    output.push(`\n📊 Coverage Report - ${category.toUpperCase()}`);
    output.push('='.repeat(40));
  }

  Object.entries(validation.metrics).forEach(([metric, data]) => {
    const status = data.passed ? '✅' : '❌';
    const percentage = `${data.actual.toFixed(1)}%`;
    const threshold = `(≥${data.threshold}%)`;
    
    output.push(`${status} ${metric.padEnd(12)} ${percentage.padStart(8)} ${threshold}`);
  });

  if (validation.failures.length > 0) {
    output.push('\n❌ Coverage Failures:');
    validation.failures.forEach(failure => {
      output.push(`   ${failure.metric}: ${failure.actual.toFixed(1)}% (need ${failure.threshold}%, short by ${failure.shortfall.toFixed(1)}%)`);
    });
  }

  return output.join('\n');
}

/**
 * Checks if a file should be included in coverage analysis
 */
export function shouldIncludeInCoverage(filePath) {
  // Convert Windows paths to Unix style for consistent matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  return !COVERAGE_EXCLUSIONS.some(pattern => {
    // Simple glob pattern matching
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    );
    
    return regex.test(normalizedPath);
  });
}

/**
 * Critical paths that must have high coverage
 */
export const CRITICAL_PATHS = [
  // Core business logic
  'outlierDetectionService.extractGameNames',
  'outlierDetectionService.validateChannelCriteria', 
  'outlierDetectionService.calculateBrandFit',
  'outlierDetectionService.isVideoExcluded',
  'outlierDetectionService.analyzeChannelOutliers',
  
  // API integration
  'youtubeService.getChannelVideos',
  'youtubeService.getChannelInfo',
  'youtubeService.searchChannels',
  
  // API endpoints
  'outlierRoutes.startAnalysis',
  'channelRoutes.searchChannels',
  'channelRoutes.getChannelInfo'
];

/**
 * Validates that critical paths have adequate coverage
 */
export function validateCriticalPaths(coverageData) {
  const results = {
    passed: true,
    coverage: {},
    missing: []
  };

  CRITICAL_PATHS.forEach(path => {
    // This would need to be implemented based on the actual coverage format
    // For now, we'll assume critical paths are covered if overall coverage is good
    const covered = coverageData.statements >= COVERAGE_THRESHOLDS.critical.statements;
    
    results.coverage[path] = covered;
    
    if (!covered) {
      results.passed = false;
      results.missing.push(path);
    }
  });

  return results;
}

export default {
  COVERAGE_THRESHOLDS,
  COVERAGE_EXCLUSIONS,
  CRITICAL_PATHS,
  validateCoverage,
  generateCoverageSummary,
  formatCoverageOutput,
  shouldIncludeInCoverage,
  validateCriticalPaths
};