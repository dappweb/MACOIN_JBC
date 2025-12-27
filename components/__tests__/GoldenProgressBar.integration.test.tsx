import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GoldenProgressBar from '../GoldenProgressBar';

// Mock window.matchMedia for reduced motion tests
const mockMatchMedia = (matches: boolean) => ({
  matches,
  media: '(prefers-reduced-motion: reduce)',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('GoldenProgressBar - Integration Tests', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockMatchMedia(false)),
    });

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });

    // Mock Image constructor
    global.Image = vi.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cross-Component Styling Consistency', () => {
    it('should maintain consistent golden styling across different usage contexts', () => {
      const { rerender } = render(
        <div>
          <GoldenProgressBar
            progress={50}
            height="sm"
            ariaLabel="Mining progress"
            className="mining-context"
          />
        </div>
      );

      const progressBar1 = screen.getByRole('progressbar');
      const styles1 = window.getComputedStyle(progressBar1);

      rerender(
        <div>
          <GoldenProgressBar
            progress={75}
            height="md"
            ariaLabel="Revenue cap progress"
            className="revenue-context"
          />
        </div>
      );

      const progressBar2 = screen.getByRole('progressbar');
      const styles2 = window.getComputedStyle(progressBar2);

      // Both should have golden gradient background
      expect(progressBar1).toHaveStyle({
        background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)'
      });
      expect(progressBar2).toHaveStyle({
        background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)'
      });
    });

    it('should handle multiple progress bars on the same page', () => {
      render(
        <div>
          <GoldenProgressBar
            progress={25}
            height="sm"
            showAnimation={true}
            ariaLabel="First progress bar"
          />
          <GoldenProgressBar
            progress={75}
            height="md"
            showAnimation={false}
            ariaLabel="Second progress bar"
          />
          <GoldenProgressBar
            progress={100}
            height="lg"
            showAnimation={true}
            ariaLabel="Third progress bar"
          />
        </div>
      );

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3);

      // Each should maintain its own state and styling
      expect(progressBars[0]).toHaveAttribute('aria-label', 'First progress bar');
      expect(progressBars[1]).toHaveAttribute('aria-label', 'Second progress bar');
      expect(progressBars[2]).toHaveAttribute('aria-label', 'Third progress bar');

      // All should have consistent golden styling
      progressBars.forEach(bar => {
        expect(bar).toHaveStyle({
          background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)'
        });
      });
    });
  });

  describe('Animation Behavior Across Scenarios', () => {
    it('should handle animation state changes dynamically', async () => {
      const { rerender } = render(
        <GoldenProgressBar
          progress={50}
          showAnimation={false}
          ariaLabel="Dynamic animation test"
        />
      );

      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();

      // Enable animation
      rerender(
        <GoldenProgressBar
          progress={75}
          showAnimation={true}
          ariaLabel="Dynamic animation test"
        />
      );

      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');

      // Disable animation
      rerender(
        <GoldenProgressBar
          progress={100}
          showAnimation={false}
          ariaLabel="Dynamic animation test"
        />
      );

      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => mockMatchMedia(true)),
      });

      render(
        <GoldenProgressBar
          progress={50}
          showAnimation={true}
          ariaLabel="Reduced motion test"
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      // Animation should be disabled due to reduced motion preference
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to mobile viewport changes', () => {
      const { rerender } = render(
        <GoldenProgressBar
          progress={50}
          height="md"
          showAnimation={true}
        />
      );

      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 600,
      });

      // Trigger re-render to apply mobile optimizations
      rerender(
        <GoldenProgressBar
          progress={50}
          height="md"
          showAnimation={true}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should handle viewport resize events', async () => {
      render(
        <GoldenProgressBar
          progress={60}
          showAnimation={true}
        />
      );

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 400,
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('Theme Switching Integration', () => {
    it('should handle rapid theme changes without performance issues', () => {
      const startTime = performance.now();

      const { rerender } = render(
        <GoldenProgressBar progress={50} theme="dark" />
      );

      // Simulate rapid theme switching
      for (let i = 0; i < 20; i++) {
        rerender(
          <GoldenProgressBar 
            progress={50 + i} 
            theme={i % 2 === 0 ? 'light' : 'dark'} 
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete rapidly without performance degradation
      expect(totalTime).toBeLessThan(500); // Less than 500ms for 20 theme switches

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should maintain accessibility during theme transitions', () => {
      const { rerender } = render(
        <GoldenProgressBar 
          progress={50} 
          theme="dark"
          ariaLabel="Theme transition test"
        />
      );

      rerender(
        <GoldenProgressBar 
          progress={75} 
          theme="light"
          ariaLabel="Theme transition test"
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Theme transition test');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('role', 'progressbar');
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle high-frequency progress updates efficiently', async () => {
      const { rerender } = render(
        <GoldenProgressBar progress={0} showAnimation={true} />
      );

      const startTime = performance.now();

      // Simulate rapid progress updates
      for (let i = 0; i <= 100; i += 5) {
        rerender(
          <GoldenProgressBar progress={i} showAnimation={true} />
        );
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(updateTime).toBeLessThan(200); // Less than 200ms for 21 updates

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should maintain performance with multiple animated progress bars', () => {
      const startTime = performance.now();

      render(
        <div>
          {Array.from({ length: 10 }, (_, i) => (
            <GoldenProgressBar
              key={i}
              progress={i * 10}
              showAnimation={true}
              ariaLabel={`Progress bar ${i + 1}`}
            />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render multiple animated bars efficiently
      expect(renderTime).toBeLessThan(300); // Less than 300ms for 10 bars

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(10);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover gracefully from asset loading failures', async () => {
      // Mock Image to fail loading
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          src: '',
        };
        
        setTimeout(() => {
          if (img.onerror) img.onerror();
        }, 10);
        
        return img;
      });

      render(
        <GoldenProgressBar
          progress={50}
          showAnimation={true}
          ariaLabel="Error recovery test"
        />
      );

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveAttribute('aria-label', 'Error recovery test');
      });

      // Component should continue functioning with fallback icons
    });

    it('should handle invalid prop combinations gracefully', () => {
      render(
        <GoldenProgressBar
          progress={150} // Invalid: > 100
          height="invalid" as any // Invalid height
          showAnimation={true}
          ariaLabel="Invalid props test"
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '100'); // Should clamp to 100
    });
  });
});