/**
 * Configuration validation and migration utilities for Cloudflare Pages wrangler.toml files
 * Handles migration from unsupported environments (staging, development) to supported ones (preview, production)
 */

const fs = require('fs');
const path = require('path');

/**
 * Supported environment names for Cloudflare Pages
 */
const SUPPORTED_ENVIRONMENTS = ['production', 'preview'];

/**
 * Environment mapping for migration
 */
const ENVIRONMENT_MAPPING = {
  'staging': 'preview',
  'development': null // Remove development environment
};

/**
 * Required environment variables that must be present
 * Some variables may be optional depending on configuration style
 */
const REQUIRED_VARIABLES = [
  'DAILY_BURN_AMOUNT',
  'MAX_BURN_AMOUNT'
];

/**
 * Optional but recommended variables
 */
const RECOMMENDED_VARIABLES = [
  'ENVIRONMENT',
  'NODE_ENV',
  'BURN_PERCENTAGE',
  'MIN_BALANCE_THRESHOLD'
];

/**
 * Parse TOML content into JavaScript object
 * Simple TOML parser for wrangler.toml structure
 * @param {string} content - TOML file content
 * @returns {Object} Parsed configuration object
 */
function parseToml(content) {
  const config = {};
  const lines = content.split('\n');
  let currentSection = null;
  let currentEnv = null;
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;
    
    // Handle section headers
    if (line.startsWith('[') && line.endsWith(']')) {
      const section = line.slice(1, -1);
      
      if (section.startsWith('env.') && section.includes('.vars')) {
        // Environment variables section like [env.production.vars]
        const envName = section.split('.')[1];
        currentSection = 'vars';
        currentEnv = envName;
        
        if (!config.env) config.env = {};
        if (!config.env[envName]) config.env[envName] = {};
        if (!config.env[envName].vars) config.env[envName].vars = {};
      } else if (section.startsWith('env.')) {
        // Environment section like [env.production]
        const envName = section.split('.')[1];
        currentSection = 'env';
        currentEnv = envName;
        
        if (!config.env) config.env = {};
        if (!config.env[envName]) config.env[envName] = {};
      } else {
        // Other sections like [vars], [build], etc.
        currentSection = section;
        currentEnv = null;
        if (!config[section]) config[section] = {};
      }
      continue;
    }
    
    // Handle key-value pairs
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = line.substring(0, equalIndex).trim();
    let value = line.substring(equalIndex + 1).trim();
    
    // Remove quotes from string values
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Handle array values (compatibility_flags)
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
    }
    
    // Store the value in appropriate location
    if (currentSection === 'vars' && currentEnv) {
      config.env[currentEnv].vars[key] = value;
    } else if (currentSection === 'env' && currentEnv) {
      config.env[currentEnv][key] = value;
    } else if (currentSection && currentSection !== 'env') {
      config[currentSection][key] = value;
    } else {
      config[key] = value;
    }
  }
  
  return config;
}

/**
 * Convert JavaScript object back to TOML format
 * @param {Object} config - Configuration object
 * @returns {string} TOML formatted string
 */
function stringifyToml(config) {
  let toml = '';
  
  // Add main configuration
  const mainKeys = Object.keys(config).filter(key => 
    !['env', 'vars', 'build', 'compatibility_flags'].includes(key)
  );
  
  for (const key of mainKeys) {
    const value = config[key];
    if (Array.isArray(value)) {
      toml += `${key} = [${value.map(v => `"${v}"`).join(', ')}]\n`;
    } else {
      toml += `${key} = "${value}"\n`;
    }
  }
  
  toml += '\n';
  
  // Add global vars if present
  if (config.vars) {
    toml += '[vars]\n';
    for (const [key, value] of Object.entries(config.vars)) {
      toml += `${key} = "${value}"\n`;
    }
    toml += '\n';
  }
  
  // Add environments
  if (config.env) {
    for (const [envName, envConfig] of Object.entries(config.env)) {
      toml += `[env.${envName}]\n`;
      
      // Add environment-specific config (name, compatibility_date, etc.)
      for (const [key, value] of Object.entries(envConfig)) {
        if (key !== 'vars') {
          toml += `${key} = "${value}"\n`;
        }
      }
      
      toml += '\n';
      
      // Add environment variables
      if (envConfig.vars) {
        toml += `[env.${envName}.vars]\n`;
        for (const [key, value] of Object.entries(envConfig.vars)) {
          toml += `${key} = "${value}"\n`;
        }
        toml += '\n';
      }
    }
  }
  
  // Add other sections
  for (const [sectionName, sectionConfig] of Object.entries(config)) {
    if (!['env', 'vars'].includes(sectionName) && typeof sectionConfig === 'object' && !Array.isArray(sectionConfig)) {
      if (!mainKeys.includes(sectionName)) {
        toml += `[${sectionName}]\n`;
        for (const [key, value] of Object.entries(sectionConfig)) {
          if (Array.isArray(value)) {
            toml += `${key} = [${value.map(v => `"${v}"`).join(', ')}]\n`;
          } else if (typeof value === 'boolean') {
            toml += `${key} = ${value}\n`;
          } else {
            toml += `${key} = "${value}"\n`;
          }
        }
        toml += '\n';
      }
    }
  }
  
  return toml;
}

