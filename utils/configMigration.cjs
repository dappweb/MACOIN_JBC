/**
 * Configuration migration utility for Cloudflare Pages wrangler.toml files
 * Provides high-level functions for migrating configuration files
 */

const fs = require('fs');
const path = require('path');
const {
  parseToml,
  stringifyToml,
  validateConfiguration,
  migrateEnvironments,
  createBackup,
  restoreFromBackup
} = require('./configValidation.cjs');

/**
 * Migrate a single wrangler.toml file
 * @param {string} filePath - Path to the configuration file
 * @param {Object} options - Migration options
 * @returns {Object} Migration result
 */
async function migrateConfigFile(filePath, options = {}) {
  const {
    createBackupFile = true,
    validateAfter = true,
    dryRun = false
  } = options;
  
  const result = {
    success: false,
    filePath,
    backupPath: null,
    errors: [],
    warnings: [],
    changes: []
  };
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      result.errors.push(`Configuration file not found: ${filePath}`);
      return result;
    }
    
    // Read and parse original configuration
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const originalConfig = parseToml(originalContent);
    
    // Validate original configuration
    const originalValidation = validateConfiguration(originalConfig);
    if (originalValidation.details.environments.errors.length === 0) {
      result.warnings.push('Configuration already uses supported environment names');
    }
    
    // Migrate environments
    const migratedConfig = migrateEnvironments(originalConfig);
    
    // Track changes
    const originalEnvs = Object.keys(originalConfig.env || {});
    const migratedEnvs = Object.keys(migratedConfig.env || {});
    
    for (const env of originalEnvs) {
      if (!migratedEnvs.includes(env)) {
        if (env === 'development') {
          result.changes.push(`Removed unsupported environment: ${env}`);
        } else if (env === 'staging') {
          result.changes.push(`Migrated environment: ${env} → preview`);
        }
      }
    }
    
    // Validate migrated configuration
    if (validateAfter) {
      const migratedValidation = validateConfiguration(migratedConfig);
      if (!migratedValidation.isValid) {
        result.errors.push(...migratedValidation.errors);
        return result;
      }
    }
    
    // Create backup if requested and not in dry run mode
    if (createBackupFile && !dryRun) {
      result.backupPath = createBackup(filePath);
      result.changes.push(`Created backup: ${result.backupPath}`);
    }
    
    // Generate new TOML content
    const migratedContent = stringifyToml(migratedConfig);
    
    // Add migration comments
    const commentedContent = addMigrationComments(migratedContent);
    
    // Write migrated configuration (unless dry run)
    if (!dryRun) {
      fs.writeFileSync(filePath, commentedContent, 'utf8');
      result.changes.push(`Updated configuration file: ${filePath}`);
    } else {
      result.changes.push(`[DRY RUN] Would update configuration file: ${filePath}`);
    }
    
    result.success = true;
    
  } catch (error) {
    result.errors.push(`Migration failed: ${error.message}`);
  }
  
  return result;
}

/**
 * Add migration comments to TOML content
 * @param {string} content - TOML content
 * @returns {string} Content with migration comments
 */
function addMigrationComments(content) {
  const migrationHeader = `# Cloudflare Pages Configuration
# Updated to use supported environment names (production, preview)
# Migration performed: ${new Date().toISOString()}
# 
# Changes made:
# - Migrated 'staging' environment to 'preview'
# - Removed 'development' environment (unsupported by Cloudflare Pages)
# - Preserved all environment variables and build settings
#
# Supported environments for Cloudflare Pages:
# - production: Used for main branch deployments
# - preview: Used for branch preview deployments
#

`;
  
  return migrationHeader + content;
}

/**
 * Migrate multiple configuration files
 * @param {string[]} filePaths - Array of configuration file paths
 * @param {Object} options - Migration options
 * @returns {Object} Combined migration results
 */
