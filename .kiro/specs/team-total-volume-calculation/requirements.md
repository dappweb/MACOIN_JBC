# Requirements Document

## Introduction

This feature implements the correct calculation and display of "Community Ticket Total Volume" (社区门票总业绩) in the team nodes page. Currently, the system only shows direct referral ticket amounts multiplied by 3, but it should display the total ticket amounts from all downstream team members across all levels.

## Glossary

- **Community_Ticket_Total_Volume**: The sum of all ticket amounts from all downstream team members (direct and indirect referrals)
- **Direct_Referral**: A user directly referred by the current user (1st level)
- **Indirect_Referral**: A user referred by someone in the current user's downstream network (2nd+ levels)
- **Team_Network**: The complete tree structure of all downstream referrals
- **Ticket_Amount**: The MC token amount invested in a user's current active ticket
- **Upstream_Propagation**: The process of updating team statistics when a downstream member's data changes

## Requirements

### Requirement 1: Team Volume Calculation

**User Story:** As a team leader, I want to see the total ticket volume from my entire downstream network, so that I can understand my complete team's investment performance.

#### Acceptance Criteria

1. WHEN calculating community ticket total volume, THE System SHALL include all downstream team members regardless of referral level
2. WHEN a user has no downstream team members, THE System SHALL return zero for community ticket total volume
3. WHEN calculating team volume, THE System SHALL only include active ticket amounts from each team member
4. WHEN a team member's ticket expires or exits, THE System SHALL exclude their ticket amount from upstream calculations
5. WHEN the calculation depth exceeds 20 levels, THE System SHALL stop recursion to prevent infinite loops

### Requirement 2: Real-time Volume Updates

**User Story:** As a team leader, I want the community ticket total volume to update automatically when team members buy or redeem tickets, so that I always see current data.

#### Acceptance Criteria

1. WHEN a downstream team member purchases a ticket, THE System SHALL update all upstream users' team total volume
2. WHEN a downstream team member redeems or exits their ticket, THE System SHALL decrease all upstream users' team total volume
3. WHEN a team member accumulates additional tickets, THE System SHALL reflect the increased amount in upstream calculations
4. WHEN team volume updates occur, THE System SHALL complete the update within the same transaction
5. WHEN volume updates fail for any upstream user, THE System SHALL not affect the original user's ticket purchase

### Requirement 3: Frontend Display Integration

**User Story:** As a user viewing the team nodes page, I want to see the accurate community ticket total volume, so that I understand my team's true performance.

#### Acceptance Criteria

1. WHEN displaying community ticket total volume, THE Frontend SHALL show the calculated team volume from the contract
2. WHEN the team volume data is loading, THE Frontend SHALL display a loading indicator
3. WHEN team volume is zero, THE Frontend SHALL display "0 MC" instead of hiding the field
4. WHEN team volume updates in real-time, THE Frontend SHALL refresh the display automatically
5. WHEN displaying large numbers, THE Frontend SHALL format them with appropriate thousand separators

### Requirement 4: Data Consistency and Performance

**User Story:** As a system administrator, I want the team volume calculations to be efficient and consistent, so that the system performs well under load.

#### Acceptance Criteria

1. WHEN storing team volume data, THE System SHALL use cached values in UserInfo struct to avoid repeated calculations
2. WHEN multiple team members make transactions simultaneously, THE System SHALL maintain data consistency
3. WHEN calculating team volumes, THE System SHALL complete within reasonable gas limits
4. WHEN team size exceeds 1000 members, THE System SHALL still calculate volumes efficiently
5. WHEN contract upgrades occur, THE System SHALL preserve existing team volume data

### Requirement 5: Error Handling and Edge Cases

**User Story:** As a developer, I want the system to handle edge cases gracefully, so that team volume calculations remain reliable.

#### Acceptance Criteria

1. WHEN circular referral relationships exist, THE System SHALL detect and handle them without infinite loops
2. WHEN a user's referrer changes, THE System SHALL update team volumes for both old and new upstream chains
3. WHEN contract calls fail during volume updates, THE System SHALL not block the main transaction
4. WHEN team volume calculations encounter errors, THE System SHALL log the error and continue operation
5. WHEN invalid user addresses are encountered, THE System SHALL skip them and continue processing