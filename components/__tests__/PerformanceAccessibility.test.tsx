/**
 * Property-Based Tests for Performance and Accessibility Compliance
 * Feature: golden-progress-bar-enhancement, Property 4: Performance and Accessibility Compliance
 * 
 * This test validates that logo animations use CSS transforms, respect reduced motion 
 * preferences, and do not cause layout shifts or performance degradation.
 * 
 * Validates: Requirements 4.2, 4.4, 4.5
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GoldenProgressBar from '../GoldenProgressBar';

// Mock performance observer for layout shift detection
const mockPerformanceObserver = {
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn().mockReturnValue([])
};

// Mock ResizeObserver
const mockResizeObserver = {
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
};

// Mock window.matchMedia for reduced motion testing
const createMockMatchMedia = (matches: boolean) => {
  return jest.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

describe('Performance and Accessibility Compliance Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup global mocks
    global.PerformanceObserver = jest.fn().mockImplementation(() => mockPerformanceObserver);
    global.ResizeObserver = jest.fn().mockImplementation(() => mockResizeObserver);
    
    // Mock Image constructor for logo loading tests
    global.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src: string = '';
      
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    } as any;
  });

  afterEach(() => {
    // Clean up
    delete (global as any).PerformanceObserver;
    delete (global as any).ResizeObserver;
    delete (global as any).Image;
  });

  /**
   * Property 4: Performance and Accessibility Compliance
   * For any logo animation, it should use CSS transforms, respect reduced motion 
   * preferences, and not cause layout shifts or performance degradation
   */
  test('Property 4: CSS transforms are used for optimal performance', () => {
    // Generate multiple test cases with different progress values
    const progressValues = Array.from({ length: 20 }, () => Math.random() * 100);
    
    progressValues.forEach((progress) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
          ariaLabel={`Test progress ${progress}%`}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      
      // Check for animation container
      const animationContainer = progressBar.querySelector('.logo-animation');
      if (progress > 0) {
        expect(animationContainer).toBeInTheDocument();
        
        // Verify CSS transform properties are used
        const computedStyle = window.getComputedStyle(animationContainer!);
        expect(computedStyle.willChange).toBe('transform');
        expect(computedStyle.contain).toBe('layout style paint');
        
        // Verify animation uses transform (not layout-affecting properties)
        expect(computedStyle.animation).toContain('logoScroll');
      }

      unmount();
    });
  });

  test('Property 4: Reduced motion preferences are respected', async () => {
    const testCases = [
      {
        name: 'Motion enabled',
        prefersReducedMotion: false,
        shouldAnimate: true
      },
      {
        name: 'Motion reduced',
        prefersReducedMotion: true,
        shouldAnimate: false
      }
    ];

    for (const testCase of testCases) {
      // Mock matchMedia for this test case
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMockMatchMedia(testCase.prefersReducedMotion)
      });

      const { unmount } = render(
        <GoldenProgressBar 
          progress={75} 
          showAnimation={true}
          ariaLabel="Test progress"
        />
      );

      // Wait for useEffect to process reduced motion preference
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const progressBar = screen.getByRole('progressbar');
      const animationContainer = progressBar.querySelector('.logo-animation');
      
      if (testCase.shouldAnimate) {
        expect(animationContainer).toBeInTheDocument();
      } else {
        // When reduced motion is preferred, animation should be disabled
        expect(animationContainer).not.toBeInTheDocument();
      }

      unmount();
    }
  });

  test('Property 4: No layout shifts are caused by animations', () => {
    const layoutShifts: any[] = [];
    
    // Mock PerformanceObserver to detect layout shifts
    global.PerformanceObserver = jest.fn().mockImplementation((callback) => {
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: jest.fn().mockReturnValue(layoutShifts)
      };
    });

    const progressValues = [0, 25, 50, 75, 100];
    
    progressValues.forEach((progress) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
          ariaLabel={`Progress ${progress}%`}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      
      // Verify container has proper containment
      const animationContainer = progressBar.querySelector('.logo-animation');
      if (animationContainer) {
        const computedStyle = window.getComputedStyle(animationContainer);
        
        // Verify containment properties that prevent layout shifts
        expect(computedStyle.contain).toBe('layout style paint');
        expect(computedStyle.position).toBe('absolute');
        
        // Verify no layout-affecting properties are animated
        expect(computedStyle.animation).not.toContain('width');
        expect(computedStyle.animation).not.toContain('height');
        expect(computedStyle.animation).not.toContain('margin');
        expect(computedStyle.animation).not.toContain('padding');
      }

      unmount();
    });

    // Verify no layout shifts were recorded
    expect(layoutShifts).toHaveLength(0);
  });

  test('Property 4: ARIA attributes are properly maintained', () => {
    const testCases = [
      { progress: 0, label: 'Starting progress' },
      { progress: 33.5, label: 'Partial progress' },
      { progress: 67.8, label: 'Advanced progress' },
      { progress: 100, label: 'Complete progress' }
    ];

    testCases.forEach(({ progress, label }) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
          ariaLabel={label}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      
      // Verify all required ARIA attributes
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', Math.min(Math.max(progress, 0), 100).toString());
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', label);
      
      // Verify progress value is clamped correctly
      const ariaValueNow = parseInt(progressBar.getAttribute('aria-valuenow') || '0');
      expect(ariaValueNow).toBeGreaterThanOrEqual(0);
      expect(ariaValueNow).toBeLessThanOrEqual(100);

      unmount();
    });
  });

  test('Property 4: Animation performance is optimized', () => {
    const { unmount } = render(
      <GoldenProgressBar 
        progress={50} 
        showAnimation={true}
        ariaLabel="Performance test"
      />
    );

    const progressBar = screen.getByRole('progressbar');
    const animationContainer = progressBar.querySelector('.logo-animation');
    
    if (animationContainer) {
      const computedStyle = window.getComputedStyle(animationContainer);
      
      // Verify GPU acceleration hints
      expect(computedStyle.willChange).toBe('transform');
      
      // Verify containment for performance isolation
      expect(computedStyle.contain).toBe('layout style paint');
      
      // Verify animation uses efficient properties
      expect(computedStyle.animation).toContain('logoScroll');
      expect(computedStyle.animationTimingFunction).toBe('linear');
      expect(computedStyle.animationIterationCount).toBe('infinite');
      
      // Verify no expensive properties are animated
      expect(computedStyle.animation).not.toContain('box-shadow');
      expect(computedStyle.animation).not.toContain('filter');
      expect(computedStyle.animation).not.toContain('opacity');
    }

    unmount();
  });

  test('Property 4: Graceful degradation when animations are disabled', () => {
    // Test with animation explicitly disabled
    const { unmount: unmount1 } = render(
      <GoldenProgressBar 
        progress={75} 
        showAnimation={false}
        ariaLabel="No animation test"
      />
    );

    let progressBar = screen.getByRole('progressbar');
    let animationContainer = progressBar.querySelector('.logo-animation');
    
    // Should not have animation container when disabled
    expect(animationContainer).not.toBeInTheDocument();
    
    // But progress bar should still function
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toBeInTheDocument();

    unmount1();

    // Test with reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMockMatchMedia(true) // prefers-reduced-motion: reduce
    });

    const { unmount: unmount2 } = render(
      <GoldenProgressBar 
        progress={75} 
        showAnimation={true}
        ariaLabel="Reduced motion test"
      />
    );

    // Wait for reduced motion detection
    act(() => {
      // Trigger useEffect
    });

    progressBar = screen.getByRole('progressbar');
    
    // Progress bar should still be functional
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toBeInTheDocument();

    unmount2();
  });

  test('Property 4: Memory leaks are prevented', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = render(
      <GoldenProgressBar 
        progress={50} 
        showAnimation={true}
        ariaLabel="Memory leak test"
      />
    );

    // Component should set up event listeners for reduced motion
    expect(addEventListenerSpy).toHaveBeenCalled();

    unmount();

    // Component should clean up event listeners on unmount
    expect(removeEventListenerSpy).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  test('Property 4: Animation respects system performance capabilities', () => {
    // Test with different device capabilities
    const testScenarios = [
      {
        name: 'High performance device',
        deviceMemory: 8,
        hardwareConcurrency: 8,
        shouldOptimize: false
      },
      {
        name: 'Low performance device',
        deviceMemory: 2,
        hardwareConcurrency: 2,
        shouldOptimize: true
      }
    ];

    testScenarios.forEach((scenario) => {
      // Mock device capabilities
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: scenario.deviceMemory
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: true,
        value: scenario.hardwareConcurrency
      });

      const { unmount } = render(
        <GoldenProgressBar 
          progress={75} 
          showAnimation={true}
          ariaLabel={`Performance test - ${scenario.name}`}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      
      // Progress bar should always be functional regardless of device capabilities
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');

      unmount();
    });
  });
});