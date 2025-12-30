// Property Test 1: Configuration Validation Completeness
// Validates: Requirements 1.1, 1.4, 4.2

import { DeploymentTestFramework } from '../DeploymentTestFramework';
import { DeploymentConfig, SecretConfig, VariableConfig } from '../types';

describe('Property Test 1: Configuration Validation Completeness', () => {
  let framework: DeploymentTestFramework;

  beforeEach(() => {
    framework = new DeploymentTestFramework();
  });

  /**
   * Property 1: Configuration Validation Completeness
   * For any deployment configuration, validation should:
   * 1. Always return a ValidationResult with isValid boolean
   * 2. Include errors array (empty if valid)
   * 3. Include warnings array (may be empty)
   * 4. Include recommendations array (may be empty)
   * 5. Mark as invalid if required fields are missing
   * 6. Provide meaningful error messages for each validation failure
   */

  test('Property 1.1: Validation result structure is always complete', () => {
    // Test with various configuration states
    const testConfigs = [
      // Valid configuration
      createValidConfig(),
      // Invalid configuration - missing required fields
      createInvalidConfig(),
      // Minimal configuration
      createMinimalConfig(),
      // Configuration with warnings
      createConfigWithWarnings()
    ];

    testConfigs.forEach((config, index) => {
      const result = framework.validateConfiguration(config);
      
      // Property: Result structure is always complete
      expect(result).toHaveProperty('isValid');
      expect(typeof result.isValid).toBe('boolean');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  test('Property 1.2: Invalid configurations are correctly identified', () => {
    // Property: Configurations missing required fields should be invalid
    const invalidConfigs = [
      { ...createValidConfig(), id: '' }, // Missing ID
      { ...createValidConfig(), name: '' }, // Missing name
      { ...createValidConfig(), cloudflareProject: '' }, // Missing Cloudflare project
      { ...createValidConfig(), environment: 'invalid' }, // Invalid environment
      { ...createValidConfig(), branch: '' }, // Missing branch
    ];

    invalidConfigs.forEach(config => {
      const result = framework.validateConfiguration(config);
      
      // Property: Invalid configurations should be marked as invalid
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Property: Each error should have required fields
      result.errors.forEach(error => {
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('severity');
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(typeof error.field).toBe('string');
        expect(error.severity).toBe('error');
      });
    });
  });

  test('Property 1.3: Valid configurations pass validation', () => {
    const validConfig = createValidConfig();
    const result = framework.validateConfiguration(validConfig);
    
    // Property: Valid configurations should pass validation
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('Property 1.4: Warnings do not affect validity', () => {
    const configWithWarnings = createConfigWithWarnings();
    const result = framework.validateConfiguration(configWithWarnings);
    
    // Property: Warnings should not make configuration invalid
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    
    // Property: Each warning should have required fields
    result.warnings.forEach(warning => {
      expect(warning).toHaveProperty('code');
      expect(warning).toHaveProperty('message');
      expect(warning).toHaveProperty('field');
      expect(typeof warning.code).toBe('string');
      expect(typeof warning.message).toBe('string');
      expect(typeof warning.field).toBe('string');
    });
  });

  test('Property 1.5: Error codes are consistent and meaningful', () => {
    const testCases = [
      { config: { ...createValidConfig(), id: '' }, expectedCode: 'MISSING_ID' },
      { config: { ...createValidConfig(), name: '' }, expectedCode: 'MISSING_NAME' },
      { config: { ...createValidConfig(), cloudflareProject: '' }, expectedCode: 'MISSING_CLOUDFLARE_PROJECT' },
      { config: { ...createValidConfig(), environment: 'invalid' }, expectedCode: 'INVALID_ENVIRONMENT' },
      { config: { ...createValidConfig(), branch: '' }, expectedCode: 'INVALID_BRANCH' },
    ];

    testCases.forEach(({ config, expectedCode }) => {
      const result = framework.validateConfiguration(config);
      
      // Property: Specific validation failures should produce expected error codes
      expect(result.errors.some(error => error.code === expectedCode)).toBe(true);
    });
  });

  test('Property 1.6: Recommendations are provided for improvements', () => {
    const configWithoutHealthCheck = {
      ...createValidConfig(),
      healthCheckUrl: undefined
    };
    
    const result = framework.validateConfiguration(configWithoutHealthCheck);
    
    // Property: Missing optional but recommended fields should generate recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some(rec => 
      rec.includes('health check') || rec.includes('Health check')
    )).toBe(true);
  });

  test('Property 1.7: Environment validation is comprehensive', () => {
    const validEnvironments = ['test', 'staging', 'preview', 'production'];
    const invalidEnvironments = ['dev', 'local', 'invalid', '', 'PRODUCTION'];

    validEnvironments.forEach(env => {
      const config = { ...createValidConfig(), environment: env };
      const result = framework.validateConfiguration(config);
      
      // Property: Valid environments should not generate environment-related errors
      expect(result.errors.some(error => error.code === 'INVALID_ENVIRONMENT')).toBe(false);
    });

    invalidEnvironments.forEach(env => {
      const config = { ...createValidConfig(), environment: env };
      const result = framework.validateConfiguration(config);
      
      // Property: Invalid environments should generate INVALID_ENVIRONMENT error
      expect(result.errors.some(error => error.code === 'INVALID_ENVIRONMENT')).toBe(true);
    });
  });

  // Helper functions to create test configurations
  function createValidConfig(): DeploymentConfig {
    return {
      id: 'test-config',
      name: 'Test Configuration',
      environment: 'test',
      branch: 'test-branch',
      cloudflareProject: 'test-project',
      healthCheckUrl: 'https://test.example.com',
      secrets: [
        {
          name: 'REQUIRED_SECRET',
          required: true,
          description: 'A required secret'
        },
        {
          name: 'OPTIONAL_SECRET',
          required: false,
          description: 'An optional secret'
        }
      ],
      variables: [
        {
          name: 'TEST_VAR',
          value: 'test-value',
          environment: 'test'
        }
      ]
    };
  }

  function createInvalidConfig(): DeploymentConfig {
    return {
      id: '',
      name: '',
      environment: 'invalid',
      branch: '',
      cloudflareProject: '',
      secrets: [],
      variables: []
    };
  }

  function createMinimalConfig(): DeploymentConfig {
    return {
      id: 'minimal',
      name: 'Minimal Config',
      environment: 'test',
      branch: 'main',
      cloudflareProject: 'minimal-project',
      secrets: [],
      variables: []
    };
  }

  function createConfigWithWarnings(): DeploymentConfig {
    return {
      id: 'warning-config',
      name: 'Config with Warnings',
      environment: 'test',
      branch: 'test',
      cloudflareProject: 'warning-project',
      // No healthCheckUrl - should generate warning
      // No required secrets - should generate warning
      secrets: [
        {
          name: 'OPTIONAL_ONLY',
          required: false,
          description: 'Only optional secret'
        }
      ],
      variables: []
    };
  }
});