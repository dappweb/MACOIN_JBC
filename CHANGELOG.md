# Changelog

All notable changes to this project will be documented in this file.

## [v1.0.0-stable] - 2025-12-28

### Milestone
- **Official Release**: First stable release of the MACOIN JBC RWA DeFi 4.0 Protocol.
- **Contract Version**: v3.2 (Finalized & Optimized).
- **Frontend Version**: Aligned with v3.2 contracts.

### Added
- **Liquidity Requirement**: Strictly enforced 1.5x rule based on historical maximum single ticket amount.
- **Ticket System**: Complete support for 4 ticket tiers (100, 300, 500, 1000 MC) with cumulative logic.
- **Mining Cycle**: 7/15/30 days staking periods with 2.0%/2.5%/3.0% daily ROI.
- **Reward System**:
  - Direct Reward (25%)
  - Level Reward (15%)
  - Team Differential Reward (Calculated on liquidity)
- **Deflationary Mechanisms**:
  - Buy/Sell Tax (50%/25%) with auto-burn.
  - Daily Burn mechanism for JBC pool.
- **Admin Panel**: Full control over distribution percentages, manual burn, and emergency withdrawals.
- **Tests**: Comprehensive test suite covering ticket purchase, liquidity staking, rewards, and differential logic.

### Fixed
- **CSS Leak**: Removed visible CSS code from `index.html`.
- **Liquidity Calculation**:
  - Fixed frontend `MiningPanel.tsx` to prioritize contract-stored `maxSingleTicketAmount`.
  - Removed misleading logic that used current total holdings for liquidity baselines.
  - Unified all documentation and tests to 1.5x standard (previously inconsistent 1.6x references).

### Changed
- **Documentation**: Updated `ALIGNMENT_TABLE.md` and `PROJECT_REQUIREMENTS.md` to reflect the final 1.5x liquidity rule.
