// Deployment Testing Framework Core Implementation

import { 
  DeploymentConfig, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  TestResult,
  WorkflowConfig,
  DeploymentStatus,
  HealthStatus
} from './types';

export class DeploymentTestFramework {
  private configs: Map<string, DeploymentConfig> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();

  /**
   * Validates deployment configuration
   * Property 1: Configuration Validation Completeness
   */
  validateConfiguration(config: DeploymentConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate required fields
    if (!config.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'Deployment configuration must have an ID',
        field: 'id',
        severity: 'error'
      });
    }

    if (!config.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Deployment configuration must have a name',
        field: 'name',
        severity: 'error'
      });
    }

    if (!config.cloudflareProject) {
      errors.push({
        code: 'MISSING_CLOUDFLARE_PROJECT',
        message: 'Cloudflare project name is required',
        field: 'cloudflareProject',
        severity: 'error'
      });
    }

    // Validate environment
    const validEnvironments = ['test', 'staging', 'preview', 'production'];
    if (!validEnvironments.includes(config.environment)) {
      errors.push({
        code: 'INVALID_ENVIRONMENT',
        message: `Environment must be one of: ${validEnvironments.join(', ')}`,
        field: 'environment',
        severity: 'error'
      });
    }

    // Validate secrets
    const requiredSecrets = config.secrets.filter(s => s.required);
    if (requiredSecrets.length === 0) {
      warnings.push({
        code: 'NO_REQUIRED_SECRETS',
        message: 'No required secrets defined - this may cause deployment issues',
        field: 'secrets'
      });
    }

    // Check for health check URL
    if (!config.healthCheckUrl) {
      warnings.push({
        code: 'NO_HEALTH_CHECK',
        message: 'No health check URL defined - post-deployment verification will be limited',
        field: 'healthCheckUrl'
      });
      recommendations.push('Add a health check URL for better deployment verification');
    }

    // Validate branch name
    if (!config.branch || config.branch.trim() === '') {
      errors.push({
        code: 'INVALID_BRANCH',
        message: 'Branch name cannot be empty',
        field: 'branch',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Validates workflow configuration
   */
  validateWorkflow(workflow: WorkflowConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate workflow structure
    if (!workflow.name) {
      errors.push({
        code: 'MISSING_WORKFLOW_NAME',
        message: 'Workflow must have a name',
        field: 'name',
        severity: 'error'
      });
    }

    if (!workflow.path) {
      errors.push({
        code: 'MISSING_WORKFLOW_PATH',
        message: 'Workflow must have a file path',
        field: 'path',
        severity: 'error'
      });
    }

    if (workflow.jobs.length === 0) {
      errors.push({
        code: 'NO_JOBS',
        message: 'Workflow must have at least one job',
        field: 'jobs',
        severity: 'error'
      });
    }

    // Validate job dependencies
    const jobNames = workflow.jobs.map(job => job.name);
    workflow.jobs.forEach(job => {
      if (job.needs) {
        job.needs.forEach(dependency => {
          if (!jobNames.includes(dependency)) {
            errors.push({
              code: 'INVALID_JOB_DEPENDENCY',
              message: `Job "${job.name}" depends on non-existent job "${dependency}"`,
              field: 'jobs',
              severity: 'error'
            });
          }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Simulates production conditions in test environment
   * Property 2: Test Environment Production Fidelity
   */
  simulateProductionEnvironment(testConfig: DeploymentConfig, prodConfig: DeploymentConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Compare environment variables
    const prodVars = new Set(prodConfig.variables.map(v => v.name));
    const testVars = new Set(testConfig.variables.map(v => v.name));

    // Check for missing variables in test
    prodVars.forEach(varName => {
      if (!testVars.has(varName)) {
        warnings.push({
          code: 'MISSING_TEST_VARIABLE',
          message: `Production variable "${varName}" not found in test environment`,
          field: 'variables'
        });
      }
    });

    // Compare secrets
    const prodSecrets = new Set(prodConfig.secrets.map(s => s.name));
    const testSecrets = new Set(testConfig.secrets.map(s => s.name));

    prodSecrets.forEach(secretName => {
      if (!testSecrets.has(secretName)) {
        errors.push({
          code: 'MISSING_TEST_SECRET',
          message: `Production secret "${secretName}" not configured in test environment`,
          field: 'secrets',
          severity: 'error'
        });
      }
    });

    // Validate similar configuration structure
    if (testConfig.cloudflareProject === prodConfig.cloudflareProject) {
      errors.push({
        code: 'SAME_CLOUDFLARE_PROJECT',
        message: 'Test and production environments should use different Cloudflare projects',
        field: 'cloudflareProject',
        severity: 'error'
      });
    }

    if (errors.length === 0 && warnings.length === 0) {
      recommendations.push('Test environment successfully simulates production conditions');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Generates comprehensive test report
   * Property 3: Comprehensive Test Reporting
   */
  generateTestReport(deploymentId: string, testResults: TestResult[]): {
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
    details: TestResult[];
    recommendations: string[];
  } {
    const total = testResults.length;
    const passed = testResults.filter(r => r.status === 'passed').length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    const skipped = testResults.filter(r => r.status === 'skipped').length;
    const duration = testResults.reduce((sum, r) => sum + r.duration, 0);

    const recommendations: string[] = [];

    if (failed > 0) {
      recommendations.push(`${failed} test(s) failed - review failed tests and fix issues before deployment`);
    }

    if (skipped > 0) {
      recommendations.push(`${skipped} test(s) were skipped - consider running all tests for complete coverage`);
    }

    if (duration > 300000) { // 5 minutes
      recommendations.push('Test execution took longer than 5 minutes - consider optimizing test performance');
    }

    if (passed === total && total > 0) {
      recommendations.push('All tests passed successfully - deployment is ready to proceed');
    }

    return {
      summary: {
        total,
        passed,
        failed,
        skipped,
        duration
      },
      details: testResults,
      recommendations
    };
  }

  /**
   * Registers a deployment configuration
   */
  registerConfig(config: DeploymentConfig): void {
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    this.configs.set(config.id, config);
  }

  /**
   * Gets a deployment configuration by ID
   */
  getConfig(id: string): DeploymentConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Lists all registered configurations
   */
  listConfigs(): DeploymentConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Records test results for a deployment
   */
  recordTestResults(deploymentId: string, results: TestResult[]): void {
    this.testResults.set(deploymentId, results);
  }

  /**
   * Gets test results for a deployment
   */
  getTestResults(deploymentId: string): TestResult[] {
    return this.testResults.get(deploymentId) || [];
  }
}