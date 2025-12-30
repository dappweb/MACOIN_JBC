// Property Test 2: Test Environment Production Fidelity
// Validates: Requirements 1.2

import { DeploymentTestFramework } from '../DeploymentTestFramework';
import { WorkflowSimulator } from '../WorkflowSimulator';
import { DeploymentConfig } from '../types';

describe('Property Test 2: Test Environment Production Fidelity', () => {
  let framework: DeploymentTestFramework;

  beforeEach(() => {
    framework = new DeploymentTestFramework();
  });

  /**
   * Property 2: Test Environment Production Fidelity
   * Test environments should accurately simulate production conditions:
   * 1. Same environment variables (with test values)
   * 2. Same required secrets (with test credentials)
   * 3. Similar infrastructure configuration
   * 4. Different project names/URLs to avoid conflicts
   * 5. Validation should identify missing components
   * 6. Fidelity score should reflect similarity accurately
   */

  test('Property 2.1: Environment variable parity is validated', () => {
    const prodConfig = createProductionConfig();
    const testConfig = createTestConfig();

    // Test with matching variables
    const matchingTestConfig = {
      ...testConfig,
      variables: prodConfig.variables.map(v => ({
        ...v,
        value: `test-${v.value}`,
        environment: 'test'
      }))
    };

    const result = framework.simulateProductionEnvironment(matchingTestConfig, prodConfig);
    
    // Property: Matching variables should not generate variable-related warnings
    const variableWarnings = result.warnings.filter(w => w.code === 'MISSING_TEST_VARIABLE');
    expect(variableWarnings.length).toBe(0);

    // Test with missing variables
    const incompleteTestConfig = {
      ...testConfig,
      variables: prodConfig.variables.slice(0, -1).map(v => ({
        ...v,
        value: `test-${v.value}`,
        environment: 'test'
      }))
    };

    const incompleteResult = framework.simulateProductionEnvironment(incompleteTestConfig, prodConfig);
    
    // Property: Missing variables should generate warnings
    const missingVarWarnings = incompleteResult.warnings.filter(w => w.code === 'MISSING_TEST_VARIABLE');
    expect(missingVarWarnings.length).toBeGreaterThan(0);
  });

  test('Property 2.2: Secret configuration parity is validated', () => {
    const prodConfig = createProductionConfig();
    const testConfig = createTestConfig();

    // Test with matching secrets
    const matchingTestConfig = {
      ...testConfig,
      secrets: prodConfig.secrets.map(s => ({
        ...s,
        name: s.name.replace('PROD_', 'TEST_')
      }))
    };

    const result = framework.simulateProductionEnvironment(matchingTestConfig, prodConfig);
    
    // Property: Missing required secrets should generate errors
    const secretErrors = result.errors.filter(e => e.code === 'MISSING_TEST_SECRET');
    expect(secretErrors.length).toBeGreaterThan(0); // Because we changed secret names

    // Test with proper secret mapping
    const properTestConfig = {
      ...testConfig,
      secrets: prodConfig.secrets // Same secret names, different values in actual deployment
    };

    const properResult = framework.simulateProductionEnvironment(properTestConfig, prodConfig);
    const properSecretErrors = properResult.errors.filter(e => e.code === 'MISSING_TEST_SECRET');
    expect(properSecretErrors.length).toBe(0);
  });

  test('Property 2.3: Infrastructure separation is enforced', () => {
    const prodConfig = createProductionConfig();
    
    // Test with same Cloudflare project (should fail)
    const conflictingTestConfig = {
      ...createTestConfig(),
      cloudflareProject: prodConfig.cloudflareProject
    };

    const result = framework.simulateProductionEnvironment(conflictingTestConfig, prodConfig);
    
    // Property: Same infrastructure should generate errors
    const infrastructureErrors = result.errors.filter(e => e.code === 'SAME_CLOUDFLARE_PROJECT');
    expect(infrastructureErrors.length).toBe(1);
    expect(result.isValid).toBe(false);
  });

  test('Property 2.4: Fidelity scoring is accurate and consistent', () => {
    const prodConfig = createProductionConfig();
    const testConfig = createTestConfig();
    const simulator = new WorkflowSimulator(testConfig);

    // Test perfect fidelity
    const perfectTestConfig = {
      ...testConfig,
      variables: prodConfig.variables.map(v => ({
        ...v,
        value: `test-${v.value}`,
        environment: 'test'
      })),
      secrets: prodConfig.secrets
    };

    const perfectFidelity = simulator.validateEnvironmentFidelity(perfectTestConfig, prodConfig);
    
    // Property: Perfect configuration should have high fidelity score
    expect(perfectFidelity.fidelityScore).toBeGreaterThanOrEqual(80);
    expect(perfectFidelity.issues.length).toBeLessThanOrEqual(2); // Only infrastructure separation issues

    // Test poor fidelity
    const poorTestConfig = {
      ...testConfig,
      variables: [], // Missing all variables
      secrets: [] // Missing all secrets
    };

    const poorFidelity = simulator.validateEnvironmentFidelity(poorTestConfig, prodConfig);
    
    // Property: Poor configuration should have low fidelity score
    expect(poorFidelity.fidelityScore).toBeLessThan(50);
    expect(poorFidelity.issues.length).toBeGreaterThan(0);
  });

  test('Property 2.5: Fidelity validation is deterministic', () => {
    const prodConfig = createProductionConfig();
    const testConfig = createTestConfig();
    const simulator = new WorkflowSimulator(testConfig);

    // Run validation multiple times
    const results = Array.from({ length: 5 }, () => 
      simulator.validateEnvironmentFidelity(testConfig, prodConfig)
    );

    // Property: Same inputs should produce same results
    const firstResult = results[0];
    results.forEach(result => {
      expect(result.fidelityScore).toBe(firstResult.fidelityScore);
      expect(result.issues).toEqual(firstResult.issues);
      expect(result.recommendations).toEqual(firstResult.recommendations);
    });
  });

  test('Property 2.6: Recommendations are actionable and relevant', () => {
    const prodConfig = createProductionConfig();
    const testConfig = createTestConfig();
    const simulator = new WorkflowSimulator(testConfig);

    const fidelity = simulator.validateEnvironmentFidelity(testConfig, prodConfig);
    
    // Property: Recommendations should be strings and actionable
    expect(Array.isArray(fidelity.recommendations)).toBe(true);
    fidelity.recommendations.forEach(recommendation => {
      expect(typeof recommendation).toBe('string');
      expect(recommendation.length).toBeGreaterThan(10); // Should be descriptive
    });

    // Property: Issues should correspond to recommendations when score is low
    if (fidelity.fidelityScore < 80) {
      expect(fidelity.recommendations.some(rec => 
        rec.includes('improve') || rec.includes('match') || rec.includes('add')
      )).toBe(true);
    }
  });

  test('Property 2.7: Environment validation handles edge cases', () => {
    const prodConfig = createProductionConfig();
    const simulator = new WorkflowSimulator(createTestConfig());

    // Test with empty configurations
    const emptyTestConfig: DeploymentConfig = {
      id: 'empty',
      name: 'Empty',
      environment: 'test',
      branch: 'test',
      cloudflareProject: 'empty-test',
      secrets: [],
      variables: []
    };

    const emptyResult = simulator.validateEnvironmentFidelity(emptyTestConfig, prodConfig);
    
    // Property: Empty configuration should be handled gracefully
    expect(typeof emptyResult.fidelityScore).toBe('number');
    expect(emptyResult.fidelityScore).toBeGreaterThanOrEqual(0);
    expect(emptyResult.fidelityScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(emptyResult.issues)).toBe(true);
    expect(Array.isArray(emptyResult.recommendations)).toBe(true);

    // Test with null/undefined values
    const nullTestConfig = {
      ...createTestConfig(),
      variables: undefined as any,
      secrets: undefined as any
    };

    expect(() => {
      simulator.validateEnvironmentFidelity(nullTestConfig, prodConfig);
    }).not.toThrow();
  });

  // Helper functions
  function createProductionConfig(): DeploymentConfig {
    return {
      id: 'prod-env',
      name: 'Production Environment',
      environment: 'production',
      branch: 'main',
      cloudflareProject: 'jinbao-protocol-prod',
      healthCheckUrl: 'https://jinbao-protocol-prod.pages.dev',
      secrets: [
        {
          name: 'CLOUDFLARE_API_TOKEN',
          required: true,
          description: 'Cloudflare API token'
        },
        {
          name: 'CLOUDFLARE_ACCOUNT_ID',
          required: true,
          description: 'Cloudflare account ID'
        },
        {
          name: 'PROD_PRIVATE_KEY',
          required: true,
          description: 'Production private key'
        },
        {
          name: 'PROD_JBC_CONTRACT_ADDRESS',
          required: true,
          description: 'Production JBC contract'
        }
      ],
      variables: [
        {
          name: 'ENVIRONMENT',
          value: 'production',
          environment: 'production'
        },
        {
          name: 'NODE_VERSION',
          value: '18',
          environment: 'production'
        },
        {
          name: 'BUILD_COMMAND',
          value: 'npm run build',
          environment: 'production'
        }
      ]
    };
  }

  function createTestConfig(): DeploymentConfig {
    return {
      id: 'test-env',
      name: 'Test Environment',
      environment: 'test',
      branch: 'test',
      cloudflareProject: 'jinbao-test',
      healthCheckUrl: 'https://jinbao-test.pages.dev',
      secrets: [
        {
          name: 'CLOUDFLARE_API_TOKEN',
          required: true,
          description: 'Cloudflare API token'
        },
        {
          name: 'CLOUDFLARE_ACCOUNT_ID',
          required: true,
          description: 'Cloudflare account ID'
        }
      ],
      variables: [
        {
          name: 'ENVIRONMENT',
          value: 'test',
          environment: 'test'
        },
        {
          name: 'NODE_VERSION',
          value: '18',
          environment: 'test'
        }
      ]
    };
  }
});