import React, { useState, useEffect } from "react"
import { TEAM_LEVELS } from "../src/constants"
import { Users, Percent, UserCheck, Copy, Share2, Crown } from "lucide-react"
import { useLanguage } from "../src/LanguageContext"
import { useWeb3 } from "../src/Web3Context"
import { ethers } from "ethers"
import toast from "react-hot-toast"

const safeFormatEther = (val: any) => {
  if (val === undefined || val === null) return "0"
  try {
    return ethers.formatEther(val)
  } catch (e) {
    return "0"
  }
}

interface DirectReferral {
  user: string
  ticketAmount: bigint
  joinTime: bigint
}

const TeamLevel: React.FC = () => {
  const { t } = useLanguage()
  const { protocolContract, account, isConnected } = useWeb3()
  const [userLevelInfo, setUserLevelInfo] = useState({
    activeDirects: 0,
    teamCount: 0,
    currentLevel: "V0",
    teamTotalVolume: 0n,
    teamTotalCap: 0n,
  })
  const [directReferrals, setDirectReferrals] = useState<DirectReferral[]>([])
  const [isLoadingDirects, setIsLoadingDirects] = useState(false)

  // Calculate total ticket amount from direct referrals
  const totalTicketAmount = directReferrals.reduce((acc, curr) => acc + curr.ticketAmount, 0n)

  const copyReferralLink = () => {
    if (account) {
      const url = `${window.location.origin}?ref=${account}`

      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Referral Link Copied!"))
          .catch(() => fallbackCopy(url))
      } else {
        // Fallback for older browsers or non-HTTPS
        fallbackCopy(url)
      }
    } else {
      toast.error("Connect Wallet First")
    }
  }

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      toast.success("Referral Link Copied!")
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link")
    }
  }

  useEffect(() => {
    const fetchTeamInfo = async () => {
      if (isConnected && account && protocolContract) {
        try {
          const userInfo = await protocolContract.userInfo(account)
          // userInfo: (referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive)

          // Calc Level
          const activeDirects = Number(userInfo[1])
          const teamCount = Number(userInfo[2])
          const effectiveCount = Math.max(activeDirects, teamCount)
          
          let level = "V0"
          if (effectiveCount >= 100000) level = "V9"
          else if (effectiveCount >= 30000) level = "V8"
          else if (effectiveCount >= 10000) level = "V7"
          else if (effectiveCount >= 3000) level = "V6"
          else if (effectiveCount >= 1000) level = "V5"
          else if (effectiveCount >= 300) level = "V4"
          else if (effectiveCount >= 100) level = "V3"
          else if (effectiveCount >= 30) level = "V2"
          else if (effectiveCount >= 10) level = "V1"

          setUserLevelInfo({
            activeDirects: activeDirects,
            teamCount: teamCount,
            currentLevel: level,
            teamTotalVolume: userInfo[7],
            teamTotalCap: userInfo[8],
          })

          // Fetch Direct Referrals
          setIsLoadingDirects(true)
          try {
            // This function was added to the contract in the latest update
            // Returns array of structs: (user, ticketAmount, joinTime)
            const data = await protocolContract.getDirectReferralsData(account)
            // data is a Result object that behaves like an array of Results
            const formattedData: DirectReferral[] = data.map((item: any) => ({
              user: item.user,
              ticketAmount: item.ticketAmount,
              joinTime: item.joinTime,
            }))
            setDirectReferrals(formattedData)
          } catch (e) {
            console.error("Failed to fetch directs", e)
          } finally {
            setIsLoadingDirects(false)
          }
        } catch (err) {
          console.error("Failed to fetch team info", err)
        }
      }
    }
    fetchTeamInfo()
  }, [isConnected, account, protocolContract])

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{t.team.title}</h2>
        <p className="text-sm md:text-base text-gray-400">{t.team.subtitle}</p>
      </div>

      <div className="glass-panel rounded-xl md:rounded-2xl overflow-hidden border border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="p-4 md:p-6 border-b border-gray-800 flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 justify-between items-start sm:items-center bg-gray-800/50">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">
              {t.team.current}: <span className="text-neon-400 text-2xl ml-1">{userLevelInfo.currentLevel}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-gray-700/50 flex items-center gap-2">
                <span className="text-xs text-gray-400">{t.team.colCount}</span>
                <span className="text-sm md:text-base font-bold text-white">
                  {Math.max(userLevelInfo.activeDirects, userLevelInfo.teamCount || 0)}
                </span>
              </div>
              <div className="bg-black/30 px-3 py-1.5 rounded-lg border border-gray-700/50 flex items-center gap-2">
                <span className="text-xs text-gray-400">{t.team.colReward}</span>
                <span className="text-sm md:text-base font-bold text-amber-400">
                  {TEAM_LEVELS.find((l) => l.level === userLevelInfo.currentLevel)?.reward || "0"}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 移动端卡片布局 */}
        <div className="block md:hidden px-4 py-2 space-y-2">
          {/* 表头 */}
          <div className="grid grid-cols-3 gap-2 px-3 pb-1 text-xs text-gray-500 font-bold uppercase tracking-wider text-center">
            <span>{t.team.colLevel}</span>
            <span>{t.team.colCountShort || "社区地址"}</span>
            <span>{t.team.colRewardShort || "奖励"}</span>
          </div>

          {TEAM_LEVELS.map((level) => {
            const isCurrent = level.level === userLevelInfo.currentLevel

            let badgeStyle = isCurrent
              ? "bg-neon-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]"
              : "bg-gray-800 text-gray-500 border border-gray-700"
            let icon = null

            if (level.level === "V7") {
              badgeStyle = isCurrent
                ? "bg-slate-300 text-black border border-slate-400 shadow-[0_0_15px_rgba(203,213,225,0.4)]"
                : "bg-slate-300/20 text-slate-300 border border-slate-400/30"
              icon = <Crown size={12} className={isCurrent ? "fill-black" : "fill-slate-300/20"} />
            } else if (level.level === "V8") {
              badgeStyle = isCurrent
                ? "bg-cyan-300 text-black border border-cyan-400 shadow-[0_0_15px_rgba(103,232,249,0.4)]"
                : "bg-cyan-300/20 text-cyan-300 border border-cyan-400/30"
              icon = <Crown size={12} className={isCurrent ? "fill-black" : "fill-cyan-300/20"} />
            } else if (level.level === "V9") {
              badgeStyle = isCurrent
                ? "bg-amber-400 text-black border border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                : "bg-amber-400/20 text-amber-400 border border-amber-500/30"
              icon = <Crown size={12} className={isCurrent ? "fill-black" : "fill-amber-400/20"} />
            }

            return (
              <div
                key={level.level}
                className={`grid grid-cols-3 gap-2 items-center p-3 rounded-lg border transition-all duration-300 text-center ${
                  isCurrent 
                    ? "bg-neon-900/20 border-neon-500/50 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)] scale-[1.02]" 
                    : "bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50"
                }`}
              >
                {/* 等级列 */}
                <div className="flex justify-center">
                  <div className={`h-7 w-14 rounded-lg flex items-center justify-center gap-1 text-sm font-bold ${badgeStyle}`}>
                    {icon}
                    {level.level}
                  </div>
                </div>

                {/* 社区地址列 */}
                <div className="flex justify-center">
                  <span className={`font-mono text-sm ${isCurrent ? "text-white font-bold" : "text-gray-400"}`}>
                    {level.countRequired.toLocaleString()}
                  </span>
                </div>

                {/* 奖励列 */}
                <div className="flex justify-center">
                  <span className={`px-2.5 py-1 rounded-full font-bold text-sm border ${
                    isCurrent
                      ? "bg-amber-500 text-black border-amber-600 shadow-lg"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}>
                    {level.reward}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 桌面端表格布局 */}
        <div className="hidden md:block overflow-x-auto px-4 -mx-4 sm:mx-0 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800">
                <th className="p-4 text-gray-400 font-medium font-mono uppercase text-sm whitespace-nowrap">
                  {t.team.colLevel}
                </th>
                <th className="p-4 text-gray-400 font-medium font-mono uppercase text-sm whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Users size={16} /> {t.team.colCount}
                  </div>
                </th>
                <th className="p-4 text-gray-400 font-medium font-mono uppercase text-sm whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Percent size={16} /> {t.team.colReward}
                  </div>
                </th>
                <th className="p-4 text-gray-400 font-medium font-mono uppercase text-sm text-right whitespace-nowrap">
                  {t.team.colStatus}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {TEAM_LEVELS.map((level) => {
                const isCurrent = level.level === userLevelInfo.currentLevel

                let badgeStyle = isCurrent
                  ? "bg-neon-500 text-black"
                  : "bg-gray-800 text-gray-500 border border-gray-700"
                let icon = null

                if (level.level === "V7") {
                  badgeStyle = isCurrent
                    ? "bg-slate-300 text-black border border-slate-400 shadow-[0_0_15px_rgba(203,213,225,0.4)]"
                    : "bg-slate-300/20 text-slate-300 border border-slate-400/30 shadow-[0_0_10px_rgba(203,213,225,0.2)]"
                  icon = <Crown size={14} className={isCurrent ? "fill-black" : "fill-slate-300/20"} />
                } else if (level.level === "V8") {
                  badgeStyle = isCurrent
                    ? "bg-cyan-300 text-black border border-cyan-400 shadow-[0_0_15px_rgba(103,232,249,0.4)]"
                    : "bg-cyan-300/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_10px_rgba(103,232,249,0.2)]"
                  icon = <Crown size={14} className={isCurrent ? "fill-black" : "fill-cyan-300/20"} />
                } else if (level.level === "V9") {
                  badgeStyle = isCurrent
                    ? "bg-amber-400 text-black border border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                    : "bg-amber-400/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                  icon = <Crown size={14} className={isCurrent ? "fill-black" : "fill-amber-400/20"} />
                }

                return (
                  <tr
                    key={level.level}
                    className={`group hover:bg-gray-800/50 transition-colors ${isCurrent ? "bg-neon-900/20" : ""}`}
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 font-bold ${isCurrent ? "text-neon-400" : "text-gray-300"}`}>
                        <div className={`h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 min-w-[3rem] ${badgeStyle}`}>
                          {icon}
                          {level.level}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 font-mono whitespace-nowrap">{level.countRequired.toLocaleString()}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                        {level.reward}%
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {isCurrent ? (
                        <span className="text-neon-400 text-xs font-bold uppercase tracking-wider border border-neon-500 px-2 py-1 rounded bg-neon-900/20">
                          {t.team.current}
                        </span>
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
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                <UserCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{t.team.networkTitle}</h3>
              </div>
            </div>
            <button
              onClick={copyReferralLink}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors border border-purple-500/30 text-xs font-bold"
              title="Copy Referral Link"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">COPY LINK</span>
              <span className="sm:hidden">COPY</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="text-left p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 relative overflow-hidden group hover:bg-gray-800/50 transition-colors">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={40} />
              </div>
              <p className="text-sm font-bold text-gray-400 mb-2">{t.team.netTotalAmount}</p>
              <p className="text-2xl md:text-3xl font-black text-purple-400 font-mono break-all tracking-tight">
                {safeFormatEther(totalTicketAmount)} <span className="text-sm font-bold text-purple-300 ml-1">MC</span>
              </p>
            </div>

            <div className="text-left p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 relative overflow-hidden group hover:bg-gray-800/50 transition-colors">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown size={40} />
              </div>
              <p className="text-sm font-bold text-gray-400 mb-2">{t.team.netTotalCap}</p>
              <p className="text-2xl md:text-3xl font-black text-blue-400 font-mono break-all tracking-tight">
                {safeFormatEther(totalTicketAmount * 3n)} <span className="text-sm font-bold text-blue-300 ml-1">MC</span>
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-400 mb-3 font-medium flex items-center gap-2">
          <span className="w-1 h-4 bg-neon-500 rounded-full"></span>
          {t.team.networkSubtitle}
        </div>

        {isLoadingDirects ? (
          <div className="text-center py-8 text-gray-500">{t.team.networkLoading}</div>
        ) : directReferrals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-800">
                  <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold">{t.team.netWallet}</th>
                  <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold whitespace-nowrap">
                    {t.team.netTicket}
                  </th>
                  <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold whitespace-nowrap">
                    {t.team.netStatus}
                  </th>
                  <th className="p-2 md:p-4 text-gray-400 text-sm font-semibold text-right whitespace-nowrap">
                    {t.team.netJoined}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {directReferrals.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                    <td className="p-2 md:p-4 text-gray-300 font-mono text-sm">
                      {item.user.substring(0, 6)}...{item.user.substring(38)}
                    </td>
                    <td className="p-2 md:p-4 text-white font-bold text-sm whitespace-nowrap">
                      {safeFormatEther(item.ticketAmount)} MC
                    </td>
                    <td className="p-2 md:p-4">
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${
                          item.ticketAmount > 0n
                            ? "bg-neon-500/20 text-neon-400 border border-neon-500/30"
                            : "bg-gray-800 text-gray-500 border border-gray-700"
                        }`}
                      >
                        {item.ticketAmount > 0n ? t.team.netActive : "Inactive"}
                      </span>
                    </td>
                    <td className="p-2 md:p-4 text-right text-gray-500 text-sm whitespace-nowrap">
                      {item.joinTime > 0n ? new Date(Number(item.joinTime) * 1000).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
            <Users className="mx-auto text-gray-600 mb-2" size={32} />
            <p className="text-gray-400 font-medium">
              {userLevelInfo.activeDirects > 0 ? (
                <span className="flex flex-col items-center gap-1">
                  <span>{t.team.netNone}</span>
                  <span className="text-xs text-gray-500">
                    ({t.team.colCount}: <span className="text-gray-300">{userLevelInfo.activeDirects}</span>)
                  </span>
                </span>
              ) : (
                t.team.netNone
              )}
            </p>
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
          <p className="text-gray-400 text-xs md:text-sm">{t.team.directDesc}</p>
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
  )
}

export default TeamLevel
