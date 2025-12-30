#!/usr/bin/env node

/**
 * CLI script for migrating Cloudflare Pages wrangler.toml configuration files
 * Usage: node scripts/migrate-wrangler-config.js [command] [options]
 */

const fs = require('fs');
const path = require('path');
const {
  migrateConfigFile,
  migrateMultipleFiles,
  rollbackMigration,
  validateConfigFiles,
  previewMigration
} = require('../utils/configMigration.cjs');

// Default configuration files to process
const DEFAULT_CONFIG_FILES = [
  'wrangler.toml',
  'config/pages-wrangler.toml'
];

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Cloudflare Pages Configuration Migration Tool

Usage: node scripts/migrate-wrangler-config.js [command] [options]

Commands:
  validate    Validate configuration files without making changes
  preview     Preview migration changes without applying them
  migrate     Migrate configuration files to use supported environments
  rollback    Rollback migration using backup files
  help        Show this help message

Options:
  --files     Comma-separated list of config files (default: wrangler.toml,config/pages-wrangler.toml)
  --dry-run   Preview changes without applying them
  --no-backup Skip creating backup files
  --backup    Specify backup file path for rollback

Examples:
  node scripts/migrate-wrangler-config.js validate
  node scripts/migrate-wrangler-config.js preview --files wrangler.toml
  node scripts/migrate-wrangler-config.js migrate --dry-run
  node scripts/migrate-wrangler-config.js migrate
  node scripts/migrate-wrangler-config.js rollback --backup wrangler.toml.backup-2024-01-01T12-00-00-000Z
`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    command: 'help',
    files: DEFAULT_CONFIG_FILES,
    dryRun: false,
    createBackup: true,
    backupPath: null
  };
  
  if (args.length === 0) {
    return parsed;
  }
  
  parsed.command = args[0];
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--files' && i + 1 < args.length) {
      parsed.files = args[i + 1].split(',').map(f => f.trim());
      i++;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--no-backup') {
      parsed.createBackup = false;
    } else if (arg === '--backup' && i + 1 < args.length) {
      parsed.backupPath = args[i + 1];
      i++;
    }
  }
  
  return parsed;
}

/**
 * Format validation results for display
 */
function formatValidationResults(results) {
  console.log('\n=== Configuration Validation Results ===\n');
  
  for (const file of results.files) {
    console.log(`File: ${file.filePath}`);
    
    if (!file.exists) {
      console.log('  ❌ File not found');
      continue;
    }
    
    if (file.valid) {
      console.log('  ✅ Valid configuration');
    } else {
      console.log('  ❌ Invalid configuration');
    }
    
    if (file.errors.length > 0) {
      console.log('  Errors:');
      file.errors.forEach(error => console.log(`    - ${error}`));
    }
    
    if (file.warnings.length > 0) {
      console.log('  Warnings:');
      file.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
    
    console.log('');
  }
  
  console.log(`Overall Status: ${results.valid ? '✅ All files valid' : '❌ Some files have issues'}`);
}

/**
 * Format migration results for display
 */
function formatMigrationResults(results) {
  console.log('\n=== Migration Results ===\n');
  
  for (const file of results.files) {
    console.log(`File: ${file.filePath}`);
    
    if (file.success) {
      console.log('  ✅ Migration successful');
    } else {
      console.log('  ❌ Migration failed');
    }
    
    if (file.changes.length > 0) {
      console.log('  Changes:');
      file.changes.forEach(change => console.log(`    - ${change}`));
    }
    
    if (file.errors.length > 0) {
      console.log('  Errors:');
      file.errors.forEach(error => console.log(`    - ${error}`));
    }
    
    if (file.warnings.length > 0) {
      console.log('  Warnings:');
      file.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
    
    if (file.backupPath) {
      console.log(`  Backup: ${file.backupPath}`);
    }
    
    console.log('');
  }
  
  console.log(`Summary: ${results.totalChanges} changes, ${results.totalErrors} errors, ${results.totalWarnings} warnings`);
  console.log(`Overall Status: ${results.success ? '✅ All migrations successful' : '❌ Some migrations failed'}`);
}

/**
 * Format preview results for display
 */
function formatPreviewResults(previews) {
  console.log('\n=== Migration Preview ===\n');
  
  for (const preview of previews) {
    console.log(`File: ${preview.filePath}`);
    
    if (preview.errors.length > 0) {
      console.log('  ❌ Errors:');
      preview.errors.forEach(error => console.log(`    - ${error}`));
      console.log('');
      continue;
    }
    
    console.log(`  Original environments: ${preview.originalEnvs.join(', ') || 'none'}`);
    console.log(`  Migrated environments: ${preview.migratedEnvs.join(', ') || 'none'}`);
    
    if (preview.changes.length > 0) {
      console.log('  Changes:');
      preview.changes.forEach(change => console.log(`    - ${change}`));
    }
    
    console.log('');
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = parseArgs();
  
  try {
    switch (args.command) {
      case 'validate':
        console.log('Validating configuration files...');
        const validationResults = validateConfigFiles(args.files);
        formatValidationResults(validationResults);
        process.exit(validationResults.valid ? 0 : 1);
        break;
        
      case 'preview':
        console.log('Previewing migration changes...');
        const previews = args.files.map(file => previewMigration(file));
        formatPreviewResults(previews);
        break;
        
      case 'migrate':
        if (args.dryRun) {
          console.log('Running migration in dry-run mode...');
        } else {
          console.log('Running migration...');
        }
        
        const migrationResults = await migrateMultipleFiles(args.files, {
          createBackupFile: args.createBackup,
          validateAfter: true,
          dryRun: args.dryRun
        });
        
        formatMigrationResults(migrationResults);
        process.exit(migrationResults.success ? 0 : 1);
        break;
        
      case 'rollback':
        if (!args.backupPath) {
          console.error('Error: --backup option is required for rollback command');
          process.exit(1);
        }
        
        console.log(`Rolling back from backup: ${args.backupPath}`);
        const originalFile = args.backupPath.replace(/\.backup-.*$/, '');
        const rollbackResult = rollbackMigration(originalFile, args.backupPath);
        
        if (rollbackResult.success) {
          console.log('✅ Rollback successful');
        } else {
          console.log('❌ Rollback failed');
          rollbackResult.errors.forEach(error => console.log(`  - ${error}`));
          process.exit(1);
        }
        break;
        
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArgs,
  formatValidationResults,
  formatMigrationResults,
  formatPreviewResults
};