import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MiningPanel } from '../MiningPanel'
import { useWeb3 } from '../../Web3Context'
import { useLanguage } from '../../LanguageContext'

// Mock dependencies
vi.mock('../../Web3Context')
vi.mock('../../LanguageContext')
vi.mock('../../hooks/useGlobalRefresh')

const mockUseWeb3 = vi.mocked(useWeb3)
const mockUseLanguage = vi.mocked(useLanguage)

describe('MiningPanel - Simplified Staking Logic', () => {
  const mockProtocolContract = {
    stakeLiquidity: vi.fn(),
    userTicket: vi.fn(),
    userInfo: vi.fn(),
    userStakes: vi.fn(),
  }

  const mockMcContract = {
    balanceOf: vi.fn(),
    allowance: vi.fn(),
    approve: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseLanguage.mockReturnValue({
      language: 'zh',
      t: {
        mining: {
          stake: '质押',
          exited: '已出局',
          canStake: '可质押',
          invalidAmount: '无效金额',
          stakeSuccess: '质押成功',
          stakeFailed: '质押失败',
        }
      }
    })

    mockUseWeb3.mockReturnValue({
      isConnected: true,
      account: '0x123',
      protocolContract: mockProtocolContract,
      mcContract: mockMcContract,
    })
  })

  describe('Staking Conditions', () => {
    it('should show stake button when not exited', async () => {
      // Mock user not exited
      mockProtocolContract.userTicket.mockResolvedValue({
        amount: 1000n,
        exited: false,
        purchaseTime: Math.floor(Date.now() / 1000),
      })

      mockProtocolContract.userInfo.mockResolvedValue({
        isActive: false,
        totalRevenue: 0n,
        currentCap: 3000n,
        maxSingleTicketAmount: 1000n,
      })

      render(<MiningPanel />)

      await waitFor(() => {
        expect(screen.getByText('质押')).toBeInTheDocument()
      })
    })

    it('should show exited state when user has exited', async () => {
      // Mock user exited
      mockProtocolContract.userTicket.mockResolvedValue({
        amount: 1000n,
        exited: true,
        purchaseTime: Math.floor(Date.now() / 1000),
      })

      mockProtocolContract.userInfo.mockResolvedValue({
        isActive: false,
        totalRevenue: 3000n,
        currentCap: 3000n,
        maxSingleTicketAmount: 1000n,
      })

      render(<MiningPanel />)

      await waitFor(() => {
        expect(screen.getByText('已出局')).toBeInTheDocument()
      })
    })

    it('should allow any amount staking', async () => {
      mockProtocolContract.userTicket.mockResolvedValue({
        amount: 1000n,
        exited: false,
        purchaseTime: Math.floor(Date.now() / 1000),
      })

      mockMcContract.balanceOf.mockResolvedValue(10000n)
      mockMcContract.allowance.mockResolvedValue(10000n)
      mockProtocolContract.stakeLiquidity.mockResolvedValue({ wait: vi.fn() })

      render(<MiningPanel />)

      // 输入任意金额
      const amountInput = screen.getByPlaceholderText(/输入质押金额/)
      fireEvent.change(amountInput, { target: { value: '1' } })

      const stakeButton = screen.getByText('质押')
      fireEvent.click(stakeButton)

      await waitFor(() => {
        expect(mockProtocolContract.stakeLiquidity).toHaveBeenCalledWith(
          expect.any(BigInt),
          expect.any(Number)
        )
      })
    })
  })

  describe('No Time Restrictions', () => {
    it('should allow staking regardless of purchase time', async () => {
      // Mock old ticket (> 72 hours)
      const oldPurchaseTime = Math.floor(Date.now() / 1000) - (73 * 60 * 60)
      
      mockProtocolContract.userTicket.mockResolvedValue({
        amount: 1000n,
        exited: false,
        purchaseTime: oldPurchaseTime,
      })

      mockMcContract.balanceOf.mockResolvedValue(10000n)
      mockMcContract.allowance.mockResolvedValue(10000n)

      render(<MiningPanel />)

      // Should still show stake button
      await waitFor(() => {
        expect(screen.getByText('质押')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid amount error', async () => {
      render(<MiningPanel />)

      const amountInput = screen.getByPlaceholderText(/输入质押金额/)
      fireEvent.change(amountInput, { target: { value: '0' } })

      const stakeButton = screen.getByText('质押')
      fireEvent.click(stakeButton)

      await waitFor(() => {
        expect(screen.getByText('无效金额')).toBeInTheDocument()
      })
    })

    it('should handle contract errors gracefully', async () => {
      mockProtocolContract.stakeLiquidity.mockRejectedValue(
        new Error('AlreadyExited')
      )

      mockMcContract.balanceOf.mockResolvedValue(10000n)
      mockMcContract.allowance.mockResolvedValue(10000n)

      render(<MiningPanel />)

      const amountInput = screen.getByPlaceholderText(/输入质押金额/)
      fireEvent.change(amountInput, { target: { value: '100' } })

      const stakeButton = screen.getByText('质押')
      fireEvent.click(stakeButton)

      await waitFor(() => {
        expect(screen.getByText(/质押失败/)).toBeInTheDocument()
      })
    })
  })

  describe('UI State Management', () => {
    it('should disable stake button when exited', async () => {
      mockProtocolContract.userTicket.mockResolvedValue({
        amount: 1000n,
        exited: true,
        purchaseTime: Math.floor(Date.now() / 1000),
      })

      render(<MiningPanel />)

      await waitFor(() => {
        const button = screen.getByText('已出局')
        expect(button).toBeDisabled()
      })
    })

    it('should show loading state during transaction', async () => {
      mockProtocolContract.stakeLiquidity.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      mockMcContract.balanceOf.mockResolvedValue(10000n)
      mockMcContract.allowance.mockResolvedValue(10000n)

      render(<MiningPanel />)

      const amountInput = screen.getByPlaceholderText(/输入质押金额/)
      fireEvent.change(amountInput, { target: { value: '100' } })

      const stakeButton = screen.getByText('质押')
      fireEvent.click(stakeButton)

      expect(screen.getByText(/处理中/)).toBeInTheDocument()
    })
  })

  describe('Integration with Web3', () => {
    it('should handle wallet disconnection', () => {
      mockUseWeb3.mockReturnValue({
        isConnected: false,
        account: null,
        protocolContract: null,
        mcContract: null,
      })

      render(<MiningPanel />)

      expect(screen.getByText(/连接钱包/)).toBeInTheDocument()
    })

    it('should handle contract call failures', async () => {
      mockProtocolContract.userTicket.mockRejectedValue(
        new Error('Network error')
      )

      render(<MiningPanel />)

      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument()
      })
    })
  })
})