async function migrateMultipleFiles(filePaths, options = {}) {
  const results = {
    success: true,
    files: [],
    totalChanges: 0,
    totalErrors: 0,
    totalWarnings: 0
  };
  
  for (const filePath of filePaths) {
    const fileResult = await migrateConfigFile(filePath, options);
    results.files.push(fileResult);
    
    if (!fileResult.success) {
      results.success = false;
    }
    
    results.totalChanges += fileResult.changes.length;
    results.totalErrors += fileResult.errors.length;
    results.totalWarnings += fileResult.warnings.length;
  }
  
  return results;
}

/**
 * Rollback migration for a single file
 * @param {string} filePath - Path to the configuration file
 * @param {string} backupPath - Path to the backup file
 * @returns {Object} Rollback result
 */
function rollbackMigration(filePath, backupPath) {
  const result = {
    success: false,
    filePath,
    backupPath,
    errors: []
  };
  
  try {
    if (!fs.existsSync(backupPath)) {
      result.errors.push(`Backup file not found: ${backupPath}`);
      return result;
    }
    
    const restored = restoreFromBackup(filePath, backupPath);
    if (restored) {
      result.success = true;
    } else {
      result.errors.push('Failed to restore from backup');
    }
    
  } catch (error) {
    result.errors.push(`Rollback failed: ${error.message}`);
  }
  
  return result;
}

/**
 * Validate configuration files without migration
 * @param {string[]} filePaths - Array of configuration file paths
 * @returns {Object} Validation results
 */
function validateConfigFiles(filePaths) {
  const results = {
    valid: true,
    files: []
  };
  
  for (const filePath of filePaths) {
    const fileResult = {
      filePath,
      exists: false,
      valid: false,
      errors: [],
      warnings: []
    };
    
    try {
      if (!fs.existsSync(filePath)) {
        fileResult.errors.push(`File not found: ${filePath}`);
      } else {
        fileResult.exists = true;
        const content = fs.readFileSync(filePath, 'utf8');
        const config = parseToml(content);
        const validation = validateConfiguration(config);
        
        fileResult.valid = validation.isValid;
        fileResult.errors = validation.errors;
        
        // Add warnings for unsupported environments
        if (config.env) {
          const unsupportedEnvs = Object.keys(config.env).filter(env => 
            !['production', 'preview'].includes(env)
          );
          if (unsupportedEnvs.length > 0) {
            fileResult.warnings.push(`Contains unsupported environments: ${unsupportedEnvs.join(', ')}`);
          }
        }
      }
    } catch (error) {
      fileResult.errors.push(`Validation failed: ${error.message}`);
    }
    
    if (!fileResult.valid) {
      results.valid = false;
    }
    
    results.files.push(fileResult);
  }
  
  return results;
}

/**
 * Get preview of migration changes without applying them
 * @param {string} filePath - Path to configuration file
 * @returns {Object} Preview of changes
 */
function previewMigration(filePath) {
  const preview = {
    filePath,
    changes: [],
    errors: [],
    originalEnvs: [],
    migratedEnvs: []
  };
  
  try {
    if (!fs.existsSync(filePath)) {
      preview.errors.push(`File not found: ${filePath}`);
      return preview;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const originalConfig = parseToml(content);
    const migratedConfig = migrateEnvironments(originalConfig);
    
    preview.originalEnvs = Object.keys(originalConfig.env || {});
    preview.migratedEnvs = Object.keys(migratedConfig.env || {});
    
    // Identify changes
    for (const env of preview.originalEnvs) {
      if (env === 'staging' && preview.migratedEnvs.includes('preview')) {
        preview.changes.push(`staging → preview`);
      } else if (env === 'development' && !preview.migratedEnvs.includes('development')) {
        preview.changes.push(`development → removed`);
      }
    }
    
    if (preview.changes.length === 0) {
      preview.changes.push('No environment changes needed');
    }
    
  } catch (error) {
    preview.errors.push(`Preview failed: ${error.message}`);
  }
  
  return preview;
}

module.exports = {
  migrateConfigFile,
  migrateMultipleFiles,
  rollbackMigration,
  validateConfigFiles,
  previewMigration,
  addMigrationComments
};