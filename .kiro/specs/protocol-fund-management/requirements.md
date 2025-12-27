# Requirements Document

## Introduction

This document outlines the requirements for a comprehensive protocol fund allocation and management strategy for the Jinbao RWA DeFi 4.0 protocol. The system manages multiple revenue streams, fund distribution mechanisms, and administrative controls to ensure sustainable protocol operations and user rewards.

## Glossary

- **Protocol**: The Jinbao RWA DeFi 4.0 smart contract system
- **Fund_Manager**: Administrative role responsible for fund allocation decisions
- **Distribution_Engine**: Smart contract component that handles automatic fund distribution
- **Revenue_Stream**: Source of protocol income (ticket purchases, swap taxes, redemption fees)
- **Allocation_Pool**: Designated fund category (direct rewards, level rewards, marketing, etc.)
- **Wallet_Manager**: System component managing protocol wallet addresses
- **Risk_Controller**: Component monitoring fund allocation limits and safety parameters
- **Treasury_Reserve**: Long-term protocol fund storage for stability and growth
- **Liquidity_Pool**: AMM reserves for MC/JBC token swapping
- **Buyback_Engine**: Mechanism for token repurchase and burn operations

## Requirements

### Requirement 1: Revenue Collection and Categorization

**User Story:** As a protocol operator, I want to systematically collect and categorize all revenue streams, so that funds can be properly allocated according to the protocol's economic model.

#### Acceptance Criteria

1. WHEN a user purchases a ticket, THE Distribution_Engine SHALL collect the ticket amount and categorize it as primary revenue
2. WHEN a swap transaction occurs, THE Distribution_Engine SHALL collect the appropriate tax percentage and categorize it as swap revenue
3. WHEN a user redeems liquidity, THE Distribution_Engine SHALL collect the redemption fee and categorize it as fee revenue
4. WHEN revenue is collected, THE Distribution_Engine SHALL timestamp and log the transaction for audit purposes
5. THE Distribution_Engine SHALL maintain separate accounting for each revenue stream type

### Requirement 2: Automated Fund Distribution

**User Story:** As a protocol administrator, I want funds to be automatically distributed according to predefined percentages, so that the protocol operates efficiently without manual intervention.

#### Acceptance Criteria

1. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 25% to direct rewards
2. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 15% to level rewards
3. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 5% to marketing operations
4. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 5% to buyback operations
5. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 25% to liquidity pool injection
6. WHEN primary revenue is collected, THE Distribution_Engine SHALL automatically allocate 25% to treasury reserves
7. THE Distribution_Engine SHALL ensure all percentage allocations sum to exactly 100%

### Requirement 3: Dynamic Allocation Configuration

**User Story:** As a protocol administrator, I want to adjust fund allocation percentages based on market conditions and protocol needs, so that the system can adapt to changing requirements.

#### Acceptance Criteria

1. WHEN an administrator updates distribution percentages, THE Distribution_Engine SHALL validate that the total equals 100%
2. WHEN distribution percentages are updated, THE Distribution_Engine SHALL apply changes to new transactions immediately
3. WHEN distribution percentages are updated, THE Distribution_Engine SHALL emit an event for transparency
4. THE Distribution_Engine SHALL reject percentage updates that would create invalid allocations
5. WHEN percentage updates are made, THE Distribution_Engine SHALL maintain historical records of changes

### Requirement 4: Multi-Wallet Management System

**User Story:** As a protocol administrator, I want to manage multiple specialized wallets for different fund categories, so that funds are properly segregated and controlled.

#### Acceptance Criteria

1. THE Wallet_Manager SHALL maintain separate addresses for marketing, treasury, LP injection, and buyback wallets
2. WHEN wallet addresses are updated, THE Wallet_Manager SHALL validate that addresses are not zero addresses
3. WHEN wallet addresses are updated, THE Wallet_Manager SHALL prevent setting the same address for multiple purposes
4. THE Wallet_Manager SHALL display current wallet addresses to administrators for verification
5. WHEN funds are distributed, THE Wallet_Manager SHALL route payments to the correct specialized wallets

### Requirement 5: Liquidity Pool Management

