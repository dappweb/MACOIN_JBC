import React, { useState, useEffect } from 'react';
import { TEAM_LEVELS } from '../constants';
import { Crown, Users, Percent, UserCheck } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';

const TeamLevel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, account, isConnected } = useWeb3();
  const [userLevelInfo, setUserLevelInfo] = useState({
      activeDirects: 0,
      teamCount: 0,
      currentLevel: 'V0'
  });
  const [directReferrals, setDirectReferrals] = useState<string[]>([]);
  const [isLoadingDirects, setIsLoadingDirects] = useState(false);

  useEffect(() => {
    const fetchTeamInfo = async () => {
        if (isConnected && account && protocolContract) {
            try {
                const userInfo = await protocolContract.userInfo(account);
                // userInfo: (referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive)

                // Calc Level
                const activeDirects = Number(userInfo[1]);
                let level = "V0";
                if (activeDirects >= 100000) level = "V9";
                else if (activeDirects >= 30000) level = "V8";
                else if (activeDirects >= 10000) level = "V7";
                else if (activeDirects >= 3000) level = "V6";
                else if (activeDirects >= 1000) level = "V5";
                else if (activeDirects >= 300) level = "V4";
                else if (activeDirects >= 100) level = "V3";
                else if (activeDirects >= 30) level = "V2";
                else if (activeDirects >= 10) level = "V1";

                setUserLevelInfo({
                    activeDirects: activeDirects,
                    teamCount: Number(userInfo[2]),
                    currentLevel: level
                });

                // Fetch Direct Referrals
                setIsLoadingDirects(true);
                try {
                    // This function was added to the contract in the latest update
                    const directs = await protocolContract.getDirectReferrals(account);
                    setDirectReferrals(directs);
                } catch (e) {
                    console.error("Failed to fetch directs", e);
                } finally {
                    setIsLoadingDirects(false);
                }

            } catch (err) {
                console.error("Failed to fetch team info", err);
            }
        }
    };
    fetchTeamInfo();
  }, [isConnected, account, protocolContract]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
       <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">{t.team.title}</h2>
        <p className="text-slate-500">{t.team.subtitle}</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
            <div>
                <h3 className="text-xl font-bold text-slate-800">{t.team.current}: <span className="text-macoin-600">{userLevelInfo.currentLevel}</span></h3>
                <p className="text-sm text-slate-500">
                    {t.team.colCount}: {userLevelInfo.activeDirects} | {t.team.colReward}: {TEAM_LEVELS.find(l => l.level === userLevelInfo.currentLevel)?.reward || '0%'}
                </p>
            </div>
            <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <span className="text-sm text-slate-500">{t.team.teamCount}:</span>
                <span className="ml-2 font-bold text-slate-900">{userLevelInfo.teamCount}</span>
            </div>
        </div>

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
                        const isCurrent = level.level === userLevelInfo.currentLevel;
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

      {/* Direct Referrals Network Section */}
      <div className="glass-panel p-6 rounded-2xl bg-white">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                <UserCheck size={24} />
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-900">{t.team.networkTitle}</h3>
                <p className="text-sm text-slate-500">{t.team.networkSubtitle}</p>
            </div>
        </div>

        {isLoadingDirects ? (
            <div className="text-center py-8 text-slate-400">{t.team.networkLoading}</div>
        ) : directReferrals.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-4 text-slate-500 text-sm font-semibold">{t.team.netWallet}</th>
                            <th className="p-4 text-slate-500 text-sm font-semibold">{t.team.netStatus}</th>
                            <th className="p-4 text-slate-500 text-sm font-semibold text-right">{t.team.netJoined}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {directReferrals.map((addr, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-slate-700 font-mono text-sm">{addr}</td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">{t.team.netActive}</span>
                                </td>
                                <td className="p-4 text-right text-slate-400 text-sm">
                                    {t.team.netRecent}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-slate-500 font-medium">{t.team.netNone}</p>
                <p className="text-slate-400 text-sm">{t.team.netShare}</p>
            </div>
        )}
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