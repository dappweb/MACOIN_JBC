// GitHub Actions Workflow Validation and Testing Utilities

import { WorkflowConfig, JobConfig, ValidationResult, ValidationError, ValidationWarning } from './types';

export class WorkflowValidator {
  /**
   * Validates GitHub Actions workflow configuration
   * Requirements: 1.1, 1.2, 1.4
   */
  validateWorkflow(workflow: WorkflowConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate basic workflow structure
    this.validateWorkflowStructure(workflow, errors);
    
    // Validate jobs and dependencies
    this.validateJobs(workflow, errors, warnings);
    
    // Validate secrets and environment variables
    this.validateSecretsAndVariables(workflow, warnings, recommendations);
    
    // Validate triggers
    this.validateTriggers(workflow, warnings, recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Validates workflow structure
   */
  private validateWorkflowStructure(workflow: WorkflowConfig, errors: ValidationError[]): void {
    if (!workflow.name || workflow.name.trim() === '') {
      errors.push({
        code: 'MISSING_WORKFLOW_NAME',
        message: 'Workflow must have a name',
        field: 'name',
        severity: 'error'
      });
    }

    if (!workflow.path || workflow.path.trim() === '') {
      errors.push({
        code: 'MISSING_WORKFLOW_PATH',
        message: 'Workflow must have a file path',
        field: 'path',
        severity: 'error'
      });
    }

    if (!workflow.path?.startsWith('.github/workflows/')) {
      errors.push({
        code: 'INVALID_WORKFLOW_PATH',
        message: 'Workflow path must be in .github/workflows/ directory',
        field: 'path',
        severity: 'error'
      });
    }

    if (!workflow.path?.endsWith('.yml') && !workflow.path?.endsWith('.yaml')) {
      errors.push({
        code: 'INVALID_WORKFLOW_EXTENSION',
        message: 'Workflow file must have .yml or .yaml extension',
        field: 'path',
        severity: 'error'
      });
    }

    if (!workflow.jobs || workflow.jobs.length === 0) {
      errors.push({
        code: 'NO_JOBS',
        message: 'Workflow must have at least one job',
        field: 'jobs',
        severity: 'error'
      });
    }
  }

  /**
   * Validates jobs and their dependencies
   */
  private validateJobs(workflow: WorkflowConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!workflow.jobs) return;

    const jobNames = workflow.jobs.map(job => job.name);
    const duplicateNames = jobNames.filter((name, index) => jobNames.indexOf(name) !== index);

    if (duplicateNames.length > 0) {
      errors.push({
        code: 'DUPLICATE_JOB_NAMES',
        message: `Duplicate job names found: ${duplicateNames.join(', ')}`,
        field: 'jobs',
        severity: 'error'
      });
    }

    workflow.jobs.forEach(job => {
      this.validateJob(job, jobNames, errors, warnings);
    });

    // Check for circular dependencies
    this.validateJobDependencies(workflow.jobs, errors);
  }

  /**
   * Validates individual job configuration
   */
  private validateJob(job: JobConfig, allJobNames: string[], errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!job.name || job.name.trim() === '') {
      errors.push({
        code: 'MISSING_JOB_NAME',
        message: 'Job must have a name',
        field: 'jobs',
        severity: 'error'
      });
    }

    if (!job.runsOn || job.runsOn.trim() === '') {
      errors.push({
        code: 'MISSING_RUNS_ON',
        message: `Job "${job.name}" must specify runs-on`,
        field: 'jobs',
        severity: 'error'
      });
    }

    if (!job.steps || job.steps.length === 0) {
      errors.push({
        code: 'NO_STEPS',
        message: `Job "${job.name}" must have at least one step`,
        field: 'jobs',
        severity: 'error'
      });
    }

    // Validate job dependencies
    if (job.needs) {
      job.needs.forEach(dependency => {
        if (!allJobNames.includes(dependency)) {
          errors.push({
            code: 'INVALID_JOB_DEPENDENCY',
            message: `Job "${job.name}" depends on non-existent job "${dependency}"`,
            field: 'jobs',
            severity: 'error'
          });
        }
      });
    }

    // Check for common runner types
    const commonRunners = ['ubuntu-latest', 'windows-latest', 'macos-latest', 'ubuntu-20.04', 'ubuntu-22.04'];
    if (job.runsOn && !commonRunners.includes(job.runsOn)) {
      warnings.push({
        code: 'UNCOMMON_RUNNER',
        message: `Job "${job.name}" uses uncommon runner "${job.runsOn}"`,
        field: 'jobs'
      });
    }
  }

