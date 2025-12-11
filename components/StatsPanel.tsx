import React from 'react';
import { UserStats } from '../types';
import { Wallet, TrendingUp, Users, Coins, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../LanguageContext';

interface StatsPanelProps {
  stats: UserStats;
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

const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const { t } = useLanguage();

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
                <button className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xl transition-all transform hover:-translate-y-1">
                    {t.stats.join}
                </button>
                <button className="px-6 py-3 bg-white/20 hover:bg-white/30 text-slate-900 border border-white/40 font-bold rounded-lg backdrop-blur-md transition-all">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.assets}</span>
                <Wallet className="text-macoin-600" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats.balanceMC.toLocaleString()}</div>
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
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats.balanceJBC.toLocaleString()}</div>
            <div className="text-xs text-yellow-600 flex items-center gap-1">
                ≈ ${(stats.balanceJBC * 1.2).toFixed(2)} USD
            </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.revenue}</span>
                <TrendingUp className="text-blue-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats.totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-slate-400">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-6 rounded-2xl hover:border-macoin-500/40 transition-colors bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm">{t.stats.level}</span>
                <Users className="text-purple-500" size={20} />
            </div>
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-1">
                {stats.currentLevel}
            </div>
            <div className="text-xs text-slate-400">
                {t.stats.teamCount}: {stats.teamCount}
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