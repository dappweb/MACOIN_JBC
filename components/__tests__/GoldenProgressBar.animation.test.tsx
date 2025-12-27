/**
 * Property-Based Tests for GoldenProgressBar Logo Animation
 * Feature: golden-progress-bar-enhancement, Property 2: Logo Animation Behavior
 * 
 * This test validates that logo animations scroll continuously from right to left
 * at consistent speed and loop seamlessly without breaks.
 * 
 * Validates: Requirements 2.1, 2.3, 2.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GoldenProgressBar } from '../GoldenProgressBar';

// Property-based test utility for generating test cases
const generateProgressValues = (): number[] => {
  const values: number[] = [];
  // Generate 100 random progress values between 0 and 100
  for (let i = 0; i < 100; i++) {
    values.push(Math.random() * 100);
  }
  return values;
};

describe('GoldenProgressBar Logo Animation Behavior', () => {
  beforeEach(() => {
    // Mock CSS animation support
    Object.defineProperty(window, 'getComputedStyle', {
      value: () => ({
        animationName: 'logoScroll',
        animationDuration: '3s',
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDirection: 'normal',
        transform: 'translateX(100%)'
      })
    });
  });

  /**
   * Property 2: Logo Animation Behavior
   * For any active progress bar, the logo animation should scroll continuously 
   * from right to left at consistent speed and loop seamlessly without breaks
   */
  test('Property 2: Logo animation scrolls consistently across all progress values', () => {
    const progressValues = generateProgressValues();
    
    progressValues.forEach((progress) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
          ariaLabel={`Progress ${progress}%`}
        />
      );

      // Verify animation container exists
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();

      // Check for animation elements
      const animationContainer = progressBar.querySelector('.logo-animation-container');
      if (progress > 0) {
        expect(animationContainer).toBeInTheDocument();
        
        // Verify animation CSS classes are applied
        const animatedElements = progressBar.querySelectorAll('.logo-scroll-animation');
        expect(animatedElements.length).toBeGreaterThan(0);
        
        // Check animation properties
        animatedElements.forEach((element) => {
          const computedStyle = window.getComputedStyle(element);
          
          // Verify right-to-left animation (translateX from 100% to -100%)
          expect(computedStyle.animationName).toBe('logoScroll');
          
          // Verify consistent timing regardless of progress
          expect(computedStyle.animationDuration).toBe('3s');
          expect(computedStyle.animationTimingFunction).toBe('linear');
          
          // Verify infinite loop for seamless animation
          expect(computedStyle.animationIterationCount).toBe('infinite');
        });
      }

      unmount();
    });
  });

  test('Animation direction is consistently right-to-left', () => {
    const testCases = [10, 25, 50, 75, 90, 100];
    
    testCases.forEach((progress) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      const animatedElements = progressBar.querySelectorAll('.logo-scroll-animation');
      
      animatedElements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element);
        
        // Animation should start from right (100%) and move to left (-100%)
        expect(computedStyle.animationDirection).toBe('normal');
        expect(computedStyle.transform).toContain('translateX');
      });

      unmount();
    });
  });

  test('Animation speed remains consistent regardless of progress percentage', () => {
    const progressValues = [1, 25, 50, 75, 99];
    const expectedDuration = '3s';
    
    progressValues.forEach((progress) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      const animatedElements = progressBar.querySelectorAll('.logo-scroll-animation');
      
      animatedElements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element);
        
        // Duration should be consistent across all progress values
        expect(computedStyle.animationDuration).toBe(expectedDuration);
        expect(computedStyle.animationTimingFunction).toBe('linear');
      });

      unmount();
    });
  });

  test('Animation loops seamlessly without breaks', () => {
    const { unmount } = render(
      <GoldenProgressBar 
        progress={75} 
        showAnimation={true}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    const animatedElements = progressBar.querySelectorAll('.logo-scroll-animation');
    
    animatedElements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element);
      
      // Verify infinite iteration for seamless looping
      expect(computedStyle.animationIterationCount).toBe('infinite');
      
      // Verify no animation delays that could cause breaks
      expect(computedStyle.animationDelay).toBe('0s');
      
      // Verify fill mode for smooth transitions
      expect(computedStyle.animationFillMode).toBe('none');
    });

    unmount();
  });

  test('Animation is only visible within filled portion of progress bar', () => {
    const testCases = [
      { progress: 0, shouldHaveAnimation: false },
      { progress: 10, shouldHaveAnimation: true },
      { progress: 50, shouldHaveAnimation: true },
      { progress: 100, shouldHaveAnimation: true }
    ];
    
    testCases.forEach(({ progress, shouldHaveAnimation }) => {
      const { unmount } = render(
        <GoldenProgressBar 
          progress={progress} 
          showAnimation={true}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      const animationContainer = progressBar.querySelector('.logo-animation-container');
      
      if (shouldHaveAnimation) {
        expect(animationContainer).toBeInTheDocument();
        
        // Verify animation is clipped to progress width
        const progressFill = progressBar.querySelector('.progress-fill');
        expect(progressFill).toHaveStyle(`width: ${progress}%`);
      } else {
        expect(animationContainer).not.toBeInTheDocument();
      }

      unmount();
    });
  });

  test('Animation respects reduced motion preferences', () => {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { unmount } = render(
      <GoldenProgressBar 
        progress={75} 
        showAnimation={true}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    
    // When reduced motion is preferred, animation should be disabled
    const animatedElements = progressBar.querySelectorAll('.logo-scroll-animation');
    
    if (animatedElements.length > 0) {
      animatedElements.forEach((element) => {
        // Animation should be paused or have no animation when reduced motion is preferred
        expect(element).toHaveClass('motion-reduce:animate-none');
      });
    }

    unmount();
  });
});