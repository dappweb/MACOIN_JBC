import React, { useEffect, useState } from "react"
import { UserStats } from "../types"
import { Wallet, TrendingUp, Users, Coins, ArrowUpRight, Link } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useLanguage } from "../LanguageContext"
import { useWeb3 } from "../Web3Context"
import { ethers } from "ethers"
import toast from "react-hot-toast"

interface StatsPanelProps {
  stats: UserStats
  onJoinClick: () => void
  onWhitepaperClick: () => void
}

// This will be replaced with real price history data from blockchain

const StatsPanel: React.FC<StatsPanelProps> = ({ stats: initialStats, onJoinClick, onWhitepaperClick }) => {
  const { t } = useLanguage()
  const { mcContract, jbcContract, protocolContract, account, isConnected, provider } = useWeb3()
  const [displayStats, setDisplayStats] = useState<UserStats>(initialStats)
  const [jbcPrice, setJbcPrice] = useState<string>("1.0")
  const [rewardTotals, setRewardTotals] = useState({ mc: 0, jbc: 0 })

  // Bind Referrer State
  const [referrer, setReferrer] = useState("")
  const [isBound, setIsBound] = useState(false)
  const [isBinding, setIsBinding] = useState(false)

  // Price History State
  const [priceHistory, setPriceHistory] = useState<Array<{ name: string; uv: number }>>([])
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(true)

  // Fetch Price History from Swap Events
  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!protocolContract || !provider) {
        setLoadingPriceHistory(false)
        return
      }

      try {
        setLoadingPriceHistory(true)
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 100000) // Last ~100k blocks

        // Query both swap events
        const [mcToJbcEvents, jbcToMcEvents] = await Promise.all([
          protocolContract.queryFilter(protocolContract.filters.SwappedMCToJBC(), fromBlock),
          protocolContract.queryFilter(protocolContract.filters.SwappedJBCToMC(), fromBlock),
        ])

        // Combine and parse swap events to calculate prices
        interface PricePoint {
          timestamp: number
          price: number
        }

        const pricePoints: PricePoint[] = []

        // Parse MC->JBC swaps: price = mcAmount / jbcAmount
        for (const event of mcToJbcEvents) {
          try {
            const block = await provider.getBlock(event.blockNumber)
            if (event.args && block) {
              const mcAmount = parseFloat(ethers.formatEther(event.args[1]))
              const jbcAmount = parseFloat(ethers.formatEther(event.args[2]))
              if (jbcAmount > 0) {
                const price = mcAmount / jbcAmount
                pricePoints.push({
                  timestamp: block.timestamp,
                  price: price,
                })
              }
            }
          } catch (err) {
            console.error("Error parsing MC->JBC event:", err)
          }
        }

        // Parse JBC->MC swaps: price = mcAmount / jbcAmount
        for (const event of jbcToMcEvents) {
          try {
            const block = await provider.getBlock(event.blockNumber)
            if (event.args && block) {
              const jbcAmount = parseFloat(ethers.formatEther(event.args[1]))
              const mcAmount = parseFloat(ethers.formatEther(event.args[2]))
              if (jbcAmount > 0) {
                const price = mcAmount / jbcAmount
                pricePoints.push({
                  timestamp: block.timestamp,
                  price: price,
                })
              }
            }
          } catch (err) {
            console.error("Error parsing JBC->MC event:", err)
          }
        }

        // Sort by timestamp
        pricePoints.sort((a, b) => a.timestamp - b.timestamp)

        if (pricePoints.length === 0) {
          // No swap data yet, use default initial price
          setPriceHistory([{ name: "Now", uv: 1.0 }])
          setLoadingPriceHistory(false)
          return
        }

        // Aggregate prices into time buckets for chart display
        // Group by days for better visualization
        const dailyPrices = new Map<string, number[]>()

        for (const point of pricePoints) {
          const date = new Date(point.timestamp * 1000)
          const dateKey = `${date.getMonth() + 1}/${date.getDate()}`

          if (!dailyPrices.has(dateKey)) {
            dailyPrices.set(dateKey, [])
          }
          dailyPrices.get(dateKey)!.push(point.price)
        }

        // Calculate average price for each day
        const chartData = Array.from(dailyPrices.entries()).map(([date, prices]) => {
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
          return {
            name: date,
            uv: avgPrice,
          }
        })

        // Limit to last 30 data points for chart readability
        const limitedData = chartData.slice(-30)

        setPriceHistory(limitedData.length > 0 ? limitedData : [{ name: "Now", uv: 1.0 }])
      } catch (error) {
        console.error("Failed to fetch price history:", error)
        // Fallback to default
        setPriceHistory([{ name: "Now", uv: 1.0 }])
      } finally {
        setLoadingPriceHistory(false)
      }
    }

    fetchPriceHistory()
  }, [protocolContract, provider])

  useEffect(() => {
    const fetchData = async () => {
      if (isConnected && account && mcContract && jbcContract && protocolContract) {
        try {
          // Fetch MC Balance
          const mcBal = await mcContract.balanceOf(account)

          // Fetch JBC Balance
          const jbcBal = await jbcContract.balanceOf(account)

          // Fetch JBC Price from Contract (Spot Price)
          try {
            const priceWei = await protocolContract.getJBCPrice()
            setJbcPrice(ethers.formatEther(priceWei))
          } catch (e) {
            console.log("Price fetch failed (maybe old contract)", e)
          }

          // Fetch Protocol Info
          const userInfo = await protocolContract.userInfo(account)
          // userInfo returns: (referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive)

          // Check referrer binding
          const currentReferrer = userInfo[0]
          if (currentReferrer && currentReferrer !== "0x0000000000000000000000000000000000000000") {
            setIsBound(true)
          } else {
            // 鏈粦瀹氫笂绾э紝妫€鏌?URL 涓槸鍚︽湁 ref 鍙傛暟
            const urlParams = new URLSearchParams(window.location.search)
            const refParam = urlParams.get("ref")
            if (refParam && !referrer) {
              setReferrer(refParam)
            }
          }

          // Calculate Level based on activeDirects (simplified V1-V9 logic)
          let level = "V0"
          const activeDirects = Number(userInfo[1])
          if (activeDirects >= 100000) level = "V9"
          else if (activeDirects >= 30000) level = "V8"
          else if (activeDirects >= 10000) level = "V7"
          else if (activeDirects >= 3000) level = "V6"
          else if (activeDirects >= 1000) level = "V5"
          else if (activeDirects >= 300) level = "V4"
          else if (activeDirects >= 100) level = "V3"
          else if (activeDirects >= 30) level = "V2"
          else if (activeDirects >= 10) level = "V1"

          let referralRevenue = 0
          let rewardMc = 0
          let rewardJbc = 0
          try {
            if (provider) {
              const currentBlock = await provider.getBlockNumber()
              const fromBlock = Math.max(0, currentBlock - 100000)
              const [referralEvents, rewardEvents] = await Promise.all([
                protocolContract.queryFilter(protocolContract.filters.ReferralRewardPaid(account), fromBlock),
                protocolContract.queryFilter(protocolContract.filters.RewardClaimed(account), fromBlock),
              ])
              for (const event of referralEvents) {
                if (event.args) {
                  referralRevenue += parseFloat(ethers.formatEther(event.args[2]))
                }
              }
              for (const event of rewardEvents) {
                if (event.args) {
                  rewardMc += parseFloat(ethers.formatEther(event.args[1]))
                  rewardJbc += parseFloat(ethers.formatEther(event.args[2]))
                }
              }
            }
          } catch (err) {
            console.error("Failed to fetch referral rewards", err)
          }

          const baseRevenue = parseFloat(ethers.formatEther(userInfo[3]))
          const combinedRevenue = baseRevenue + referralRevenue
          setRewardTotals({
            mc: rewardMc + referralRevenue,
            jbc: rewardJbc,
          })

          setDisplayStats((prev) => ({
            ...prev,
            balanceMC: parseFloat(ethers.formatEther(mcBal)),
            balanceJBC: parseFloat(ethers.formatEther(jbcBal)),
            totalRevenue: combinedRevenue,
            teamCount: Number(userInfo[2]),
            currentLevel: level,
          }))
        } catch (err) {
          console.error("Error fetching stats", err)
        }
      }
    }
    const timer = setInterval(fetchData, 5000) // Refresh every 5s
    fetchData()
    return () => clearInterval(timer)
  }, [isConnected, account, mcContract, jbcContract, protocolContract])

  const handleBind = async () => {
    if (referrer.trim() && protocolContract) {
      setIsBinding(true)
      try {
        // 鎻愬彇 ref= 涔嬪悗鐨勫湴鍧€
        let address = referrer.trim()
        const refMatch = address.match(/ref=([^&\s]+)/i)
        if (refMatch) {
          address = refMatch[1]
        }

        // 楠岃瘉鍦板潃鏍煎紡
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          toast.error("璇疯緭鍏ユ纭殑閽卞寘鍦板潃")
          setIsBinding(false)
          return
        }

        const tx = await protocolContract.bindReferrer(address)
        await tx.wait()
        setIsBound(true)
        toast.success("Referrer Bound Successfully!")
      } catch (err: any) {
        console.error(err)
        toast.error("缁戝畾澶辫触: " + (err.reason || err.message))
      } finally {
        setIsBinding(false)
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Section - Gold Theme */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden min-h-[250px] md:min-h-[300px] flex items-center bg-gradient-to-br from-macoin-300 via-macoin-400 to-macoin-600 border border-macoin-500/50 shadow-2xl">
        {/* Texture Overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-macoin-500/20 via-transparent to-transparent"></div>

        <div className="relative z-10 p-5 sm:p-6 md:p-12 max-w-2xl w-full">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/10 text-slate-900 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-3 md:mb-4 border border-black/5 backdrop-blur-sm">
            {t.stats.protocol}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-extrabold text-slate-900 mb-3 md:mb-4 leading-tight drop-shadow-sm">
            {t.stats.title} <br />
            <span className="text-white drop-shadow-md text-xl sm:text-2xl md:text-3xl lg:text-5xl">
              {t.stats.subtitle}
            </span>
          </h1>
          <p className="text-slate-900/80 text-sm sm:text-base md:text-lg mb-5 md:mb-8 max-w-lg font-medium">
            {t.stats.desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
              onClick={onJoinClick}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xl transition-all transform hover:-translate-y-1 text-sm md:text-base"
            >
              {t.stats.join}
            </button>
            <button
              onClick={onWhitepaperClick}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 text-slate-900 border border-white/40 font-bold rounded-lg backdrop-blur-md transition-all text-sm md:text-base"
            >
              {t.stats.whitepaper}
            </button>
          </div>
        </div>

        {/* Floating Gold Element */}
        <div className="hidden lg:block absolute right-20 top-1/2 -translate-y-1/2">
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 bg-macoin-200 rounded-full blur-[80px] opacity-40"></div>
            {/* Gold bars or Coin Image Placeholder */}
            <div className="relative z-10 w-48 h-48 bg-gradient-to-br from-macoin-100 to-macoin-600 rounded-2xl rotate-12 shadow-[0_20px_50px_rgba(180,83,9,0.5)] border-t border-l border-white/50 flex items-center justify-center">
              <div className="text-6xl font-bold text-macoin-900 opacity-20">JBC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bind Referrer Section (Moved from TeamLevel) */}
      <div className="glass-panel p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl bg-white border-l-4 border-macoin-500 flex flex-col items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
          <div className="bg-macoin-100 p-2 md:p-3 rounded-full text-macoin-600">
            <Link size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-slate-900">{t.team.bindTitle}</h3>
            <p className="text-xs md:text-sm text-slate-500">{t.team.bindDesc}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          {!isConnected ? (
            <button
              disabled
              className="px-4 py-2.5 md:px-6 md:py-3 bg-slate-200 text-slate-400 font-bold rounded-lg cursor-not-allowed whitespace-nowrap text-sm md:text-base w-full sm:w-auto"
            >
              Connect Wallet First
            </button>
          ) : isBound ? (
            <div className="px-4 py-2.5 md:px-6 md:py-3 bg-green-100 text-green-700 font-bold rounded-lg border border-green-200 flex items-center gap-2 text-sm md:text-base justify-center sm:justify-start">
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
                className="w-full sm:w-48 md:w-64 px-3 py-2.5 md:px-4 md:py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-macoin-500 text-slate-900 text-sm md:text-base"
              />
              <button
                onClick={handleBind}
                disabled={!referrer.trim() || isBinding}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-macoin-500 hover:bg-macoin-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-lg shadow-macoin-500/20 whitespace-nowrap text-sm md:text-base"
              >
                {isBinding ? "Binding..." : t.team.bindButton}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Stat 1 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-slate-500 text-xs md:text-sm">{t.stats.assets}</span>
            <Wallet className="text-macoin-600" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
            {displayStats.balanceMC.toLocaleString()}
          </div>
          {/* <div className="text-xs text-macoin-600 flex items-center gap-1">
                <ArrowUpRight size={12} /> +2.4% {t.stats.today}
            </div> */}
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-slate-500 text-xs md:text-sm">{t.stats.holding}</span>
            <Coins className="text-macoin-500" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
            {displayStats.balanceJBC.toLocaleString()}
          </div>
          <div className="text-xs text-macoin-600 flex items-center gap-1">
            鈮?{(displayStats.balanceJBC * parseFloat(jbcPrice)).toFixed(2)} MC (Price: {parseFloat(jbcPrice).toFixed(4)}
            )
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-macoin-500/40 transition-colors bg-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-slate-500 text-xs md:text-sm">{t.stats.revenue}</span>
            <TrendingUp className="text-blue-500" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
            {rewardTotals.mc.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">
            MC: {rewardTotals.mc.toLocaleString()} · JBC: {rewardTotals.jbc.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-macoin-500/40 transition-colors bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-slate-500 text-xs md:text-sm">{t.stats.level}</span>
            <Users className="text-purple-500" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-1">
            {displayStats.currentLevel}
          </div>
          <div className="text-xs text-slate-400">
            {t.stats.teamCount}: {displayStats.teamCount}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-white">
        <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-slate-900 border-l-4 border-macoin-500 pl-3">
          {t.stats.chartTitle}
        </h3>
        {loadingPriceHistory ? (
          <div className="h-[200px] sm:h-[250px] md:h-[300px] w-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-macoin-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-slate-500">Loading price history...</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px] sm:h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00dc82" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00dc82" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderColor: "#e2e8f0",
                    color: "#0f172a",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  itemStyle={{ color: "#16a34a" }}
                />
                <Area
                  type="monotone"
                  dataKey="uv"
                  stroke="#00dc82"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorUv)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsPanel





