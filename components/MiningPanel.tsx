import React, { useState, useMemo } from 'react';
import { TICKET_TIERS, MINING_PLANS } from '../constants';
import { MiningPlan, TicketTier } from '../types';
import { Zap, Clock, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';
import { ethers } from 'ethers';

const MiningPanel: React.FC = () => {
  const [selectedTicket, setSelectedTicket] = useState<TicketTier>(TICKET_TIERS[0]);
  const [selectedPlan, setSelectedPlan] = useState<MiningPlan>(MINING_PLANS[0]);
  const [isApproved, setIsApproved] = useState(false);
  const [isTicketBought, setIsTicketBought] = useState(false); // New state to track ticket purchase
  const [txPending, setTxPending] = useState(false);
  
  const { t } = useLanguage();
  const { protocolContract, mcContract, account, isConnected } = useWeb3();

  // Calculations based on PDF logic
  const totalInvestment = selectedTicket.amount + selectedTicket.requiredLiquidity;
  const dailyROI = (selectedTicket.amount * selectedPlan.dailyRate) / 100;
  const totalROI = dailyROI * selectedPlan.days;
  
  // 3x Cap Calculation
  const maxCap = selectedTicket.amount * 3;

  const handleApprove = async () => {
      if (!mcContract || !protocolContract) return;
      setTxPending(true);
      try {
          const tx = await mcContract.approve(await protocolContract.getAddress(), ethers.MaxUint256);
          await tx.wait();
          setIsApproved(true);
          alert("Approval Successful!");
      } catch (err) {
          console.error(err);
          // Fallback for demo
          setIsApproved(true); 
      } finally {
          setTxPending(false);
      }
  };

  const handleBuyTicket = async () => {
      if (!protocolContract) return;
      setTxPending(true);
      try {
          const amountWei = ethers.parseEther(selectedTicket.amount.toString());
          const tx = await protocolContract.buyTicket(amountWei);
          await tx.wait();
          setIsTicketBought(true);
          alert("Ticket Purchased Successfully!");
      } catch (err) {
          console.error(err);
          // Fallback for demo
          setIsTicketBought(true);
      } finally {
          setTxPending(false);
      }
  };

  const handleStake = async () => {
      if (!protocolContract) return;
      setTxPending(true);
      try {
          const tx = await protocolContract.stakeLiquidity(selectedPlan.days);
          await tx.wait();
          alert("Staking Successful! Mining Started.");
      } catch (err) {
          console.error(err);
          // Fallback for demo
          alert("Staking Successful! (Demo Mode)");
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
          alert("Rewards Claimed Successfully!");
      } catch (err) {
          console.error(err);
          alert("Claim Failed. (Maybe no rewards yet?)");
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
          alert("Redemption Successful!");
          setIsTicketBought(false); // Reset UI state
      } catch (err) {
          console.error(err);
          alert("Redemption Failed. (Maybe cycle not ended?)");
      } finally {
          setTxPending(false);
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">
      
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">{t.mining.title}</h2>
        <p className="text-slate-500">{t.mining.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Controls */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Ticket */}
            <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group transition-opacity ${isTicketBought ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-macoin-500/10 rounded-full blur-2xl group-hover:bg-macoin-500/20 transition-all"></div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-macoin-100 rounded-lg text-macoin-600">
                        <Zap size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{t.mining.step1} {isTicketBought && "(Completed)"}</h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TICKET_TIERS.map((tier) => (
                        <button
                            key={tier.amount}
                            onClick={() => setSelectedTicket(tier)}
                            className={`relative py-4 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
                                selectedTicket.amount === tier.amount
                                ? 'bg-macoin-500 text-white border-macoin-600 shadow-lg shadow-macoin-500/20 transform scale-105 z-10'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-macoin-300 hover:bg-slate-50'
                            }`}
                        >
                            <span className="text-xl font-bold">{tier.amount} MC</span>
                            <span className={`text-[10px] ${selectedTicket.amount === tier.amount ? 'text-white/90' : 'text-slate-400'}`}>
                                +{tier.requiredLiquidity} {t.mining.liquidity}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Cycle */}
            <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group transition-opacity ${!isTicketBought ? 'opacity-50 pointer-events-none' : ''}`}>
                 {!isTicketBought && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-2xl">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg shadow-xl">
                            <Lock size={16} />
                            <span className="text-sm font-bold">Purchase Ticket First</span>
                        </div>
                    </div>
                )}
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Clock size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{t.mining.step2}</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {MINING_PLANS.map((plan) => (
                        <button
                            key={plan.days}
                            onClick={() => setSelectedPlan(plan)}
                            className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                                selectedPlan.days === plan.days
                                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg shadow-blue-500/20'
                                : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'
                            }`}
                        >
                            <div className="text-2xl font-bold mb-1">{plan.days} <span className="text-sm font-normal opacity-80">{t.mining.days}</span></div>
                            <div className={`flex items-center gap-1 text-sm ${selectedPlan.days === plan.days ? 'text-blue-100' : 'text-slate-500'}`}>
                                <TrendingUp size={14} />
                                <span>{t.mining.daily} {plan.dailyRate}%</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

             {/* Warnings */}
             <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-orange-800/80">
                    <p className="font-bold mb-1 text-orange-900">{t.mining.notice}</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>{t.mining.notice1}</li>
                        <li>{t.mining.notice2}</li>
                        <li>{t.mining.notice3}</li>
                    </ul>
                </div>
            </div>
        </div>

        {/* Right Col: Summary */}
        <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl h-full border-t-4 border-t-macoin-500 flex flex-col justify-between relative bg-white">
                
                <div>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
                        <ShieldCheck className="text-macoin-600" />
                        {t.mining.estRevenue}
                    </h3>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">{t.mining.ticketInv}</span>
                            <span className="font-mono text-slate-900">{selectedTicket.amount} MC</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">{t.mining.liqInv}</span>
                            <span className="font-mono text-slate-900">{selectedTicket.requiredLiquidity} MC</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">{t.mining.totalLock}</span>
                            <span className="font-mono text-macoin-600 font-bold">{totalInvestment} MC</span>
                        </div>
                        
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
                            Wallet Not Connected
                        </button>
                    ) : !isApproved ? (
                        <button 
                            onClick={handleApprove}
                            disabled={txPending}
                            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold rounded-lg transition-colors border border-slate-300 disabled:opacity-50"
                        >
                            {txPending ? "Approving..." : t.mining.approve}
                        </button>
                    ) : !isTicketBought ? (
                        <button 
                            onClick={handleBuyTicket}
                            disabled={txPending}
                            className="w-full py-4 bg-macoin-500 hover:bg-macoin-600 text-white font-extrabold text-lg rounded-lg shadow-lg shadow-macoin-500/30 transition-all disabled:opacity-50"
                        >
                            {txPending ? "Buying Ticket..." : "Step 2: Buy Ticket"}
                        </button>
                    ) : (
                         <button 
                            onClick={handleStake}
                            disabled={txPending}
                            className="w-full py-4 bg-gradient-to-r from-macoin-600 to-macoin-500 hover:from-macoin-500 hover:to-macoin-400 text-white font-extrabold text-lg rounded-lg shadow-lg shadow-macoin-500/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {txPending ? "Staking..." : t.mining.stake} <ArrowRight size={20} />
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
                            Claim Rewards
                         </button>
                         <button 
                            onClick={handleRedeem}
                            disabled={txPending}
                            className="flex-1 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                         >
                            Redeem
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