**User Story:** As a protocol administrator, I want to manage AMM liquidity pools for token swapping, so that users can exchange tokens with minimal slippage.

#### Acceptance Criteria

1. WHEN an administrator adds MC tokens, THE Liquidity_Pool SHALL increase MC reserves and update swap ratios
2. WHEN an administrator adds JBC tokens, THE Liquidity_Pool SHALL increase JBC reserves and update swap ratios
3. WHEN liquidity is added, THE Liquidity_Pool SHALL emit events for transparency
4. THE Liquidity_Pool SHALL prevent unauthorized liquidity modifications
5. WHEN liquidity operations occur, THE Liquidity_Pool SHALL maintain accurate reserve accounting

### Requirement 6: Risk Management and Safety Controls

**User Story:** As a protocol stakeholder, I want comprehensive risk controls on fund management, so that the protocol remains secure and sustainable.

#### Acceptance Criteria

1. THE Risk_Controller SHALL enforce maximum daily withdrawal limits for each wallet category
2. WHEN large fund movements are requested, THE Risk_Controller SHALL require additional authorization
3. THE Risk_Controller SHALL monitor fund allocation ratios and alert on dangerous imbalances
4. WHEN treasury reserves fall below minimum thresholds, THE Risk_Controller SHALL restrict non-essential distributions
5. THE Risk_Controller SHALL maintain emergency pause functionality for fund operations

### Requirement 7: Treasury Reserve Management

**User Story:** As a protocol administrator, I want to manage long-term treasury reserves, so that the protocol has sufficient funds for growth and emergency situations.

#### Acceptance Criteria

1. THE Treasury_Reserve SHALL accumulate 25% of all primary revenue automatically
2. WHEN treasury funds are accessed, THE Treasury_Reserve SHALL require multi-signature authorization
3. THE Treasury_Reserve SHALL maintain minimum reserve ratios relative to active user deposits
4. WHEN reserve levels change significantly, THE Treasury_Reserve SHALL notify administrators
5. THE Treasury_Reserve SHALL support both MC and JBC token holdings for diversification

### Requirement 8: Buyback and Burn Operations

**User Story:** As a protocol administrator, I want to execute token buyback and burn operations, so that token supply is managed according to economic policy.

#### Acceptance Criteria

1. THE Buyback_Engine SHALL accumulate 5% of primary revenue for buyback operations
2. WHEN buyback operations execute, THE Buyback_Engine SHALL purchase JBC tokens from the AMM pool
3. WHEN JBC tokens are purchased for buyback, THE Buyback_Engine SHALL permanently burn the tokens
4. THE Buyback_Engine SHALL execute buyback operations on a scheduled basis (daily/weekly)
5. WHEN burn operations complete, THE Buyback_Engine SHALL emit events showing burned token amounts

### Requirement 9: Comprehensive Audit and Reporting

**User Story:** As a protocol stakeholder, I want comprehensive audit trails and reporting, so that all fund movements are transparent and verifiable.

#### Acceptance Criteria

1. THE Distribution_Engine SHALL log all fund allocation decisions with timestamps and amounts
2. WHEN funds are distributed, THE Distribution_Engine SHALL record recipient addresses and transaction hashes
3. THE Distribution_Engine SHALL generate periodic reports showing fund flow summaries
4. THE Distribution_Engine SHALL maintain immutable audit logs for regulatory compliance
5. WHEN audit reports are generated, THE Distribution_Engine SHALL include percentage breakdowns and trend analysis

### Requirement 10: Emergency Fund Recovery

**User Story:** As a protocol administrator, I want emergency fund recovery capabilities, so that the protocol can respond to critical situations or smart contract issues.

#### Acceptance Criteria

1. THE Fund_Manager SHALL provide emergency withdrawal functions for each fund category
2. WHEN emergency withdrawals are executed, THE Fund_Manager SHALL require owner-level authorization
3. THE Fund_Manager SHALL implement time delays for large emergency withdrawals
4. WHEN emergency functions are used, THE Fund_Manager SHALL emit high-priority events for monitoring
5. THE Fund_Manager SHALL maintain separate emergency procedures for different fund types (operational vs. user deposits)