import React, { useState, useMemo } from 'react';
import { TicketTier, MiningPlan } from '../src/types';
import { TICKET_TIERS, MINING_PLANS } from '../src/constants';
import { Calculator, DollarSign, TrendingUp, RefreshCw, Plus, Minus, Info } from 'lucide-react';
import { useLanguage } from '../src/LanguageContext';

interface RevenueCalculatorProps {
  initialTicket?: TicketTier;
  initialPlan?: MiningPlan;
}

const RevenueCalculator: React.FC<RevenueCalculatorProps> = ({ 
  initialTicket = TICKET_TIERS[0], 
  initialPlan = MINING_PLANS[0] 
}) => {
  const { t } = useLanguage();
  const [selectedTicket, setSelectedTicket] = useState<TicketTier>(initialTicket);
  const [selectedPlan, setSelectedPlan] = useState<MiningPlan>(initialPlan);
  const [quantity, setQuantity] = useState<number>(1);
  const [showDetails, setShowDetails] = useState(false);

  const calculations = useMemo(() => {
    const ticketCost = selectedTicket.amount * quantity;
    const liquidityReq = selectedTicket.requiredLiquidity * quantity;
    const totalInvestment = ticketCost + liquidityReq;
    
    // Daily Revenue = Liquidity * Rate
    const dailyRevenue = (liquidityReq * selectedPlan.dailyRate) / 100;
    const totalRevenue = dailyRevenue * selectedPlan.days;
    
    // Net Profit = Total Revenue - Ticket Cost (assuming liquidity is returned)
    const netProfit = totalRevenue - ticketCost;
    
    // ROI = (Net Profit / Total Investment) * 100
    // Or (Net Profit / Ticket Cost) ? 
    // Usually users care about "How much do I make on top of what I put in?"
    // Since Liquidity is returned, the actual "cost" is opportunity cost of liquidity + ticket cost.
    // Let's show Net ROI based on Total Investment involved.
    const netRoi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    return {
      ticketCost,
      liquidityReq,
      totalInvestment,
      dailyRevenue,
      totalRevenue,
      netProfit,
      netRoi
    };
  }, [selectedTicket, selectedPlan, quantity]);

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(100, prev + delta)));
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in">
      <div className="p-4 md:p-6 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white">
          <Calculator className="text-neon-400" size={24} />
          <h3 className="font-bold text-lg">{t.mining?.calculatorTitle || "Revenue Calculator"}</h3>
        </div>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-neon-400 hover:text-neon-300 transition-colors"
        >
          {showDetails ? (t.common?.simpleMode || "Simple Mode") : (t.common?.detailMode || "Detail Mode")}
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Ticket Tier */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium block">{t.mining?.selectTicket || "Select Ticket"}</label>
            <div className="grid grid-cols-2 gap-2">
              {TICKET_TIERS.map((tier) => (
                <button
                  key={tier.amount}
                  onClick={() => setSelectedTicket(tier)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    selectedTicket.amount === tier.amount
                      ? 'bg-neon-500/20 text-neon-400 border-neon-500/50'
                      : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {tier.amount} MC
                </button>
              ))}
            </div>
          </div>

          {/* Mining Plan */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium block">{t.mining?.selectCycle || "Select Cycle"}</label>
            <div className="flex gap-2">
              {MINING_PLANS.map((plan) => (
                <button
                  key={plan.days}
                  onClick={() => setSelectedPlan(plan)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    selectedPlan.days === plan.days
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {plan.days} {t.mining?.days || "Days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center justify-between bg-gray-800/30 p-3 rounded-xl border border-gray-800">
          <span className="text-gray-300 font-medium">{t.mining?.quantity || "Quantity"}</span>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleQuantityChange(-1)}
              className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
            >
              <Minus size={16} />
            </button>
            <span className="w-8 text-center font-bold text-white text-lg">{quantity}</span>
            <button 
              onClick={() => handleQuantityChange(1)}
              className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-gray-800/50 rounded-xl p-4 md:p-5 border border-gray-700 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">{t.mining?.totalInvestment || "Total Investment"}</div>
              <div className="text-lg md:text-xl font-bold text-white font-mono">
                {calculations.totalInvestment.toLocaleString()} <span className="text-sm font-normal text-gray-500">MC</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">{t.mining?.netProfit || "Est. Net Profit"}</div>
              <div className={`text-lg md:text-xl font-bold font-mono ${calculations.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculations.netProfit >= 0 ? '+' : ''}{calculations.netProfit.toLocaleString()} <span className="text-sm font-normal text-gray-500">MC</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-700/50" />

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-300">
              {t.mining?.dailyRev || "Daily Revenue"}
            </div>
            <div className="font-mono font-bold text-neon-400">
              +{calculations.dailyRevenue.toFixed(2)} MC
            </div>
          </div>

          {showDetails && (
            <div className="space-y-2 pt-2 animate-in slide-in-from-top-2 fade-in">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{t.mining?.ticketCost || "Ticket Cost"}</span>
                <span className="font-mono text-gray-300">-{calculations.ticketCost.toLocaleString()} MC</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{t.mining?.liqInv || "Liquidity"} (Returned)</span>
                <span className="font-mono text-gray-300">{calculations.liquidityReq.toLocaleString()} MC</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{t.mining?.totalRev || "Gross Revenue"}</span>
                <span className="font-mono text-amber-400">+{calculations.totalRevenue.toFixed(2)} MC</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-700/50">
                <span className="text-gray-400">Net ROI</span>
                <span className={`font-mono font-bold ${calculations.netRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.netRoi.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-900/10 p-3 rounded-lg border border-blue-500/10">
          <Info size={14} className="mt-0.5 shrink-0 text-blue-400" />
          <p>{t.mining?.calcDisclaimer || "Calculations are estimates. Ticket cost is non-refundable. Liquidity is returned after the cycle ends."}</p>
        </div>
      </div>
    </div>
  );
};

export default RevenueCalculator;
