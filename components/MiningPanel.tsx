import React, { useState, useMemo, useEffect } from 'react';
import { TICKET_TIERS, MINING_PLANS } from '../constants';
import { MiningPlan, TicketTier } from '../types';
import { Zap, Clock, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Lock, Package, History, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

type TicketInfo = {
  amount: bigint;
  requiredLiquidity: bigint;
  purchaseTime: number;
  liquidityProvided: boolean;
  redeemed: boolean;
  startTime: number;
  cycleDays: number;
};

type TicketHistoryItem = {
    ticketId: string;
    amount: string;
    purchaseTime: number;
    status: 'Pending' | 'Mining' | 'Redeemed' | 'Expired';
    cycleDays?: number;
    startTime?: number;
    endTime?: number;
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
  
  // 历史记录状态
  const [ticketHistory, setTicketHistory] = useState<TicketHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { t } = useLanguage();
  const { protocolContract, mcContract, account, isConnected, hasReferrer, isOwner, referrerAddress, checkReferrerStatus, provider } = useWeb3();

  // 基于PDF逻辑的计算
  // 更新：基于流动性金额（门票金额 * 1.5）计算ROI，而不是门票金额
  const totalInvestment = selectedTicket.amount + selectedTicket.requiredLiquidity;
  const liquidityAmount = selectedTicket.requiredLiquidity; // 通常是门票金额 * 1.5
  
  // 每日ROI = 流动性金额 * 每日利率
  const dailyROI = (Number(liquidityAmount) * selectedPlan.dailyRate) / 100;
  const totalROI = dailyROI * selectedPlan.days;

  // 3倍上限计算
  const maxCap = selectedTicket.amount * 3;

  // 向导步骤状态
  const [currentStep, setCurrentStep] = useState(1);

  const now = Math.floor(Date.now() / 1000);
  const hasTicket = !!ticketInfo && ticketInfo.amount > 0n;
  const isRedeemed = !!ticketInfo && ticketInfo.redeemed;
  const hasActiveTicket = !!ticketInfo && ticketInfo.liquidityProvided && !ticketInfo.redeemed;
  const isTicketExpired =
      hasTicket &&
      ticketInfo &&
      !ticketInfo.liquidityProvided &&
      !isRedeemed &&
      now > ticketInfo.purchaseTime + 72 * 3600;
  const canStakeLiquidity =
      hasTicket &&
      ticketInfo &&
      !ticketInfo.liquidityProvided &&
      !isTicketExpired &&
      !isRedeemed;
  const isTicketBought = hasTicket && !isRedeemed;

  // 根据状态自动推进步骤
  useEffect(() => {
      if (hasActiveTicket) {
          setCurrentStep(3); // 挖矿仪表板
      } else if (canStakeLiquidity) {
          setCurrentStep(2); // 质押流动性
      } else {
          setCurrentStep(1); // 购买门票
      }
  }, [hasActiveTicket, canStakeLiquidity, ticketInfo]);

  // 格式化日期辅助函数
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getTicketStatus = () => {
    if (!ticketInfo) return null;
    if (ticketInfo.redeemed) return { label: t.mining.redeemed, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' };
    if (isTicketExpired) return { label: t.mining.expired, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
    if (ticketInfo.liquidityProvided) return { label: t.mining.mining, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' };
    return { label: t.mining.pendingLiquidity, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' };
  };

  const statusInfo = getTicketStatus();

  const checkTicketStatus = async () => {
      if (!protocolContract || !account) {
          setTicketInfo(null);
          return;
      }

      try {
          const ticket = await protocolContract.userTicket(account);

          console.log('ticket info:', {
              amount: ticket.amount.toString(),
              liquidityProvided: ticket.liquidityProvided,
              redeemed: ticket.redeemed,
              purchaseTime: Number(ticket.purchaseTime),
              requiredLiquidity: ticket.requiredLiquidity.toString(),
          });

          setTicketInfo({
              amount: ticket.amount,
              requiredLiquidity: ticket.requiredLiquidity,
              purchaseTime: Number(ticket.purchaseTime),
              liquidityProvided: ticket.liquidityProvided,
              redeemed: ticket.redeemed,
              startTime: Number(ticket.startTime),
              cycleDays: Number(ticket.cycleDays),
          });
      } catch (err) {
          console.error('Failed to check ticket status', err);
      }
  };

  const fetchHistory = async () => {
    if (!protocolContract || !account || !provider) return;
    setLoadingHistory(true);
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
                    currentItem.endTime = timestamp + (currentItem.cycleDays || 0) * 60; // 分钟
                }
            } else if (item.type === 'redeem') {
                if (currentItem && currentItem.status === 'Mining') {
                    currentItem.status = 'Redeemed';
                }
            }
        }
        
        if (currentItem) {
            historyItems.push(currentItem);
        }

        const now = Math.floor(Date.now() / 1000);
        historyItems.forEach(item => {
            if (item.status === 'Pending' && now > item.purchaseTime + 72 * 3600) {
                item.status = 'Expired';
            }
        });

        setTicketHistory(historyItems.reverse());
    } catch (err) {
        console.error("Failed to fetch history", err);
    } finally {
        setLoadingHistory(false);
    }
  };

  useEffect(() => {
    checkTicketStatus();
    fetchHistory();
  }, [protocolContract, account]);

  useEffect(() => {
    const checkAllowance = async () => {
        if (mcContract && account && protocolContract) {
            setIsCheckingAllowance(true);
            try {
                const protocolAddr = await protocolContract.getAddress();
                const allowance = await mcContract.allowance(account, protocolAddr);
                // 检查授权额度是否覆盖所需的总投资
                // 使用稍低的阈值来捕获"已批准无限额度"
                // 或仅检查所需金额
                const requiredWei = ethers.parseEther(totalInvestment.toString());

                if (allowance >= requiredWei) {
                    setIsApproved(true);
                } else {
                    setIsApproved(false);
                }
            } catch (err) {
                console.error("Failed to check allowance", err);
            } finally {
                setIsCheckingAllowance(false);
            }
        }
    };
    checkAllowance();
  }, [mcContract, account, protocolContract, totalInvestment]);

  const handleApprove = async () => {
      if (!mcContract || !protocolContract) return;
      setTxPending(true);
      try {
          const tx = await mcContract.approve(await protocolContract.getAddress(), ethers.MaxUint256);
          await tx.wait();
          setIsApproved(true);
          toast.success(t.mining.approveSuccess);
      } catch (err: any) {
          console.error(err);
          toast.error(`${t.mining.claimFailed}: ${err.reason || err.message}`);
          // 演示用回退
          setIsApproved(true);
      } finally {
          setTxPending(false);
      }
  };

  const handleScrollToBuy = () => {
      if (typeof window === 'undefined') return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBuyTicket = async () => {
      if (!protocolContract || !mcContract) return;
      
      setTxPending(true);
      try {
          // 妫€鏌?MC 浣欓
          const amountWei = ethers.parseEther(selectedTicket.amount.toString());
          const mcBalance = await mcContract.balanceOf(account);
          
          if (mcBalance < amountWei) {
              toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${selectedTicket.amount} MC锛?{t.mining.currentBalance}: ${ethers.formatEther(mcBalance)} MC`);
              return;
          }

          const tx = await protocolContract.buyTicket(amountWei);
          await tx.wait();
          toast.success(t.mining.ticketBuySuccess);
          // 鍒锋柊绁ㄦ嵁鐘舵€?
          await checkTicketStatus();
      } catch (err: any) {
          console.error(err);
          const errorMsg = err.reason || err.message || '';
          if (errorMsg.includes('Active ticket exists')) {
              toast.error(t.mining.activeTicketExists, {
                  duration: 5000,
              });
          } else if (errorMsg.includes('Invalid ticket tier')) {
              toast.error(t.mining.invalidTicketTier);
          } else {
              toast.error(`${t.mining.ticketBuyFailed}: ${errorMsg}`);
          }
      } finally {
          setTxPending(false);
      }
  };

  const handleStake = async () => {
      if (!protocolContract || !mcContract) return;
      setTxPending(true);
      try {
          // 1. 妫€鏌?MC 浣欓
          const requiredAmount = ethers.parseEther(selectedTicket.requiredLiquidity.toString());
          const mcBalance = await mcContract.balanceOf(account);
          
          if (mcBalance < requiredAmount) {
              toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${selectedTicket.requiredLiquidity} MC锛?{t.mining.currentBalance}: ${ethers.formatEther(mcBalance)} MC`);
              return;
          }

          // 2. 妫€鏌ユ巿鏉?
          const protocolAddr = await protocolContract.getAddress();
          const allowance = await mcContract.allowance(account, protocolAddr);
          
          if (allowance < requiredAmount) {
              toast.error(t.mining.needApprove);
              const approveTx = await mcContract.approve(protocolAddr, ethers.MaxUint256);
              await approveTx.wait();
              toast.success(t.mining.approveSuccess);
              return;
          }

          // 3. 鎵ц璐ㄦ娂
          const tx = await protocolContract.stakeLiquidity(selectedPlan.days);
          await tx.wait();

          toast.success(t.mining.stakeSuccess);
          // 鍒锋柊绁ㄦ嵁鐘舵€?
          await checkTicketStatus();
      } catch (err: any) {
          console.error(t.mining.stakeFailed, err);
          const errorMsg = err.reason || err.message || '';
          
          if (errorMsg.includes('Ticket expired')) {
              toast.error(t.mining.ticketExpiredBuy, { duration: 5000 });
          } else if (errorMsg.includes('No valid ticket')) {
              toast.error(t.mining.noValidTicket);
          } else if (errorMsg.includes('Invalid cycle')) {
              toast.error(t.mining.invalidCycle);
          } else {
              toast.error(`${t.mining.stakeFailed}: ${errorMsg}`);
          }
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
      } catch (err: any) {
          console.error(err);
          const errorMsg = err.reason || err.message || '';
          if (errorMsg.includes("No rewards yet")) {
            toast.error(t.mining.noRewardsYet);
          } else {
            toast.error(`${t.mining.claimFailed}: ${errorMsg || t.mining.noRewards}`);
          }
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
          await checkTicketStatus();
      } catch (err: any) {
          console.error(err);
          const errorMsg = err.reason || err.message || '';
          if (errorMsg.includes('Cycle not finished')) {
              toast.error(t.mining.cycleNotFinished);
          } else {
              toast.error(`${t.mining.redeemFailed}: ${errorMsg}`);
          }
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
          
          // 提取错误信息
          // Extract error message
          const errorMsg = err.reason || err.message || '';
          
          // 处理特定错误：已经绑定过推荐人
          // Handle specific error: Already bound a referrer
          if (errorMsg.includes('Already bound')) {
              toast.error('You have already bound a referrer!');
          } else {
              // 显示其他错误信息
              // Display other error messages
              toast.error(`${t.referrer.bindError}: ${errorMsg}`);
          }
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

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-8">
        {[
          { step: 1, label: t.mining.buyTicket, icon: Package },
          { step: 2, label: t.mining.stake, icon: Lock },
          { step: 3, label: t.mining.mining, icon: Zap }
        ].map((s, idx) => (
          <div key={s.step} className="flex items-center">
            <button 
              onClick={() => setCurrentStep(s.step)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              currentStep === s.step 
                ? 'bg-neon-500/20 border-neon-500 text-neon-400 shadow-lg shadow-neon-500/20' 
                : currentStep > s.step
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-gray-900/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                 currentStep === s.step ? 'bg-neon-500 text-black' : 
                 currentStep > s.step ? 'bg-green-500 text-black' : 'bg-gray-800'
              }`}>
                {currentStep > s.step ? '✓' : s.step}
              </div>
              <span className="hidden md:block font-bold text-sm">{s.label}</span>
            </button>
            {idx < 2 && <div className={`w-8 h-0.5 mx-2 ${currentStep > s.step ? 'bg-green-500/30' : 'bg-gray-800'}`} />}
          </div>
        ))}
      </div>

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



      {/* 蹇€熻喘涔伴棬绁ㄦ寜閽尯鍩?- 鏄剧溂浣嶇疆 */}
      {currentStep === 1 && isConnected && (hasReferrer || isOwner) && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border-2 border-neon-500/50 shadow-xl shadow-neon-500/20 animate-fade-in bg-gray-900/50">
          <div className="text-center mb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{t.mining.buyTicket}</h3>
            <p className="text-gray-400">{t.mining.step1}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
            {TICKET_TIERS.map((tier) => (
              <button
                key={tier.amount}
                onClick={() => setSelectedTicket(tier)}
                className={`relative py-4 md:py-6 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
                  selectedTicket.amount === tier.amount
                    ? 'bg-gradient-to-br from-neon-500 to-neon-600 text-black border-neon-400 shadow-lg shadow-neon-500/40 transform scale-105 z-10'
                    : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-neon-500/50 hover:bg-gray-800/50'
                }`}
              >
                <span className="text-2xl md:text-3xl font-bold">{tier.amount}</span>
                <span className="text-sm font-semibold">MC</span>
                <span className={`text-xs ${selectedTicket.amount === tier.amount ? 'text-black/80' : 'text-gray-400'}`}>
                  +{tier.requiredLiquidity} {t.mining.liquidity}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {!isApproved ? (
              <button
                onClick={handleApprove}
                disabled={txPending}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-xl transition-colors shadow-lg disabled:opacity-50"
              >
                {txPending ? t.mining.approving : `${t.mining.approve}`}
              </button>
            ) : (
              <button
                onClick={handleBuyTicket}
                disabled={txPending}
                className="w-full py-4 md:py-5 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-extrabold text-xl rounded-xl shadow-xl shadow-neon-500/40 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {txPending ? t.mining.buying : `${t.mining.buyTicket} - ${selectedTicket.amount} MC`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ticket Status Warnings */}
      {isTicketExpired && (
        <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-red-300 mb-1">{t.mining.ticketExpired}</p>
            <p className="text-sm text-red-200/80">
              {t.mining.ticketExpiredDesc}
            </p>
          </div>
        </div>
      )}
      
      {hasActiveTicket && !isTicketExpired && (
        <div className="bg-neon-900/20 border-2 border-neon-500/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in backdrop-blur-sm">
          <AlertCircle className="text-neon-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-neon-300 mb-1">{t.mining.alreadyStaked}</p>
            <p className="text-sm text-neon-200/80">
              {t.mining.alreadyStakedDesc}
            </p>
          </div>
        </div>
      )}
      
      {canStakeLiquidity && !hasActiveTicket && !isTicketExpired && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-green-900 mb-1">{t.mining.readyToStake}</p>
            <p className="text-sm text-green-800">
              {t.mining.readyToStakeDesc}
            </p>
          </div>
        </div>
      )}

      {currentStep === 2 && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">

            {/* Left Col: Controls */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">

            {/* Step 2: Cycle */}
            <div id="staking-section" className={`glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl relative overflow-hidden group transition-opacity bg-gray-900/50 border border-gray-800 ${(!isTicketBought || isTicketExpired || hasActiveTicket || (!hasReferrer && !isOwner)) ? 'opacity-50 pointer-events-none' : ''}`}>
                 {!isTicketBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl md:rounded-2xl">
                        <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm font-bold">{t.mining.purchaseFirst}</span>
                        </div>
                    </div>
                )}
                 {(isTicketExpired || hasActiveTicket) && isTicketBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl md:rounded-2xl">
                        <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-900 border border-gray-700 text-white rounded-lg shadow-xl">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm font-bold">{isTicketExpired ? t.mining.ticketExpired : t.mining.alreadyStaked}</span>
                        </div>
                    </div>
                )}
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
                            <div className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1">{plan.days} <span className="text-xs md:text-sm font-normal opacity-80">{t.mining.days}</span></div>
                            <div className={`flex items-center gap-1 text-xs md:text-sm ${selectedPlan.days === plan.days ? 'text-black/80' : 'text-gray-400'}`}>
                                <TrendingUp size={12} className="md:w-3.5 md:h-3.5" />
                                <span>{t.mining.daily} {plan.dailyRate}%</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

             {/* Warnings */}
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

        {/* Right Col: Summary */}
        <div className="space-y-4 md:space-y-6">
            <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl h-full border-t-4 border-t-neon-500 flex flex-col justify-between relative bg-gray-900/50 border border-gray-800">


                <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-white">
                        <ShieldCheck className="text-neon-400 md:w-6 md:h-6" size={20} />
                        {t.mining.estRevenue}
                    </h3>

                    <div className="space-y-3 md:space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                            <span className="text-gray-400">{t.mining.ticketInv}</span>
                            <span className="font-mono text-white">{selectedTicket.amount} MC</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-800">
                            <span className="text-gray-400">{t.mining.liqInv}</span>
                            <span className="font-mono text-white">{selectedTicket.requiredLiquidity} MC</span>
                        </div>
                        {/*<div className="flex justify-between items-center py-2 border-b border-slate-100">*/}
                        {/*    <span className="text-slate-500">{t.mining.totalLock}</span>*/}
                        {/*    <span className="font-mono text-macoin-600 font-bold">{totalInvestment} MC</span>*/}
                        {/*</div>*/}

                         <div className="py-4 space-y-2 bg-gray-800/30 -mx-2 px-2 rounded-lg border border-gray-800">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">{t.mining.dailyRev} ({selectedPlan.dailyRate}%)</span>
                                <span className="font-mono text-neon-400 font-bold">~{dailyROI.toFixed(1)} MC</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-gray-400">{t.mining.totalRev} ({selectedPlan.days} {t.mining.days})</span>
                                <span className="font-mono text-neon-400 font-bold">~{totalROI.toFixed(1)} MC</span>
                            </div>
                         </div>

                         <div className="bg-gray-800/30 rounded-lg p-3 border border-dashed border-gray-700">
                            {/* User Note: This place currently displays the 3x cap for the selected ticket. User indicated it should represent historical total quota in the future. */}
                            <div className="text-xs text-gray-400 uppercase mb-1">{t.mining.cap}</div>
                            <div className="flex justify-between items-end">
                                <span className="text-2xl font-bold text-white">{maxCap} MC</span>
                                <span className="text-xs text-amber-400 mb-1">{t.mining.maxCap}</span>
                            </div>
                            <div className="w-full bg-gray-700 h-1.5 rounded-full mt-2">
                                <div className="bg-neon-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    {!isConnected ? (
                        <button disabled className="w-full py-3 bg-gray-800 text-gray-500 font-bold rounded-lg cursor-not-allowed border border-gray-700">
                            {t.mining.walletNotConnected}
                        </button>
                    ) : !hasReferrer && !isOwner ? (
                        <button disabled className="w-full py-3 bg-amber-200 text-amber-700 font-bold rounded-lg cursor-not-allowed">
                            {t.referrer.noReferrer}
                        </button>
                    ) : isCheckingAllowance ? (
                        <button
                            disabled
                            className="w-full py-3 bg-gray-800 text-gray-500 font-bold rounded-lg cursor-wait animate-pulse border border-gray-700"
                        >
                            {t.mining.checkingAuth}
                        </button>
                    ) : !isApproved ? (
                        <button
                            onClick={handleApprove}
                            disabled={txPending}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors border border-gray-600 disabled:opacity-50"
                        >
                            {txPending ? t.mining.approving : t.mining.approve}
                        </button>
                    ) : isTicketExpired ? (
                        <button
                            onClick={handleScrollToBuy}
                            disabled={txPending}
                            className="w-full py-3 text-red-400 font-semibold rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                            {txPending ? t.mining.buying : t.mining.buyTicket}
                        </button>
                    ) : !isTicketBought ? (
                        <button
                            onClick={handleScrollToBuy}
                            disabled={txPending}
                            className="w-full py-3 text-neon-400 font-semibold rounded-lg border border-neon-500/30 hover:bg-neon-500/10 transition-colors disabled:opacity-50"
                        >
                            {txPending ? t.mining.buying : `${t.mining.buyTicket} (Top)`}
                        </button>
                    ) : canStakeLiquidity ? (
                         <button
                            onClick={handleStake}
                            disabled={txPending}
                            className="w-full py-4 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-extrabold text-lg rounded-lg shadow-lg shadow-neon-500/40 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {txPending ? t.mining.staking : t.mining.stake} <ArrowRight size={20} />
                        </button>
                    ) : hasActiveTicket ? (
                        <button
                            onClick={handleScrollToBuy}
                            disabled={txPending}
                            className="w-full py-3 text-neon-400 font-semibold rounded-lg border border-neon-500/30 hover:bg-neon-500/10 transition-colors disabled:opacity-50"
                        >
                            {txPending ? t.mining.buying : `${t.mining.buyTicket} (Top)`}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="w-full py-4 bg-gray-800 text-gray-500 font-bold text-lg rounded-lg cursor-not-allowed border border-gray-700"
                        >
                            {t.mining.unknownStatus}
                        </button>
                    )}

                    <p className="text-xs text-center text-slate-400">
                        {t.mining.agreement}
                    </p>
                </div>

                {/* Active Mining Controls */}
                {hasActiveTicket && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                         <button
                            onClick={handleRedeem}
                            disabled={txPending}
                            className="flex-1 py-2 bg-red-500/20 text-red-300 font-bold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 border border-red-500/30"
                         >
                            {t.mining.redeem}
                         </button>
                    </div>
                )}

            </div>
        </div>

      </div>
      )}

      {/* Ticket Status Display - New Addition */}
      {currentStep === 3 && (
        <div className={`glass-panel p-4 md:p-6 rounded-xl border-2 animate-fade-in backdrop-blur-sm bg-gray-900/50 mt-8 ${statusInfo?.border || 'border-gray-800'}`}>
            {!hasActiveTicket ? (
                <div className="text-center py-12">
                    <div className="bg-gray-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                        <Zap className="text-gray-600" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">{t.mining.unknownStatus || "No Mining Activity"}</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                        {canStakeLiquidity 
                            ? t.mining.readyToStakeDesc 
                            : isTicketBought 
                                ? "You have a ticket but haven't staked liquidity yet."
                                : "You haven't purchased a mining ticket yet."}
                    </p>
                    <button 
                        onClick={() => setCurrentStep(canStakeLiquidity ? 2 : 1)}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border border-gray-600 transition-colors"
                    >
                        {canStakeLiquidity ? t.mining.stake : t.mining.buyTicket}
                    </button>
                </div>
            ) : (
                <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Package className="text-neon-400" size={24} />
                    <h3 className="text-xl font-bold text-white">{t.mining.currentTicket}</h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold border ${statusInfo?.bg} ${statusInfo?.color} ${statusInfo?.border}`}>
                    {statusInfo?.label}
                </div>
            </div>

            {/* Quick Action for Pending Liquidity */}
            {canStakeLiquidity && (
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-gray-400 mb-1">{t.mining.ticketAmount}</div>
                    <div className="text-lg font-bold text-white font-mono">{ethers.formatEther(ticketInfo.amount)} MC</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-gray-400 mb-1">{t.mining.purchaseTime}</div>
                    <div className="text-white font-mono">{formatDate(ticketInfo.purchaseTime)}</div>
                </div>
                {ticketInfo.liquidityProvided ? (
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
                ) : !ticketInfo.redeemed && (
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 col-span-1 md:col-span-2">
                        <div className="text-gray-400 mb-1">{t.mining.timeLeft}</div>
                        <div className="text-white font-mono">
                             {isTicketExpired 
                                ? "00:00:00" 
                                : (() => {
                                    const expiry = ticketInfo.purchaseTime + 72 * 3600;
                                    const diff = expiry - now;
                                    if (diff <= 0) return "00:00:00";
                                    const h = Math.floor(diff / 3600);
                                    const m = Math.floor((diff % 3600) / 60);
                                    return `${h}h ${m}m`;
                                })()
                             }
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons for Step 3 */}
            {hasActiveTicket && (
                 <div className="mt-6 pt-6 border-t border-gray-700 flex flex-col md:flex-row gap-4">
                     <button
                        onClick={handleRedeem}
                        disabled={txPending}
                        className="flex-1 py-3 md:py-4 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-300 font-bold rounded-xl border border-red-500/30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/10"
                     >
                        <TrendingUp size={20} />
                        {t.mining.redeem}
                     </button>
                </div>
            )}
          </>
        )}
      </div>
    )}
      {/* History Section */}
      {isConnected && (
        <div className="glass-panel p-4 md:p-6 rounded-xl border border-gray-800 bg-gray-900/50 mt-8 animate-fade-in">
            <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-white hover:text-neon-400 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <History className="text-neon-400" size={20} />
                    <h3 className="text-lg font-bold">{t.mining.ticketHistory || "Ticket History"}</h3>
                </div>
                {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showHistory && (
                <div className="mt-4 space-y-3 animate-fade-in">
                    {loadingHistory ? (
                        <div className="text-center py-8 text-gray-400 flex flex-col items-center gap-2">
                             <div className="w-6 h-6 border-2 border-neon-500 border-t-transparent rounded-full animate-spin"></div>
                             <span>Loading history...</span>
                        </div>
                    ) : ticketHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-800 rounded-xl">
                            No ticket history found
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ticketHistory.map((item, idx) => (
                            <div key={idx} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-neon-500/30 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-gray-900/50 px-2 py-1 rounded text-xs font-mono text-gray-400 border border-gray-700">
                                            #{item.ticketId}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                            item.status === 'Mining' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            item.status === 'Redeemed' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                            item.status === 'Expired' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        }`}>
                                            {item.status === 'Mining' ? t.mining.mining : 
                                             item.status === 'Redeemed' ? t.mining.redeemed :
                                             item.status === 'Expired' ? t.mining.expired :
                                             t.mining.pendingLiquidity}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-white text-lg">{item.amount} <span className="text-xs font-normal text-gray-400">MC</span></div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 mb-0.5">{t.mining.purchaseTime}</span>
                                        <span className="font-mono text-gray-300">{formatDate(item.purchaseTime)}</span>
                                    </div>
                                    
                                    {item.status === 'Mining' && item.endTime && (
                                        <div className="flex flex-col text-right">
                                            <span className="text-gray-500 mb-0.5">{t.mining.endTime}</span>
                                            <span className="font-mono text-neon-400">{formatDate(item.endTime)}</span>
                                        </div>
                                    )}
                                    
                                    {item.status === 'Redeemed' && (
                                         <div className="flex flex-col text-right">
                                            <span className="text-gray-500 mb-0.5">{t.mining.status}</span>
                                            <span className="font-mono text-gray-300">{t.mining.redeemed}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0px left-0 right-0 p-4 bg-gray-900/95 border-t border-gray-800 backdrop-blur-xl md:hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
        {currentStep === 1 && isConnected && (hasReferrer || isOwner) && (
            !isApproved ? (
              <button
                onClick={handleApprove}
                disabled={txPending}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-xl transition-colors shadow-lg disabled:opacity-50"
              >
                {txPending ? t.mining.approving : t.mining.approve}
              </button>
            ) : (
              <button
                onClick={handleBuyTicket}
                disabled={txPending}
                className="w-full py-3 bg-gradient-to-r from-neon-500 to-neon-600 text-black font-extrabold text-xl rounded-xl shadow-lg shadow-neon-500/20 disabled:opacity-50"
              >
                {txPending ? t.mining.buying : `${t.mining.buyTicket} - ${selectedTicket.amount} MC`}
              </button>
            )
        )}

        {currentStep === 2 && canStakeLiquidity && (
            <button
                onClick={handleStake}
                disabled={txPending}
                className="w-full py-3 bg-gradient-to-r from-neon-500 to-neon-600 text-black font-extrabold text-lg rounded-xl shadow-lg shadow-neon-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
             >
                {txPending ? t.mining.staking : t.mining.stake} <ArrowRight size={20} />
            </button>
        )}

        {currentStep === 3 && hasActiveTicket && (
             <button
                onClick={handleRedeem}
                disabled={txPending}
                className="w-full py-3 bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 font-bold rounded-xl border border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
             >
                <TrendingUp size={20} />
                {t.mining.redeem}
             </button>
        )}
      </div>

    </div>
  );
};

export default MiningPanel;




