import React, { useState, useEffect } from 'react';
import { TEAM_LEVELS } from '../constants';
import { Crown, Users, Percent, UserCheck, Copy, Share2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useWeb3 } from '../Web3Context';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

interface DirectReferral {
    user: string;
    ticketAmount: bigint;
    joinTime: bigint;
}

const TeamLevel: React.FC = () => {
  const { t } = useLanguage();
  const { protocolContract, account, isConnected } = useWeb3();
  const [userLevelInfo, setUserLevelInfo] = useState({
      activeDirects: 0,
      teamCount: 0,
      currentLevel: 'V0'
  });
  const [directReferrals, setDirectReferrals] = useState<DirectReferral[]>([]);
  const [isLoadingDirects, setIsLoadingDirects] = useState(false);

  // Calculate total ticket amount from direct referrals
  const totalTicketAmount = directReferrals.reduce((acc, curr) => acc + curr.ticketAmount, 0n);

  const copyReferralLink = () => {
      if (account) {
          const url = `${window.location.origin}?ref=${account}`;
          
          // Try modern clipboard API first
          if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url)
                  .then(() => toast.success("Referral Link Copied!"))
                  .catch(() => fallbackCopy(url));
          } else {
              // Fallback for older browsers or non-HTTPS
              fallbackCopy(url);
          }
      } else {
          toast.error("Connect Wallet First");
      }
  };

  const fallbackCopy = (text: string) => {
      try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          toast.success("Referral Link Copied!");
      } catch (err) {
          console.error('Failed to copy:', err);
          toast.error("Failed to copy link");
      }
  };

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
                    // Returns array of structs: (user, ticketAmount, joinTime)
                    const data = await protocolContract.getDirectReferralsData(account);
                    // data is a Result object that behaves like an array of Results
                    const formattedData: DirectReferral[] = data.map((item: any) => ({
                        user: item.user,
                        ticketAmount: item.ticketAmount,
                        joinTime: item.joinTime
                    }));
                    setDirectReferrals(formattedData);
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
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
       <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{t.team.title}</h2>
        <p className="text-sm md:text-base text-gray-400">{t.team.subtitle}</p>
      </div>

      <div className="glass-panel rounded-xl md:rounded-2xl overflow-hidden border border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="p-4 md:p-6 border-b border-gray-800 flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 justify-between items-start sm:items-center bg-gray-800/50">
            <div>
                <h3 className="text-lg md:text-xl font-bold text-white">{t.team.current}: <span className="text-neon-400">{userLevelInfo.currentLevel}</span></h3>
                <p className="text-xs md:text-sm text-gray-400">
                    {t.team.colCount}: {userLevelInfo.activeDirects} | {t.team.colReward}: {TEAM_LEVELS.find(l => l.level === userLevelInfo.currentLevel)?.reward || '0%'}
                </p>
            </div>

        </div>

        <div className="overflow-x-auto px-4 -mx-4 sm:mx-0">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-800/50 border-b border-gray-800">
                        <th className="p-2 md:p-4 text-gray-400 font-medium font-mono uppercase text-xs md:text-sm">{t.team.colLevel}</th>
                        <th className="p-2 md:p-4 text-gray-400 font-medium font-mono uppercase text-xs md:text-sm">
                            <div className="flex items-center gap-1 md:gap-2">
                                <Users size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">{t.team.colCount}</span>
                            </div>
                        </th>
                        <th className="p-2 md:p-4 text-gray-400 font-medium font-mono uppercase text-xs md:text-sm">
                            <div className="flex items-center gap-1 md:gap-2">
                                <Percent size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">{t.team.colReward}</span>
                            </div>
                        </th>
                        <th className="p-2 md:p-4 text-gray-400 font-medium font-mono uppercase text-xs md:text-sm text-right">{t.team.colStatus}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {TEAM_LEVELS.map((level, index) => {
                        const isCurrent = level.level === userLevelInfo.currentLevel;
                        return (
                            <tr 
                                key={level.level} 
                                className={`group hover:bg-gray-800/50 transition-colors ${isCurrent ? 'bg-neon-900/20' : ''}`}
                            >
                                <td className="p-2 md:p-4">
                                    <div className={`flex items-center gap-2 font-bold ${isCurrent ? 'text-neon-400' : 'text-gray-300'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            index >= 6 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                            isCurrent ? 'bg-neon-500 text-black' : 'bg-gray-800 text-gray-500 border border-gray-700'
                                        }`}>
                                            {index >= 6 ? <Crown size={16} /> : level.level}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-2 md:p-4 text-gray-400 font-mono">
                                    {level.countRequired.toLocaleString()}
                                </td>
                                <td className="p-2 md:p-4">
                                    <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                                        {level.reward}%
                                    </span>
                                </td>
                                <td className="p-2 md:p-4 text-right">
                                    {isCurrent ? (
                                        <span className="text-neon-400 text-xs font-bold uppercase tracking-wider border border-neon-500 px-2 py-1 rounded bg-neon-900/20">{t.team.current}</span>
                                    ) : (
                                        <span className="text-gray-700 text-xs">—</span>
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
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 md:mb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                    <UserCheck size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">{t.team.networkTitle}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        {t.team.networkSubtitle}
                        {account && (
                            <button onClick={copyReferralLink} className="text-neon-400 hover:text-neon-300 font-bold flex items-center gap-1 ml-2">
                                <Copy size={12} /> Link
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{t.team.netTotalAmount}</p>
                <p className="text-xl font-black text-purple-400 font-mono">
                    {ethers.formatEther(totalTicketAmount)} <span className="text-sm font-bold text-purple-300">MC</span>
                </p>
            </div>
        </div>

        {isLoadingDirects ? (
            <div className="text-center py-8 text-gray-500">{t.team.networkLoading}</div>
        ) : directReferrals.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                            <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold">{t.team.netWallet}</th>
                            <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold whitespace-nowrap">{t.team.netTicket}</th>
                            <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold whitespace-nowrap">{t.team.netStatus}</th>
                            <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold text-right whitespace-nowrap">{t.team.netJoined}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {directReferrals.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                <td className="p-2 md:p-4 text-gray-300 font-mono text-sm">
                                    {item.user.substring(0, 6)}...{item.user.substring(38)}
                                </td>
                                <td className="p-2 md:p-4 text-white font-bold text-sm whitespace-nowrap">
                                    {ethers.formatEther(item.ticketAmount)} MC
                                </td>
                                <td className="p-2 md:p-4">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${item.ticketAmount > 0n ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                                        {item.ticketAmount > 0n ? t.team.netActive : 'Inactive'}
                                    </span>
                                </td>
                                <td className="p-2 md:p-4 text-right text-gray-500 text-sm whitespace-nowrap">
                                    {item.joinTime > 0n ? new Date(Number(item.joinTime) * 1000).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                <Users className="mx-auto text-gray-600 mb-2" size={32} />
                <p className="text-gray-400 font-medium">{t.team.netNone}</p>
                <button 
                    onClick={copyReferralLink}
                    className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 bg-neon-500/20 text-neon-400 rounded-lg hover:bg-neon-500/30 transition-colors font-bold text-sm border border-neon-500/30"
                >
                    <Share2 size={16} />
                    {t.team.netShare}
                </button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
                <h3 className="text-base md:text-lg font-bold text-white mb-2">{t.team.directReward}</h3>
                <div className="text-3xl md:text-4xl font-bold text-neon-400 mb-2">25%</div>
                <p className="text-gray-400 text-xs md:text-sm">
                    {t.team.directDesc}
                </p>
            </div>
            <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
                <h3 className="text-base md:text-lg font-bold text-white mb-2">{t.team.levelReward}</h3>
                <ul className="space-y-2 text-xs md:text-sm text-gray-400">
                    <li className="flex justify-between border-b border-gray-800 pb-1">
                        <span>{t.team.l1}</span>
                        <span className="text-gray-300">{t.team.r1}</span>
                    </li>
                    <li className="flex justify-between border-b border-gray-800 pb-1">
                        <span>{t.team.l2}</span>
                        <span className="text-gray-300">{t.team.r2}</span>
                    </li>
                    <li className="flex justify-between">
                        <span>{t.team.l3}</span>
                        <span className="text-gray-300">{t.team.r3}</span>
                    </li>
                </ul>
            </div>
      </div>
    </div>
  );
};

export default TeamLevel;