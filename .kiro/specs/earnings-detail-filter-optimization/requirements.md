# Requirements Document

## Introduction

This specification defines the requirements for optimizing the earnings detail page by repositioning the filter controls to improve user experience and interface flow.

## Glossary

- **Filter_Controls**: The interactive elements that allow users to filter earnings records by reward type
- **Earnings_Records**: The list of reward transactions displayed to the user
- **Stats_Section**: The summary cards showing total and daily earnings statistics
- **Header_Section**: The top section containing title, subtitle, and action buttons

## Requirements

### Requirement 1: Filter Position Optimization

**User Story:** As a user viewing my earnings details, I want the filter controls to be positioned directly above the earnings records, so that I can easily filter the data without scrolling past statistics.

#### Acceptance Criteria

1. THE Filter_Controls SHALL be positioned immediately above the Earnings_Records list
2. THE Filter_Controls SHALL be positioned below the Stats_Section
3. THE Filter_Controls SHALL maintain their current functionality and styling
4. THE Filter_Controls SHALL remain visible and accessible on both desktop and mobile devices
5. THE page layout SHALL maintain proper spacing and visual hierarchy after repositioning

### Requirement 2: Visual Consistency

**User Story:** As a user, I want the filter controls to maintain consistent styling and behavior, so that the interface remains familiar and intuitive.

#### Acceptance Criteria

1. THE Filter_Controls SHALL retain their current visual design and styling
2. THE Filter_Controls SHALL maintain their current responsive behavior on mobile devices
3. THE Filter_Controls SHALL preserve their current hover and active states
4. THE Filter_Controls SHALL continue to display the filter icon and "All" option
5. THE Filter_Controls SHALL maintain their horizontal scrolling behavior on mobile when needed

### Requirement 3: Functional Preservation

**User Story:** As a user, I want all filter functionality to work exactly as before, so that I can continue to filter my earnings records effectively.

#### Acceptance Criteria

1. THE Filter_Controls SHALL continue to filter earnings records by reward type
2. THE pagination SHALL reset to page 1 when filter selection changes
3. THE filtered record count SHALL update correctly in pagination information
4. THE "All" filter SHALL continue to show all earnings records
5. THE individual reward type filters SHALL continue to show only matching records

### Requirement 4: Layout Flow Optimization

**User Story:** As a user, I want the page layout to flow logically from summary information to filtering to detailed records, so that the interface is intuitive to navigate.

#### Acceptance Criteria

1. THE page layout SHALL follow this order: Header_Section, Stats_Section, Filter_Controls, Earnings_Records
2. THE visual spacing between sections SHALL be consistent and appropriate
3. THE Filter_Controls SHALL have clear visual separation from both Stats_Section and Earnings_Records
4. THE layout SHALL remain responsive and functional on all screen sizes
5. THE scrolling behavior SHALL remain smooth and natural

### Requirement 5: Dynamic Reward Removal

**User Story:** As a user, I want to see only relevant reward types in the earnings detail, so that the interface is cleaner and more focused on actual rewards I receive.

#### Acceptance Criteria

1. THE dynamic reward type (rewardType === 1) SHALL be removed from all filter options
2. THE dynamic reward records SHALL be excluded from the earnings records display
3. THE dynamic reward statistics SHALL be removed from the 24h stats section
4. THE filter tabs SHALL no longer include the dynamic reward option
5. THE reward type labels and icons SHALL not include dynamic reward references

### Requirement 6: Layout Reorganization

**User Story:** As a user, I want the summary statistics to be at the top of the page, so that I can quickly see my total earnings before filtering through detailed records.

#### Acceptance Criteria

1. THE total stats section SHALL be positioned immediately after the header section
2. THE 24h stats section SHALL be positioned after the total stats section
3. THE differential reward highlight SHALL be positioned after the 24h stats section
4. THE filter controls SHALL be positioned after all statistics sections
5. THE earnings records SHALL be positioned after the filter controls

### Requirement 7: Performance Preservation

**User Story:** As a user, I want the page to continue loading and filtering quickly, so that my experience remains smooth and responsive.

#### Acceptance Criteria

1. THE filter operations SHALL maintain their current performance characteristics
2. THE page rendering SHALL not be negatively impacted by the layout changes
3. THE component re-rendering SHALL remain efficient when filters are applied
4. THE pagination performance SHALL remain unchanged
5. THE mobile scrolling performance SHALL remain smooth