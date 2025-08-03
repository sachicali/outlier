#!/usr/bin/env node

/**
 * Configuration Management CLI Tool
 *
 * Usage:
 *   node configManager.js view                     - View current configuration
 *   node configManager.js update-queries [file]    - Update search queries from JSON file or stdin
 *   node configManager.js update-patterns [file]   - Update game patterns from JSON file or stdin
 *   node configManager.js reset                    - Reset to default configuration
 *   node configManager.js validate                 - Validate current configuration
 */

const fs = require('fs');
const path = require('path');
const contentConfig = require('../config/contentConfig');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
    case 'view':
      await viewConfig();
      break;
    case 'update-queries':
      await updateSearchQueries(args[1]);
      break;
    case 'update-patterns':
      await updateGamePatterns(args[1]);
      break;
    case 'reset':
      await resetConfig();
      break;
    case 'validate':
      await validateConfig();
      break;
    case 'export':
      await exportConfig(args[1]);
      break;
    case 'import':
      await importConfig(args[1]);
      break;
    case 'help':
    default:
      showHelp();
      break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function viewConfig() {
  console.log('Loading current configuration...\n');
  const config = await contentConfig.loadConfig();

  console.log('=== CURRENT CONFIGURATION ===\n');
  console.log('Version:', config.version);
  console.log('Last Updated:', config.lastUpdated);
  console.log('\nDescription:', config.description);

  console.log('\n--- Search Queries ---');
  config.searchQueries.forEach((query, index) => {
    console.log(`${index + 1}. ${query}`);
  });

  console.log('\n--- Game Patterns ---');
  config.gamePatterns.forEach((pattern, index) => {
    console.log(`${index + 1}. /${pattern.pattern}/${pattern.flags}`);
  });

  console.log('\n--- Thresholds ---');
  console.log(`Outlier Threshold: ${config.outlierThreshold}`);
  console.log(`Brand Fit Threshold: ${config.brandFit.threshold}`);
  console.log(`Max Results: ${config.maxResults}`);

  console.log('\n--- Channel Criteria ---');
  const criteria = config.channelCriteria;
  console.log(`Subscriber Range: ${criteria.minSubscribers.toLocaleString()} - ${criteria.maxSubscribers.toLocaleString()}`);
  console.log(`Min Video Count: ${criteria.minVideoCount}`);
  console.log(`Excluded Title Keywords: ${criteria.excludeTitleKeywords.join(', ')}`);

  console.log(`\nConfiguration file location: ${contentConfig.getConfigPath()}`);
}

async function updateSearchQueries(filePath) {
  let queries;

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const data = fs.readFileSync(filePath, 'utf8');
    queries = JSON.parse(data);
  } else {
    console.log('Enter search queries as JSON array (e.g., ["query1", "query2"]):');
    const input = await readStdin();
    queries = JSON.parse(input);
  }

  if (!Array.isArray(queries)) {
    throw new Error('Search queries must be an array');
  }

  const currentConfig = await contentConfig.loadConfig();
  currentConfig.searchQueries = queries;

  await contentConfig.updateConfig(currentConfig);
  console.log(`✅ Updated ${queries.length} search queries successfully`);
}

async function updateGamePatterns(filePath) {
  let patterns;

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const data = fs.readFileSync(filePath, 'utf8');
    patterns = JSON.parse(data);
  } else {
    console.log('Enter game patterns as JSON array (e.g., [{"pattern": "doors?", "flags": "gi"}]):');
    const input = await readStdin();
    patterns = JSON.parse(input);
  }

  if (!Array.isArray(patterns)) {
    throw new Error('Game patterns must be an array');
  }

  // Validate pattern structure
  for (const pattern of patterns) {
    if (!pattern.pattern) {
      throw new Error('Each game pattern must have a pattern field');
    }
  }

  const currentConfig = await contentConfig.loadConfig();
  currentConfig.gamePatterns = patterns;

  await contentConfig.updateConfig(currentConfig);
  console.log(`✅ Updated ${patterns.length} game patterns successfully`);
}

