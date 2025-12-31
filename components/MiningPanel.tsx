import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TICKET_TIERS, MINING_PLANS } from '../src/constants';
import { MiningPlan, TicketTier } from '../src/types';
import { Zap, Clock, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Lock, Package, History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useLanguage } from '../src/LanguageContext';
import { useWeb3 } from '../src/Web3Context';
import { useGlobalRefresh, useEventRefresh } from '../hooks/useGlobalRefresh';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatContractError } from '../utils/errorFormatter';
import { useChineseErrorFormatter } from '../utils/chineseErrorFormatter';
import { showFriendlyError, showInsufficientBalanceError } from './ErrorToast';
import { detectTimeConfig, TimeUtils, type TimeConfig } from '../src/utils/timeUtils';
import LiquidityPositions from './LiquidityPositions';
import GoldenProgressBar from './GoldenProgressBar';

// Skeleton components for loading states
const SkeletonCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-800/50 rounded-xl p-4 border border-gray-700 ${className}`}>
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
    <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-gray-700 rounded w-full"></div>
  </div>
);

const SkeletonButton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-700 rounded-xl h-12 ${className}`}></div>
);

type TicketInfo = {
  amount: bigint;
  requiredLiquidity: bigint;
  purchaseTime: number;
  liquidityProvided: boolean;
  redeemed: boolean;
  startTime: number;
  cycleDays: number;
  totalRevenue: bigint;
  currentCap: bigint;
  exited: boolean;
  maxTicketAmount: bigint; // Added field
  maxSingleTicketAmount: bigint; // New field for single ticket max
};

type StakeInfo = {
  id: bigint;
  amount: bigint;
  startTime: number;
  cycleDays: number;
  active: boolean;
  paid: bigint;
};

type TicketHistoryItem = {
    ticketId: string;
    amount: string;
    purchaseTime: number;
    status: 'Pending' | 'Mining' | 'Completed' | 'Expired';
    cycleDays?: number;
    startTime?: number;
    endTime?: number;
};

// Unified user mining state enum
enum UserMiningState {
  NOT_CONNECTED = 'not_connected',
  NO_TICKET = 'no_ticket',
  TICKET_EXPIRED = 'ticket_expired',
  NEEDS_APPROVAL = 'needs_approval',
  READY_TO_STAKE = 'ready_to_stake',
  ALREADY_STAKED = 'already_staked',
  MINING_COMPLETE = 'mining_complete'
}

type ButtonState = {
  text: string;
  action: (() => void) | null;
  disabled: boolean;
  className: string;
};

