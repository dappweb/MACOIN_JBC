import React, { useEffect, useState } from 'react';
import { UserStats } from '../types';
import { Wallet, TrendingUp, Users, Coins, ArrowUpRight, Link } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

interface StatsPanelProps {
  stats: UserStats;
  onJoinClick: () => void;
  onWhitepaperClick: () => void;
}

const data = [
  { name: '1', uv: 4000 },
  { name: '5', uv: 3000 },
  { name: '10', uv: 5000 },
  { name: '15', uv: 7580 },
  { name: '20', uv: 6890 },
  { name: '25', uv: 9390 },
  { name: '30', uv: 10500 },
];

const StatsPanel: React.FC<StatsPanelProps> = ({ stats: initialStats, onJoinClick, onWhitepaperClick }) => {
  const { t } = useLanguage();
  const { mcContract, protocolContract, account, isConnected } = useWeb3();
  const [displayStats, setDisplayStats] = useState<UserStats>(initialStats);
  
  // Bind Referrer State
  const [referrer, setReferrer] = useState('');
  const [isBound, setIsBound] = useState(false);
  const [isBinding, setIsBinding] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        if (isConnected && account && mcContract && protocolContract) {
            try {
                // Fetch MC Balance
                const mcBal = await mcContract.balanceOf(account);
                
                // Fetch Protocol Info
                const userInfo = await protocolContract.userInfo(account);
                // userInfo returns: (referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive)
                
                // Check referrer binding
                const currentReferrer = userInfo[0];
                if (currentReferrer && currentReferrer !== '0x0000000000000000000000000000000000000000') {
                    setIsBound(true);
                }

                // Calculate Level based on activeDirects (simplified V1-V9 logic)
                let level = "V0";
                const activeDirects = Number(userInfo[1]);
                if (activeDirects >= 100000) level = "V9";
                else if (activeDirects >= 30000) level = "V8";
                else if (activeDirects >= 10000) level = "V7";
                else if (activeDirects >= 3000) level = "V6";
                else if (activeDirects >= 1000) level = "V5";
                else if (activeDirects >= 300) level = "V4";
                else if (activeDirects >= 100) level = "V3";
                else if (activeDirects >= 30) level = "V2";
                else if (activeDirects >= 10) level = "V1";

                setDisplayStats(prev => ({ 
                    ...prev, 
                    balanceMC: parseFloat(ethers.formatEther(mcBal)),
                    // balanceJBC: ... (Need JBC Contract),
                    totalRevenue: parseFloat(ethers.formatEther(userInfo[3])),
                    teamCount: Number(userInfo[2]),
                    currentLevel: level
                }));
            } catch (err) {
                console.error("Error fetching stats", err);
            }
        }
    };
    const timer = setInterval(fetchData, 5000); // Refresh every 5s
    fetchData();
    return () => clearInterval(timer);
  }, [isConnected, account, mcContract, protocolContract]);

  const handleBind = async () => {
    if (referrer.trim() && protocolContract) {
      setIsBinding(true);
      try {
        const tx = await protocolContract.bindReferrer(referrer.trim());
        await tx.wait();
        setIsBound(true);
        toast.success("Referrer Bound Successfully!");
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to bind: " + (err.reason || err.message));
      } finally {
        setIsBinding(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* Hero Section - Gold Theme */}
      <div className="relative rounded-3xl overflow-hidden min-h-[300px] flex items-center bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border border-yellow-500/50 shadow-2xl">
         {/* Texture Overlay */}
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-transparent"></div>
         
         <div className="relative z-10 p-8 md:p-12 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/10 text-slate-900 text-xs font-bold uppercase tracking-wider mb-4 border border-black/5 backdrop-blur-sm">
                {t.stats.protocol}
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-4 leading-tight drop-shadow-sm">
                {t.stats.title} <br/>
                <span className="text-white drop-shadow-md text-3xl md:text-5xl">{t.stats.subtitle}</span>
            </h1>
            <p className="text-slate-900/80 text-lg mb-8 max-w-lg font-medium">
                {t.stats.desc}
            </p>
            <div className="flex gap-4">
                <button 
                    onClick={onJoinClick}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xl transition-all transform hover:-translate-y-1"
                >
                    {t.stats.join}
                </button>
                <button 
                    onClick={onWhitepaperClick}
                    className="px-6 py-3 bg-white/20 hover:bg-white/30 text-slate-900 border border-white/40 font-bold rounded-lg backdrop-blur-md transition-all"
                >
                    {t.stats.whitepaper}
                </button>
            </div>
         </div>

         {/* Floating Gold Element */}
         <div className="hidden lg:block absolute right-20 top-1/2 -translate-y-1/2">
            <div className="relative w-64 h-64">
                 <div className="absolute inset-0 bg-yellow-200 rounded-full blur-[80px] opacity-40"></div>
                 {/* Gold bars or Coin Image Placeholder */}
                 <div className="relative z-10 w-48 h-48 bg-gradient-to-br from-yellow-100 to-yellow-600 rounded-2xl rotate-12 shadow-[0_20px_50px_rgba(180,83,9,0.5)] border-t border-l border-white/50 flex items-center justify-center">
                    <div className="text-6xl font-bold text-yellow-900 opacity-20">JBC</div>
                 </div>
            </div>
         </div>
      </div>

      {/* Bind Referrer Section (Moved from TeamLevel) */}
      <div className="glass-panel p-6 rounded-2xl bg-white border-l-4 border-macoin-500 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="bg-macoin-100 p-3 rounded-full text-macoin-600">
                <Link size={24} />
            </div>
            <div>
                <h3 className="font-bold text-slate-900">{t.team.bindTitle}</h3>
                <p className="text-sm text-slate-500">{t.team.bindDesc}</p>
            </div>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
            {!isConnected ? (
                <button disabled className="px-6 py-3 bg-slate-200 text-slate-400 font-bold rounded-lg cursor-not-allowed whitespace-nowrap">
                    Connect Wallet First
                </button>
            ) : isBound ? (
                 <div className="px-6 py-3 bg-green-100 text-green-700 font-bold rounded-lg border border-green-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {t.team.bindSuccess}
                 </div>
            ) : (
                <>
                    <input 
                        type="text" 
                        value={referrer}
                        onChange={(e) => setReferrer(e.target.value)}
                        placeholder={t.team.bindPlaceholder}
                        className="w-full sm:w-64 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-macoin-500 text-slate-900"
                    />
                    <button 
                        onClick={handleBind}
                        disabled={!referrer.trim() || isBinding}
                        className="px-6 py-3 bg-macoin-500 hover:bg-macoin-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-lg shadow-macoin-500/20 whitespace-nowrap"
                    >
                        {isBinding ? "Binding..." : t.team.bindButton}
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.assets}</span>
                <Wallet className="text-macoin-600" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{displayStats.balanceMC.toLocaleString()}</div>
            <div className="text-xs text-macoin-600 flex items-center gap-1">
                <ArrowUpRight size={12} /> +2.4% {t.stats.today}
            </div>
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.holding}</span>
                <Coins className="text-yellow-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{displayStats.balanceJBC.toLocaleString()}</div>
            <div className="text-xs text-yellow-600 flex items-center gap-1">
                ≈ ${(displayStats.balanceJBC * 1.2).toFixed(2)} USD
            </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.revenue}</span>
                <TrendingUp className="text-blue-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{displayStats.totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-slate-400">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.level}</span>
                <Users className="text-purple-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-1">
                {displayStats.currentLevel}
            </div>
            <div className="text-xs text-slate-400">
                {t.stats.teamCount}: {displayStats.teamCount}
            </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel p-6 rounded-2xl bg-white">
         <h3 className="text-lg font-bold mb-6 text-slate-900 border-l-4 border-macoin-500 pl-3">{t.stats.chartTitle}</h3>
         <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00dc82" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00dc82" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                    itemStyle={{ color: '#16a34a' }}
                />
                <Area type="monotone" dataKey="uv" stroke="#00dc82" strokeWidth={3} fillOpacity={1} fill="url(#colorUv)" />
                </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

    </div>
  );
};

export default StatsPanel;