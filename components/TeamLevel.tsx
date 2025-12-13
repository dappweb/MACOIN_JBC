import React, { useState } from 'react';
import { TEAM_LEVELS } from '../constants';
import { Crown, Users, Percent, Link } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';

const TeamLevel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, isConnected } = useWeb3();
  const [referrer, setReferrer] = useState('');
  const [isBound, setIsBound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBind = async () => {
    if (referrer.trim() && protocolContract) {
      setIsLoading(true);
      try {
        const tx = await protocolContract.bindReferrer(referrer.trim());
        await tx.wait();
        setIsBound(true);
        alert("Referrer Bound Successfully!");
      } catch (err) {
        console.error(err);
        // Demo fallback
        setIsBound(true); 
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
       <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">{t.team.title}</h2>
        <p className="text-slate-500">{t.team.subtitle}</p>
      </div>

      {/* Bind Referrer Section */}
      <div className="glass-panel p-6 rounded-2xl bg-white border-l-4 border-macoin-500 flex flex-col sm:flex-row items-center justify-between gap-4">
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
                        disabled={!referrer.trim() || isLoading}
                        className="px-6 py-3 bg-macoin-500 hover:bg-macoin-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-lg shadow-macoin-500/20 whitespace-nowrap"
                    >
                        {isLoading ? "Binding..." : t.team.bindButton}
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 bg-white">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-slate-500 font-medium font-mono uppercase text-sm">{t.team.colLevel}</th>
                        <th className="p-4 text-slate-500 font-medium font-mono uppercase text-sm flex items-center gap-2">
                            <Users size={16} /> {t.team.colCount}
                        </th>
                        <th className="p-4 text-slate-500 font-medium font-mono uppercase text-sm">
                            <div className="flex items-center gap-2">
                                <Percent size={16} /> {t.team.colReward}
                            </div>
                        </th>
                        <th className="p-4 text-slate-500 font-medium font-mono uppercase text-sm text-right">{t.team.colStatus}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {TEAM_LEVELS.map((level, index) => {
                        const isCurrent = level.level === 'V2'; // Mock current level
                        return (
                            <tr 
                                key={level.level} 
                                className={`group hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-macoin-50' : ''}`}
                            >
                                <td className="p-4">
                                    <div className={`flex items-center gap-2 font-bold ${isCurrent ? 'text-macoin-700' : 'text-slate-700'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            index >= 6 ? 'bg-yellow-100 text-yellow-600' : 
                                            isCurrent ? 'bg-macoin-500 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {index >= 6 ? <Crown size={16} /> : level.level}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-600 font-mono">
                                    {level.countRequired.toLocaleString()}
                                </td>
                                <td className="p-4">
                                    <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-100">
                                        {level.reward}%
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    {isCurrent ? (
                                        <span className="text-macoin-600 text-xs font-bold uppercase tracking-wider border border-macoin-500 px-2 py-1 rounded bg-white">{t.team.current}</span>
                                    ) : (
                                        <span className="text-slate-300 text-xs">—</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl bg-white">
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t.team.directReward}</h3>
                <div className="text-4xl font-bold text-macoin-600 mb-2">25%</div>
                <p className="text-slate-500 text-sm">
                    {t.team.directDesc}
                </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl bg-white">
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t.team.levelReward}</h3>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{t.team.l1}</span>
                        <span className="text-slate-800">{t.team.r1}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{t.team.l2}</span>
                        <span className="text-slate-800">{t.team.r2}</span>
                    </li>
                    <li className="flex justify-between">
                        <span>{t.team.l3}</span>
                        <span className="text-slate-800">{t.team.r3}</span>
                    </li>
                </ul>
            </div>
      </div>
    </div>
  );
};

export default TeamLevel;