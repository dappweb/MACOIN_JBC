import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { ethers } from "ethers"
import { useAccount, useChainId } from "wagmi"
import { useEthersProvider, useEthersSigner } from "./wagmi-adapters"
import { useConnectModal } from "@rainbow-me/rainbowkit"

// Partial ABIs
export const MC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]

export const PROTOCOL_ABI = [
  "function bindReferrer(address _referrer) external",
  "function expireMyTicket() external",
  "function buyTicket(uint256 amount) external",
  "function stakeLiquidity(uint256 amount, uint256 cycleDays) external",
  "function claimRewards() external",
  "function redeem() external",
  "function swapMCToJBC(uint256 mcAmount) external",
  "function swapJBCToMC(uint256 jbcAmount) external",
  "function dailyBurn() external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function getDirectReferrals(address) view returns (address[])",
  "function getDirectReferralsData(address) view returns (tuple(address user, uint256 ticketAmount, uint256 joinTime)[])",
  "function owner() view returns (address)",
  "function setWallets(address, address, address, address) external",
  "function setDistributionPercents(uint256, uint256, uint256, uint256, uint256, uint256) external",
  "function setSwapTaxes(uint256, uint256) external",
  "function setRedemptionFee(uint256) external",
  "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external",
  "function adminWithdrawMC(uint256 amount, address to) external",
  "function adminWithdrawJBC(uint256 amount, address to) external",
  "function adminSetUserStats(address, uint256, uint256) external",
  "function adminSetReferrer(address, address) external",
  "function getJBCPrice() view returns (uint256)",
  "function getAmountOut(uint256, uint256, uint256) pure returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  "function setLevelConfigs(tuple(uint256 minDirects, uint256 level, uint256 percent)[]) external",
  "function setTicketFlexibilityDuration(uint256) external",
  "function setLiquidityEnabled(bool) external",
  "function setRedeemEnabled(bool) external",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event TicketExpired(address indexed user, uint256 ticketId, uint256 amount)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)",
  "event Redeemed(address indexed user, uint256 principal, uint256 fee)",
  "event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax)",
  "event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax)",
]

// Contract Addresses
export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
  JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
  PROTOCOL: "0xe4D97D48A2EE5Fb2aBAe282100d09BCd4C81a475"
};

interface Web3ContextType {
  provider: ethers.Provider | null
  signer: ethers.Signer | null
  account: string | null
  connectWallet: () => void
  isConnected: boolean
  mcContract: ethers.Contract | null
  jbcContract: ethers.Contract | null
  protocolContract: ethers.Contract | null
  hasReferrer: boolean
  isOwner: boolean
  referrerAddress: string | null
  checkReferrerStatus: () => Promise<void>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const provider = useEthersProvider({ chainId })
  const signer = useEthersSigner({ chainId })
  const { openConnectModal } = useConnectModal()

  const [mcContract, setMcContract] = useState<ethers.Contract | null>(null)
  const [jbcContract, setJbcContract] = useState<ethers.Contract | null>(null)
  const [protocolContract, setProtocolContract] = useState<ethers.Contract | null>(null)
  const [hasReferrer, setHasReferrer] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<string | null>(null)

  useEffect(() => {
    const checkOwner = async () => {
      if (protocolContract && address) { // Use address from useAccount() instead of account from context
        try {
          const owner = await protocolContract.owner()
          setIsOwner(owner.toLowerCase() === address.toLowerCase())
        } catch (e) {
          console.error("Failed to check owner in Web3Context", e)
        }
      }
    }
    checkOwner()
  }, [protocolContract, address])

  useEffect(() => {
    if (signer) {
      // Init Contracts with Signer (Write access)
      const _mc = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, signer)
      const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, MC_ABI, signer)
      const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, signer)
      setMcContract(_mc)
      setJbcContract(_jbc)
      setProtocolContract(_protocol)
    } else if (provider) {
      // Init Contracts with Provider (Read only)
      const _mc = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, provider)
      const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, MC_ABI, provider)
      const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider)
      setMcContract(_mc)
      setJbcContract(_jbc)
      setProtocolContract(_protocol)
    } else {
      setMcContract(null)
      setJbcContract(null)
      setProtocolContract(null)
    }
  }, [signer, provider])

  // 检查推荐人状态
  const checkReferrerStatus = async () => {
    if (!protocolContract || !address) {
      setHasReferrer(false)
      setIsOwner(false)
      setReferrerAddress(null)
      return
    }

    try {
      // 检查是否是管理员
      const owner = await protocolContract.owner()
      const ownerStatus = owner.toLowerCase() === address.toLowerCase()
      setIsOwner(ownerStatus)

      // 如果是管理员，不需要推荐人
      if (ownerStatus) {
        setHasReferrer(true)
        setReferrerAddress(null)
        return
      }

      // 检查是否有推荐人
      const userInfo = await protocolContract.userInfo(address)
      const referrer = userInfo[0] // referrer is first return value
      const hasRef = referrer !== ethers.ZeroAddress
      setHasReferrer(hasRef)
      setReferrerAddress(hasRef ? referrer : null)
      
    } catch (err) {
      setHasReferrer(false)
      setIsOwner(false)
      setReferrerAddress(null)
    }
  }

  useEffect(() => {
    // Check for referral code in URL
    const searchParams = new URLSearchParams(window.location.search)
    const ref = searchParams.get("ref")
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem("pendingReferrer", ref)
    }
  }, [])

  // 检查推荐人状态
  useEffect(() => {
    checkReferrerStatus()
  }, [protocolContract, address])

  // Auto-bind referrer when connected
  useEffect(() => {
    const bindReferrer = async () => {
      const pendingRef = localStorage.getItem("pendingReferrer")
      if (isConnected && address && protocolContract && pendingRef) {
        // Changed 'account' to 'address'
        // Validate
        if (pendingRef.toLowerCase() === address.toLowerCase()) return // Self-ref

        try {
          // Check if already bound
          const userInfo = await protocolContract.userInfo(address)
          const currentReferrer = userInfo[0] // referrer is first return val

          if (currentReferrer === ethers.ZeroAddress) {
            console.log("Binding referrer:", pendingRef)
            // Call bind
            const tx = await protocolContract.bindReferrer(pendingRef)
            await tx.wait()
            console.log("Bind successful")
            // Clear pending
            localStorage.removeItem("pendingReferrer")
            // 重新检查推荐人状态
            await checkReferrerStatus()
            // Optional: Show toast or reload
          } else {
            // Already bound
            localStorage.removeItem("pendingReferrer")
          }
        } catch (err) {
          console.error("Auto-bind failed", err)
        }
      }
    }
    bindReferrer()
  }, [isConnected, address, protocolContract]) // Changed dependency from 'account' to 'address'

  const connectWallet = () => {
    if (openConnectModal) {
      openConnectModal()
    }
  }

  return (
    <Web3Context.Provider
      value={{
        provider: provider || null,
        signer: signer || null,
        account: address || null,
        connectWallet,
        isConnected,
        mcContract,
        jbcContract,
        protocolContract,
        hasReferrer,
        isOwner,
        referrerAddress,
        checkReferrerStatus,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}

export const useWeb3 = () => {
  const context = useContext(Web3Context)
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}
