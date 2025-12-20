import React, { useState, useMemo, useEffect } from 'react';
import { TICKET_TIERS, MINING_PLANS } from '../constants';
import { MiningPlan, TicketTier } from '../types';
import { Zap, Clock, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const MiningPanel: React.FC = () => {
  const [selectedTicket, setSelectedTicket] = useState<TicketTier>(TICKET_TIERS[0]);
  const [selectedPlan, setSelectedPlan] = useState<MiningPlan>(MINING_PLANS[0]);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [isTicketBought, setIsTicketBought] = useState(false); // New state to track ticket purchase
  const [hasActiveTicket, setHasActiveTicket] = useState(false); // Track if user has active ticket
  const [canStakeLiquidity, setCanStakeLiquidity] = useState(false);
  const [isTicketExpired, setIsTicketExpired] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [inputReferrerAddress, setInputReferrerAddress] = useState('');
  const [isBindingReferrer, setIsBindingReferrer] = useState(false);

  const { t } = useLanguage();
  const { protocolContract, mcContract, account, isConnected, hasReferrer, isOwner, referrerAddress, checkReferrerStatus } = useWeb3();

  // Calculations based on PDF logic
  const totalInvestment = selectedTicket.amount + selectedTicket.requiredLiquidity;
  const dailyROI = (selectedTicket.amount * selectedPlan.dailyRate) / 100;
  const totalROI = dailyROI * selectedPlan.days;

  // 3x Cap Calculation
  const maxCap = selectedTicket.amount * 3;

  // Check if user has active ticket
  const checkTicketStatus = async () => {
      if (!protocolContract || !account) return;

      try {
          const ticket = await protocolContract.userTicket(account);

          console.log("ticket info:", {
              amount: ticket.amount.toString(),
              liquidityProvided: ticket.liquidityProvided,
              redeemed: ticket.redeemed,
              purchaseTime: Number(ticket.purchaseTime),
              requiredLiquidity: ticket.requiredLiquidity.toString(),
          });

          const now = Math.floor(Date.now() / 1000);

          // 1️⃣ 是否买过票（amount > 0）
          const hasTicket = ticket.amount > 0n;

          // 2️⃣ 是否已质押（liquidityProvided && !redeemed）
          const isStaked = ticket.liquidityProvided && !ticket.redeemed;

          // 3️⃣ 是否已赎回（redeemed == true）
          const isRedeemed = ticket.redeemed;

          // 4️⃣ 是否已过期（超过72小时且未质押且未赎回）
          const isExpired =
              hasTicket &&
              !ticket.liquidityProvided &&
              !isRedeemed &&
              now > Number(ticket.purchaseTime) + 72 * 3600;

          // 5️⃣ 是否可以质押（已买票 && 未质押 && 未过期 && 未赎回）
          const canStake =
              hasTicket &&
              !ticket.liquidityProvided &&
              !isExpired &&
              !isRedeemed;

          // ====== 更新 UI 状态 ======
          setIsTicketBought(hasTicket && !isRedeemed);  // 有有效票据（未赎回）
          setHasActiveTicket(isStaked);                  // 是否已经质押
          setCanStakeLiquidity(canStake);                // 是否可以质押
          setIsTicketExpired(isExpired);                 // 是否过期

      } catch (err) {
          console.error("Failed to check ticket status", err);
      }
  };

  useEffect(() => {
    checkTicketStatus()
  }, [protocolContract, account]);

  useEffect(() => {
    const checkAllowance = async () => {
        if (mcContract && account && protocolContract) {
            setIsCheckingAllowance(true);
            try {
                const protocolAddr = await protocolContract.getAddress();
                const allowance = await mcContract.allowance(account, protocolAddr);
                // Check if allowance covers the total investment required
                // Using a slightly lower threshold to catch "already approved infinite"
                // or just check against the needed amount
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
          // Fallback for demo
          setIsApproved(true);
      } finally {
          setTxPending(false);
      }
  };

  const handleBuyTicket = async () => {
      if (!protocolContract || !mcContract) return;
      
      // 检查是否有过期票据
      if (isTicketExpired) {
          toast.error(t.mining.expiredTicketWarning, {
              duration: 5000,
          });
          return;
      }
      
      setTxPending(true);
      try {
          // 检查 MC 余额
          const amountWei = ethers.parseEther(selectedTicket.amount.toString());
          const mcBalance = await mcContract.balanceOf(account);
          
          if (mcBalance < amountWei) {
              toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${selectedTicket.amount} MC，${t.mining.currentBalance}: ${ethers.formatEther(mcBalance)} MC`);
              return;
          }

          const tx = await protocolContract.buyTicket(amountWei);
          await tx.wait();
          toast.success(t.mining.ticketBuySuccess);
          // 刷新票据状态
          await checkTicketStatus();
      } catch (err: any) {
          console.error(err);
          const errorMsg = err.reason || err.message || '';
          if (errorMsg.includes('Active ticket exists')) {
              toast.error(t.mining.activeTicketExists, {
                  duration: 5000,
              });
              setHasActiveTicket(true);
              setIsTicketBought(true);
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
          // 1. 检查 MC 余额
          const requiredAmount = ethers.parseEther(selectedTicket.requiredLiquidity.toString());
          const mcBalance = await mcContract.balanceOf(account);
          
          if (mcBalance < requiredAmount) {
              toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${selectedTicket.requiredLiquidity} MC，${t.mining.currentBalance}: ${ethers.formatEther(mcBalance)} MC`);
              return;
          }

          // 2. 检查授权
          const protocolAddr = await protocolContract.getAddress();
          const allowance = await mcContract.allowance(account, protocolAddr);
          
          if (allowance < requiredAmount) {
              toast.error(t.mining.needApprove);
              const approveTx = await mcContract.approve(protocolAddr, ethers.MaxUint256);
              await approveTx.wait();
              toast.success(t.mining.approveSuccess);
              return;
          }

          // 3. 执行质押
          const tx = await protocolContract.stakeLiquidity(selectedPlan.days);
          await tx.wait();

          toast.success(t.mining.stakeSuccess);
          // 刷新票据状态
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
          setIsTicketBought(false); // Reset UI state
          setHasActiveTicket(false);
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

  const handleBindReferrer = async () => {
      if (!protocolContract || !inputReferrerAddress) return;

      // 验证地址格式
      if (!ethers.isAddress(inputReferrerAddress)) {
          toast.error('Invalid address format!');
          return;
      }

      // 检查是否绑定自己
      if (inputReferrerAddress.toLowerCase() === account?.toLowerCase()) {
          toast.error('Cannot bind yourself as referrer!');
          return;
      }

      setIsBindingReferrer(true);
      try {
          const tx = await protocolContract.bindReferrer(inputReferrerAddress);
          await tx.wait();
          toast.success(t.team.bindSuccess);
          setInputReferrerAddress('');
          // 重新检查推荐人状态
          await checkReferrerStatus();
      } catch (err: any) {
          console.error(err);
          const errorMsg = err.reason || err.message || '';
          if (errorMsg.includes('Already bound')) {
              toast.error('You have already bound a referrer!');
          } else {
              toast.error(`${t.referrer.bindError}: ${errorMsg}`);
          }
      } finally {
          setIsBindingReferrer(false);
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in">

      <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{t.mining.title}</h2>
        <p className="text-sm md:text-base text-slate-500">{t.mining.subtitle}</p>
      </div>

      {/* 推荐人绑定提示 - 非管理员且未绑定推荐人时显示 */}
      {isConnected && !hasReferrer && !isOwner && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 animate-fade-in">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <p className="font-bold text-amber-900 text-lg mb-2">⚠️ {t.referrer.required}</p>
              <p className="text-sm text-amber-800 mb-4">
                {t.referrer.requiredDesc}
              </p>

              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <input
                  type="text"
                  value={inputReferrerAddress}
                  onChange={(e) => setInputReferrerAddress(e.target.value)}
                  placeholder={t.referrer.enterAddress}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <button
                  onClick={handleBindReferrer}
                  disabled={isBindingReferrer || !inputReferrerAddress}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <ShieldCheck className="text-green-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-green-900 mb-1">✅ {t.referrer.bound}</p>
            <p className="text-sm text-green-800">
              {t.referrer.yourReferrer}: <span className="font-mono font-bold">{referrerAddress}</span>
            </p>
          </div>
        </div>
      )}

      {/* 管理员提示 */}
      {isConnected && isOwner && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <ShieldCheck className="text-purple-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-purple-900">👑 {t.referrer.adminExempt}</p>
          </div>
        </div>
      )}

      {/* 快速购买门票按钮区域 - 显眼位置 */}
      {isConnected && (hasReferrer || isOwner) && !isTicketBought && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border-2 border-macoin-500 shadow-xl shadow-macoin-500/20 animate-fade-in">
          <div className="text-center mb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">🎫 {t.mining.buyTicket}</h3>
            <p className="text-slate-600">{t.mining.step1}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
            {TICKET_TIERS.map((tier) => (
              <button
                key={tier.amount}
                onClick={() => setSelectedTicket(tier)}
                className={`relative py-4 md:py-6 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
                  selectedTicket.amount === tier.amount
                    ? 'bg-macoin-500 text-white border-macoin-600 shadow-lg shadow-macoin-500/30 transform scale-105 z-10'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-macoin-400 hover:bg-macoin-50'
                }`}
              >
                <span className="text-2xl md:text-3xl font-bold">{tier.amount}</span>
                <span className="text-sm font-semibold">MC</span>
                <span className={`text-xs ${selectedTicket.amount === tier.amount ? 'text-white/90' : 'text-slate-500'}`}>
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
                className="w-full py-4 bg-slate-600 hover:bg-slate-700 text-white font-bold text-lg rounded-xl transition-colors shadow-lg disabled:opacity-50"
              >
                {txPending ? t.mining.approving : `${t.mining.approve}`}
              </button>
            ) : (
              <button
                onClick={handleBuyTicket}
                disabled={txPending || isTicketExpired}
                className="w-full py-4 md:py-5 bg-gradient-to-r from-macoin-600 to-macoin-500 hover:from-macoin-500 hover:to-macoin-400 text-white font-extrabold text-xl rounded-xl shadow-xl shadow-macoin-500/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {txPending ? t.mining.buying : `🎫 ${t.mining.buyTicket} - ${selectedTicket.amount} MC`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ticket Status Warnings */}
      {isTicketExpired && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-red-900 mb-1">⏰ {t.mining.ticketExpired}</p>
            <p className="text-sm text-red-800">
              {t.mining.ticketExpiredDesc}
            </p>
          </div>
        </div>
      )}
      
      {hasActiveTicket && !isTicketExpired && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-blue-900 mb-1">✅ {t.mining.alreadyStaked}</p>
            <p className="text-sm text-blue-800">
              {t.mining.alreadyStakedDesc}
            </p>
          </div>
        </div>
      )}
      
      {canStakeLiquidity && !hasActiveTicket && !isTicketExpired && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-bold text-green-900 mb-1">🎫 {t.mining.readyToStake}</p>
            <p className="text-sm text-green-800">
              {t.mining.readyToStakeDesc}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">

            {/* Left Col: Controls */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">

            {/* Step 1: Ticket */}
            <div className={`glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl relative overflow-hidden group transition-opacity ${isTicketBought || (!hasReferrer && !isOwner) ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-macoin-500/10 rounded-full blur-2xl group-hover:bg-macoin-500/20 transition-all"></div>
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-1.5 md:p-2 bg-macoin-100 rounded-lg text-macoin-600">
                        <Zap size={18} className="md:w-5 md:h-5" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-slate-800">{t.mining.step1} {isTicketBought && `(${t.mining.completed})`}</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                    {TICKET_TIERS.map((tier) => (
                        <button
                            key={tier.amount}
                            onClick={() => setSelectedTicket(tier)}
                            className={`relative py-3 md:py-4 rounded-lg md:rounded-xl border transition-all duration-300 flex flex-col items-center justify-center gap-0.5 md:gap-1 ${
                                selectedTicket.amount === tier.amount
                                ? 'bg-macoin-500 text-white border-macoin-600 shadow-lg shadow-macoin-500/20 transform scale-105 z-10'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-macoin-300 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-lg md:text-xl font-bold">{tier.amount} MC</span>
                            <span className={`text-[9px] md:text-[10px] ${selectedTicket.amount === tier.amount ? 'text-white/90' : 'text-slate-400'}`}>
                                +{tier.requiredLiquidity} {t.mining.liquidity}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Cycle */}
            <div className={`glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl relative overflow-hidden group transition-opacity ${(!isTicketBought || isTicketExpired || hasActiveTicket || (!hasReferrer && !isOwner)) ? 'opacity-50 pointer-events-none' : ''}`}>
                 {!isTicketBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl md:rounded-2xl">
                        <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-slate-800 text-white rounded-lg shadow-xl">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm font-bold">{t.mining.purchaseFirst}</span>
                        </div>
                    </div>
                )}
                 {(isTicketExpired || hasActiveTicket) && isTicketBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl md:rounded-2xl">
                        <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-slate-800 text-white rounded-lg shadow-xl">
                            <Lock size={14} className="md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm font-bold">{isTicketExpired ? t.mining.ticketExpired : t.mining.alreadyStaked}</span>
                        </div>
                    </div>
                )}
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Clock size={18} className="md:w-5 md:h-5" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-slate-800">{t.mining.step2}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {MINING_PLANS.map((plan) => (
                        <button
                            key={plan.days}
                            onClick={() => setSelectedPlan(plan)}
                            className={`p-3 md:p-4 rounded-lg md:rounded-xl border text-left transition-all duration-300 ${
                                selectedPlan.days === plan.days
                                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg shadow-blue-500/20'
                                : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'
                            }`}
                        >
                            <div className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1">{plan.days} <span className="text-xs md:text-sm font-normal opacity-80">{t.mining.days}</span></div>
                            <div className={`flex items-center gap-1 text-xs md:text-sm ${selectedPlan.days === plan.days ? 'text-blue-100' : 'text-slate-500'}`}>
                                <TrendingUp size={12} className="md:w-3.5 md:h-3.5" />
                                <span>{t.mining.daily} {plan.dailyRate}%</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

             {/* Warnings */}
             <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5 md:w-4.5 md:h-4.5" size={16} />
                <div className="text-xs md:text-sm text-orange-800/80">
                    <p className="font-bold mb-1 text-orange-900">{t.mining.notice}</p>
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
            <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl h-full border-t-4 border-t-macoin-500 flex flex-col justify-between relative bg-white">


                <div>
                    <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-slate-900">
                        <ShieldCheck className="text-macoin-600 md:w-6 md:h-6" size={20} />
                        {t.mining.estRevenue}
                    </h3>

                    <div className="space-y-3 md:space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">{t.mining.ticketInv}</span>
                            <span className="font-mono text-slate-900">{selectedTicket.amount} MC</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">{t.mining.liqInv}</span>
                            <span className="font-mono text-slate-900">{selectedTicket.requiredLiquidity} MC</span>
                        </div>
                        {/*<div className="flex justify-between items-center py-2 border-b border-slate-100">*/}
                        {/*    <span className="text-slate-500">{t.mining.totalLock}</span>*/}
                        {/*    <span className="font-mono text-macoin-600 font-bold">{totalInvestment} MC</span>*/}
                        {/*</div>*/}

                         <div className="py-4 space-y-2 bg-slate-50 -mx-2 px-2 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">{t.mining.dailyRev} ({selectedPlan.dailyRate}%)</span>
                                <span className="font-mono text-macoin-600 font-bold">~{dailyROI.toFixed(1)} MC</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-slate-500">{t.mining.totalRev} ({selectedPlan.days} {t.mining.days})</span>
                                <span className="font-mono text-macoin-600 font-bold">~{totalROI.toFixed(1)} MC</span>
                            </div>
                         </div>

                         <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-300">
                            <div className="text-xs text-slate-500 uppercase mb-1">{t.mining.cap}</div>
                            <div className="flex justify-between items-end">
                                <span className="text-2xl font-bold text-slate-900">{maxCap} MC</span>
                                <span className="text-xs text-macoin-600 mb-1">{t.mining.maxCap}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                                <div className="bg-macoin-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    {!isConnected ? (
                        <button disabled className="w-full py-3 bg-slate-200 text-slate-400 font-bold rounded-lg cursor-not-allowed">
                            {t.mining.walletNotConnected}
                        </button>
                    ) : !hasReferrer && !isOwner ? (
                        <button disabled className="w-full py-3 bg-amber-200 text-amber-700 font-bold rounded-lg cursor-not-allowed">
                            ⚠️ {t.referrer.noReferrer}
                        </button>
                    ) : isCheckingAllowance ? (
                        <button
                            disabled
                            className="w-full py-3 bg-slate-100 text-slate-400 font-bold rounded-lg cursor-wait animate-pulse"
                        >
                            {t.mining.checkingAuth}
                        </button>
                    ) : !isApproved ? (
                        <button
                            onClick={handleApprove}
                            disabled={txPending}
                            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-lg transition-colors border border-slate-300 disabled:opacity-50"
                        >
                            {txPending ? t.mining.approving : t.mining.approve}
                        </button>
                    ) : isTicketExpired ? (
                        <button
                            disabled
                            className="w-full py-4 bg-red-100 text-red-700 font-bold text-lg rounded-lg cursor-not-allowed border-2 border-red-300"
                        >
                            ⏰ {t.mining.ticketExpiredCannotBuy}
                        </button>
                    ) : !isTicketBought ? (
                        <button
                            onClick={handleBuyTicket}
                            disabled={txPending}
                            className="w-full py-4 bg-macoin-500 hover:bg-macoin-600 text-white font-extrabold text-lg rounded-lg shadow-lg shadow-macoin-500/30 transition-all disabled:opacity-50"
                        >
                            {txPending ? t.mining.buying : `🎫 ${t.mining.buyTicket}`}
                        </button>
                    ) : canStakeLiquidity ? (
                         <button
                            onClick={handleStake}
                            disabled={txPending}
                            className="w-full py-4 bg-gradient-to-r from-macoin-600 to-macoin-500 hover:from-macoin-500 hover:to-macoin-400 text-white font-extrabold text-lg rounded-lg shadow-lg shadow-macoin-500/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {txPending ? t.mining.staking : t.mining.stake} <ArrowRight size={20} />
                        </button>
                    ) : hasActiveTicket ? (
                        <button
                            disabled
                            className="w-full py-4 bg-blue-100 text-blue-700 font-bold text-lg rounded-lg cursor-not-allowed border-2 border-blue-300"
                        >
                            ✅ {t.mining.alreadyStaked}
                        </button>
                    ) : (
                        <button
                            disabled
                            className="w-full py-4 bg-slate-200 text-slate-500 font-bold text-lg rounded-lg cursor-not-allowed"
                        >
                            ⚠️ {t.mining.unknownStatus}
                        </button>
                    )}

                    <p className="text-xs text-center text-slate-400">
                        {t.mining.agreement}
                    </p>
                </div>

                {/* Active Mining Controls */}
                {isTicketBought && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                         <button
                            onClick={handleClaim}
                            disabled={txPending}
                            className="flex-1 py-2 bg-yellow-100 text-yellow-700 font-bold rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
                         >
                            {t.mining.claimRewards}
                         </button>
                         <button
                            onClick={handleRedeem}
                            disabled={txPending}
                            className="flex-1 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                         >
                            {t.mining.redeem}
                         </button>
                    </div>
                )}

            </div>
        </div>

      </div>
    </div>
  );
};

export default MiningPanel;
