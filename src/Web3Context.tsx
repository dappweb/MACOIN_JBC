import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { ethers } from "ethers"
import { useAccount, useChainId, useDisconnect } from "wagmi"
import { useEthersProvider, useEthersSigner } from "./wagmi-adapters"
import { useConnectModal } from "@rainbow-me/rainbowkit"

// Native MC Protocol ABI - No MC token contract needed
export const PROTOCOL_ABI = [
  "function bindReferrer(address _referrer) external",
  "function buyTicket() external payable",
  "function stakeLiquidity(uint256 cycleDays) external payable",
  "function claimRewards() external",
  "function redeem() external",
  "function swapMCToJBC() external payable",
  "function swapJBCToMC(uint256 jbcAmount) external",
  "function dailyBurn() external",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function getDirectReferrals(address) view returns (address[])",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 percent)",
  "function owner() view returns (address)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lp, uint256 _treasury) external",
  "function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external",
  "function setRedemptionFeePercent(uint256 _fee) external",
  "function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external",
  "function addLiquidity(uint256 jbcAmount) external payable",
  "function withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC) external",
  "function rescueTokens(address token, address to, uint256 amount) external",
  "function transferOwnership(address newOwner) external",
  "function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external",
  "function setTicketFlexibilityDuration(uint256 _duration) external",
  "function adminSetReferrer(address user, address newReferrer) external",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event TicketExpired(address indexed user, uint256 ticketId, uint256 amount)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount)",
  "event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount)",
  "event Redeemed(address indexed user, uint256 principal, uint256 fee)",
  "event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax)",
  "event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax)",
]

export const DAILY_BURN_MANAGER_ABI = [
  "function dailyBurn() external",
  "function canBurn() view returns (bool)",
  "function nextBurnTime() view returns (uint256)",
  "function getBurnAmount() view returns (uint256)",
  "function timeUntilNextBurn() view returns (uint256)",
  "function lastBurnTime() view returns (uint256)",
  "function emergencyPause() external",
  "function resumeBurn() external",
  "function owner() view returns (address)",
  "event DailyBurnExecuted(uint256 burnAmount, uint256 timestamp, address executor)"
]

// Contract Addresses - MC Chain Testnet (Native MC Version)
export const CONTRACT_ADDRESSES = {
  // MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF", // No longer needed
  JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
  PROTOCOL: "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5", // Will be updated with native MC version
  DAILY_BURN_MANAGER: "0x6C2FdDEb939D92E0dde178845F570FC4E0d213bc"
};

interface Web3ContextType {
  provider: ethers.Provider | null
  signer: ethers.Signer | null
  account: string | null
  connectWallet: () => void
  disconnectWallet: () => void
  isConnected: boolean
  // mcContract: ethers.Contract | null  // Removed - no longer needed
  jbcContract: ethers.Contract | null
  protocolContract: ethers.Contract | null
  // Native MC balance management
  mcBalance: bigint | null
  refreshMcBalance: () => Promise<void>
  hasReferrer: boolean
  isOwner: boolean
  referrerAddress: string | null
  checkReferrerStatus: () => Promise<void>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const provider = useEthersProvider({ chainId })
  const signer = useEthersSigner({ chainId })
  const { openConnectModal } = useConnectModal()

  // Removed mcContract state - no longer needed
  const [jbcContract, setJbcContract] = useState<ethers.Contract | null>(null)
  const [protocolContract, setProtocolContract] = useState<ethers.Contract | null>(null)
  const [mcBalance, setMcBalance] = useState<bigint | null>(null)
  const [hasReferrer, setHasReferrer] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<string | null>(null)

  // Native MC balance refresh function
  const refreshMcBalance = async () => {
    if (!provider || !address) {
      setMcBalance(null)
      return
    }
    
    try {
      const balance = await provider.getBalance(address)
      setMcBalance(balance)
    } catch (error) {
      console.error("Failed to fetch native MC balance:", error)
      setMcBalance(null)
    }
  }

  useEffect(() => {
    checkOwner()
  }, [protocolContract, address])

  useEffect(() => {
    if (signer) {
      // Init Contracts with Signer (Write access) - No MC contract needed
      const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, ["function transfer(address to, uint256 amount) external returns (bool)", "function transferFrom(address from, address to, uint256 amount) external returns (bool)", "function balanceOf(address account) external view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)", "function allowance(address owner, address spender) external view returns (uint256)"], signer)
      const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, signer)
      setJbcContract(_jbc)
      setProtocolContract(_protocol)
    } else if (provider) {
      // Init Contracts with Provider (Read only) - No MC contract needed
      const _jbc = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, ["function transfer(address to, uint256 amount) external returns (bool)", "function transferFrom(address from, address to, uint256 amount) external returns (bool)", "function balanceOf(address account) external view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)", "function allowance(address owner, address spender) external view returns (uint256)"], provider)
      const _protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider)
      setJbcContract(_jbc)
      setProtocolContract(_protocol)
    } else {
      setJbcContract(null)
      setProtocolContract(null)
    }
  }, [signer, provider])

  // Refresh native MC balance when provider or address changes
  useEffect(() => {
    refreshMcBalance()
  }, [provider, address])

  const checkOwner = async () => {
    if (protocolContract && address) {
      try {
        console.log("🔍 [Web3Context] 检查owner状态...", {
          address,
          contractAddress: await protocolContract.getAddress().catch(() => "Unknown")
        });
        
        const owner = await protocolContract.owner()
        const isOwnerAccount = owner.toLowerCase() === address.toLowerCase()
        
        console.log("✅ [Web3Context] Owner检查结果:", {
          contractOwner: owner,
          userAddress: address,
          isOwner: isOwnerAccount
        });
        
        setIsOwner(isOwnerAccount)
      } catch (e) {
        console.error("❌ [Web3Context] Failed to check owner:", e)
        setIsOwner(false)
      }
    } else {
      console.log("⚠️ [Web3Context] 无法检查owner - 缺少合约或地址");
      setIsOwner(false)
    }
  }

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
      console.error("Error checking referrer status:", err)
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

  const disconnectWallet = () => {
    disconnect()
    setHasReferrer(false)
    setIsOwner(false)
    setReferrerAddress(null)
    setMcBalance(null)
  }

  return (
    <Web3Context.Provider
      value={{
        provider: provider || null,
        signer: signer || null,
        account: address || null,
        connectWallet,
        disconnectWallet,
        isConnected,
        // mcContract, // Removed - no longer needed
        jbcContract,
        protocolContract,
        mcBalance,
        refreshMcBalance,
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
