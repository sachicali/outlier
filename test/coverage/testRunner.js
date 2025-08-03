/* eslint-disable no-console */
#!/usr/bin/env bun
/**
 * Custom test runner for YouTube Outlier Discovery Tool
 * Provides comprehensive test execution with coverage reporting
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const SERVER_DIR = join(PROJECT_ROOT, 'server');
const CLIENT_DIR = join(PROJECT_ROOT, 'client');

class TestRunner {
  constructor() {
    this.results = {
      server: null,
      client: null,
      integration: null
    };
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        ...options
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async runServerTests() {
    console.log('🔧 Running Server Tests...');
    
    try {
      await this.runCommand('bun', ['test', '--coverage'], {
        cwd: SERVER_DIR
      });
      
      this.results.server = { success: true, coverage: 'Generated' };
      console.log('✅ Server tests completed successfully');
    } catch (error) {
      this.results.server = { success: false, error: error.message };
      console.error('❌ Server tests failed:', error.message);
      throw error;
    }
  }

  async runClientTests() {
    console.log('⚛️  Running Client Tests...');
    
    // Check if client test dependencies are installed
    if (!existsSync(join(CLIENT_DIR, 'node_modules'))) {
      console.log('📦 Installing client dependencies...');
      await this.runCommand('bun', ['install'], { cwd: CLIENT_DIR });
    }

    try {
      // Run client tests with Bun
      await this.runCommand('bun', ['test', '--coverage'], {
        cwd: CLIENT_DIR
      });
      
      this.results.client = { success: true, coverage: 'Generated' };
      console.log('✅ Client tests completed successfully');
    } catch (error) {
      this.results.client = { success: false, error: error.message };
      console.error('❌ Client tests failed:', error.message);
      throw error;
    }
  }

  async runIntegrationTests() {
    console.log('🔗 Running Integration Tests...');
    
    try {
      await this.runCommand('bun', ['test', 'test/integration/**/*.test.js', '--coverage'], {
        cwd: PROJECT_ROOT
      });
      
      this.results.integration = { success: true, coverage: 'Generated' };
      console.log('✅ Integration tests completed successfully');
    } catch (error) {
      this.results.integration = { success: false, error: error.message };
      console.error('❌ Integration tests failed:', error.message);
      throw error;
    }
  }

  async validateCoverage() {
    console.log('📊 Validating Test Coverage...');
    
    // Check coverage files exist
    const coverageFiles = [
      join(SERVER_DIR, 'coverage'),
      join(CLIENT_DIR, 'coverage'),
      join(PROJECT_ROOT, 'coverage')
    ];

    let totalCoverage = 0;
    let validCoverageFiles = 0;

    for (const coverageDir of coverageFiles) {
      if (existsSync(coverageDir)) {
        validCoverageFiles++;
        console.log(`✅ Coverage report found: ${coverageDir}`);
      } else {
        console.log(`⚠️  Coverage report missing: ${coverageDir}`);
      }
    }

    if (validCoverageFiles === 0) {
      console.error('❌ No coverage reports found!');
      return false;
    }

    console.log(`📈 Coverage validation: ${validCoverageFiles}/${coverageFiles.length} reports generated`);
    return validCoverageFiles > 0;
  }

  async generateCombinedReport() {
    console.log('📋 Generating Combined Test Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total: 3,
        passed: Object.values(this.results).filter(r => r?.success).length,
        failed: Object.values(this.results).filter(r => r && !r.success).length
      }
    };

    console.log('\n' + '='.repeat(50));
    console.log('🎯 TEST EXECUTION SUMMARY');
    console.log('='.repeat(50));
    
    console.table({
      'Server Tests': this.results.server?.success ? '✅ PASSED' : '❌ FAILED',
      'Client Tests': this.results.client?.success ? '✅ PASSED' : '❌ FAILED',
      'Integration Tests': this.results.integration?.success ? '✅ PASSED' : '❌ FAILED'
    });

    console.log(`\n📊 Overall: ${report.summary.passed}/${report.summary.total} test suites passed`);
    
    if (report.summary.failed > 0) {
      console.log('\n❌ Failed test suites:');
      Object.entries(this.results).forEach(([key, result]) => {
        if (result && !result.success) {
          console.log(`  - ${key}: ${result.error}`);
        }
      });
    }

    return report;
  }

  async run(options = {}) {
    const { 
      skipServer = false, 
      skipClient = false, 
      skipIntegration = false,
      failFast = false 
    } = options;

    console.log('🚀 Starting YouTube Outlier Discovery Tool Test Suite');
    console.log(`📁 Project Root: ${PROJECT_ROOT}`);
    console.log('⚙️  Options:', { skipServer, skipClient, skipIntegration, failFast });
    
    const startTime = Date.now();

    try {
      // Run server tests
      if (!skipServer) {
        await this.runServerTests();
        if (failFast && !this.results.server.success) {
          throw new Error('Server tests failed and fail-fast is enabled');
        }
      }

      // Run client tests
      if (!skipClient) {
        await this.runClientTests();
        if (failFast && !this.results.client.success) {
          throw new Error('Client tests failed and fail-fast is enabled');
        }
      }

      // Run integration tests
      if (!skipIntegration) {
        await this.runIntegrationTests();
        if (failFast && !this.results.integration.success) {
          throw new Error('Integration tests failed and fail-fast is enabled');
        }
      }

      // Validate coverage
      const coverageValid = await this.validateCoverage();
      if (!coverageValid) {
        console.warn('⚠️  Coverage validation failed, but tests passed');
      }

      // Generate final report
      const report = await this.generateCombinedReport();
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`\n⏱️  Total execution time: ${duration}s`);
      console.log('🎉 Test suite completed successfully!');

      return report;

    } catch (error) {
      const report = await this.generateCombinedReport();
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`\n⏱️  Total execution time: ${duration}s`);
      console.error('💥 Test suite failed:', error.message);

      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach(arg => {
    switch (arg) {
      case '--skip-server':
        options.skipServer = true;
        break;
      case '--skip-client':
        options.skipClient = true;
        break;
      case '--skip-integration':
        options.skipIntegration = true;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--help':
        console.log(`
YouTube Outlier Discovery Tool Test Runner

Usage: bun test/coverage/testRunner.js [options]

Options:
  --skip-server       Skip server-side tests
  --skip-client       Skip client-side tests  
  --skip-integration  Skip integration tests
  --fail-fast         Stop on first test failure
  --help              Show this help message

Examples:
  bun test/coverage/testRunner.js                    # Run all tests
  bun test/coverage/testRunner.js --skip-client      # Skip client tests
  bun test/coverage/testRunner.js --fail-fast        # Stop on first failure
        `);
        process.exit(0);
    }
  });

  const runner = new TestRunner();
  await runner.run(options);
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error);
}

export default TestRunner;