async function resetConfig() {
  console.log('Resetting configuration to defaults...');
  const defaultConfig = contentConfig.getDefaultConfig();
  await contentConfig.updateConfig(defaultConfig);
  console.log('✅ Configuration reset to defaults successfully');
}

async function validateConfig() {
  console.log('Validating configuration...');
  const config = await contentConfig.loadConfig();

  try {
    contentConfig.validateConfig(config);
    console.log('✅ Configuration is valid');

    // Additional validation checks
    console.log('\n--- Validation Details ---');
    console.log(`Search Queries: ${config.searchQueries.length} entries`);
    console.log(`Game Patterns: ${config.gamePatterns.length} entries`);

    // Test regex patterns
    let invalidPatterns = 0;
    config.gamePatterns.forEach((pattern, index) => {
      try {
        new RegExp(pattern.pattern, pattern.flags);
      } catch (error) {
        console.log(`⚠️  Invalid regex pattern ${index + 1}: ${pattern.pattern} (${error.message})`);
        invalidPatterns++;
      }
    });

    if (invalidPatterns === 0) {
      console.log('✅ All regex patterns are valid');
    } else {
      console.log(`❌ Found ${invalidPatterns} invalid regex patterns`);
    }

  } catch (error) {
    console.log('❌ Configuration is invalid:', error.message);
    process.exit(1);
  }
}

async function exportConfig(outputPath) {
  const config = await contentConfig.loadConfig();
  const exportPath = outputPath || `config-export-${Date.now()}.json`;

  fs.writeFileSync(exportPath, JSON.stringify(config, null, 2));
  console.log(`✅ Configuration exported to: ${path.resolve(exportPath)}`);
}

async function importConfig(filePath) {
  if (!filePath) {
    throw new Error('Import file path is required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const data = fs.readFileSync(filePath, 'utf8');
  const config = JSON.parse(data);

  // Validate before importing
  contentConfig.validateConfig(config);

  await contentConfig.updateConfig(config);
  console.log(`✅ Configuration imported from: ${filePath}`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data.trim());
    });

    process.stdin.on('error', reject);
  });
}

function showHelp() {
  console.log(`
YouTube Outlier Discovery - Configuration Manager

USAGE:
  node configManager.js <command> [options]

COMMANDS:
  view                      View current configuration
  update-queries [file]     Update search queries from JSON file or stdin
  update-patterns [file]    Update game patterns from JSON file or stdin
  reset                     Reset configuration to defaults
  validate                  Validate current configuration
  export [file]             Export configuration to JSON file
  import <file>             Import configuration from JSON file
  help                      Show this help message

EXAMPLES:
  # View current configuration
  node configManager.js view
  
  # Update search queries from file
  echo '["new query 1", "new query 2"]' > queries.json
  node configManager.js update-queries queries.json
  
  # Update game patterns interactively
  node configManager.js update-patterns
  
  # Reset to defaults
  node configManager.js reset
  
  # Export current config for backup
  node configManager.js export backup.json
  
  # Import configuration
  node configManager.js import backup.json

ENVIRONMENT VARIABLES:
  You can also override configuration using environment variables:
  
  CONTENT_SEARCH_QUERIES     - JSON array of search queries
  CONTENT_GAME_PATTERNS      - JSON array of game pattern objects
  OUTLIER_THRESHOLD          - Outlier detection threshold (default: 20)
  BRAND_FIT_THRESHOLD        - Brand fit threshold (default: 6)

CONFIGURATION FILE:
  The configuration is stored at: ${contentConfig.getConfigPath()}
  You can also edit this file directly - changes will be automatically detected.
`);
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = {
  viewConfig,
  updateSearchQueries,
  updateGamePatterns,
  resetConfig,
  validateConfig,
  exportConfig,
  importConfig,
};