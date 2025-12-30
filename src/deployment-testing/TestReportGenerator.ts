// Comprehensive Test Reporting System

import { TestResult, DeploymentConfig, ValidationResult } from './types';

export interface TestReport {
  id: string;
  timestamp: Date;
  environment: string;
  summary: TestSummary;
  results: TestResult[];
  deploymentConfig: DeploymentConfig;
  recommendations: string[];
  artifacts: ReportArtifact[];
  metadata: ReportMetadata;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  successRate: number;
}

export interface ReportArtifact {
  name: string;
  type: 'log' | 'screenshot' | 'file' | 'json' | 'xml';
  path: string;
  size: number;
  description: string;
}

export interface ReportMetadata {
  version: string;
  generatedBy: string;
  branch: string;
  commit?: string;
  buildNumber?: string;
  tags: string[];
}

export interface RemediationStep {
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'configuration' | 'infrastructure' | 'security' | 'performance';
  description: string;
  steps: string[];
  estimatedTime: string;
  resources: string[];
}

export class TestReportGenerator {
  private deploymentConfig: DeploymentConfig;

  constructor(deploymentConfig: DeploymentConfig) {
    this.deploymentConfig = deploymentConfig;
  }

  /**
   * Generates comprehensive test report
   * Requirements: 1.3, 1.5 - Comprehensive Test Reporting
   */
  generateReport(reportId: string, testResults: TestResult[]): TestReport {
    const timestamp = new Date();
    const summary = this.calculateSummary(testResults);
    const recommendations = this.generateRecommendations(testResults, summary);
    const artifacts = this.collectArtifacts(testResults);
    const metadata = this.generateMetadata();

    return {
      id: reportId,
      timestamp,
      environment: this.deploymentConfig.environment,
      summary,
      results: testResults,
      deploymentConfig: this.deploymentConfig,
      recommendations,
      artifacts,
      metadata
    };
  }

  /**
   * Calculates test summary statistics
   */
  private calculateSummary(testResults: TestResult[]): TestSummary {
    const total = testResults.length;
    const passed = testResults.filter(r => r.status === 'passed').length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    const skipped = testResults.filter(r => r.status === 'skipped').length;
    const duration = testResults.reduce((sum, r) => sum + r.duration, 0);
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return {
      total,
      passed,
      failed,
      skipped,
      duration,
      successRate
    };
  }

  /**
   * Generates actionable recommendations based on test results
   */
  private generateRecommendations(testResults: TestResult[], summary: TestSummary): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (summary.duration > 600000) { // 10 minutes
      recommendations.push('Consider optimizing test execution time - current duration exceeds 10 minutes');
    }

    // Success rate recommendations
    if (summary.successRate < 80) {
      recommendations.push('Test success rate is below 80% - review and fix failing tests before deployment');
    } else if (summary.successRate === 100 && summary.total > 0) {
      recommendations.push('All tests passed successfully - deployment is ready to proceed');
    }

    // Skipped tests recommendations
    if (summary.skipped > 0) {
      recommendations.push(`${summary.skipped} test(s) were skipped - ensure all tests are executed for complete coverage`);
    }

    // Failed tests recommendations
    if (summary.failed > 0) {
      const failedTests = testResults.filter(r => r.status === 'failed');
      recommendations.push(`${summary.failed} test(s) failed - review: ${failedTests.map(t => t.testName).join(', ')}`);
    }

    // Environment-specific recommendations
    if (this.deploymentConfig.environment === 'production') {
      recommendations.push('Production deployment detected - ensure all security and performance tests pass');
    }

    // Coverage recommendations
    const hasSecurityTests = testResults.some(r => r.testName.toLowerCase().includes('security'));
    const hasPerformanceTests = testResults.some(r => r.testName.toLowerCase().includes('performance'));
    
    if (!hasSecurityTests) {
      recommendations.push('Consider adding security tests to the test suite');
    }
    
    if (!hasPerformanceTests) {
      recommendations.push('Consider adding performance tests to validate deployment speed');
    }

