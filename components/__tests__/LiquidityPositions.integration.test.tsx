/**
 * Unit Tests for LiquidityPositions Integration with GoldenProgressBar
 * 
 * Tests progress bar rendering with different position states and
 * verifies animation enabling/disabling logic.
 * 
 * Validates: Requirements 3.1, 3.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiquidityPositions from '../LiquidityPositions';
import { useWeb3 } from '../../Web3Context';
import { useLanguage } from '../../LanguageContext';

// Mock dependencies
jest.mock('../../Web3Context');
jest.mock('../../LanguageContext');
jest.mock('../GoldenProgressBar', () => {
  return function MockGoldenProgressBar({ progress, showAnimation, ariaLabel }: any) {
    return (
      <div 
        data-testid="golden-progress-bar"
        data-progress={progress}
        data-show-animation={showAnimation}
        aria-label={ariaLabel}
        role="progressbar"
      >
        Golden Progress Bar: {progress}% {showAnimation ? '(animated)' : '(static)'}
      </div>
    );
  };
});

const mockUseWeb3 = useWeb3 as jest.MockedFunction<typeof useWeb3>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

// Mock contract and provider
const mockProtocolContract = {
  userStakes: jest.fn(),
  SECONDS_IN_UNIT: jest.fn().mockResolvedValue(60)
};

const mockProvider = {
  getBlockNumber: jest.fn().mockResolvedValue(1000000)
};

describe('LiquidityPositions Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUseWeb3.mockReturnValue({
      protocolContract: mockProtocolContract as any,
      account: '0x1234567890123456789012345678901234567890',
      provider: mockProvider as any
    } as any);

    mockUseLanguage.mockReturnValue({
      t: {
        mining: {
          liquidity: 'Liquidity Positions',
          totalLock: 'Total Staked',
          estPendingReward: 'Est. Pending Reward',
          mining: 'Mining',
          completed: 'Completed',
          redeemed: 'Redeemed',
          cycle: 'Cycle',
          countdown: 'Countdown',
          days: 'Mins',
          totalPaid: 'Total Paid',
          pending: 'Pending'
        }
      }
    } as any);
  });

  test('renders progress bars for active positions only', async () => {
    // Mock stake data with different statuses
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000', // 1000 tokens
        1640000000, // startTime
        7, // cycleDays
        true, // active
        '50000000000000000000' // paid (50 tokens)
      ])
      .mockResolvedValueOnce([
        '2', // id
        '2000000000000000000000', // 2000 tokens
        1640000000, // startTime
        15, // cycleDays
        false, // not active (redeemed)
        '300000000000000000000' // paid (300 tokens)
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      // Should have progress bar for active position
      const progressBars = screen.getAllByTestId('golden-progress-bar');
      expect(progressBars).toHaveLength(1);
      
      // Check that the active position has animation enabled
      const activeProgressBar = progressBars[0];
      expect(activeProgressBar).toHaveAttribute('data-show-animation', 'true');
    });
  });

  test('animation is enabled for active mining positions', async () => {
    // Mock active stake
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000', // 1000 tokens
        Math.floor(Date.now() / 1000) - 3600, // started 1 hour ago
        7, // 7 minute cycle
        true, // active
        '10000000000000000000' // paid (10 tokens)
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      const progressBar = screen.getByTestId('golden-progress-bar');
      
      // Should show animation for active position
      expect(progressBar).toHaveAttribute('data-show-animation', 'true');
      
      // Should have proper aria label
      expect(progressBar).toHaveAttribute('aria-label');
      expect(progressBar.getAttribute('aria-label')).toContain('Mining progress');
    });
  });

  test('animation is disabled for completed positions', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime - 8 * 60; // Started 8 minutes ago
    
    // Mock completed stake (cycle finished but still active in contract)
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000', // 1000 tokens
        startTime,
        7, // 7 minute cycle (should be completed)
        true, // still active in contract
        '70000000000000000000' // paid (70 tokens - full cycle)
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      const progressBar = screen.getByTestId('golden-progress-bar');
      
      // Should not show animation for completed position
      expect(progressBar).toHaveAttribute('data-show-animation', 'false');
      
      // Progress should be 100%
      expect(progressBar).toHaveAttribute('data-progress', '100');
    });
  });

  test('no progress bar for redeemed positions', async () => {
    // Mock redeemed stake
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000', // 1000 tokens
        1640000000, // startTime
        7, // cycleDays
        false, // not active (redeemed)
        '70000000000000000000' // paid (70 tokens)
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      // Should not have any progress bars for redeemed positions
      const progressBars = screen.queryAllByTestId('golden-progress-bar');
      expect(progressBars).toHaveLength(0);
    });
  });

  test('progress calculation is accurate', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime - 3.5 * 60; // Started 3.5 minutes ago
    
    // Mock stake with partial progress
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000', // 1000 tokens
        startTime,
        7, // 7 minute cycle
        true, // active
        '35000000000000000000' // paid (35 tokens - 50% of cycle)
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      const progressBar = screen.getByTestId('golden-progress-bar');
      
      // Progress should be approximately 50% (3.5/7 minutes)
      const progress = parseFloat(progressBar.getAttribute('data-progress') || '0');
      expect(progress).toBeGreaterThan(45);
      expect(progress).toBeLessThan(55);
      
      // Should have animation enabled
      expect(progressBar).toHaveAttribute('data-show-animation', 'true');
    });
  });

  test('handles multiple positions with different states', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Mock multiple stakes with different states
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id - active position
        '1000000000000000000000',
        currentTime - 2 * 60, // 2 minutes ago
        7, // 7 minute cycle
        true, // active
        '20000000000000000000' // paid
      ])
      .mockResolvedValueOnce([
        '2', // id - completed position
        '2000000000000000000000',
        currentTime - 8 * 60, // 8 minutes ago (completed)
        7, // 7 minute cycle
        true, // still active in contract
        '140000000000000000000' // paid (full cycle)
      ])
      .mockResolvedValueOnce([
        '3', // id - redeemed position
        '1500000000000000000000',
        currentTime - 10 * 60,
        15, // 15 minute cycle
        false, // redeemed
        '225000000000000000000' // paid
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      const progressBars = screen.getAllByTestId('golden-progress-bar');
      
      // Should have 2 progress bars (active and completed, but not redeemed)
      expect(progressBars).toHaveLength(2);
      
      // First should be active with animation
      expect(progressBars[0]).toHaveAttribute('data-show-animation', 'true');
      
      // Second should be completed without animation
      expect(progressBars[1]).toHaveAttribute('data-show-animation', 'false');
      expect(progressBars[1]).toHaveAttribute('data-progress', '100');
    });
  });

  test('preserves existing countdown functionality', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime - 3 * 60; // 3 minutes ago
    
    mockProtocolContract.userStakes
      .mockResolvedValueOnce([
        '1', // id
        '1000000000000000000000',
        startTime,
        7, // 7 minute cycle
        true, // active
        '30000000000000000000' // paid
      ])
      .mockRejectedValueOnce(new Error('No more stakes'));

    render(<LiquidityPositions />);

    await waitFor(() => {
      // Should still show countdown timer
      expect(screen.getByText(/Countdown|倒计时/)).toBeInTheDocument();
      
      // Should show time remaining (approximately 4 minutes)
      const countdownElement = screen.getByText(/04:00|4分/);
      expect(countdownElement).toBeInTheDocument();
      
      // Progress bar should also be present
      expect(screen.getByTestId('golden-progress-bar')).toBeInTheDocument();
    });
  });
});