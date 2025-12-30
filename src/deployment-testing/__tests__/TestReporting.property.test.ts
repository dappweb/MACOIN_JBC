// Property Test 3: Comprehensive Test Reporting
// Validates: Requirements 1.5

import { TestReportGenerator } from '../TestReportGenerator';
import { DeploymentConfig, TestResult } from '../types';

describe('Property Test 3: Comprehensive Test Reporting', () => {
  let generator: TestReportGenerator;
  let deploymentConfig: DeploymentConfig;

  beforeEach(() => {
    deploymentConfig = createTestDeploymentConfig();
    generator = new TestReportGenerator(deploymentConfig);
  });

  /**
   * Property 3: Comprehensive Test Reporting
   * Test reports should:
   * 1. Always include complete summary statistics
   * 2. Provide actionable recommendations based on results
   * 3. Include all test results with proper status
   * 4. Generate artifacts for different output formats
   * 5. Include metadata for traceability
   * 6. Provide remediation steps for failures
   * 7. Handle edge cases gracefully
   */

  test('Property 3.1: Report structure is always complete', () => {
    const testCases = [
      [], // Empty results
      [createPassedTest()], // Single passed test
      [createFailedTest()], // Single failed test
      [createPassedTest(), createFailedTest(), createSkippedTest()], // Mixed results
      Array.from({ length: 100 }, (_, i) => createPassedTest(`test-${i}`)) // Many tests
    ];

    testCases.forEach((testResults, index) => {
      const report = generator.generateReport(`test-${index}`, testResults);
      
      // Property: Report structure is always complete
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('deploymentConfig');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('artifacts');
      expect(report).toHaveProperty('metadata');

      // Property: Summary statistics are accurate
      expect(report.summary.total).toBe(testResults.length);
      expect(report.summary.passed + report.summary.failed + report.summary.skipped).toBe(testResults.length);
      
      const expectedPassed = testResults.filter(r => r.status === 'passed').length;
      const expectedFailed = testResults.filter(r => r.status === 'failed').length;
      const expectedSkipped = testResults.filter(r => r.status === 'skipped').length;
      
      expect(report.summary.passed).toBe(expectedPassed);
      expect(report.summary.failed).toBe(expectedFailed);
      expect(report.summary.skipped).toBe(expectedSkipped);
    });
  });

  test('Property 3.2: Success rate calculation is accurate', () => {
    const testCases = [
      { results: [], expectedRate: 0 },
      { results: [createPassedTest()], expectedRate: 100 },
      { results: [createFailedTest()], expectedRate: 0 },
      { results: [createPassedTest(), createFailedTest()], expectedRate: 50 },
      { results: [createPassedTest(), createPassedTest(), createFailedTest()], expectedRate: 66.67 },
      { results: [createSkippedTest()], expectedRate: 0 }
    ];

    testCases.forEach(({ results, expectedRate }, index) => {
      const report = generator.generateReport(`rate-test-${index}`, results);
      
      // Property: Success rate should be calculated correctly
      expect(report.summary.successRate).toBeCloseTo(expectedRate, 1);
      expect(report.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.successRate).toBeLessThanOrEqual(100);
    });
  });

  test('Property 3.3: Recommendations are contextual and actionable', () => {
    // Test with all passed tests
    const allPassedResults = [createPassedTest(), createPassedTest()];
    const allPassedReport = generator.generateReport('all-passed', allPassedResults);
    
    // Property: All passed tests should generate positive recommendation
    expect(allPassedReport.recommendations.some(rec => 
      rec.includes('All tests passed') || rec.includes('ready to proceed')
    )).toBe(true);

    // Test with failed tests
    const failedResults = [createPassedTest(), createFailedTest()];
    const failedReport = generator.generateReport('with-failures', failedResults);
    
    // Property: Failed tests should generate failure-specific recommendations
    expect(failedReport.recommendations.some(rec => 
      rec.includes('failed') || rec.includes('review')
    )).toBe(true);

    // Test with skipped tests
    const skippedResults = [createPassedTest(), createSkippedTest()];
    const skippedReport = generator.generateReport('with-skipped', skippedResults);
    
    // Property: Skipped tests should generate coverage recommendations
    expect(skippedReport.recommendations.some(rec => 
      rec.includes('skipped') || rec.includes('coverage')
    )).toBe(true);

    // Test with long duration
    const longDurationResults = [createLongRunningTest()];
    const longDurationReport = generator.generateReport('long-duration', longDurationResults);
    
    // Property: Long duration should generate performance recommendations
    expect(longDurationReport.recommendations.some(rec => 
      rec.includes('optimizing') || rec.includes('duration') || rec.includes('time')
    )).toBe(true);
  });

  test('Property 3.4: Artifacts are properly collected and categorized', () => {
    const testWithArtifacts = createTestWithArtifacts();
    const report = generator.generateReport('artifacts-test', [testWithArtifacts]);
    
    // Property: Artifacts should be collected from test results
    expect(report.artifacts.length).toBeGreaterThan(0);
    
    // Property: Each artifact should have required properties
    report.artifacts.forEach(artifact => {
      expect(artifact).toHaveProperty('name');
      expect(artifact).toHaveProperty('type');
      expect(artifact).toHaveProperty('path');
      expect(artifact).toHaveProperty('size');
      expect(artifact).toHaveProperty('description');
      
      expect(typeof artifact.name).toBe('string');
      expect(['log', 'screenshot', 'file', 'json', 'xml'].includes(artifact.type)).toBe(true);
      expect(typeof artifact.path).toBe('string');
      expect(typeof artifact.size).toBe('number');
      expect(typeof artifact.description).toBe('string');
    });

    // Property: Standard report artifacts should always be included
    const hasJsonReport = report.artifacts.some(a => a.name === 'test-report.json');
    const hasHtmlReport = report.artifacts.some(a => a.name === 'test-summary.html');
    expect(hasJsonReport).toBe(true);
    expect(hasHtmlReport).toBe(true);
  });

  test('Property 3.5: Metadata provides complete traceability', () => {
    const report = generator.generateReport('metadata-test', [createPassedTest()]);
    
    // Property: Metadata should include all required fields
    expect(report.metadata).toHaveProperty('version');
    expect(report.metadata).toHaveProperty('generatedBy');
    expect(report.metadata).toHaveProperty('branch');
    expect(report.metadata).toHaveProperty('tags');
    
    expect(typeof report.metadata.version).toBe('string');
    expect(typeof report.metadata.generatedBy).toBe('string');
    expect(typeof report.metadata.branch).toBe('string');
    expect(Array.isArray(report.metadata.tags)).toBe(true);
    
    // Property: Tags should include environment
    expect(report.metadata.tags.includes(deploymentConfig.environment)).toBe(true);
  });

  test('Property 3.6: Remediation steps are generated for failures', () => {
    const failedTests = [
      createFailedTest('Configuration Validation'),
      createFailedTest('Build Process'),
      createFailedTest('Security Scan'),
      createFailedTest('Performance Test'),
      createFailedTest('Unknown Test Type')
    ];

    const remediationSteps = generator.generateRemediationSteps(failedTests);
    
    // Property: Remediation steps should be generated for each failed test
    expect(remediationSteps.length).toBe(failedTests.length);
    
    // Property: Each remediation step should have required properties
    remediationSteps.forEach(step => {
      expect(step).toHaveProperty('issue');
      expect(step).toHaveProperty('severity');
      expect(step).toHaveProperty('category');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('steps');
      expect(step).toHaveProperty('estimatedTime');
      expect(step).toHaveProperty('resources');
      
      expect(typeof step.issue).toBe('string');
      expect(['low', 'medium', 'high', 'critical'].includes(step.severity)).toBe(true);
      expect(['configuration', 'infrastructure', 'security', 'performance'].includes(step.category)).toBe(true);
      expect(typeof step.description).toBe('string');
      expect(Array.isArray(step.steps)).toBe(true);
      expect(step.steps.length).toBeGreaterThan(0);
      expect(typeof step.estimatedTime).toBe('string');
      expect(Array.isArray(step.resources)).toBe(true);
    });
  });

  test('Property 3.7: Export formats are valid and complete', () => {
    const testResults = [createPassedTest(), createFailedTest()];
    const report = generator.generateReport('export-test', testResults);
    
    // Test JSON export
    const jsonExport = generator.exportReport(report, 'json');
    expect(() => JSON.parse(jsonExport)).not.toThrow();
    const parsedJson = JSON.parse(jsonExport);
    expect(parsedJson.id).toBe(report.id);
    expect(parsedJson.summary.total).toBe(report.summary.total);

    // Test HTML export
    const htmlExport = generator.exportReport(report, 'html');
    expect(htmlExport).toContain('<!DOCTYPE html>');
    expect(htmlExport).toContain(report.environment);
    expect(htmlExport).toContain(report.summary.total.toString());

    // Test XML export
    const xmlExport = generator.exportReport(report, 'xml');
    expect(xmlExport).toContain('<?xml version="1.0"');
    expect(xmlExport).toContain('<testReport>');
    expect(xmlExport).toContain('</testReport>');

    // Test CSV export
    const csvExport = generator.exportReport(report, 'csv');
    const lines = csvExport.split('\n');
    expect(lines[0]).toContain('Test ID,Test Name,Status');
    expect(lines.length).toBe(testResults.length + 1); // Header + data rows
  });

  test('Property 3.8: Report generation is deterministic', () => {
    const testResults = [createPassedTest(), createFailedTest()];
    
    // Generate multiple reports with same input
    const reports = Array.from({ length: 3 }, (_, i) => 
      generator.generateReport('deterministic-test', testResults)
    );

    // Property: Same inputs should produce consistent results (except timestamp)
    const firstReport = reports[0];
    reports.slice(1).forEach(report => {
      expect(report.summary).toEqual(firstReport.summary);
      expect(report.results).toEqual(firstReport.results);
      expect(report.deploymentConfig).toEqual(firstReport.deploymentConfig);
      expect(report.metadata.version).toBe(firstReport.metadata.version);
      expect(report.metadata.branch).toBe(firstReport.metadata.branch);
    });
  });

  // Helper functions
  function createTestDeploymentConfig(): DeploymentConfig {
    return {
      id: 'test-config',
      name: 'Test Configuration',
      environment: 'test',
      branch: 'test-branch',
      cloudflareProject: 'test-project',
      healthCheckUrl: 'https://test.example.com',
      secrets: [],
      variables: []
    };
  }

  function createPassedTest(name: string = 'Passed Test'): TestResult {
    return {
      testId: `test-${Date.now()}-${Math.random()}`,
      testName: name,
      status: 'passed',
      duration: 1000,
      environment: 'test',
      details: ['Test completed successfully'],
      artifacts: []
    };
  }

  function createFailedTest(name: string = 'Failed Test'): TestResult {
    return {
      testId: `test-${Date.now()}-${Math.random()}`,
      testName: name,
      status: 'failed',
      duration: 2000,
      environment: 'test',
      details: ['Test failed with error'],
      artifacts: ['error-log.txt']
    };
  }

  function createSkippedTest(name: string = 'Skipped Test'): TestResult {
    return {
      testId: `test-${Date.now()}-${Math.random()}`,
      testName: name,
      status: 'skipped',
      duration: 0,
      environment: 'test',
      details: ['Test was skipped'],
      artifacts: []
    };
  }

  function createLongRunningTest(): TestResult {
    return {
      testId: `long-test-${Date.now()}`,
      testName: 'Long Running Test',
      status: 'passed',
      duration: 700000, // 11+ minutes
      environment: 'test',
      details: ['Long running test completed'],
      artifacts: []
    };
  }

  function createTestWithArtifacts(): TestResult {
    return {
      testId: `artifact-test-${Date.now()}`,
      testName: 'Test with Artifacts',
      status: 'passed',
      duration: 3000,
      environment: 'test',
      details: ['Test generated artifacts'],
      artifacts: [
        'build-output.log',
        'test-results.json',
        'coverage-report.xml',
        'screenshot.png'
      ]
    };
  }
});