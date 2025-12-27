import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Web3 providers
global.window = Object.assign(global.window, {
  ethereum: {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
})

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    parseEther: vi.fn((value) => BigInt(value) * BigInt(10 ** 18)),
    formatEther: vi.fn((value) => (Number(value) / 10 ** 18).toString()),
    MaxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
    Contract: vi.fn(),
    BrowserProvider: vi.fn(),
  },
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Zap: () => <div data-testid="zap-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  Package: () => <div data-testid="package-icon" />,
  History: () => <div data-testid="history-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronUp: () => <div data-testid="chevron-up-icon" />,
}))

// Global test utilities
global.testUtils = {
  mockUserTicket: (overrides = {}) => ({
    amount: 1000n,
    exited: false,
    purchaseTime: Math.floor(Date.now() / 1000),
    ...overrides,
  }),
  
  mockUserInfo: (overrides = {}) => ({
    isActive: false,
    totalRevenue: 0n,
    currentCap: 3000n,
    maxSingleTicketAmount: 1000n,
    ...overrides,
  }),
}