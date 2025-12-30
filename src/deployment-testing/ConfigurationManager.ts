// Configuration Manager for Deployment Testing

import { DeploymentConfig, SecretConfig, VariableConfig } from './types';

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configs: Map<string, DeploymentConfig> = new Map();

  private constructor() {
    this.initializeDefaultConfigs();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Initialize default deployment configurations
   */
  private initializeDefaultConfigs(): void {
    // Test environment configuration
    const testConfig: DeploymentConfig = {
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
          description: 'Cloudflare API token for deployment'
        },
        {
          name: 'CLOUDFLARE_ACCOUNT_ID',
          required: true,
          description: 'Cloudflare account ID'
        },
        {
          name: 'TEST_PRIVATE_KEY',
          required: false,
          description: 'Private key for test network interactions'
        },
        {
          name: 'TEST_JBC_CONTRACT_ADDRESS',
          required: false,
          description: 'JBC contract address for test environment'
        },
        {
          name: 'TEST_PROTOCOL_CONTRACT_ADDRESS',
          required: false,
          description: 'Protocol contract address for test environment'
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
        },
        {
          name: 'BUILD_COMMAND',
          value: 'npm run build',
          environment: 'test'
        }
      ]
    };

    // Staging environment configuration
    const stagingConfig: DeploymentConfig = {
      id: 'staging-env',
      name: 'Staging Environment',
      environment: 'staging',
      branch: 'staging',
      cloudflareProject: 'jinbao-staging',
      healthCheckUrl: 'https://jinbao-staging.pages.dev',
      secrets: [
        {
          name: 'CLOUDFLARE_API_TOKEN',
          required: true,
          description: 'Cloudflare API token for deployment'
        },
        {
          name: 'CLOUDFLARE_ACCOUNT_ID',
          required: true,
          description: 'Cloudflare account ID'
        },
        {
          name: 'STAGING_PRIVATE_KEY',
          required: false,
          description: 'Private key for staging network interactions'
        }
      ],
      variables: [
        {
          name: 'ENVIRONMENT',
          value: 'staging',
          environment: 'staging'
        },
        {
          name: 'NODE_VERSION',
          value: '18',
          environment: 'staging'
        }
      ]
    };

    // Production environment configuration
    const prodConfig: DeploymentConfig = {
      id: 'prod-env',
      name: 'Production Environment',
      environment: 'production',
      branch: 'prod',
      cloudflareProject: 'jinbao-protocol-prod',
      healthCheckUrl: 'https://jinbao-protocol-prod.pages.dev',
      secrets: [
        {
          name: 'CLOUDFLARE_API_TOKEN',
          required: true,
          description: 'Cloudflare API token for deployment'
        },
        {
          name: 'CLOUDFLARE_ACCOUNT_ID',
          required: true,
          description: 'Cloudflare account ID'
        },
        {
          name: 'PROD_PRIVATE_KEY',
          required: true,
          description: 'Private key for production network interactions'
        },
        {
          name: 'PROD_JBC_CONTRACT_ADDRESS',
          required: true,
          description: 'JBC contract address for production'
        },
        {
          name: 'PROD_PROTOCOL_CONTRACT_ADDRESS',
          required: true,
          description: 'Protocol contract address for production'
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
        }
      ]
    };

    this.configs.set(testConfig.id, testConfig);
    this.configs.set(stagingConfig.id, stagingConfig);
    this.configs.set(prodConfig.id, prodConfig);
  }

  /**
   * Get configuration by environment
   */
  getConfigByEnvironment(environment: string): DeploymentConfig | undefined {
    return Array.from(this.configs.values()).find(config => config.environment === environment);
  }

  /**
   * Get configuration by ID
   */
  getConfig(id: string): DeploymentConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): DeploymentConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Add or update configuration
   */
  setConfig(config: DeploymentConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Get required secrets for an environment
   */
  getRequiredSecrets(environment: string): SecretConfig[] {
    const config = this.getConfigByEnvironment(environment);
    return config ? config.secrets.filter(secret => secret.required) : [];
  }

  /**
   * Get environment variables for an environment
   */
  getEnvironmentVariables(environment: string): VariableConfig[] {
    const config = this.getConfigByEnvironment(environment);
    return config ? config.variables : [];
  }

  /**
   * Validate that all required secrets are available
   */
  validateSecrets(environment: string, availableSecrets: string[]): {
    valid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const requiredSecrets = this.getRequiredSecrets(environment);
    const missing: string[] = [];
    const warnings: string[] = [];

    requiredSecrets.forEach(secret => {
      if (!availableSecrets.includes(secret.name)) {
        missing.push(secret.name);
      }
    });

    const config = this.getConfigByEnvironment(environment);
    if (config) {
      const optionalSecrets = config.secrets.filter(s => !s.required);
      optionalSecrets.forEach(secret => {
        if (!availableSecrets.includes(secret.name)) {
          warnings.push(`Optional secret '${secret.name}' not configured: ${secret.description}`);
        }
      });
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    };
  }

  /**
   * Generate GitHub Actions environment configuration
   */
  generateGitHubActionsConfig(environment: string): {
    secrets: string[];
    variables: Record<string, string>;
  } {
    const config = this.getConfigByEnvironment(environment);
    if (!config) {
      throw new Error(`Configuration not found for environment: ${environment}`);
    }

    const secrets = config.secrets.map(secret => secret.name);
    const variables: Record<string, string> = {};

    config.variables.forEach(variable => {
      variables[variable.name] = variable.value;
    });

    return { secrets, variables };
  }
}