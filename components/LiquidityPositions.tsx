import React, { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { Clock, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useWeb3 } from '../Web3Context';
import { useLanguage } from '../LanguageContext';

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
  staticReward: string; // Estimated pending static reward
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
  const { protocolContract, account } = useWeb3();
  const { t } = useLanguage();
  const [rawPositions, setRawPositions] = useState<RawStakePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [secondsInUnit, setSecondsInUnit] = useState(60);

  // Update current time every second for countdown/progress
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch SECONDS_IN_UNIT from contract
  useEffect(() => {
    const fetchConstants = async () => {
      if (protocolContract) {
        try {
          // Check if function exists in ABI before calling (handled by try/catch or ensure ABI update)
          const s = await protocolContract.SECONDS_IN_UNIT();
          setSecondsInUnit(Number(s));
        } catch (e) {
          console.warn("Failed to fetch SECONDS_IN_UNIT, using default 60", e);
        }
      }
    };
    fetchConstants();
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
          
          const id = stakeData[0].toString();
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
                    {pos.status === 'active' ? (t.mining?.mining || 'Mining') : pos.status === 'completed' ? (t.mining?.completed || 'Completed') : (t.mining?.redeemed || 'Redeemed')}
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
                <div className="text-xs text-gray-500">{t.mining?.pending || "Pending"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">{t.mining?.cycle || "Cycle"}</span>
                 <span className="text-gray-300">{pos.cycleDays} {t.mining?.days || "Mins"}</span>
               </div>
               <div className="bg-black/20 rounded p-2">
                 <span className="text-gray-500 text-xs block">{t.mining?.countdown || "倒计时"}</span>
                 <span className={`font-mono ${pos.status === 'completed' ? 'text-green-400' : 'text-neon-400'}`}>
                    {formatCountdown(pos.endTime, currentTime, t)}
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