  /**
   * Validates job dependencies for circular references
   */
  private validateJobDependencies(jobs: JobConfig[], errors: ValidationError[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (jobName: string): boolean => {
      if (recursionStack.has(jobName)) {
        return true;
      }
      if (visited.has(jobName)) {
        return false;
      }

      visited.add(jobName);
      recursionStack.add(jobName);

      const job = jobs.find(j => j.name === jobName);
      if (job?.needs) {
        for (const dependency of job.needs) {
          if (hasCycle(dependency)) {
            return true;
          }
        }
      }

      recursionStack.delete(jobName);
      return false;
    };

    for (const job of jobs) {
      if (hasCycle(job.name)) {
        errors.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected involving job "${job.name}"`,
          field: 'jobs',
          severity: 'error'
        });
        break;
      }
    }
  }

  /**
   * Validates secrets and environment variables usage
   */
  private validateSecretsAndVariables(workflow: WorkflowConfig, warnings: ValidationWarning[], recommendations: string[]): void {
    if (!workflow.secrets || workflow.secrets.length === 0) {
      warnings.push({
        code: 'NO_SECRETS',
        message: 'Workflow does not define any secrets',
        field: 'secrets'
      });
      recommendations.push('Consider if this workflow needs access to secrets for deployment');
    }

    if (!workflow.variables || workflow.variables.length === 0) {
      warnings.push({
        code: 'NO_VARIABLES',
        message: 'Workflow does not define any environment variables',
        field: 'variables'
      });
    }

    // Check for common required secrets
    const commonSecrets = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
    const definedSecrets = workflow.secrets?.map(s => s.name) || [];
    
    commonSecrets.forEach(secretName => {
      if (!definedSecrets.includes(secretName)) {
        recommendations.push(`Consider adding ${secretName} secret if this workflow deploys to Cloudflare`);
      }
    });
  }

  /**
   * Validates workflow triggers
   */
  private validateTriggers(workflow: WorkflowConfig, warnings: ValidationWarning[], recommendations: string[]): void {
    if (!workflow.triggers || workflow.triggers.length === 0) {
      warnings.push({
        code: 'NO_TRIGGERS',
        message: 'Workflow does not define any triggers',
        field: 'triggers'
      });
      recommendations.push('Add appropriate triggers (push, pull_request, workflow_dispatch, etc.)');
    }

    const triggers = workflow.triggers || [];
    
    // Check for manual trigger
    if (!triggers.includes('workflow_dispatch')) {
      recommendations.push('Consider adding workflow_dispatch trigger for manual execution');
    }

    // Check for appropriate branch triggers
    const hasPushTrigger = triggers.some(t => t.startsWith('push'));
    const hasPRTrigger = triggers.some(t => t.startsWith('pull_request'));
    
    if (!hasPushTrigger && !hasPRTrigger) {
      warnings.push({
        code: 'NO_BRANCH_TRIGGERS',
        message: 'Workflow has no push or pull_request triggers',
        field: 'triggers'
      });
    }
  }

  /**
   * Simulates workflow execution for testing
   * Requirements: 1.2
   */
  simulateWorkflowExecution(workflow: WorkflowConfig): {
    success: boolean;
    executionOrder: string[];
    estimatedDuration: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const executionOrder: string[] = [];
    let estimatedDuration = 0;

    try {
      // Calculate execution order based on dependencies
      const sortedJobs = this.topologicalSort(workflow.jobs);
      
      if (sortedJobs.length !== workflow.jobs.length) {
        issues.push('Some jobs cannot be executed due to dependency issues');
        return {
          success: false,
          executionOrder: [],
          estimatedDuration: 0,
          issues
        };
      }

      // Simulate execution
      for (const job of sortedJobs) {
        executionOrder.push(job.name);
        
        // Estimate duration based on steps
        const stepDuration = job.steps.length * 30; // 30 seconds per step average
        estimatedDuration += stepDuration;

        // Check for potential issues
        if (job.steps.length > 20) {
          issues.push(`Job "${job.name}" has many steps (${job.steps.length}) - consider splitting`);
        }

        if (job.runsOn === 'windows-latest' && job.steps.some(step => step.includes('npm'))) {
          estimatedDuration += 60; // Windows npm operations are slower
        }
      }

      return {
        success: true,
        executionOrder,
        estimatedDuration,
        issues
      };

    } catch (error) {
      issues.push(`Simulation failed: ${error}`);
      return {
        success: false,
        executionOrder,
        estimatedDuration,
        issues
      };
    }
  }

  /**
   * Performs topological sort of jobs based on dependencies
   */
  private topologicalSort(jobs: JobConfig[]): JobConfig[] {
    const visited = new Set<string>();
    const result: JobConfig[] = [];
    const jobMap = new Map(jobs.map(job => [job.name, job]));

    const visit = (jobName: string): void => {
      if (visited.has(jobName)) return;
      
      const job = jobMap.get(jobName);
      if (!job) return;

      visited.add(jobName);

      // Visit dependencies first
      if (job.needs) {
        job.needs.forEach(dependency => visit(dependency));
      }

      result.push(job);
    };

    jobs.forEach(job => visit(job.name));
    return result;
  }

  /**
   * Generates workflow YAML content
   */
  generateWorkflowYAML(workflow: WorkflowConfig): string {
    const yaml = [
      `name: ${workflow.name}`,
      '',
      'on:',
      ...this.generateTriggersYAML(workflow.triggers || []),
      '',
      'jobs:'
    ];

    workflow.jobs.forEach(job => {
      yaml.push(`  ${job.name}:`);
      yaml.push(`    runs-on: ${job.runsOn}`);
      
      if (job.needs && job.needs.length > 0) {
        yaml.push(`    needs: [${job.needs.join(', ')}]`);
      }

      yaml.push('    steps:');
      job.steps.forEach((step, index) => {
        yaml.push(`      - name: Step ${index + 1}`);
        yaml.push(`        run: ${step}`);
      });
      yaml.push('');
    });

    return yaml.join('\n');
  }

  /**
   * Generates triggers YAML section
   */
  private generateTriggersYAML(triggers: string[]): string[] {
    const yaml: string[] = [];
    
    triggers.forEach(trigger => {
      if (trigger === 'workflow_dispatch') {
        yaml.push('  workflow_dispatch:');
      } else if (trigger.startsWith('push:')) {
        yaml.push('  push:');
        const branches = trigger.split(':')[1];
        if (branches) {
          yaml.push(`    branches: [${branches}]`);
        }
      } else if (trigger.startsWith('pull_request:')) {
        yaml.push('  pull_request:');
        const branches = trigger.split(':')[1];
        if (branches) {
          yaml.push(`    branches: [${branches}]`);
        }
      } else {
        yaml.push(`  ${trigger}:`);
      }
    });

    return yaml;
  }
}