    return recommendations;
  }

  /**
   * Collects test artifacts
   */
  private collectArtifacts(testResults: TestResult[]): ReportArtifact[] {
    const artifacts: ReportArtifact[] = [];

    testResults.forEach(result => {
      result.artifacts?.forEach(artifactPath => {
        artifacts.push({
          name: this.extractFileName(artifactPath),
          type: this.determineArtifactType(artifactPath),
          path: artifactPath,
          size: 0, // Would be calculated in real implementation
          description: `Artifact from ${result.testName}`
        });
      });
    });

    // Add standard report artifacts
    artifacts.push({
      name: 'test-report.json',
      type: 'json',
      path: `reports/${this.deploymentConfig.environment}/test-report.json`,
      size: 0,
      description: 'Complete test report in JSON format'
    });

    artifacts.push({
      name: 'test-summary.html',
      type: 'file',
      path: `reports/${this.deploymentConfig.environment}/test-summary.html`,
      size: 0,
      description: 'HTML test report for browser viewing'
    });

    return artifacts;
  }

  /**
   * Generates report metadata
   */
  private generateMetadata(): ReportMetadata {
    return {
      version: '1.0.0',
      generatedBy: 'Deployment Testing Framework',
      branch: this.deploymentConfig.branch,
      commit: process.env.GITHUB_SHA,
      buildNumber: process.env.GITHUB_RUN_NUMBER,
      tags: [
        this.deploymentConfig.environment,
        'automated',
        'deployment-test'
      ]
    };
  }

  /**
   * Generates detailed remediation steps for failed tests
   */
  generateRemediationSteps(testResults: TestResult[]): RemediationStep[] {
    const remediationSteps: RemediationStep[] = [];
    const failedTests = testResults.filter(r => r.status === 'failed');

    failedTests.forEach(test => {
      const remediation = this.createRemediationStep(test);
      if (remediation) {
        remediationSteps.push(remediation);
      }
    });

    return remediationSteps;
  }

  /**
   * Creates remediation step for a failed test
   */
  private createRemediationStep(test: TestResult): RemediationStep | null {
    const testName = test.testName.toLowerCase();
    
    if (testName.includes('configuration')) {
      return {
        issue: `Configuration validation failed: ${test.testName}`,
        severity: 'high',
        category: 'configuration',
        description: 'Deployment configuration has validation errors that must be fixed',
        steps: [
          'Review the deployment configuration file',
          'Check for missing required fields',
          'Validate environment-specific settings',
          'Run configuration validation again'
        ],
        estimatedTime: '15-30 minutes',
        resources: [
          'Deployment configuration documentation',
          'Environment setup guide'
        ]
      };
    }

    if (testName.includes('build')) {
      return {
        issue: `Build process failed: ${test.testName}`,
        severity: 'critical',
        category: 'infrastructure',
        description: 'Application build failed, preventing deployment',
        steps: [
          'Check build logs for specific error messages',
          'Verify all dependencies are installed',
          'Check for syntax errors in source code',
          'Ensure build environment matches requirements',
          'Run build locally to reproduce the issue'
        ],
        estimatedTime: '30-60 minutes',
        resources: [
          'Build configuration documentation',
          'Troubleshooting guide',
          'Development environment setup'
        ]
      };
    }

    if (testName.includes('security')) {
      return {
        issue: `Security test failed: ${test.testName}`,
        severity: 'critical',
        category: 'security',
        description: 'Security vulnerability detected that must be addressed',
        steps: [
          'Review security scan results',
          'Update vulnerable dependencies',
          'Apply security patches',
          'Review code for security issues',
          'Re-run security tests'
        ],
        estimatedTime: '1-4 hours',
        resources: [
          'Security best practices guide',
          'Vulnerability database',
          'Security team contact'
        ]
      };
    }

    if (testName.includes('performance')) {
      return {
        issue: `Performance test failed: ${test.testName}`,
        severity: 'medium',
        category: 'performance',
        description: 'Performance requirements not met',
        steps: [
          'Analyze performance metrics',
          'Identify performance bottlenecks',
          'Optimize slow operations',
          'Review resource usage',
          'Re-run performance tests'
        ],
        estimatedTime: '2-6 hours',
        resources: [
          'Performance optimization guide',
          'Monitoring dashboard',
          'Performance team contact'
        ]
      };
    }

    // Generic remediation for unknown test types
    return {
      issue: `Test failed: ${test.testName}`,
      severity: 'medium',
      category: 'infrastructure',
      description: 'Test failure requires investigation',
      steps: [
        'Review test logs and error messages',
        'Check test environment setup',
        'Verify test data and dependencies',
        'Run test in isolation to debug',
        'Contact development team if needed'
      ],
      estimatedTime: '30-90 minutes',
      resources: [
        'Test documentation',
        'Development team contact'
      ]
    };
  }

  /**
   * Exports report to various formats
   */
  exportReport(report: TestReport, format: 'json' | 'html' | 'xml' | 'csv'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'html':
        return this.generateHTMLReport(report);
      
      case 'xml':
        return this.generateXMLReport(report);
      
      case 'csv':
        return this.generateCSVReport(report);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generates HTML report
   */
  private generateHTMLReport(report: TestReport): string {
    const successRate = report.summary.successRate.toFixed(1);
    const statusColor = report.summary.successRate >= 80 ? 'green' : 
                       report.summary.successRate >= 60 ? 'orange' : 'red';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Deployment Test Report - ${report.environment}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success-rate { color: ${statusColor}; font-weight: bold; font-size: 24px; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: green; }
        .failed { border-left-color: red; }
        .skipped { border-left-color: orange; }
        .recommendations { background: #e8f4fd; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Deployment Test Report</h1>
        <p><strong>Environment:</strong> ${report.environment}</p>
        <p><strong>Generated:</strong> ${report.timestamp.toISOString()}</p>
        <p><strong>Report ID:</strong> ${report.id}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="success-rate">${successRate}%</div>
        </div>
        <div class="metric">
            <h3>Total Tests</h3>
            <div>${report.summary.total}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div style="color: green;">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div style="color: red;">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <div>${Math.round(report.summary.duration / 1000)}s</div>
        </div>
    </div>

    <h2>Test Results</h2>
    ${report.results.map(result => `
        <div class="test-result ${result.status}">
            <h4>${result.testName} - ${result.status.toUpperCase()}</h4>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            <p><strong>Environment:</strong> ${result.environment}</p>
            ${result.details.length > 0 ? `<p><strong>Details:</strong> ${result.details.join(', ')}</p>` : ''}
        </div>
    `).join('')}

    ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Generates XML report
   */
  private generateXMLReport(report: TestReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<testReport>
    <id>${report.id}</id>
    <timestamp>${report.timestamp.toISOString()}</timestamp>
    <environment>${report.environment}</environment>
    <summary>
        <total>${report.summary.total}</total>
        <passed>${report.summary.passed}</passed>
        <failed>${report.summary.failed}</failed>
        <skipped>${report.summary.skipped}</skipped>
        <duration>${report.summary.duration}</duration>
        <successRate>${report.summary.successRate}</successRate>
    </summary>
    <results>
        ${report.results.map(result => `
        <test>
            <id>${result.testId}</id>
            <name>${result.testName}</name>
            <status>${result.status}</status>
            <duration>${result.duration}</duration>
            <environment>${result.environment}</environment>
        </test>`).join('')}
    </results>
</testReport>`;
  }

  /**
   * Generates CSV report
   */
  private generateCSVReport(report: TestReport): string {
    const headers = 'Test ID,Test Name,Status,Duration (ms),Environment,Details';
    const rows = report.results.map(result => 
      `${result.testId},"${result.testName}",${result.status},${result.duration},${result.environment},"${result.details.join('; ')}"`
    );
    
    return [headers, ...rows].join('\n');
  }

  /**
   * Helper methods
   */
  private extractFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  private determineArtifactType(path: string): ReportArtifact['type'] {
    const extension = path.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'json': return 'json';
      case 'xml': return 'xml';
      case 'log': case 'txt': return 'log';
      case 'png': case 'jpg': case 'jpeg': return 'screenshot';
      default: return 'file';
    }
  }
}