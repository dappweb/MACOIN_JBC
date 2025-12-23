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
  const jbcPriceNum = parseFloat(jbcPrice)
  const totalRevenueJbc = jbcPriceNum > 0 ? displayStats.totalRevenue / jbcPriceNum : 0

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
            // 未绑定上级，检查 URL 中是否有 ref 参数
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

          setDisplayStats((prev) => ({
            ...prev,
            balanceMC: parseFloat(ethers.formatEther(mcBal)),
            balanceJBC: parseFloat(ethers.formatEther(jbcBal)),
            totalRevenue: parseFloat(ethers.formatEther(userInfo[3])),
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
        // 提取 ref= 之后的地址
        let address = referrer.trim()
        const refMatch = address.match(/ref=([^&\s]+)/i)
        if (refMatch) {
          address = refMatch[1]
        }

        // 验证地址格式
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          toast.error("请输入正确的钱包地址")
          setIsBinding(false)
          return
        }

        const tx = await protocolContract.bindReferrer(address)
        await tx.wait()
        setIsBound(true)
        toast.success("Referrer Bound Successfully!")
      } catch (err: any) {
        console.error(err)
        toast.error("绑定失败: " + (err.reason || err.message))
      } finally {
        setIsBinding(false)
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Section - Cyberpunk Theme */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center bg-gradient-to-br from-black via-gray-900 to-gray-800 border border-emerald-400/40 shadow-2xl shadow-neon-500/30">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        
        {/* World Map Overlay */}
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 1000 500" className="w-full h-full">
            <path d="M150,100 L200,120 L250,110 L300,130 L350,115 L400,125 L450,120 L500,135 L550,125 L600,140 L650,130 L700,145 L750,135 L800,150" 
                  stroke="rgba(16, 185, 129, 0.3)" strokeWidth="2" fill="none"/>
            <circle cx="200" cy="120" r="3" fill="rgba(16, 185, 129, 0.5)"/>
            <circle cx="400" cy="125" r="3" fill="rgba(16, 185, 129, 0.5)"/>
            <circle cx="600" cy="140" r="3" fill="rgba(16, 185, 129, 0.5)"/>
          </svg>
        </div>

        {/* Glowing Circles */}
        <div className="absolute top-10 right-20 w-64 h-64 bg-neon-500/30 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-10 left-20 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] animate-pulse" style={{animationDelay: '1s'}}></div>

        <div className="relative z-10 p-5 sm:p-6 md:p-12 max-w-3xl w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-500/15 text-neon-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-4 md:mb-6 border border-emerald-400/40 backdrop-blur-sm">
            <span className="w-2 h-2 bg-neon-400 rounded-full animate-pulse"></span>
            {t.stats.protocol}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-neon-400 via-neon-300 to-neon-500 mb-4 md:mb-6 leading-tight drop-shadow-[0_0_30px_rgba(1,254,174,0.7)]">
            {t.stats.title}
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-3 md:mb-4 font-light">
            {t.stats.subtitle}
          </p>
          <p className="text-gray-400 text-sm sm:text-base md:text-lg mb-6 md:mb-10 max-w-2xl font-light leading-relaxed">
            {t.stats.desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 md:gap-5">
            <button
              onClick={onJoinClick}
              className="px-6 py-3 md:px-8 md:py-4 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-lg shadow-lg shadow-neon-500/60 transition-all transform hover:-translate-y-1 hover:shadow-neon-500/80 text-sm md:text-base border border-emerald-300"
            >
              {t.stats.join}
            </button>
            <button
              onClick={onWhitepaperClick}
              className="px-6 py-3 md:px-8 md:py-4 bg-transparent hover:bg-neon-500/15 text-neon-400 border-2 border-emerald-400/60 hover:border-emerald-300 font-bold rounded-lg backdrop-blur-md transition-all text-sm md:text-base"
            >
              {t.stats.whitepaper}
            </button>
          </div>
        </div>

        {/* Decorative Ring Element */}
        <div className="hidden lg:block absolute right-10 top-1/2 -translate-y-1/2">
          <div className="relative w-80 h-80">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-spin" style={{animationDuration: '20s'}}></div>
            <div className="absolute inset-8 rounded-full border-2 border-emerald-400/40 animate-spin" style={{animationDuration: '15s', animationDirection: 'reverse'}}></div>
            <div className="absolute inset-16 rounded-full border border-amber-400/20 animate-spin" style={{animationDuration: '10s'}}></div>
            {/* Center Glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-neon-400/30 to-amber-500/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bind Referrer Section (Moved from TeamLevel) */}
      <div className="glass-panel p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-emerald-400/40 flex flex-col items-start sm:items-center gap-4 shadow-lg shadow-neon-500/15">
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
          <div className="bg-neon-500/25 p-2 md:p-3 rounded-full text-neon-400 border border-emerald-400/40">
            <Link size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-white">{t.team.bindTitle}</h3>
            <p className="text-xs md:text-sm text-gray-400">{t.team.bindDesc}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          {!isConnected ? (
            <button
              disabled
              className="px-4 py-2.5 md:px-6 md:py-3 bg-gray-800 text-gray-500 font-bold rounded-lg cursor-not-allowed whitespace-nowrap text-sm md:text-base w-full sm:w-auto border border-gray-700"
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
                className="w-full sm:w-48 md:w-64 px-3 py-2.5 md:px-4 md:py-3 bg-black/50 border border-emerald-400/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-white placeholder-gray-500 text-sm md:text-base"
              />
              <button
                onClick={handleBind}
                disabled={!referrer.trim() || isBinding}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors shadow-lg shadow-neon-500/40 whitespace-nowrap text-sm md:text-base"
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
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-emerald-400/60 transition-all bg-gray-900/50 border border-gray-800 hover:shadow-lg hover:shadow-neon-500/30">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.assets}</span>
            <Wallet className="text-neon-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
            {displayStats.balanceMC.toLocaleString()}
          </div>
          {/* <div className="text-xs text-macoin-600 flex items-center gap-1">
                <ArrowUpRight size={12} /> +2.4% {t.stats.today}
            </div> */}
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-emerald-400/60 transition-all bg-gray-900/50 border border-gray-800 hover:shadow-lg hover:shadow-neon-500/30">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.holding}</span>
            <Coins className="text-amber-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
            {displayStats.balanceJBC.toLocaleString()}
          </div>
          <div className="text-xs text-neon-400 flex items-center gap-1">
            ≈ {(displayStats.balanceJBC * parseFloat(jbcPrice)).toFixed(2)} MC (Price: {parseFloat(jbcPrice).toFixed(4)}
            )
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-emerald-400/60 transition-all bg-gray-900/50 border border-gray-800 hover:shadow-lg hover:shadow-neon-500/30">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.revenue}</span>
            <TrendingUp className="text-neon-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
            {displayStats.totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">
            MC: {displayStats.totalRevenue.toLocaleString()} · JBC: {totalRevenueJbc.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-emerald-400/60 transition-all bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-gray-800 hover:shadow-lg hover:shadow-neon-500/30">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.level}</span>
            <Users className="text-amber-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-400 to-amber-400 mb-1">
            {displayStats.currentLevel}
          </div>
          <div className="text-xs text-gray-400">
            {t.stats.teamCount}: {displayStats.teamCount}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800">
        <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-white border-l-4 border-emerald-400 pl-3">
          {t.stats.chartTitle}
        </h3>
        {loadingPriceHistory ? (
          <div className="h-[200px] sm:h-[250px] md:h-[300px] w-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-neon-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-400">Loading price history...</p>
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
