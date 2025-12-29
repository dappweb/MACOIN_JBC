# Requirements Document

## Introduction

Fix Cloudflare Pages deployment configuration error caused by unsupported environment names in wrangler.toml files. The current configuration uses "staging" and "development" environments which are not supported by Cloudflare Pages, causing deployment failures.

## Glossary

- **Cloudflare_Pages**: Cloudflare's static site hosting service with serverless functions support
- **Wrangler**: Cloudflare's command-line tool for managing Workers and Pages projects
- **Environment_Configuration**: Named environment settings in wrangler.toml for different deployment stages
- **Pages_Project**: A Cloudflare Pages project deployment
- **Named_Environment**: Specific environment configurations (production, preview) supported by Pages

## Requirements

### Requirement 1: Fix Environment Configuration

**User Story:** As a developer, I want to deploy the Jinbao Protocol to Cloudflare Pages, so that the application is accessible to users without configuration errors.

#### Acceptance Criteria

1. WHEN deploying to Cloudflare Pages, THE Wrangler_Configuration SHALL use only supported environment names
2. THE Wrangler_Configuration SHALL replace "staging" environment with "preview" environment
3. THE Wrangler_Configuration SHALL remove "development" environment configuration
4. THE Pages_Project SHALL maintain all necessary environment variables for each supported environment
5. WHEN environment variables are migrated, THE Pages_Project SHALL preserve all functional settings

### Requirement 2: Maintain Environment Variable Consistency

**User Story:** As a system administrator, I want environment-specific configurations to work correctly, so that different deployment stages have appropriate settings.

#### Acceptance Criteria

1. THE Preview_Environment SHALL contain testing-appropriate values for burn amounts and thresholds
2. THE Production_Environment SHALL contain production-ready values for all configuration variables
3. WHEN migrating from staging to preview, THE Environment_Variables SHALL maintain equivalent functionality
4. THE Configuration_Files SHALL include clear documentation for environment variable setup
5. THE Sensitive_Variables SHALL continue to be managed through Cloudflare Pages dashboard

### Requirement 3: Preserve Deployment Functionality

**User Story:** As a DevOps engineer, I want the deployment process to work seamlessly, so that automated deployments continue functioning after the configuration fix.

#### Acceptance Criteria

1. THE Build_Configuration SHALL remain compatible with the existing Vite build process
2. THE Pages_Build_Output_Dir SHALL continue pointing to the correct "dist" directory
3. WHEN the configuration is updated, THE Existing_Secrets SHALL remain accessible
4. THE Compatibility_Flags SHALL be preserved to maintain Node.js compatibility
5. THE Deployment_Scripts SHALL work without modification after configuration changes

### Requirement 4: Update Configuration Documentation

**User Story:** As a team member, I want clear documentation on the new configuration, so that I can understand and maintain the deployment setup.

#### Acceptance Criteria

1. THE Configuration_Files SHALL include updated comments explaining the environment changes
2. THE Documentation SHALL provide clear instructions for setting up secrets in both environments
3. WHEN new team members join, THE Setup_Instructions SHALL be sufficient for independent configuration
4. THE Migration_Notes SHALL explain the changes made from the old configuration
5. THE Troubleshooting_Guide SHALL include common deployment issues and solutions