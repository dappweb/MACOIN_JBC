# Design Document

## Overview

This design document outlines the implementation of enhanced golden progress bars with animated logo scrolling for the JBC RWA mining application. The enhancement will replace existing neon-colored progress bars with more prominent golden-themed progress indicators featuring continuously scrolling project logos.

## Architecture

### Component Architecture

The enhancement will modify two existing React components:

1. **LiquidityPositions.tsx** - Mining cycle countdown progress bars
2. **MiningPanel.tsx** - Revenue cap progress tracking

### Design Patterns

- **Composition Pattern**: Create reusable `GoldenProgressBar` component
- **CSS-in-JS**: Use Tailwind CSS classes with custom CSS animations
- **Progressive Enhancement**: Maintain existing functionality while adding visual enhancements

## Components and Interfaces

### GoldenProgressBar Component

```typescript
interface GoldenProgressBarProps {
  progress: number;           // 0-100 percentage
  height?: 'sm' | 'md' | 'lg'; // h-3, h-4, h-5
  showAnimation?: boolean;     // Enable/disable logo animation
  className?: string;          // Additional CSS classes
  ariaLabel?: string;         // Accessibility label
}
```

### Animation Configuration

```typescript
interface LogoAnimationConfig {
  duration: number;           // Animation duration in seconds
  logoSize: number;          // Logo size in pixels
  logoSpacing: number;       // Space between logos in pixels
  direction: 'ltr' | 'rtl';  // Animation direction
}
```

## Data Models

### Progress Bar State

```typescript
interface ProgressBarState {
  progress: number;          // Current progress percentage
  isActive: boolean;         // Whether animation should run
  theme: 'light' | 'dark';   // Theme variant
  reducedMotion: boolean;    // User motion preference
}
```

### Logo Asset Management

```typescript
interface LogoAsset {
  src: string;               // Logo image source
  alt: string;               // Alternative text
  fallbackIcon: string;      // Fallback icon class
  width: number;             // Optimized width
  height: number;            // Optimized height
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all testable criteria from the prework analysis, I identified several areas where properties can be consolidated:

- Properties 1.2, 3.3, and 3.5 all relate to consistent styling across components and can be combined
- Properties 2.1, 2.3, and 2.5 all test animation behavior and can be unified
- Properties 4.2, 4.4, and 4.5 all relate to performance and accessibility and can be consolidated
- Properties 5.2, 5.4, and 5.5 all test asset handling robustness and can be combined

### Core Properties

**Property 1: Golden Styling Consistency**
*For any* progress bar component in the application, the styling should use golden color scheme with 16px height and maintain visual consistency across all instances
**Validates: Requirements 1.2, 3.3, 3.5**

**Property 2: Logo Animation Behavior**
*For any* active progress bar, the logo animation should scroll continuously from right to left at consistent speed and loop seamlessly without breaks
**Validates: Requirements 2.1, 2.3, 2.5**

**Property 3: Progress Functionality Preservation**
*For any* progress bar enhancement, the existing progress tracking and countdown functionality should continue to work correctly while adding visual improvements
**Validates: Requirements 3.4**

**Property 4: Performance and Accessibility Compliance**
*For any* logo animation, it should use CSS transforms, respect reduced motion preferences, and not cause layout shifts or performance degradation
**Validates: Requirements 4.2, 4.4, 4.5**

**Property 5: Asset Management Robustness**
*For any* logo asset loading scenario, the system should handle missing assets gracefully, maintain aspect ratios, and support theme variations
**Validates: Requirements 5.2, 5.4, 5.5**

## Error Handling

### Logo Asset Loading

- **Missing Logo**: Fall back to default icon (Zap or Clock)
- **Load Failure**: Display progress bar without animation
- **Invalid Dimensions**: Auto-scale to fit progress bar height

### Animation Performance

- **Reduced Motion**: Disable animations, show static progress
- **Low Performance**: Reduce animation complexity
- **Browser Compatibility**: Graceful degradation for older browsers

### Responsive Design

- **Mobile Devices**: Adjust logo size and animation speed
- **Small Screens**: Maintain readability with appropriate scaling
- **Touch Interfaces**: Ensure progress bars remain functional

## Testing Strategy

### Dual Testing Approach

The implementation will use both unit tests and property-based tests:

- **Unit tests**: Verify specific styling values, component rendering, and edge cases
- **Property tests**: Verify universal properties across all progress bar instances

### Property-Based Testing Configuration

- **Library**: React Testing Library with custom property test utilities
- **Iterations**: Minimum 100 iterations per property test
- **Test Tags**: Each property test will reference its design document property

**Tag Format**: `Feature: golden-progress-bar-enhancement, Property {number}: {property_text}`

### Unit Testing Focus

- Golden color scheme application
- Logo asset loading and fallbacks
- Animation CSS class application
- Accessibility attribute presence
- Responsive behavior verification

### Integration Testing

- Cross-component styling consistency
- Animation performance impact
- Theme switching compatibility
- Mobile device functionality

## Implementation Details

### CSS Animation Keyframes

```css
@keyframes logoScroll {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

@keyframes goldenGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
}
```

### Tailwind CSS Classes

```css
.golden-progress-bar {
  @apply h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full relative overflow-hidden;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

.logo-animation {
  @apply absolute inset-y-0 flex items-center;
  animation: logoScroll 3s linear infinite;
}
```

### Component Integration Points

1. **LiquidityPositions.tsx**: Replace existing progress bar at line 225-230
2. **MiningPanel.tsx**: Replace existing progress bar at line 1345-1349
3. **Shared Styling**: Create common progress bar utility component

### Performance Optimizations

- Use `transform` instead of `left/right` for animations
- Implement `will-change: transform` for animation elements
- Use `contain: layout style paint` for animation containers
- Lazy load logo assets with intersection observer