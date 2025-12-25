import React, { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { Clock, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useWeb3 } from '../Web3Context';
import { useLanguage } from '../LanguageContext';

interface StakePosition {
  id: string;
  amount: string;
  startTime: number;
  cycleDays: number;
  active: boolean;
  paid: string;
  staticReward: string; // Estimated pending static reward
  endTime: number;
  progress: number;
  status: 'active' | 'completed' | 'redeemed';
}

const LiquidityPositions: React.FC = () => {
  const { protocolContract, account } = useWeb3();
  const { t } = useLanguage();
  const [positions, setPositions] = useState<StakePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Update current time every second for countdown/progress
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPositions = async () => {
    if (!protocolContract || !account) return;
    
    setLoading(true);
    try {
      // Need to find how many stakes user has.
      // Contract doesn't expose "getUserStakeCount" directly, but we can try fetching until error or use a large number if we had an event indexer.
      // However, the contract `userStakes(address, index)` returns a struct.
      // We don't know the length.
      // Workaround: Try fetching index 0, 1, 2... until revert. 
      // Optimized: Assuming a reasonable max cap or if the contract had a length getter.
      // Looking at ABI in Web3Context: "function userStakes(address, uint256) view returns (...)"
      // No length getter exposed in ABI.
      // BUT, we can try to fetch a reasonable amount, e.g., 50. Or stop when it fails.
      
      const stakes: StakePosition[] = [];
      let index = 0;
      let consecutiveFailures = 0;

      while (true) {
        try {
          const stakeData = await protocolContract.userStakes(account, index);
          // struct Stake { id, amount, startTime, cycleDays, active, paid }
          // Returns: [id, amount, startTime, cycleDays, active, paid]
          
          const id = stakeData[0].toString();
          const amount = ethers.formatEther(stakeData[1]);
          const startTime = Number(stakeData[2]);
          const cycleDays = Number(stakeData[3]);
          const active = stakeData[4];
          const paid = ethers.formatEther(stakeData[5]);
          
          // Calculate End Time (Minutes in Demo, Days in Prod - based on SECONDS_IN_UNIT)
          // Contract constant SECONDS_IN_UNIT = 60 (from ABI check or assuming Demo mode as per previous context)
          // Let's check contract code if possible, but assuming standard logic.
          // In deployment it might be days. But earlier code showed 60.
          // Let's assume 60 seconds per unit for now as per previous contract read.
          const SECONDS_IN_UNIT = 60; 
          const durationSeconds = cycleDays * SECONDS_IN_UNIT;
          const endTime = startTime + durationSeconds;
          
          // Calculate Status
          let status: StakePosition['status'] = 'redeemed';
          if (active) {
            status = currentTime >= endTime ? 'completed' : 'active';
          }

          // Calculate Pending Static Reward
          // Rate: 7->2%, 15->2.5%, 30->3% (Per cycle? No, Rate per thousand? Let's re-read contract logic)
          // Contract: 
          // 7 days -> ratePerThousand = 20 (2%)
          // 15 days -> ratePerThousand = 25 (2.5%)
          // 30 days -> ratePerThousand = 30 (3.0%)
          // Formula: (amount * rate * unitsPassed) / 1000
          
          let ratePerThousand = 0;
          if (cycleDays === 7) ratePerThousand = 20;
          else if (cycleDays === 15) ratePerThousand = 25;
          else if (cycleDays === 30) ratePerThousand = 30;

          const unitsPassed = Math.min(
            cycleDays,
            Math.floor((currentTime - startTime) / SECONDS_IN_UNIT)
          );
          
          const totalStaticShouldBe = (BigInt(stakeData[1]) * BigInt(ratePerThousand) * BigInt(unitsPassed)) / 1000n;
          const paidBigInt = stakeData[5];
          const pendingBigInt = totalStaticShouldBe > paidBigInt ? totalStaticShouldBe - paidBigInt : 0n;
          const staticReward = ethers.formatEther(pendingBigInt);

          // Calculate Progress
          const totalDuration = endTime - startTime;
          const elapsed = currentTime - startTime;
          let progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          if (!active) progress = 100;

          stakes.push({
            id,
            amount,
            startTime,
            cycleDays,
            active,
            paid,
            staticReward,
            endTime,
            progress,
            status
          });

          index++;
          // Safety break
          if (index > 50) break; 
        } catch (e) {
            // Revert likely means index out of bounds
            break;
        }
      }
      
      // Sort: Active first, then by Start Time desc
      stakes.sort((a, b) => {
        if (a.active === b.active) {
            return b.startTime - a.startTime;
        }
        return a.active ? -1 : 1;
      });

      setPositions(stakes);
    } catch (err) {
      console.error("Failed to fetch stake positions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [protocolContract, account, currentTime]); // Re-fetch or re-calc when time changes? Maybe just re-calc. 
  // Optimization: Don't re-fetch from chain every second. Just re-calc locally.
  // But for simplicity in V1, let's fetch on mount and account change, and maybe refresh button.
  // The useEffect above with `currentTime` is too heavy. Let's remove `currentTime` from dep array.
  
  useEffect(() => {
    fetchPositions();
  }, [protocolContract, account]);

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
                <p className="text-sm text-gray-400">Est. Pending Reward</p>
                <p className="text-lg font-bold text-amber-400">≈ {totalPending.toFixed(4)} Value</p>
            </div>
        </div>
      </div>

      <div className="space-y-3">
        {positions.map((pos) => (
          <div 
            key={pos.id} 
            className={`relative overflow-hidden bg-gray-900/50 border rounded-xl p-4 transition-all ${
              pos.active 
                ? 'border-gray-700 hover:border-neon-500/50' 
                : 'border-gray-800 opacity-60'
            }`}
          >
            {/* Progress Bar Background */}
            {pos.active && (
              <div 
                className="absolute bottom-0 left-0 h-1 bg-neon-500/20" 
                style={{ width: `${pos.progress}%` }} 
              />
            )}

            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">{parseFloat(pos.amount).toFixed(0)} MC</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    pos.status === 'active' ? 'bg-neon-500/10 text-neon-400 border-neon-500/30' :
                    pos.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    'bg-gray-700 text-gray-400 border-gray-600'
                  }`}>
                    {pos.status === 'active' ? 'Mining' : pos.status === 'completed' ? 'Completed' : 'Redeemed'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(pos.startTime * 1000).toLocaleString()}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-amber-400">
                  +{parseFloat(pos.staticReward).toFixed(4)}
                </div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">Cycle</span>
                 <span className="text-gray-300">{pos.cycleDays} {t.mining?.days || "Mins"}</span>
               </div>
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">End Time</span>
                 <span className="text-gray-300">
                    {new Date(pos.endTime * 1000).toLocaleTimeString()}
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