const MiningPanel: React.FC = () => {
  const [selectedTicket, setSelectedTicket] = useState<TicketTier>(TICKET_TIERS[0]);
  const [selectedPlan, setSelectedPlan] = useState<MiningPlan>(MINING_PLANS[0]);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [inputReferrerAddress, setInputReferrerAddress] = useState('');
  const [isBindingReferrer, setIsBindingReferrer] = useState(false);
  
  // Loading states for better UX
  const [isLoadingTicketStatus, setIsLoadingTicketStatus] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // 历史记录状态
  const [ticketHistory, setTicketHistory] = useState<TicketHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [maxUnredeemedTicket, setMaxUnredeemedTicket] = useState<number>(0); // 未赎回的最大门票金额
  const [activeStake, setActiveStake] = useState<StakeInfo | null>(null);
  
  const [liquidityAmountInput, setLiquidityAmountInput] = useState('');
  const [stakeAmount, setStakeAmount] = useState<bigint>(0n);
  const [ticketFlexibilityDuration, setTicketFlexibilityDuration] = useState<number>(72 * 3600);
  const [secondsInUnit, setSecondsInUnit] = useState<number>(60); // 从合约获取的时间单位
  const [timeConfig, setTimeConfig] = useState<TimeConfig | null>(null); // 时间配置
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000)); // 用于倒计时
  
  const { t, language } = useLanguage();
  const { formatError, getSuggestion } = useChineseErrorFormatter();
  const { protocolContract, account, isConnected, hasReferrer, isOwner, referrerAddress, checkReferrerStatus, provider, mcBalance } = useWeb3();
  
  // 使用全局刷新机制
  const { balances, priceData, onTransactionSuccess, refreshAll } = useGlobalRefresh();
  
  // 从全局状态获取JBC价格
  const jbcPrice = priceData.jbcPrice;

  // 监听事件刷新
  useEventRefresh('ticketStatusChanged', () => {
    checkTicketStatus();
    fetchHistory();
  });

  useEventRefresh('stakingStatusChanged', () => {
    checkTicketStatus();
    fetchHistory();
  });

  useEventRefresh('rewardsChanged', () => {
    checkTicketStatus();
  });
  // Auto-select ticket tier if user has bought one
  useEffect(() => {
    if (ticketInfo && ticketInfo.amount > 0n) {
        const amount = parseFloat(ethers.formatEther(ticketInfo.amount));
        const tier = TICKET_TIERS.find(t => t.amount === amount);
        if (tier) {
            setSelectedTicket(tier);
        }
    }
  }, [ticketInfo]);

  // 移除自动设置流动性金额的逻辑 - 用户可以自由输入任意金额
  // useEffect(() => {
  //   if (ticketInfo && ticketInfo.amount > 0n) {
  //       const contractMaxSingle = ticketInfo.maxSingleTicketAmount ? parseFloat(ethers.formatEther(ticketInfo.maxSingleTicketAmount)) : 0;
  // Calculate 1.5x of max single ticket amount for liquidity input
  useEffect(() => {
    if (ticketInfo) {
      const contractMaxSingle = ticketInfo.maxSingleTicketAmount ? parseFloat(ethers.formatEther(ticketInfo.maxSingleTicketAmount)) : 0;
      
      // Use maxUnredeemedTicket as fallback if needed, but contractMaxSingle is best
      const historyMax = maxUnredeemedTicket;
      
      let baseAmount = 0;

      // 优先级 1: 合约记录的单张最大值 (最准确)
      if (contractMaxSingle > 0) {
          baseAmount = contractMaxSingle;
      }
      // 优先级 2: 前端回溯的历史单张最大值 (备选)
      else if (historyMax > 0) {
          baseAmount = historyMax;
      }
      
      if (baseAmount > 0) {
          const required = baseAmount * 1.5;
          setLiquidityAmountInput(required.toString());
      }
    }
  }, [ticketInfo, maxUnredeemedTicket]);

  // Handle liquidity amount change (Sync state)
  useEffect(() => {
    try {
        if (liquidityAmountInput) {
            setStakeAmount(ethers.parseEther(liquidityAmountInput));
        } else {
            setStakeAmount(0n);
        }
    } catch (e) {
        setStakeAmount(0n);
    }
  }, [liquidityAmountInput]);

  // Update calculations
  const dailyROI = (Number(liquidityAmountInput || 0) * selectedPlan.dailyRate) / 100;
  const totalROI = dailyROI * selectedPlan.days;

  // 向导步骤状态
  const [currentStep, setCurrentStep] = useState(1);

  // 3倍上限计算
  // Fix: Use bought ticket amount for max cap calculation if available, otherwise use selected ticket
  const activeTicketAmount = ticketInfo && ticketInfo.amount > 0n 
    ? parseFloat(ethers.formatEther(ticketInfo.amount)) 
    : selectedTicket.amount;
  
  const maxCap = activeTicketAmount * 3;

  // Calculate total investment required for current step (for allowance check)
  const totalInvestment = useMemo(() => {
    if (currentStep === 1) {
        return selectedTicket.amount;
    } 
    return Number(liquidityAmountInput) || 0;
  }, [currentStep, selectedTicket.amount, liquidityAmountInput]);

  // Revenue & Progress
  const currentRevenueWei = ticketInfo?.totalRevenue || 0n;
  const currentRevenue = parseFloat(ethers.formatEther(currentRevenueWei));
  // Use maxCap (calculated based on active ticket) as fallback
  const displayCap = ticketInfo && ticketInfo.currentCap > 0n ? parseFloat(ethers.formatEther(ticketInfo.currentCap)) : maxCap;
  const progressPercent = displayCap > 0 ? Math.min((currentRevenue / displayCap) * 100, 100) : 0;

  const now = Math.floor(Date.now() / 1000);
  const hasTicket = !!ticketInfo && ticketInfo.amount > 0n;
  const isExited = !!ticketInfo && ticketInfo.exited;
  const [hasStaked, setHasStaked] = useState(false);

  // New: Check if user has actually staked liquidity (by checking history or stakes array length if available)
  // Since we don't have stakes array in ticketInfo, we can infer from history or just use a new logic.
  // Ideally, we should fetch stakes from contract. For now, let's use a simple heuristic:
  // If ticketInfo.totalRevenue > 0, they definitely staked.
  // If not, we might need to check stakes count.
  // Let's assume 'liquidityProvided' in ticketInfo was meant for this but is deprecated.
  // 检查用户是否已经质押流动性
  // 使用更可靠的方法：检查是否有总收益或者历史记录中有挖矿状态
  const hasStakedLiquidity = useMemo(() => {
      if (hasStaked) return true;
      if (!ticketInfo) return false;
      
      // 如果有总收益，说明已经开始挖矿
      if (ticketInfo.totalRevenue > 0n) return true;
      
      // 检查历史记录中是否有挖矿状态（不依赖ticketId匹配）
      return ticketHistory.some(item => (item.status === 'Mining' || item.status === 'Completed'));
  }, [ticketHistory, ticketInfo, hasStaked]);
  
  // 简化逻辑：只检查是否已达到3倍出局
  const canStakeLiquidity = !isExited;
  const isTicketBought = hasTicket && !isExited;
  const hasValidTicket = hasTicket && !isExited; // Renamed from hasActiveTicket to avoid confusion

  // Check if any mining stake is expired and redeemable
  const isRedeemable = useMemo(() => {
    // 1. Check ticket history for any 'Mining' status items that have passed their endTime
    const hasExpiredMining = ticketHistory.some(item => 
      item.status === 'Mining' && 
      item.endTime && 
      item.endTime <= currentTime
    );
    
    // 2. Check activeStake from direct contract check
    const isActiveStakeExpired = !!(activeStake && activeStake.active && 
      (activeStake.startTime + activeStake.cycleDays * secondsInUnit) <= currentTime);
      
    return hasExpiredMining || isActiveStakeExpired;
  }, [ticketHistory, activeStake, currentTime, secondsInUnit]);

  const getUserMiningState = (): UserMiningState => {
    if (!isConnected) return UserMiningState.NOT_CONNECTED;
    if (isCheckingAllowance) return UserMiningState.NOT_CONNECTED; // Treat as not ready
    if (isExited) return UserMiningState.MINING_COMPLETE;
    // Allow continuous staking unless exited
    // if (hasStakedLiquidity) return UserMiningState.ALREADY_STAKED;
    if (!isApproved) return UserMiningState.NEEDS_APPROVAL;
    return UserMiningState.READY_TO_STAKE;
  };

  // Unified button state function
  const getStakingButtonState = (userState: UserMiningState): ButtonState => {
    switch (userState) {
      case UserMiningState.NOT_CONNECTED:
        return {
          text: t.mining.walletNotConnected || 'Connect Wallet',
          action: null,
          disabled: true,
          className: 'w-full py-3 bg-gray-800 text-gray-500 font-bold rounded-lg cursor-not-allowed border border-gray-700'
        };
      case UserMiningState.NO_TICKET:
        return {
          text: `${t.mining.buyTicket} (Top)`,
          action: handleScrollToBuy,
          disabled: false,
          className: 'w-full py-3 text-neon-400 font-semibold rounded-lg border border-neon-500/30 hover:bg-neon-500/10 transition-colors'
        };
      case UserMiningState.TICKET_EXPIRED:
        return {
          text: t.mining.buyTicket,
          action: handleScrollToBuy,
          disabled: false,
          className: 'w-full py-3 text-red-400 font-semibold rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors'
        };
      case UserMiningState.NEEDS_APPROVAL:
        return {
          text: txPending ? t.mining.approving : t.mining.approve,
          action: handleApprove,
          disabled: txPending,
          className: 'w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors border border-gray-600 disabled:opacity-50'
        };
      case UserMiningState.READY_TO_STAKE:
        return {
          text: txPending ? t.mining.staking : t.mining.stake,
          action: handleStake,
          disabled: txPending || stakeAmount <= 0n,
          className: 'w-full py-4 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-extrabold text-lg rounded-lg shadow-lg shadow-neon-500/40 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50'
        };
      case UserMiningState.ALREADY_STAKED:
        return {
          text: t.mining.alreadyStaked || 'Already Staking',
          action: null,
          disabled: true,
          className: 'w-full py-3 bg-green-500/20 text-green-400 font-bold rounded-lg border border-green-500/30 cursor-not-allowed'
        };
      case UserMiningState.MINING_COMPLETE:
        return {
          text: t.mining.completed || 'Mining Complete',
          action: null,
          disabled: true,
          className: 'w-full py-3 bg-purple-500/20 text-purple-400 font-bold rounded-lg border border-purple-500/30 cursor-not-allowed'
        };
      default:
        return {
          text: t.mining.unknownStatus || 'Unknown Status',
          action: null,
          disabled: true,
          className: 'w-full py-4 bg-gray-800 text-gray-500 font-bold text-lg rounded-lg cursor-not-allowed border border-gray-700'
        };
    }
  };

  // 获取单张最大门票金额的辅助函数
  const getMaxSingleTicketAmount = useCallback(() => {
    // 优先使用合约记录的单张最大金额
    if (ticketInfo?.maxSingleTicketAmount && ticketInfo.maxSingleTicketAmount > 0n) {
      return parseFloat(ethers.formatEther(ticketInfo.maxSingleTicketAmount));
    }
    
    // 如果合约没有记录（老用户），则必须使用当前门票金额作为基准，
    // 而不是使用前端的历史记录，因为合约会回退到 ticket.amount。
    // 如果前端使用历史记录（可能大于当前），会导致计算出的流动性大于合约预期的（当前*1.5），从而导致 InvalidAmount 错误。
    if (ticketInfo && ticketInfo.amount > 0n) {
        return parseFloat(ethers.formatEther(ticketInfo.amount));
    }

    // 备选：使用前端计算的历史单张最大 (仅在没有ticketInfo时使用，实际上很少走到这里)
    if (maxUnredeemedTicket > 0) {
      return maxUnredeemedTicket;
    }
    
    // 最后备选：如果当前金额是标准档位，使用当前金额
    const currentAmount = ticketInfo ? parseFloat(ethers.formatEther(ticketInfo.amount)) : 0;
    if (TICKET_TIERS.some(t => Math.abs(t.amount - currentAmount) < 0.1)) {
      return currentAmount;
    }
    
    return 0;
  }, [ticketInfo, maxUnredeemedTicket]);

  // 移除自动步骤推进逻辑，允许用户自由浏览所有步骤
  // useEffect(() => {
  //     if (hasStakedLiquidity) {
  //         // If already staked, go to dashboard (step 3), but allow going back to 2
  //         if (currentStep < 3) setCurrentStep(3);
  //     } else if (canStakeLiquidity) {
  //         if (currentStep === 1) setCurrentStep(2);
  //     } else {
  //         setCurrentStep(1); // 购买门票
  //     }
  // }, [canStakeLiquidity, hasStakedLiquidity]);

  // 格式化日期辅助函数
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // 倒计时格式化函数 - 根据时间配置动态调整
  const formatCountdown = (endTime: number): string => {
    const remaining = endTime - currentTime;
    if (remaining <= 0) return t.mining?.redeemable || "质押可赎回";
    
    if (!timeConfig) {
      // 如果时间配置还未加载，使用默认格式
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    const totalUnits = Math.floor(remaining / timeConfig.SECONDS_IN_UNIT);
    const remainingSeconds = remaining % timeConfig.SECONDS_IN_UNIT;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    
    if (timeConfig.TIME_UNIT === 'minutes') {
      // 测试环境：显示分钟和秒
      if (totalUnits > 0) {
        return `${totalUnits}${t.mining?.minUnit || '分'} ${seconds}秒`;
      }
      return `${seconds}秒`;
    } else {
      // 生产环境：显示天、小时、分钟
      if (totalUnits > 0) {
        return `${totalUnits}${t.mining?.dayUnit || '天'} ${hours}${t.mining?.hourUnit || '时'} ${minutes}${t.mining?.minUnit || '分'}`;
      }
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const getTicketStatus = () => {
    if (!ticketInfo) return null;
    if (ticketInfo.redeemed) return { label: '流动性已赎回', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' };
    if (isExited) return { label: t.mining.exited, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
    if (hasStakedLiquidity) return { label: t.mining.mining, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' };
    return { label: t.mining.canStake, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' };
  };

  const statusInfo = getTicketStatus();

  const checkTicketStatus = async () => {
      if (!protocolContract || !account) {
          setTicketInfo(null);
          setIsLoadingTicketStatus(false);
          return;
      }

      setIsLoadingTicketStatus(true);
      try {
          const [ticket, userInfo] = await Promise.all([
              protocolContract.userTicket(account),
              protocolContract.userInfo(account)
          ]);

          // 从 userInfo 中获取 maxSingleTicketAmount (新合约结构)
          let maxSingleTicket = 0n;
          if (userInfo.maxSingleTicketAmount) {
              maxSingleTicket = userInfo.maxSingleTicketAmount;
          }

          setTicketInfo({
              amount: ticket.amount,
              requiredLiquidity: 0n, // Deprecated
              purchaseTime: Number(ticket.purchaseTime),
              liquidityProvided: false, // Deprecated, logic changed
              redeemed: false, // Deprecated
              startTime: 0, // Deprecated
              cycleDays: 0, // Deprecated
              totalRevenue: userInfo.totalRevenue,
              currentCap: userInfo.currentCap,
              exited: ticket.exited,
              maxTicketAmount: userInfo.maxTicketAmount,
              maxSingleTicketAmount: maxSingleTicket
          });
      } catch (err) {
          console.error('Failed to check ticket status', err);
          toast.error('Failed to load ticket information. Please try again.');
      } finally {
          setIsLoadingTicketStatus(false);
      }
  };

  const fetchHistory = async () => {
    if (!protocolContract || !account || !provider) return;
    setLoadingHistory(true);
    setIsLoadingHistory(true);
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000000); 

        // 获取事件
        const [purchaseEvents, stakeEvents, redeemEvents] = await Promise.all([
            protocolContract.queryFilter(protocolContract.filters.TicketPurchased(account), fromBlock),
            protocolContract.queryFilter(protocolContract.filters.LiquidityStaked(account), fromBlock),
            protocolContract.queryFilter(protocolContract.filters.Redeemed(account), fromBlock)
        ]);

        // 合并并排序
        const allEvents = [
            ...purchaseEvents.map(e => ({ type: 'purchase', event: e })),
            ...stakeEvents.map(e => ({ type: 'stake', event: e })),
            ...redeemEvents.map(e => ({ type: 'redeem', event: e }))
        ].sort((a, b) => {
            if (a.event.blockNumber !== b.event.blockNumber) {
                return a.event.blockNumber - b.event.blockNumber;
            }
            return a.event.index - b.event.index;
        });

        const historyItems: TicketHistoryItem[] = [];
        let currentItem: TicketHistoryItem | null = null;
        
        // 缓存区块时间戳
        const blockTimestamps: Record<number, number> = {};
        const getBlockTimestamp = async (blockNumber: number) => {
            if (blockTimestamps[blockNumber]) return blockTimestamps[blockNumber];
            const block = await provider.getBlock(blockNumber);
            if (block) {
                blockTimestamps[blockNumber] = block.timestamp;
                return block.timestamp;
            }
            return 0;
        };

        for (const item of allEvents) {
            const e = item.event;
            const args = (e as any).args;
            const timestamp = await getBlockTimestamp(e.blockNumber);

            if (item.type === 'purchase') {
                if (currentItem) {
                    historyItems.push(currentItem);
                }
                currentItem = {
                    ticketId: args[2].toString(),
                    amount: ethers.formatEther(args[1]),
                    purchaseTime: timestamp,
                    status: 'Pending'
                };
            } else if (item.type === 'stake') {
                if (currentItem && currentItem.status === 'Pending') {
                    currentItem.status = 'Mining';
                    currentItem.cycleDays = Number(args[2]);
                    currentItem.startTime = timestamp;
                    currentItem.endTime = timestamp + (currentItem.cycleDays || 0) * secondsInUnit; // 使用合约时间单位
                }
            } else if (item.type === 'redeem') {
                if (currentItem && currentItem.status === 'Mining') {
                    currentItem.status = 'Completed';
                }
            }
        }
        
        if (currentItem) {
            historyItems.push(currentItem);
        }

        const now = Math.floor(Date.now() / 1000);
        // Removed expiration check on frontend to match contract change
        // historyItems.forEach(item => {
        //    if (item.status === 'Pending' && now > item.purchaseTime + ticketFlexibilityDuration) {
        //        item.status = 'Expired';
        //    }
        // });

        setTicketHistory(historyItems.reverse());
        
        // 计算未赎回的最大门票金额
        const unredeemedTickets = historyItems.filter(item => 
            item.status === 'Mining' || item.status === 'Pending'
        );
        
        if (unredeemedTickets.length > 0) {
            const maxAmount = Math.max(...unredeemedTickets.map(item => parseFloat(item.amount)));
            setMaxUnredeemedTicket(maxAmount);
        } else {
            setMaxUnredeemedTicket(0);
        }
    } catch (err) {
        console.error("Failed to fetch history", err);
        toast.error('Failed to load transaction history. Please try again.');
    } finally {
        setLoadingHistory(false);
        setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setIsInitialLoad(true);
      await Promise.all([
        checkTicketStatus(),
        fetchHistory()
      ]);
      setIsInitialLoad(false);
    };
    
    initializeData();
  }, [protocolContract, account]);

  useEffect(() => {
    const fetchFlexDuration = async () => {
      if (!protocolContract) return
      try {
        const duration = await protocolContract.ticketFlexibilityDuration()
        setTicketFlexibilityDuration(Number(duration))
      } catch (e) {
      }
    }
    fetchFlexDuration()
  }, [protocolContract])

  // 获取合约中的时间配置
  useEffect(() => {
    const fetchTimeConfig = async () => {
      if (!protocolContract) return;
      try {
        const config = await detectTimeConfig(protocolContract);
        setTimeConfig(config);
        setSecondsInUnit(config.SECONDS_IN_UNIT);
        console.log('🕒 [MiningPanel] 时间配置:', config);
      } catch (e) {
        console.warn("Failed to fetch time config, using default", e);
        // 默认使用测试环境配置
        const defaultConfig: TimeConfig = {
          SECONDS_IN_UNIT: 60,
          TIME_UNIT: 'minutes',
          RATE_UNIT: 'per minute',
          UNIT_LABEL: '分钟',
          SHORT_UNIT: '分'
        };
        setTimeConfig(defaultConfig);
        setSecondsInUnit(60);
      }
    };
    fetchTimeConfig();
  }, [protocolContract]);

  // 每秒更新 currentTime 用于倒计时显示
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check direct stakes from contract as fallback source of truth
  const checkDirectStakes = async () => {
    if (!protocolContract || !account || !ticketInfo) return;
    try {
        // Try to fetch first 10 stakes. If any is active and matches current ticket timeframe, set hasStaked=true
        // We iterate blindly because we don't know the length.
        let found = false;
        for (let i = 0; i < 10; i++) {
            try {
                const stake = await protocolContract.userStakes(account, i);
                // stake struct: id, amount, startTime, cycleDays, active, paid
                // Note: Ethers returns struct as array-like object with named properties
                const startTime = Number(stake.startTime);
                const active = stake.active;
                
                // If stake is active and started after or at ticket purchase time (with small buffer)
                if (active && startTime >= (ticketInfo.purchaseTime - 60)) {
                    found = true;
                    setActiveStake({
                        id: stake.id,
                        amount: stake.amount,
                        startTime: Number(stake.startTime),
                        cycleDays: Number(stake.cycleDays),
                        active: stake.active,
                        paid: stake.paid
                    });
                    break;
                }
            } catch (e) {
                // End of array or error
                break;
            }
        }
        if (found) {
            setHasStaked(true);
        }
    } catch (e) {
        console.error("Error checking stakes:", e);
    }
  };

  useEffect(() => {
    if (ticketInfo) {
        checkDirectStakes();
    }
  }, [ticketInfo, protocolContract]);

  // 原生MC版本 - 不需要检查授权
  useEffect(() => {
    // 原生MC不需要授权检查，直接设置为已授权
    setIsApproved(true);
    setIsCheckingAllowance(false);
  }, [account, protocolContract, totalInvestment]);

  // 原生MC版本 - 不需要授权函数
  const handleApprove = async () => {
    // 原生MC不需要授权，直接设置为已授权
    setIsApproved(true);
    toast.success('原生MC无需授权，可直接使用');
  };

  const handleScrollToBuy = () => {
      if (typeof window === 'undefined') return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBuyTicket = async () => {
      if (!protocolContract) return;

      // Guard removed: Allow buying multiple tickets or overwriting
      /*
      // Guard: Check if user already has an active ticket
      if (ticketInfo && ticketInfo.amount > 0n && !ticketInfo.exited) {
          toast.error(t.mining.activeTicketExists || "You already have a ticket. Please stake or redeem first.");
          return;
      }
      */
      
      setTxPending(true);
      try {
          // 检查原生MC余额
          const amountWei = ethers.parseEther(selectedTicket.amount.toString());
          const currentMcBalance = mcBalance || 0n;
          
          if (currentMcBalance < amountWei) {
              const required = ethers.formatEther(amountWei);
              const current = ethers.formatEther(currentMcBalance);
              showInsufficientBalanceError(required, current);
              return;
          }

          // 使用原生MC购买门票
          const tx = await protocolContract.buyTicket({ value: amountWei });
          
          // Enhanced loading feedback
          toast.loading('🎫 Processing ticket purchase...', { id: 'buy-ticket' });
          await tx.wait();
          toast.success('🎉 Ticket purchased successfully!', { id: 'buy-ticket' });
          
          // 使用全局刷新机制
          await onTransactionSuccess('ticket_purchase');
          
          // 购买成功后自动跳转到提供流动性页面
          setCurrentStep(2);
      } catch (err: any) {
          console.error(err);
          toast.dismiss('buy-ticket');
          
          // 使用友好的错误提示
          showFriendlyError(err, 'buyTicket');
      } finally {
          setTxPending(false);
      }
  };

  const handleStake = async () => {
      if (!protocolContract || !provider) return;
      if (stakeAmount <= 0n) {
          toast.error(t.mining.invalidAmount || "Invalid amount");
          return;
      }

      setTxPending(true);
      try {
          // 1. 检查原生MC余额
          const requiredAmount = stakeAmount;
          const currentMcBalance = mcBalance || 0n;
          
          if (currentMcBalance < requiredAmount) {
              toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${liquidityAmountInput} MC，${t.mining.currentBalance}: ${ethers.formatEther(currentMcBalance)} MC`);
              return;
          }

          // 2. 检查Gas费用
          try {
              const gasEstimate = await protocolContract.stakeLiquidity.estimateGas(selectedPlan.days, { value: requiredAmount });
              const feeData = await provider.getFeeData();
              const gasCost = gasEstimate * (feeData.gasPrice || 0n);
              const totalRequired = requiredAmount + gasCost;
              
              if (currentMcBalance < totalRequired) {
                  const shortfall = ethers.formatEther(totalRequired - currentMcBalance);
                  toast.error(`余额不足，还需要 ${shortfall} MC 作为Gas费用`);
                  return;
              }
          } catch (error) {
              console.warn("Gas estimation failed, proceeding anyway:", error);
          }

          // 3. 直接执行质押 - 使用原生MC (payable)
          const tx = await protocolContract.stakeLiquidity(selectedPlan.days, { value: requiredAmount });
          
          toast.loading("💎 Staking liquidity...", { id: "stake-liquidity" });
          await tx.wait();

          toast.success("🚀 Liquidity staked successfully!", { id: "stake-liquidity" });
          
          // 使用全局刷新机制
          await onTransactionSuccess('liquidity_stake');
          
          // Clear input and move to dashboard
          setLiquidityAmountInput('');
          setCurrentStep(3);
      } catch (err: any) {
          console.error(t.mining.stakeFailed, err);
          showFriendlyError(err, 'stakeLiquidity');
      } finally {
          setTxPending(false);
      }
  };

  const handleClaim = async () => {
      if (!protocolContract) return;
      setTxPending(true);
      try {
          const tx = await protocolContract.claimRewards();
          await tx.wait();
          toast.success(t.mining.claimSuccess);
          
          // 使用全局刷新机制
          await onTransactionSuccess('claim');
      } catch (err: any) {
          console.error(err);
          showFriendlyError(err, 'claimRewards');
      } finally {
          setTxPending(false);
      }
  };

  const handleRedeem = async () => {
      if (!protocolContract) return;
      setTxPending(true);
      try {
          const tx = await protocolContract.redeem();
          await tx.wait();
          toast.success(t.mining.redeemSuccess);
          
          // 使用全局刷新机制
          await onTransactionSuccess('redeem');
      } catch (err: any) {
          console.error(err);
          showFriendlyError(err, 'redeem');
      } finally {
          setTxPending(false);
      }
  };

  /**
   * 处理绑定推荐人操作
   * Handles the referrer binding operation
   * 
   * 功能流程 / Function Flow:
   * 1. 验证合约实例和输入地址是否存在
   * 2. 验证地址格式的有效性
   * 3. 防止用户绑定自己为推荐人
   * 4. 调用智能合约执行绑定操作
   * 5. 等待交易确认并更新UI状态
   * 
   * @throws {Error} 地址格式无效 / Invalid address format
   * @throws {Error} 不能绑定自己 / Cannot bind yourself
   * @throws {Error} 已经绑定过推荐人 / Already bound a referrer
   */
  const handleBindReferrer = async () => {
      // 前置检查：确保合约实例和输入地址都存在
      // Pre-check: Ensure contract instance and input address exist
      if (!protocolContract || !inputReferrerAddress) return;

      // 验证地址格式是否符合以太坊地址规范
      // Validate if address format conforms to Ethereum address standard
      if (!ethers.isAddress(inputReferrerAddress)) {
          toast.error('Invalid address format!');
          return;
      }

      // 防止用户将自己设置为推荐人（业务逻辑限制）
      // Prevent user from setting themselves as referrer (business logic restriction)
      if (inputReferrerAddress.toLowerCase() === account?.toLowerCase()) {
          toast.error('Cannot bind yourself as referrer!');
          return;
      }

      // 设置加载状态，禁用按钮防止重复提交
      // Set loading state to disable button and prevent duplicate submissions
      setIsBindingReferrer(true);
      try {
          // 调用智能合约的 bindReferrer 方法
          // Call smart contract's bindReferrer method
          const tx = await protocolContract.bindReferrer(inputReferrerAddress);
          
          // 等待交易被区块链确认
          // Wait for transaction to be confirmed on blockchain
          await tx.wait();
          
          // 绑定成功：显示成功提示并清空输入框
          // Binding successful: Show success message and clear input
          toast.success(t.team.bindSuccess);
          setInputReferrerAddress('');
          
          // 重新检查推荐人状态以更新UI
          // Re-check referrer status to update UI
          await checkReferrerStatus();
      } catch (err: any) {
          console.error(err);
          showFriendlyError(err, 'bindReferrer');
      } finally {
          // 无论成功或失败，都重置加载状态
          // Reset loading state regardless of success or failure
          setIsBindingReferrer(false);
      }
  };

  const handleScrollToStake = () => {
      const element = document.getElementById('staking-section');
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 可选：添加高亮效果
          element.classList.add('ring-2', 'ring-neon-500');
          setTimeout(() => element.classList.remove('ring-2', 'ring-neon-500'), 2000);
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in pb-28 md:pb-0">

      <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{t.mining.title}</h2>
        <p className="text-sm md:text-base text-gray-400">{t.mining.subtitle}</p>
      </div>

      {/* Loading State for Initial Load */}
      {isInitialLoad && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <SkeletonButton className="w-32 h-10" />
                {step < 3 && <div className="w-8 h-0.5 mx-2 bg-gray-800" />}
              </div>
            ))}
          </div>
          <SkeletonCard className="h-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SkeletonCard className="h-48" />
            </div>
            <SkeletonCard className="h-48" />
          </div>
        </div>
      )}

      {/* Main Content - Hidden during initial load */}
      {!isInitialLoad && (
        <>
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 md:gap-4 mb-8">
            {[
              { step: 1, label: t.mining.buyTicket, icon: Package },
              { step: 2, label: t.mining.stake, icon: Lock },
              { step: 3, label: t.mining.mining, icon: Zap }
            ].map((s, idx) => {
              const userState = getUserMiningState();
              
              // Determine if step is completed based on unified state
              const isCompleted = (s.step === 1 && userState !== UserMiningState.NOT_CONNECTED && userState !== UserMiningState.NO_TICKET) || 
                                 (s.step === 2 && (userState === UserMiningState.ALREADY_STAKED || userState === UserMiningState.MINING_COMPLETE));
              
              // All steps are accessible for browsing
              const isAccessible = true;
              
              return (
              <div key={s.step} className="flex items-center">
                <button 
                  onClick={() => {
                    if (isAccessible) setCurrentStep(s.step);
                  }}
                  disabled={!isAccessible}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all transform active:scale-95 ${
                    isAccessible ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed opacity-50'
                  } ${
                  currentStep === s.step 
                    ? 'bg-neon-500/20 border-neon-500 text-neon-400 shadow-lg shadow-neon-500/20' 
                    : isCompleted
                      ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                      : 'bg-gray-900/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                     currentStep === s.step ? 'bg-neon-500 text-black' : 
                     isCompleted ? 'bg-green-500 text-black' : 'bg-gray-800'
                  }`}>
                    {isCompleted ? '✓' : s.step}
                  </div>
                  <span className="hidden md:block font-bold text-sm">{s.label}</span>
                </button>
                {idx < 2 && <div className={`w-8 h-0.5 mx-2 transition-colors ${isCompleted ? 'bg-green-500/30' : 'bg-gray-800'}`} />}
              </div>
            )})}
          </div>
        </>
      )}

      {/* 鎺ㄨ崘浜虹粦瀹氭彁绀?- 闈炵鐞嗗憳涓旀湭缁戝畾鎺ㄨ崘浜烘椂鏄剧ず */}
      {isConnected && !hasReferrer && !isOwner && (
        <div className="bg-amber-900/20 border-2 border-amber-500/50 rounded-xl p-6 animate-fade-in backdrop-blur-sm">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <p className="font-bold text-amber-300 text-lg mb-2">{t.referrer.required}</p>
              <p className="text-sm text-amber-200/80 mb-4">
                {t.referrer.requiredDesc}
              </p>

              <div className="bg-black/50 rounded-lg p-4 border border-amber-500/30">
                <input
                  type="text"
                  value={inputReferrerAddress}
                  onChange={(e) => setInputReferrerAddress(e.target.value)}
                  placeholder={t.referrer.enterAddress}
                  className="w-full px-4 py-3 border border-gray-700 bg-gray-900/50 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500 text-sm"
                />
                <button
                  onClick={handleBindReferrer}
                  disabled={isBindingReferrer || !inputReferrerAddress}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
                >
                  {isBindingReferrer ? t.referrer.binding : t.referrer.bind}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 已绑定推荐人提示 - 显示推荐人地址 */}
      {isConnected && hasReferrer && !isOwner && referrerAddress && (
        <div className="bg-neon-900/20 border-2 border-neon-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
          <ShieldCheck className="text-neon-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-neon-300 mb-1">{t.referrer.bound}</p>
            <p className="text-sm text-neon-200/80 break-all">
              {t.referrer.yourReferrer}: <span className="font-mono font-bold">{referrerAddress?.slice(0, 6)}...{referrerAddress?.slice(-4)}</span>
            </p>
          </div>
        </div>
      )}

      {/* 管理员提示 */}
      {isConnected && isOwner && (
        <div className="bg-purple-900/20 border-2 border-purple-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
          <ShieldCheck className="text-purple-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-purple-300">{t.referrer.adminExempt}</p>
          </div>
        </div>
      )}



      {/* Ticket Selection UI Enhancement */}
      {currentStep === 1 && isConnected && !isInitialLoad && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border-2 border-neon-500/50 shadow-xl shadow-neon-500/20 animate-fade-in bg-gray-900/50 relative overflow-hidden">
          {/* Background Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-500/5 rounded-full blur-3xl -z-10"></div>
          
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              <Package className="text-neon-400" /> {t.mining.buyTicket}
            </h3>
            <p className="text-gray-400 max-w-lg mx-auto">{t.mining.step1}</p>
          </div>

          {/* Loading state for ticket status */}
          {isLoadingTicketStatus ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 mb-8">
              {TICKET_TIERS.map((tier) => {
                const maxSingleTicket = getMaxSingleTicketAmount();
                const isDisabled = hasTicket && !isExited && tier.amount < maxSingleTicket;
                const isSelected = selectedTicket.amount === tier.amount;

                return (
                  <button
                    key={tier.amount}
                    onClick={() => !isDisabled && setSelectedTicket(tier)}
                    disabled={isDisabled}
                    className={`group relative py-6 md:py-8 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden transform active:scale-95 ${
                      isDisabled
                        ? 'bg-gray-900/30 border-gray-800 text-gray-600 cursor-not-allowed opacity-50 grayscale'
                        : isSelected
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-neon-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] transform scale-105 z-10'
                        : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-neon-500/50 hover:bg-gray-800/80 hover:shadow-lg hover:scale-102'
                    }`}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-neon-500 text-black flex items-center justify-center rounded-bl-xl font-bold animate-bounce">
                        ✓
                      </div>
                    )}
                    
                    {/* Holographic Effect for Selected */}
                    {isSelected && (
                       <div className="absolute inset-0 bg-gradient-to-tr from-neon-500/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
                    )}

                    {isDisabled && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    
                    <div className={`text-3xl md:text-4xl font-bold font-mono tracking-tighter transition-all ${isSelected ? 'text-neon-400 text-shadow-neon' : 'text-white'}`}>
                      {tier.amount}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider transition-all ${isSelected ? 'text-white' : 'text-gray-500'}`}>MC Token</span>
                    
                    {/* Cap Info */}
                    <div className={`mt-2 px-2 py-1 rounded text-[10px] md:text-xs font-mono border transition-all ${
                        isSelected ? 'bg-neon-500/20 border-neon-500/30 text-neon-300' : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}>
                      Cap: {tier.amount * 3}
                    </div>

                    {/* Ripple effect on click */}
                    {!isDisabled && (
                      <div className="absolute inset-0 overflow-hidden rounded-xl">
                        <div className="absolute inset-0 bg-white/10 scale-0 rounded-full transition-transform duration-300 group-active:scale-150"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {hasTicket && !isExited && (
            <div className="mb-6 bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 backdrop-blur-sm animate-fade-in">
              <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-amber-200/80">
                 <span className="font-bold text-amber-300 block mb-1">升级限制</span>
                 您已购买过最大单张 {getMaxSingleTicketAmount()}MC 的门票，只能购买更大金额的门票进行升级。
              </div>
            </div>
          )}

          <div className="space-y-4 max-w-md mx-auto">
            {!isApproved ? (
              <button
                onClick={handleApprove}
                disabled={txPending}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl border border-gray-600 disabled:opacity-50 relative overflow-hidden group transform active:scale-95"
              >
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {txPending && <Loader2 className="animate-spin" size={20} />}
                  {txPending ? t.mining.approving : `${t.mining.approve}`}
                </div>
              </button>
            ) : (
              <button
                onClick={handleBuyTicket}
                disabled={txPending}
                className="w-full py-4 md:py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold text-xl rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {txPending && <Loader2 className="animate-spin" size={20} />}
                  {txPending ? t.mining.buying : (
                      <span className="flex items-center justify-center gap-2">
                          {t.mining.buyTicket} <span className="opacity-80 font-mono text-lg">({selectedTicket.amount} MC)</span>
                      </span>
                  )}
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ticket Status Warnings - Updated with unified state */}
      {(() => {
        const userState = getUserMiningState();
        
        if (userState === UserMiningState.TICKET_EXPIRED) {
          return (
            <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-bold text-red-300 mb-1">{t.mining.ticketExpired}</p>
                <p className="text-sm text-red-200/80">
                  {t.mining.ticketExpiredDesc}
                </p>
              </div>
            </div>
          );
        }
        
        if (userState === UserMiningState.ALREADY_STAKED) {
          return (
            <div className="bg-neon-900/20 border-2 border-neon-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
              <AlertCircle className="text-neon-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-bold text-neon-300 mb-1">{t.mining.alreadyStaked}</p>
                <p className="text-sm text-neon-200/80">
                  {t.mining.alreadyStakedDesc}
                </p>
              </div>
            </div>
          );
        }
        
        if (userState === UserMiningState.READY_TO_STAKE) {
          return (
            <div className="bg-green-900/20 border-2 border-green-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
              <AlertCircle className="text-green-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-bold text-green-300 mb-1">{t.mining.readyToStake}</p>
                <p className="text-sm text-green-200/80">
                  {t.mining.readyToStakeDesc}
                </p>
              </div>
            </div>
          );
        }
        
        return null;
      })()}

      {currentStep === 2 && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">

            {/* Left Col: Controls */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">

            {/* Step 2: Cycle */}
            <div id="staking-section" className={`glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl relative overflow-hidden group transition-opacity bg-gray-900/50 border border-gray-800 ${(() => {
                const userState = getUserMiningState();
                return (userState === UserMiningState.NOT_CONNECTED || userState === UserMiningState.NO_TICKET || userState === UserMiningState.TICKET_EXPIRED) ? 'opacity-50 pointer-events-none' : '';
            })()}`}>
                 {(() => {
                    const userState = getUserMiningState();
                    
                    if (userState === UserMiningState.NOT_CONNECTED || userState === UserMiningState.NO_TICKET) {
                        return (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl md:rounded-2xl">
                                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700">
                                    <Lock size={14} className="md:w-4 md:h-4" />
                                    <span className="text-xs md:text-sm font-bold">{t.mining.purchaseFirst}</span>
                                </div>
                            </div>
                        );
                    }
                    
                    if (userState === UserMiningState.TICKET_EXPIRED) {
                        return (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl md:rounded-2xl">
                                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-900 border border-gray-700 text-white rounded-lg shadow-xl">
                                    <Lock size={14} className="md:w-4 md:h-4" />
                                    <span className="text-xs md:text-sm font-bold">{t.mining.ticketExpired}</span>
                                </div>
                            </div>
                        );
                    }
                    
                    return null;
                 })()}
                <div className="absolute top-0 right-0 w-24 h-24 bg-neon-500/10 rounded-full blur-2xl group-hover:bg-neon-500/20 transition-all"></div>
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-1.5 md:p-2 bg-neon-500/20 rounded-lg text-neon-400 border border-neon-500/30">
                        <Clock size={18} className="md:w-5 md:h-5" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-white">{t.mining.step2}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {MINING_PLANS.map((plan) => (
                        <button
                            key={plan.days}
                            onClick={() => setSelectedPlan(plan)}
                            className={`p-3 md:p-4 rounded-lg md:rounded-xl border text-left transition-all duration-300 ${
                                selectedPlan.days === plan.days
                                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black border-amber-400 shadow-lg shadow-amber-500/30'
                                : 'bg-gray-900/50 border-gray-700 hover:border-amber-500/50 text-gray-300'
                            }`}
                        >
                            <div className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1">
                                {plan.days} <span className="text-xs md:text-sm font-normal opacity-80">
                                    {timeConfig ? timeConfig.UNIT_LABEL : (t.mining.days || '天')}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-6 md:mt-8 bg-gray-950/50 p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                            <Zap className="text-neon-400" size={16} />
                            {t.mining.liqInv || "Liquidity Amount"} <span className="text-neon-500 text-xs">(Fixed 1.5x Ticket)</span>
                        </label>
                        <span className="text-xs text-gray-500 font-mono">Balance: 10,000 MC</span>
                    </div>
                    
                    <div className="relative mb-6">
                        <input
                            type="number"
                            value={liquidityAmountInput}
                            readOnly
                            className="w-full px-4 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white text-xl font-mono focus:outline-none focus:ring-2 focus:ring-neon-500/50 placeholder-gray-700 transition-all cursor-not-allowed opacity-80"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-500 pointer-events-none">MC</div>
                    </div>

                    {/* Fixed Amount Info */}
                    <div className="text-xs text-gray-400 text-center mb-2">
                        Required Liquidity: <span className="text-neon-400 font-bold">{liquidityAmountInput} MC</span> (1.5x Ticket Amount)
                    </div>
                </div>
            </div>
        </div>

        {/* Right Col: Summary */}
        <div className="space-y-4 md:space-y-6 flex flex-col h-full">
            <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl flex-1 border-t-4 border-t-neon-500 flex flex-col justify-between relative bg-gray-900/50 border border-gray-800">


                <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-white">
                        <ShieldCheck className="text-neon-400 md:w-6 md:h-6" size={20} />
                        {t.mining.estRevenue}
                    </h3>

                    <div className="space-y-3 md:space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                            <span className="text-gray-400">{t.mining.ticketInv}</span>
                            <span className="font-mono text-white">
                                {displayCap > 0 ? (displayCap / 3).toFixed(1) : selectedTicket.amount} MC
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                            <span className="text-gray-400">{t.mining.liqInv}</span>
                            <span className="font-mono text-white">{liquidityAmountInput || '0'} MC</span>
                        </div>
                        {/*<div className="flex justify-between items-center py-2 border-b border-slate-100">*/}
                        {/*    <span className="text-slate-500">{t.mining.totalLock}</span>*/}
                        {/*    <span className="font-mono text-macoin-600 font-bold">{totalInvestment} MC</span>*/}
                        {/*</div>*/}

                         <div className="py-4 space-y-2 bg-gray-800/30 -mx-2 px-2 rounded-lg border border-gray-800">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400">{t.mining.totalRev} ({selectedPlan.days} {t.mining.days})</span>
                                <span className="font-mono text-neon-400 font-bold">~{totalROI.toFixed(1)} MC</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700/50 mt-2">
                                <div className="bg-gray-900/40 p-2 rounded border border-gray-700/50">
                                    <div className="text-xs text-gray-500 mb-1">50% MC</div>
                                    <div className="font-mono text-white text-sm">~{(totalROI / 2).toFixed(1)}</div>
                                </div>
                                <div className="bg-gray-900/40 p-2 rounded border border-gray-700/50">
                                    <div className="text-xs text-gray-500 mb-1">50% JBC</div>
                                    <div className="font-mono text-amber-400 text-sm">
                                        ~{jbcPrice > 0 ? ((totalROI / 2) / jbcPrice).toFixed(2) : '0.00'}
                                    </div>
                                </div>
                            </div>
                            {jbcPrice > 0 && (
                                <div className="text-xs text-gray-600 text-right mt-1 px-1">
                                    1 JBC ≈ {jbcPrice.toFixed(4)} MC
                                </div>
                            )}
                         </div>

                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    {(() => {
                        const userState = getUserMiningState();
                        const buttonState = getStakingButtonState(userState);
                        
                        return (
                            <button
                                onClick={buttonState.action || undefined}
                                disabled={buttonState.disabled}
                                className={`${buttonState.className} transform active:scale-95 transition-all duration-200`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    {txPending && <Loader2 className="animate-spin" size={20} />}
                                    <span>{buttonState.text}</span>
                                    {userState === UserMiningState.READY_TO_STAKE && !buttonState.disabled && !txPending && (
                                        <ArrowRight size={20} />
                                    )}
                                </div>
                            </button>
                        );
                    })()}

                    <p className="text-xs text-center text-slate-400">
                        {t.mining.agreement}
                    </p>
                </div>

                {/* Active Mining Controls - Unified Redeem Removed */}
                {hasStakedLiquidity && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                         <p className="text-xs text-center text-gray-500">
                            {t.mining?.redeemInstruction || "Please manage your positions in the list below"}
                         </p>
                    </div>
                )}

            </div>

             {/* Warnings - Moved from Left Col */}
             <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3 backdrop-blur-sm">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5 md:w-4.5 md:h-4.5" size={16} />
                <div className="text-xs md:text-sm text-amber-200/80">
                    <p className="font-bold mb-1 text-amber-300">{t.mining.notice}</p>
                    <ul className="list-disc pl-3 md:pl-4 space-y-0.5 md:space-y-1">
                        <li>{t.mining.notice1}</li>
                        <li>{t.mining.notice2}</li>
                        <li>{t.mining.notice3}</li>
                    </ul>
                </div>
            </div>
        </div>

      </div>
      )}

      {/* Ticket Status Display - New Addition */}
      {currentStep === 3 && (
        <div className={`glass-panel p-4 md:p-6 rounded-xl border-2 animate-fade-in backdrop-blur-sm bg-gray-900/50 mt-8 ${statusInfo?.border || 'border-gray-800'}`}>
            {isExited ? (
                 <div className="text-center py-8">
                    <div className="bg-purple-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                        <TrendingUp className="text-purple-400" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{t.mining.completed || "Mining Completed (Exited)"}</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-6">
                        You have reached the 3x Cap limit.
                    </p>
                    
                    <div className="max-w-sm mx-auto bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-6">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-gray-400">Total Revenue</span>
                             <span className="text-neon-400 font-mono font-bold">{currentRevenue.toFixed(2)} MC</span>
                        </div>
                        <div className="flex justify-between items-center mb-4">
                             <span className="text-gray-400">Cap Limit</span>
                             <span className="text-white font-mono font-bold">{displayCap} MC</span>
                        </div>
                        <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                             <div className="bg-purple-500 h-full w-full"></div>
                        </div>
                        <div className="text-center mt-2 text-xs text-purple-400 font-bold">100% Completed</div>
                    </div>

                    <button 
                        onClick={() => {
                            setCurrentStep(1);
                            handleScrollToBuy();
                        }}
                        className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all transform hover:scale-105"
                    >
                        {t.mining.buyTicket} (Start New Round)
                    </button>
                 </div>
            ) : !hasStakedLiquidity ? (
                <div className="text-center py-12">
                    <div className="bg-gray-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                        <Zap className="text-gray-600" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">{t.mining.unknownStatus || "No Mining Activity"}</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                        {canStakeLiquidity 
                            ? "您可以随时提供流动性开始挖矿" 
                            : "您已达到3倍出局，无法继续提供流动性"}
                    </p>
                    <button 
                        onClick={() => setCurrentStep(canStakeLiquidity ? 2 : 1)}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border border-gray-600 transition-colors"
                        disabled={!canStakeLiquidity}
                    >
                        {canStakeLiquidity ? t.mining.stake : "已出局"}
                    </button>
                </div>
            ) : (
                <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Package className="text-neon-400" size={24} />
                    <h3 className="text-xl font-bold text-white">
                        {hasStakedLiquidity ? t.mining.currentStatus : t.mining.currentTicket}
                    </h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold border ${statusInfo?.bg} ${statusInfo?.color} ${statusInfo?.border}`}>
                    {statusInfo?.label}
                </div>
            </div>

            {/* Quick Action for Pending Liquidity */}
            {canStakeLiquidity && !hasStakedLiquidity && (
                <div className="mb-4 bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-amber-200/80 text-sm">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{t.mining.readyToStakeDesc}</span>
                    </div>
                    <button
                        onClick={handleScrollToStake}
                        className="whitespace-nowrap px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1"
                    >
                        {t.mining.stake} <ArrowRight size={14} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-gray-400 mb-1">{t.mining.ticketAmount}</div>
                    <div className="text-lg font-bold text-white font-mono">{ethers.formatEther(ticketInfo.amount)} MC</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-gray-400 mb-1">{t.mining.purchaseTime}</div>
                    <div className="text-white font-mono">{formatDate(ticketInfo.purchaseTime)}</div>
                </div>
                {ticketInfo.liquidityProvided && (
                    <>
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                            <div className="text-gray-400 mb-1">{t.mining.startTime}</div>
                            <div className="text-white font-mono">{formatDate(ticketInfo.startTime)}</div>
                        </div>
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                            <div className="text-gray-400 mb-1">{t.mining.endTime}</div>
                            <div className="text-white font-mono">
                                {formatDate(ticketInfo.startTime + ticketInfo.cycleDays * 60)}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Action Buttons for Step 3 - Unified Redeem Removed */}
            {hasValidTicket && (
                 <div className="mt-6 pt-6 border-t border-gray-700">
                     <p className="text-sm text-center text-gray-400">
                        {t.mining?.redeemInstruction || "Please manage your positions in the Liquidity Positions list below"}
                     </p>
                </div>
            )}
          </>
        )}
      </div>
    )}
      {/* 3x Cap Section */}
      {isConnected && (
        <div className="glass-panel p-4 md:p-6 rounded-xl border border-gray-800 bg-gray-900/50 mt-8 animate-fade-in">
          <div className="bg-gray-800/30 rounded-lg p-3 border border-dashed border-gray-700">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-400 uppercase">{t.mining.cap}</div>
              <div className="text-xs text-neon-400">{progressPercent.toFixed(1)}%</div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-2xl font-bold text-white">{currentRevenue.toFixed(2)}</span>
                <span className="text-xs text-gray-500 ml-1">/ {displayCap} MC</span>
              </div>
              <span className="text-xs text-amber-400 mb-1">{t.mining.maxCap}</span>
            </div>
            <div className="w-full mt-2">
              <GoldenProgressBar
                progress={progressPercent}
                height="md"
                showAnimation={progressPercent > 0 && progressPercent < 100}
                showSplashAnimation={progressPercent > 0 && progressPercent < 10} // 开屏动画在收益开始时显示
                highContrast={true} // 启用高对比度模式
                ariaLabel={`Revenue cap progress: ${progressPercent.toFixed(1)}%`}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Liquidity Positions Section */}
      {isConnected && <LiquidityPositions />}

      {/* History Section */}
      {isConnected && !isInitialLoad && (
        <div className="glass-panel p-4 md:p-6 rounded-xl border border-gray-800 bg-gray-900/50 mt-8 animate-fade-in">
            <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-white hover:text-neon-400 transition-colors transform active:scale-95"
            >
                <div className="flex items-center gap-2">
                    <History className="text-neon-400" size={20} />
                    <h3 className="text-lg font-bold">{t.mining.ticketHistory || "Ticket History"}</h3>
                    {isLoadingHistory && <Loader2 className="animate-spin text-neon-400" size={16} />}
                </div>
                {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showHistory && (
                <div className="mt-4 space-y-3 animate-fade-in">
                    {loadingHistory || isLoadingHistory ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <SkeletonCard key={i} className="h-24" />
                            ))}
                        </div>
                    ) : ticketHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-800 rounded-xl">
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No ticket history found</p>
                            <p className="text-xs mt-1 opacity-70">Your transactions will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ticketHistory.map((item, idx) => {
                                // Calculate expiration time for pending tickets
                                // const expireTime = item.purchaseTime + 72 * 3600;
                                // const isExpired = now > expireTime;
                                const isExpired = false; // Tickets no longer expire by time
                                const showStakeAction = item.status === 'Pending' && !isExpired && !hasStakedLiquidity && !isExited;
                                
                                // Check if this is an add-on (same ticket ID as the next/older item)
                                const isAddOn = idx < ticketHistory.length - 1 && ticketHistory[idx + 1].ticketId === item.ticketId;

                                return (
                                <div key={idx} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-neon-500/30 transition-all duration-300 transform hover:scale-[1.01]">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-start gap-1">
                                            <div className="bg-gray-900/50 px-2 py-1 rounded text-xs font-mono text-gray-400 border border-gray-700">
                                                #{item.ticketId}
                                            </div>
                                            {isAddOn && (
                                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap">
                                                    {language === 'zh' ? '追加' : 'Add-on'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-white text-lg">{item.amount} <span className="text-xs font-normal text-gray-400">MC</span></div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-2 text-xs text-gray-400">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 mb-0.5">{t.mining.purchaseTime}</span>
                                        <span className="font-mono text-gray-300">{formatDate(item.purchaseTime)}</span>
                                    </div>
                                    
                                    {/* 隐藏质押返回时间和质押可赎回状态 */}
                                    {false && item.status === 'Mining' && item.endTime && (
                                        <div className="flex flex-col text-right">
                                            <span className="text-gray-500 mb-0.5">{t.mining?.countdown || "倒计时"}</span>
                                            <span className={`font-mono ${item.endTime <= currentTime ? 'text-green-400' : 'text-neon-400'}`}>
                                              {formatCountdown(item.endTime)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {false && item.status === 'Completed' && (
                                         <div className="flex flex-col text-right">
                                            <span className="text-gray-500 mb-0.5">状态</span>
                                            <span className="font-mono text-blue-300">挖矿完成</span>
                                        </div>
                                    )}

                                    {item.status === 'Pending' && !isExpired && (
                                        <div className="flex flex-col">
                                            <span className="text-gray-500 mb-0.5">{t.mining.endTime || "Valid Until"}</span>
                                            <span className="font-mono text-amber-400">长期有效</span>
                                        </div>
                                    )}
                                </div>

                                {showStakeAction && (
                                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                                        <button
                                            onClick={() => {
                                                handleScrollToStake();
                                                setCurrentStep(2);
                                            }}
                                            className="w-full py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 font-bold rounded-lg border border-amber-500/30 transition-all flex items-center justify-center gap-2 text-sm transform active:scale-95"
                                        >
                                            {t.mining.stake} <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            )})}
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Mobile Sticky Footer Removed */}

    </div>
  );
};

export default MiningPanel;


