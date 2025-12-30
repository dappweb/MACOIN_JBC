// Tests for Deployment Test Framework

import { DeploymentTestFramework } from '../DeploymentTestFramework';
import { DeploymentConfig, TestResult } from '../types';

describe('DeploymentTestFramework', () => {
  let framework: DeploymentTestFramework;

  beforeEach(() => {
    framework = new DeploymentTestFramework();
  });

  describe('Configuration Validation', () => {
    it('should validate a complete configuration successfully', () => {
      const config: DeploymentConfig = {
        id: 'test-config',
        name: 'Test Configuration',
        environment: 'test',
        branch: 'test',
        cloudflareProject: 'test-project',
        healthCheckUrl: 'https://test-project.pages.dev',
        secrets: [
          {
            name: 'API_TOKEN',
            required: true,
            description: 'API token for deployment'
          }
        ],
        variables: [
          {
            name: 'NODE_ENV',
            value: 'test',
            environment: 'test'
          }
        ]
      };

      const result = framework.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const config: DeploymentConfig = {
        id: '',
        name: '',
        environment: 'test',
        branch: '',
        cloudflareProject: '',
        secrets: [],
        variables: []
      };

      const result = framework.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_CLOUDFLARE_PROJECT')).toBe(true);
    });

    it('should detect invalid environment', () => {
      const config: DeploymentConfig = {
        id: 'test',
        name: 'Test',
        environment: 'invalid' as any,
        branch: 'test',
        cloudflareProject: 'test-project',
        secrets: [],
        variables: []
      };

      const result = framework.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ENVIRONMENT')).toBe(true);
    });
  });

  describe('Test Reporting', () => {
    it('should generate comprehensive test report', () => {
      const testResults: TestResult[] = [
        {
          testId: 'test-1',
          testName: 'Build Test',
          status: 'passed',
          duration: 1000,
          environment: 'test',
          details: [],
          artifacts: []
        },
        {
          testId: 'test-2',
          testName: 'Deploy Test',
          status: 'failed',
          duration: 2000,
          environment: 'test',
          details: [],
          artifacts: []
        },
        {
          testId: 'test-3',
          testName: 'Health Check',
          status: 'skipped',
          duration: 0,
          environment: 'test',
          details: [],
          artifacts: []
        }
      ];

      const report = framework.generateTestReport('deployment-1', testResults);

      expect(report.summary.total).toBe(3);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.skipped).toBe(1);
      expect(report.summary.duration).toBe(3000);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for failed tests', () => {
      const testResults: TestResult[] = [
        {
          testId: 'test-1',
          testName: 'Failed Test',
          status: 'failed',
          duration: 1000,
          environment: 'test',
          details: [],
          artifacts: []
        }
      ];

      const report = framework.generateTestReport('deployment-1', testResults);

      expect(report.recommendations.some(r => r.includes('failed'))).toBe(true);
    });
  });

  describe('Production Environment Simulation', () => {
    it('should validate test environment matches production', () => {
      const prodConfig: DeploymentConfig = {
        id: 'prod',
        name: 'Production',
        environment: 'production',
        branch: 'prod',
        cloudflareProject: 'prod-project',
        secrets: [
          { name: 'API_TOKEN', required: true, description: 'API token' },
          { name: 'DB_PASSWORD', required: true, description: 'Database password' }
        ],
        variables: [
          { name: 'NODE_ENV', value: 'production', environment: 'production' }
        ]
      };

      const testConfig: DeploymentConfig = {
        id: 'test',
        name: 'Test',
        environment: 'test',
        branch: 'test',
        cloudflareProject: 'test-project',
        secrets: [
          { name: 'API_TOKEN', required: true, description: 'API token' },
          { name: 'DB_PASSWORD', required: true, description: 'Database password' }
        ],
        variables: [
          { name: 'NODE_ENV', value: 'test', environment: 'test' }
        ]
      };

      const result = framework.simulateProductionEnvironment(testConfig, prodConfig);

      expect(result.isValid).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect missing secrets in test environment', () => {
      const prodConfig: DeploymentConfig = {
        id: 'prod',
        name: 'Production',
        environment: 'production',
        branch: 'prod',
        cloudflareProject: 'prod-project',
        secrets: [
          { name: 'API_TOKEN', required: true, description: 'API token' },
          { name: 'SECRET_KEY', required: true, description: 'Secret key' }
        ],
        variables: []
      };

      const testConfig: DeploymentConfig = {
        id: 'test',
        name: 'Test',
        environment: 'test',
        branch: 'test',
        cloudflareProject: 'test-project',
        secrets: [
          { name: 'API_TOKEN', required: true, description: 'API token' }
          // Missing SECRET_KEY
        ],
        variables: []
      };

      const result = framework.simulateProductionEnvironment(testConfig, prodConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TEST_SECRET')).toBe(true);
    });
  });
});