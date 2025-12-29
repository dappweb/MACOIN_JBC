import React, { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { Clock, TrendingUp, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useWeb3 } from '../src/Web3Context';
import { useLanguage } from '../src/LanguageContext';
import GoldenProgressBar from './GoldenProgressBar';
import toast from 'react-hot-toast';
import { formatContractError } from '../utils/errorFormatter';

interface RawStakePosition {
  id: string;
  amount: bigint;
  startTime: number;
  cycleDays: number;
  active: boolean;
  paid: bigint;
}

interface StakePosition {
  id: string;
  amount: string;
  startTime: number;
  cycleDays: number;
  active: boolean;
  paid: string;
  staticReward: string; // Keep for compatibility or total value
  pendingMc: string;
  pendingJbc: string;
  endTime: number;
  progress: number;
  status: 'active' | 'completed' | 'redeemed';
}

// 倒计时格式化函数
const formatCountdown = (endTime: number, currentTime: number, t: any): string => {
  const remaining = endTime - currentTime;
  if (remaining <= 0) return t?.mining?.redeemable || "可赎回";
  
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  if (days > 0) {
    return `${days}${t?.mining?.dayUnit || '天'} ${hours}${t?.mining?.hourUnit || '时'} ${minutes}${t?.mining?.minUnit || '分'}`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const LiquidityPositions: React.FC = () => {
  const { protocolContract, mcContract, account } = useWeb3();
  const { t } = useLanguage();
  const [rawPositions, setRawPositions] = useState<RawStakePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  // Default to 60 (1 minute) to match contract SECONDS_IN_UNIT constant.
  // This ensures correct static reward calculations even if contract fetch fails.
  const [secondsInUnit, setSecondsInUnit] = useState(60);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [reserves, setReserves] = useState<{mc: bigint, jbc: bigint}>({ mc: 0n, jbc: 0n });

  // Update current time every second for countdown/progress
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch SECONDS_IN_UNIT and Reserves from contract
  useEffect(() => {
    const fetchConstants = async () => {
      if (protocolContract) {
        try {
          const s = await protocolContract.SECONDS_IN_UNIT();
          setSecondsInUnit(Number(s));
        } catch (e) {
          console.warn("Failed to fetch SECONDS_IN_UNIT", e);
        }

        try {
           const mc = await protocolContract.swapReserveMC();
           const jbc = await protocolContract.swapReserveJBC();
           console.log("Reserves:", mc, jbc);
           setReserves({ mc: BigInt(mc), jbc: BigInt(jbc) });
        } catch (e) {
           console.warn("Failed to fetch reserves", e);
        }
      }
    };
    fetchConstants();
    
    // Poll reserves every 10 seconds
    const interval = setInterval(fetchConstants, 10000);
    return () => clearInterval(interval);
  }, [protocolContract]);

  const fetchPositions = async () => {
    if (!protocolContract || !account) return;
    
    setLoading(true);
    try {
      const stakes: RawStakePosition[] = [];
      let index = 0;

      while (true) {
        try {
          const stakeData = await protocolContract.userStakes(account, index);
          // struct Stake { id, amount, startTime, cycleDays, active, paid }
          
          const id = index.toString(); // Use array index as ID instead of stake ID
          const amount = stakeData[1];
          const startTime = Number(stakeData[2]);
          const cycleDays = Number(stakeData[3]);
          const active = stakeData[4];
          const paid = stakeData[5];
          
          stakes.push({
            id,
            amount,
            startTime,
            cycleDays,
            active,
            paid
          });

          index++;
          if (index > 50) break; 
        } catch (e) {
            break;
        }
      }
      
      setRawPositions(stakes);
    } catch (err) {
      console.error("Failed to fetch stake positions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (id: string) => {
    if (!protocolContract || !mcContract) return;
    setRedeemingId(id);
    try {
      const stakeIndex = parseInt(id); // ID is already the array index
      
      // Get user info to calculate fee
      const userInfo = await protocolContract.userInfo(account);
      const userTicket = await protocolContract.userTicket(account);
      
      let redemptionFeePercent = 0n;
      try {
        // Safe check for function existence
        if (typeof protocolContract.redemptionFeePercent === 'function') {
            redemptionFeePercent = await protocolContract.redemptionFeePercent();
        } else {
            console.warn("redemptionFeePercent function not found on contract");
        }
      } catch (err) {
        console.error("Failed to fetch redemptionFeePercent:", err);
      }
      
      // Calculate expected fee - use correct fallback (ticket amount, not refundFeeAmount)
      const feeBase = userInfo.maxTicketAmount > 0n ? userInfo.maxTicketAmount : userTicket.amount;
      const expectedFee = (feeBase * redemptionFeePercent) / 100n;
      
      if (expectedFee > 0n) {
        // Check MC balance
        const mcBalance = await mcContract.balanceOf(account);
        if (mcBalance < expectedFee) {
          toast.error(`Insufficient MC balance for redemption fee: ${ethers.formatEther(expectedFee)} MC required`);
          return;
        }
        
        // Check and request approval if needed
        const allowance = await mcContract.allowance(account, protocolContract.target);
        if (allowance < expectedFee) {
          toast.loading("Approving MC tokens for redemption fee...");
          const approveTx = await mcContract.approve(protocolContract.target, expectedFee);
          await approveTx.wait();
          toast.dismiss();
          toast.success("Approval successful");
        }
      }
      
      // Add detailed logging for debugging
      console.log("Redeem attempt:", {
        stakeId: id,
        stakeIndex: parseInt(id),
        userBalance: ethers.formatEther(await mcContract.balanceOf(account)),
        expectedFee: ethers.formatEther(expectedFee),
        allowance: ethers.formatEther(await mcContract.allowance(account, protocolContract.target)),
        feeBase: ethers.formatEther(feeBase)
      });
      
      // Proceed with redemption
      const tx = await protocolContract.redeem();
      
      // 获取预估的奖励信息用于展示
      const targetPos = positions.find(p => p.id === id);
      const rewardMsg = targetPos 
        ? `\n预计获得: ${parseFloat(targetPos.pendingMc).toFixed(4)} MC + ${parseFloat(targetPos.pendingJbc).toFixed(4)} JBC`
        : "";

      await tx.wait();
      toast.success((t.mining?.redeemSuccess || "Redemption Successful") + rewardMsg);
      fetchPositions(); // Refresh list
    } catch (err: any) {
      console.error("Redeem error details:", err);
      
      // Enhanced error handling with specific messages
      if (err.message?.includes("Invalid stake")) {
        toast.error("质押无效，请刷新页面重试");
      } else if (err.message?.includes("Not expired")) {
        toast.error("质押尚未到期，请等待到期后再试");
      } else if (err.message?.includes("Disabled")) {
        toast.error("赎回功能暂时禁用，请联系管理员");
      } else if (err.message?.includes("Transfer failed")) {
        toast.error("转账失败，请检查余额和授权");
      } else {
        toast.error(formatContractError(err));
      }
    } finally {
      setRedeemingId(null);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [protocolContract, account]);

  const positions = useMemo(() => {
    return rawPositions.map(pos => {
        const durationSeconds = pos.cycleDays * secondsInUnit;
        const endTime = pos.startTime + durationSeconds;
        
        let status: StakePosition['status'] = 'redeemed';
        if (pos.active) {
          status = currentTime >= endTime ? 'completed' : 'active';
        }

        // 使用与合约一致的收益率 (ratePerBillion)
        let ratePerBillion = 0n;
        if (pos.cycleDays === 7) ratePerBillion = 13333334n;      // 1.3333334%
        else if (pos.cycleDays === 15) ratePerBillion = 16666667n; // 1.6666667%
        else if (pos.cycleDays === 30) ratePerBillion = 20000000n; // 2.0%

        const unitsPassed = Math.min(
          pos.cycleDays,
          Math.floor((currentTime - pos.startTime) / secondsInUnit)
        );
        
        const totalStaticShouldBe = (pos.amount * ratePerBillion * BigInt(unitsPassed)) / 1000000000n;
        const pendingBigInt = totalStaticShouldBe > pos.paid ? totalStaticShouldBe - pos.paid : 0n;
        const staticReward = ethers.formatEther(pendingBigInt);

        // Split Pending Reward 50/50
        const pendingMcVal = pendingBigInt / 2n;
        const pendingJbcVal = pendingBigInt - pendingMcVal;
        
        let pendingJbcAmount = 0n;
        if (reserves.mc > 0n && reserves.jbc > 0n) {
            // JBC Price (in MC) = ReserveMC / ReserveJBC (scaled 1e18)
            // But we can just use ratio: AmountJBC = ValueMC * ReserveJBC / ReserveMC
            pendingJbcAmount = (pendingJbcVal * reserves.jbc) / reserves.mc;
        } else {
             // Fallback if reserves are 0 (should not happen if liquidity provided)
             // Use 1:1 or keep as 0? Safe to show 0 if no market.
             // But technically if no reserves, price is 1 ether in contract logic.
             // uint256 jbcPrice = (swapReserveJBC == 0) ? 1 ether : ...
             // If price is 1 ether (1 MC = 1 JBC), then amount = value.
             pendingJbcAmount = pendingJbcVal;
        }

        const totalDuration = endTime - pos.startTime;
        const elapsed = currentTime - pos.startTime;
        let progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        if (!pos.active) progress = 100;

        return {
            id: pos.id,
            amount: ethers.formatEther(pos.amount),
            startTime: pos.startTime,
            cycleDays: pos.cycleDays,
            active: pos.active,
            paid: ethers.formatEther(pos.paid),
            staticReward,
            pendingMc: ethers.formatEther(pendingMcVal),
            pendingJbc: ethers.formatEther(pendingJbcAmount),
            endTime,
            progress,
            status
        } as StakePosition;
    }).sort((a, b) => {
      if (a.active === b.active) {
          return b.startTime - a.startTime;
      }
      return a.active ? -1 : 1;
    });
  }, [rawPositions, currentTime, secondsInUnit]);

  const totalStaked = useMemo(() => {
    return positions.reduce((acc, p) => p.active ? acc + parseFloat(p.amount) : acc, 0);
  }, [positions]);

  const totalPending = useMemo(() => {
    return positions.reduce((acc, p) => p.active ? acc + parseFloat(p.staticReward) : acc, 0);
  }, [positions]);

  if (!account || positions.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-neon-400" />
          {t.mining?.liquidity || "Liquidity Positions"}
        </h3>
        <button 
          onClick={fetchPositions}
          disabled={loading}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 backdrop-blur-sm mb-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-sm text-gray-400">{t.mining?.totalLock || "Total Staked"}</p>
                <p className="text-lg font-bold text-neon-400">{totalStaked.toFixed(2)} MC</p>
            </div>
            <div>
                <p className="text-sm text-gray-400">{t.mining?.estPendingReward || "Est. Pending Reward"}</p>
                <p className="text-lg font-bold text-amber-400">≈ {totalPending.toFixed(4)} Value</p>
            </div>
        </div>
        
        {/* Debug Info (Visible only if needed, currently showing rate for verification) */}
        {reserves.mc > 0n && reserves.jbc > 0n && (
            <div className="mt-2 text-xs text-gray-500 text-right">
                Exchange Rate: 1 JBC ≈ {(Number(ethers.formatEther(reserves.mc)) / Number(ethers.formatEther(reserves.jbc))).toFixed(4)} MC
            </div>
        )}
      </div>

      <div className="space-y-3">
        {positions.map((pos) => (
          <div 
            key={pos.id} 
            className={`relative overflow-hidden bg-gray-900/50 border rounded-xl p-4 pb-8 transition-all ${
              pos.active 
                ? 'border-gray-700 hover:border-neon-500/50' 
                : 'border-gray-800 opacity-60'
            }`}
          >
            {/* Enhanced Golden Progress Bar */}
            {pos.active && (
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-2">
                <GoldenProgressBar
                  progress={pos.progress}
                  height="sm"
                  showAnimation={pos.status === 'active'}
                  showSplashAnimation={pos.status === 'active' && pos.progress < 5} // 开屏动画仅在开始时显示
                  highContrast={true} // 启用高对比度模式
                  ariaLabel={`Mining progress: ${pos.progress.toFixed(1)}%`}
                  className="w-full"
                />
              </div>
            )}

            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">{parseFloat(pos.amount).toFixed(0)} MC</span>
                  {pos.status === 'completed' ? (
                    <button
                        onClick={() => handleRedeem(pos.id)}
                        disabled={redeemingId === pos.id}
                        className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 text-xs font-bold animate-pulse"
                    >
                        {redeemingId === pos.id ? (
                            <span className="animate-spin">⌛</span>
                        ) : (
                            <TrendingUp size={12} />
                        )}
                        {redeemingId === pos.id ? (t.mining?.redeeming || "Redeeming...") : (t.mining?.redeem || "Redeem")}
                    </button>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      pos.status === 'active' ? 'bg-neon-500/10 text-neon-400 border-neon-500/30' :
                      'bg-gray-700 text-gray-400 border-gray-600'
                    }`}>
                      {pos.status === 'active' ? (t.mining?.mining || 'Mining') : (t.mining?.redeemed || 'Redeemed')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(pos.startTime * 1000).toLocaleString()}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-amber-400">
                  {pos.status === 'redeemed' 
                    ? (
                        <div className="flex flex-col items-end opacity-75">
                          {/* 估算已领取的 MC 和 JBC，假设 50/50 分配 */}
                          <span className="text-white">
                            + {(parseFloat(pos.paid) / 2).toFixed(4)} MC
                          </span>
                          <span className="text-xs text-neon-400">
                            + {(() => {
                                // pos.paid is formatted string in useMemo. We should use raw calculation or re-parse.
                                // Simplest is to re-calculate from string float.
                                const paidFloat = parseFloat(pos.paid);
                                const paidMcVal = paidFloat / 2;
                                // Convert MC value to JBC amount using current rate
                                const jbcAmount = reserves.mc > 0n ? (paidMcVal * Number(reserves.jbc)) / Number(reserves.mc) : 0;
                                return jbcAmount.toFixed(4);
                            })()} JBC (Est.)
                          </span>
                        </div>
                      )
                    : (
                      <div className="flex flex-col items-end">
                        <span className="text-white">+ {parseFloat(pos.pendingMc).toFixed(4)} MC</span>
                        <span className="text-xs text-neon-400">+ {parseFloat(pos.pendingJbc).toFixed(4)} JBC</span>
                      </div>
                    )
                  }
                </div>
                <div className="text-xs text-gray-500">
                  {pos.status === 'redeemed' 
                    ? (t.mining?.totalPaid || "Total Paid")
                    : (t.mining?.pending || "Pending")
                  }
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">{t.mining?.cycle || "Cycle"}</span>
                 <span className="text-gray-300">{pos.cycleDays} {t.mining?.days || "Mins"}</span>
               </div>
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">{t.mining?.countdown || "倒计时"}</span>
                 <span className={`font-mono ${pos.status === 'completed' ? 'text-green-400' : pos.status === 'redeemed' ? 'text-gray-400' : 'text-neon-400'}`}>
                    {pos.status === 'redeemed' ? (t.mining?.redeemed || "已赎回") : 
                     pos.status === 'completed' ? (t.mining?.redeemable || "可赎回") : 
                     formatCountdown(pos.endTime, currentTime, t)}
                 </span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiquidityPositions;
