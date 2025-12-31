# Requirements Document

## Introduction

This specification addresses the issue where user `0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82` is not seeing dynamic rewards (动态奖励) displayed in their interface. The system currently filters out dynamic rewards (rewardType === 1) from the earnings display, but users should be able to see their differential rewards through the DifferentialRewardStatus component.

## Glossary

- **Dynamic_Rewards**: Legacy reward type (rewardType === 1) that has been deprecated in favor of differential rewards
- **Differential_Rewards**: Current reward mechanism based on team building and V-level progression
- **Reward_Type**: Numeric identifier for different reward categories (0=static, 1=dynamic, 2=direct, 3=level)
- **User_Interface**: The frontend components that display reward information to users
- **DifferentialRewardStatus_Component**: React component responsible for displaying differential reward information

## Requirements

### Requirement 1: Dynamic Rewards Display Investigation

**User Story:** As a user, I want to understand why my dynamic rewards are not displaying, so that I can see all my earned rewards properly.

#### Acceptance Criteria

1. WHEN investigating user `0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82`, THE System SHALL identify the root cause of missing dynamic rewards display
2. WHEN checking the user's reward history, THE System SHALL determine if they have any dynamic reward records in the blockchain
3. WHEN analyzing the frontend filtering logic, THE System SHALL verify if dynamic rewards are being properly excluded or incorrectly filtered
4. THE System SHALL distinguish between legacy dynamic rewards (rewardType === 1) and current differential rewards
5. WHEN examining the DifferentialRewardStatus component, THE System SHALL verify it is loading and displaying correctly for this user

### Requirement 2: User-Specific Diagnostic Analysis

**User Story:** As a technical administrator, I want to perform comprehensive diagnostics on this specific user's account, so that I can identify any account-specific issues affecting reward display.

#### Acceptance Criteria

1. WHEN running diagnostics on user `0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82`, THE System SHALL check their V-level status and team count
2. WHEN querying blockchain events, THE System SHALL search for DifferentialRewardReleased events for this user
3. WHEN checking contract state, THE System SHALL verify the user's level information and reward eligibility
4. THE System SHALL identify any network connectivity or contract access issues affecting this user
5. WHEN analyzing recent transactions, THE System SHALL determine if the user has performed actions that should generate differential rewards

### Requirement 3: Differential Rewards Component Verification

**User Story:** As a user, I want the differential rewards component to load and display my reward information correctly, so that I can track my team-based earnings.

#### Acceptance Criteria

1. WHEN the DifferentialRewardStatus component loads for this user, THE System SHALL successfully fetch their V-level information
2. WHEN querying differential reward events, THE System SHALL handle network timeouts and errors gracefully
3. WHEN displaying recent rewards, THE System SHALL show the most recent differential reward transactions
4. THE System SHALL display accurate team count and level progression information
5. WHEN no differential rewards exist, THE System SHALL show an appropriate message explaining the reward mechanism

### Requirement 4: Frontend Error Handling Enhancement

**User Story:** As a user, I want clear error messages when reward components fail to load, so that I understand what is happening with my account.

#### Acceptance Criteria

1. WHEN the DifferentialRewardStatus component encounters errors, THE System SHALL display specific error messages
2. WHEN network connectivity is poor, THE System SHALL show loading states with timeout handling
3. WHEN contract queries fail, THE System SHALL provide actionable error messages to the user
4. THE System SHALL log detailed error information for debugging purposes
5. WHEN retrying failed operations, THE System SHALL provide manual refresh options

### Requirement 5: Dynamic vs Differential Rewards Clarification

**User Story:** As a user, I want to understand the difference between dynamic rewards and differential rewards, so that I know what rewards I should expect to see.

#### Acceptance Criteria

1. THE System SHALL clearly document that dynamic rewards (rewardType === 1) are deprecated
2. THE System SHALL explain that differential rewards are the current reward mechanism
3. WHEN users ask about missing dynamic rewards, THE System SHALL direct them to the differential rewards section
4. THE System SHALL provide clear labeling to distinguish between different reward types
5. THE System SHALL ensure consistent terminology across all user interfaces

### Requirement 6: User Account Recovery and Fix

**User Story:** As the affected user, I want my reward display issues resolved, so that I can see all my earned rewards properly.

#### Acceptance Criteria

1. WHEN the root cause is identified, THE System SHALL implement appropriate fixes for this user's account
2. WHEN frontend issues are found, THE System SHALL update the user interface to display rewards correctly
3. WHEN contract state issues exist, THE System SHALL provide scripts to verify and correct the user's data
4. THE System SHALL verify the fix works specifically for user `0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82`
5. WHEN the fix is complete, THE System SHALL provide confirmation that all reward types are displaying correctly