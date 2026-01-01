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

// Mock Lucide React icons - return null for all icons (no JSX in .ts file)
vi.mock('lucide-react', () => ({
  Zap: () => null,
  Clock: () => null,
  TrendingUp: () => null,
  AlertCircle: () => null,
  ArrowRight: () => null,
  ShieldCheck: () => null,
  Lock: () => null,
  Package: () => null,
  History: () => null,
  ChevronDown: () => null,
  ChevronUp: () => null,
  CheckCircle: () => null,
  XCircle: () => null,
  Info: () => null,
  Wallet: () => null,
  Users: () => null,
  RefreshCw: () => null,
  Settings: () => null,
  Menu: () => null,
  X: () => null,
  Copy: () => null,
  ExternalLink: () => null,
  Loader2: () => null,
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