/**
 * Validate that configuration uses only supported environment names
 * @param {Object} config - Parsed configuration object
 * @returns {Object} Validation result with isValid and errors
 */
function validateEnvironmentNames(config) {
  const errors = [];
  
  if (!config.env) {
    return { isValid: true, errors: [] };
  }
  
  const envNames = Object.keys(config.env);
  const unsupportedEnvs = envNames.filter(name => !SUPPORTED_ENVIRONMENTS.includes(name));
  
  if (unsupportedEnvs.length > 0) {
    errors.push(`Unsupported environment names found: ${unsupportedEnvs.join(', ')}. Supported environments: ${SUPPORTED_ENVIRONMENTS.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate that required environment variables are present
 * @param {Object} config - Parsed configuration object
 * @returns {Object} Validation result with isValid and errors
 */
function validateRequiredVariables(config) {
  const errors = [];
  
  if (!config.env) {
    return { isValid: true, errors: [] };
  }
  
  for (const [envName, envConfig] of Object.entries(config.env)) {
    if (!envConfig.vars) {
      errors.push(`Environment '${envName}' is missing variables section`);
      continue;
    }
    
    const missingVars = REQUIRED_VARIABLES.filter(varName => 
      !(varName in envConfig.vars)
    );
    
    if (missingVars.length > 0) {
      errors.push(`Environment '${envName}' is missing required variables: ${missingVars.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate that no sensitive variables are hardcoded in configuration
 * @param {Object} config - Parsed configuration object
 * @returns {Object} Validation result with isValid and errors
 */
function validateSensitiveVariables(config) {
  const errors = [];
  const sensitivePatterns = [
    /private[_-]?key/i,
    /secret/i,
    /password/i,
    /token/i,
    /api[_-]?key/i
  ];
  
  // Check global vars
  if (config.vars) {
    for (const [key, value] of Object.entries(config.vars)) {
      if (sensitivePatterns.some(pattern => pattern.test(key)) && value && value !== '') {
        errors.push(`Sensitive variable '${key}' should not be hardcoded in configuration`);
      }
    }
  }
  
  // Check environment vars
  if (config.env) {
    for (const [envName, envConfig] of Object.entries(config.env)) {
      if (envConfig.vars) {
        for (const [key, value] of Object.entries(envConfig.vars)) {
          if (sensitivePatterns.some(pattern => pattern.test(key)) && value && value !== '') {
            errors.push(`Sensitive variable '${key}' in environment '${envName}' should not be hardcoded in configuration`);
          }
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Migrate configuration from unsupported to supported environments
 * @param {Object} config - Parsed configuration object
 * @returns {Object} Migrated configuration object
 */
function migrateEnvironments(config) {
  if (!config.env) {
    return config;
  }
  
  const migratedConfig = { ...config, env: {} };
  
  for (const [envName, envConfig] of Object.entries(config.env)) {
    const targetEnv = ENVIRONMENT_MAPPING[envName];
    
    // Skip development environment (mapped to null)
    if (targetEnv === null) {
      continue;
    }
    
    // Use mapped environment name or keep original if not in mapping
    const finalEnvName = targetEnv || envName;
    
    // Copy environment configuration
    migratedConfig.env[finalEnvName] = { ...envConfig };
    
    // Update environment-specific values
    if (migratedConfig.env[finalEnvName].vars) {
      // Update ENVIRONMENT variable to match new environment name
      if (migratedConfig.env[finalEnvName].vars.ENVIRONMENT) {
        migratedConfig.env[finalEnvName].vars.ENVIRONMENT = finalEnvName;
      }
      
      // Update name to reflect new environment
      if (migratedConfig.env[finalEnvName].name) {
        migratedConfig.env[finalEnvName].name = migratedConfig.env[finalEnvName].name.replace(envName, finalEnvName);
      }
    }
  }
  
  return migratedConfig;
}

/**
 * Create backup of configuration file
 * @param {string} filePath - Path to configuration file
 * @returns {string} Path to backup file
 */
function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  
  return backupPath;
}

/**
 * Restore configuration from backup
 * @param {string} filePath - Path to configuration file
 * @param {string} backupPath - Path to backup file
 */
function restoreFromBackup(filePath, backupPath) {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    return true;
  }
  return false;
}

/**
 * Comprehensive validation of wrangler configuration
 * @param {Object} config - Parsed configuration object
 * @returns {Object} Complete validation result
 */
function validateConfiguration(config) {
  const envValidation = validateEnvironmentNames(config);
  const varsValidation = validateRequiredVariables(config);
  const sensitiveValidation = validateSensitiveVariables(config);
  
  const allErrors = [
    ...envValidation.errors,
    ...varsValidation.errors,
    ...sensitiveValidation.errors
  ];
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    details: {
      environments: envValidation,
      variables: varsValidation,
      sensitive: sensitiveValidation
    }
  };
}

module.exports = {
  parseToml,
  stringifyToml,
  validateEnvironmentNames,
  validateRequiredVariables,
  validateSensitiveVariables,
  validateConfiguration,
  migrateEnvironments,
  createBackup,
  restoreFromBackup,
  SUPPORTED_ENVIRONMENTS,
  ENVIRONMENT_MAPPING,
  REQUIRED_VARIABLES
};