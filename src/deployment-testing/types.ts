// Deployment Testing Framework Types

export interface DeploymentConfig {
  id: string;
  name: string;
  environment: 'test' | 'staging' | 'preview' | 'production';
  branch: string;
  cloudflareProject: string;
  healthCheckUrl?: string;
  secrets: SecretConfig[];
  variables: VariableConfig[];
}

export interface SecretConfig {
  name: string;
  required: boolean;
  description: string;
}

export interface VariableConfig {
  name: string;
  value: string;
  environment: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  recommendations: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  environment: string;
  details: TestDetail[];
  artifacts: string[];
}

export interface TestDetail {
  step: string;
  status: 'passed' | 'failed';
  message?: string;
  data?: any;
}

export interface DeploymentStatus {
  id: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed';
  startTime: Date;
  endTime?: Date;
  url?: string;
  logs: string[];
  healthCheck?: HealthStatus;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
  details: HealthDetail[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
}

export interface HealthDetail {
  check: string;
  status: 'passed' | 'failed';
  message?: string;
  value?: any;
}

export interface MonitoringData {
  deploymentId: string;
  timestamp: Date;
  stage: DeploymentStage;
  status: DeploymentStatus['status'];
  metrics: Metric[];
  logs: LogEntry[];
  alerts: Alert[];
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'deployment_failed' | 'health_check_failed' | 'performance_degraded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export type DeploymentStage = 
  | 'validation'
  | 'building' 
  | 'testing'
  | 'deploying'
  | 'health_check'
  | 'completed'
  | 'failed';

export interface WorkflowConfig {
  name: string;
  path: string;
  triggers: TriggerConfig[];
  jobs: JobConfig[];
  dependencies: string[];
}

export interface TriggerConfig {
  type: 'push' | 'pull_request' | 'workflow_dispatch' | 'schedule';
  branches?: string[];
  paths?: string[];
  schedule?: string;
}

export interface JobConfig {
  name: string;
  runsOn: string;
  steps: StepConfig[];
  needs?: string[];
  if?: string;
}

export interface StepConfig {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
}