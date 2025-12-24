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
  const [mcUsdtPrice, setMcUsdtPrice] = useState<number>(0)

  // Fetch MC/USDT Price
  useEffect(() => {
    const fetchMcPrice = async () => {
      try {
        const response = await fetch('https://api.macoin.ai/market/symbol-thumb')
        const data = await response.json()
        const mcData = data.find((item: any) => item.symbol === 'MC/USDT')
        if (mcData) {
          setMcUsdtPrice(parseFloat(mcData.close))
        }
      } catch (error) {
        console.error("Failed to fetch MC price:", error)
      }
    }
    
    fetchMcPrice()
    const interval = setInterval(fetchMcPrice, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Bind Referrer State
  const [referrer, setReferrer] = useState("")
  const [isBound, setIsBound] = useState(false)
  const [isBinding, setIsBinding] = useState(false)

  // Price History State
  interface PriceDataPoint {
    name: string
    uv: number
    ema?: number
    high?: number
    low?: number
    change?: number
  }

  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([])
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(true)
  const [realtimePrices, setRealtimePrices] = useState<Array<{ timestamp: number; price: number }>>([])
  const [priceStats, setPriceStats] = useState({ high: 0, low: 0, change: 0, avgPrice: 0 })

  // Calculate EMA (Exponential Moving Average)
  const calculateEMA = (prices: number[], period: number = 7): number[] => {
    if (prices.length === 0) return []
    
    const emaValues: number[] = []
    const multiplier = 2 / (period + 1)
    
    // Start EMA with SMA
    let sma = prices.slice(0, Math.min(period, prices.length)).reduce((a, b) => a + b, 0) / Math.min(period, prices.length)
    emaValues.push(sma)
    
    // Calculate EMA for remaining values
    for (let i = 1; i < prices.length; i++) {
      const ema = (prices[i] - emaValues[i - 1]) * multiplier + emaValues[i - 1]
      emaValues.push(ema)
    }
    
    return emaValues
  }

  // Helper function to format price data for chart
  const formatPriceHistory = (pricePoints: Array<{ timestamp: number; price: number }>) => {
    if (pricePoints.length === 0) {
      return generateMockPriceData()
    }

    // Sort by timestamp
    const sorted = [...pricePoints].sort((a, b) => a.timestamp - b.timestamp)

    // Dynamic aggregation based on data count - keep more data points for better granularity
    let aggregatedData: Array<{ name: string; prices: number[]; high: number; low: number }> = []

    if (sorted.length < 15) {
      // Few data points: aggregate by 30 minutes
      const period30mPrices = new Map<number, number[]>()
      for (const point of sorted) {
        const period = Math.floor(point.timestamp / 1800) * 1800 // 30 minutes
        if (!period30mPrices.has(period)) {
          period30mPrices.set(period, [])
        }
        period30mPrices.get(period)!.push(point.price)
      }

      aggregatedData = Array.from(period30mPrices.entries())
        .map(([period, prices]) => {
          const date = new Date(period * 1000)
          const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
          return {
            name: timeStr,
            prices,
            high: Math.max(...prices),
            low: Math.min(...prices),
          }
        })
        .slice(-50)
    } else if (sorted.length < 100) {
      // Medium data points: aggregate by hour
      const hourlyPrices = new Map<number, number[]>()
      for (const point of sorted) {
        const hour = Math.floor(point.timestamp / 3600) * 3600
        if (!hourlyPrices.has(hour)) {
          hourlyPrices.set(hour, [])
        }
        hourlyPrices.get(hour)!.push(point.price)
      }

      aggregatedData = Array.from(hourlyPrices.entries())
        .map(([hour, prices]) => {
          const date = new Date(hour * 1000)
          const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:00`
          return {
            name: timeStr,
            prices,
            high: Math.max(...prices),
            low: Math.min(...prices),
          }
        })
        .slice(-50)
    } else {
      // Many data points: aggregate by 4 hours
      const period4hPrices = new Map<number, number[]>()
      for (const point of sorted) {
        const period = Math.floor(point.timestamp / 14400) * 14400 // 4 hours
        if (!period4hPrices.has(period)) {
          period4hPrices.set(period, [])
        }
        period4hPrices.get(period)!.push(point.price)
      }

      aggregatedData = Array.from(period4hPrices.entries())
        .map(([period, prices]) => {
          const date = new Date(period * 1000)
          const timeStr = `${date.getMonth() + 1}/${date.getDate()}`
          return {
            name: timeStr,
            prices,
            high: Math.max(...prices),
            low: Math.min(...prices),
          }
        })
        .slice(-50)
    }

    // Convert to chart format with EMA and stats
    const allPrices = aggregatedData.flatMap(d => d.prices)
    const emaValues = calculateEMA(allPrices, 7)
    
    const chartData: PriceDataPoint[] = aggregatedData.map((data, idx) => {
      const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length
      const change = idx === 0 ? 0 : ((avgPrice - aggregatedData[idx - 1].prices[0]) / aggregatedData[idx - 1].prices[0]) * 100
      
      return {
        name: data.name,
        uv: avgPrice,
        ema: emaValues[idx] || avgPrice,
        high: data.high,
        low: data.low,
        change: parseFloat(change.toFixed(2)),
      }
    })

    // Calculate overall stats
    if (chartData.length > 0) {
      const prices = chartData.map(d => d.uv)
      const high = Math.max(...prices)
      const low = Math.min(...prices)
      const change = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
      
      setPriceStats({
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        change: parseFloat(change.toFixed(2)),
        avgPrice: parseFloat(avgPrice.toFixed(6)),
      })
    }

    return chartData.length > 0 ? chartData : generateMockPriceData()
  }

  // Generate interpolated data to ensure minimum 10 points
  const generateInterpolatedData = (aggregatedData: Array<any>, allPrices: number[]): PriceDataPoint[] => {
    if (aggregatedData.length === 0) return generateMockPriceData()

    const result: PriceDataPoint[] = []
    const basePrice = allPrices[0]

    // Generate 15 interpolated points based on existing data
    for (let i = 0; i < 15; i++) {
      const progress = i / 14
      const baseIdx = Math.floor((aggregatedData.length - 1) * progress)
      const nextIdx = Math.min(baseIdx + 1, aggregatedData.length - 1)
      
      const current = aggregatedData[baseIdx]
      const next = aggregatedData[nextIdx]
      
      const currentPrice = current.prices.reduce((a: number, b: number) => a + b, 0) / current.prices.length
      const nextPrice = next.prices.reduce((a: number, b: number) => a + b, 0) / next.prices.length
      
      const localProgress = (aggregatedData.length - 1) * progress - baseIdx
      const interpolatedPrice = currentPrice + (nextPrice - currentPrice) * localProgress
      
      result.push({
        name: current.name,
        uv: parseFloat(interpolatedPrice.toFixed(6)),
        ema: parseFloat(interpolatedPrice.toFixed(6)),
        high: current.high,
        low: current.low,
        change: 0,
      })
    }

    return result
  }

  // Generate mock price data (10+ points)
  const generateMockPriceData = (): PriceDataPoint[] => {
    const now = Math.floor(Date.now() / 1000)
    const basePrice = 1.0
    const data: PriceDataPoint[] = []

    // Generate 15 data points with realistic price movements
    for (let i = 0; i < 15; i++) {
      const timestamp = now - (14 - i) * 3600 // Hourly points for last 15 hours
      const date = new Date(timestamp * 1000)
      const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:00`
      
      // Simulate realistic price movement (±3% per hour)
      const randomWalk = (Math.random() - 0.5) * 0.06
      const price = basePrice * (1 + randomWalk * (i + 1))
      
      data.push({
        name: timeStr,
        uv: parseFloat(price.toFixed(6)),
        ema: parseFloat(price.toFixed(6)),
        high: parseFloat((price * 1.01).toFixed(6)),
        low: parseFloat((price * 0.99).toFixed(6)),
        change: 0,
      })
    }

    // Calculate stats for mock data
    const prices = data.map(d => d.uv)
    setPriceStats({
      high: Math.max(...prices),
      low: Math.min(...prices),
      change: ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    })

    return data
  }

  // Fetch Initial Price History from Swap Events
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

        // Store price points and format for chart
        setRealtimePrices(pricePoints)
        setPriceHistory(formatPriceHistory(pricePoints))
      } catch (error) {
        console.error("Failed to fetch price history:", error)
        setPriceHistory([{ name: "Now", uv: 1.0 }])
      } finally {
        setLoadingPriceHistory(false)
      }
    }

    fetchPriceHistory()
  }, [protocolContract, provider])

  // Real-time event listener for price updates
  useEffect(() => {
    if (!protocolContract || !provider) return

    const handleSwapMCToJBC = (user: string, mcAmount: any, jbcAmount: any, event: any) => {
      try {
        const mcAmountNum = parseFloat(ethers.formatEther(mcAmount))
        const jbcAmountNum = parseFloat(ethers.formatEther(jbcAmount))
        if (jbcAmountNum > 0) {
          const price = mcAmountNum / jbcAmountNum
          const timestamp = Math.floor(Date.now() / 1000)

          setRealtimePrices((prev) => {
            const updated = [...prev, { timestamp, price }]
            // Keep only last 500 points to avoid memory issues
            const limited = updated.slice(-500)
            setPriceHistory(formatPriceHistory(limited))
            return limited
          })
        }
      } catch (err) {
        console.error("Error processing SwappedMCToJBC event:", err)
      }
    }

    const handleSwapJBCToMC = (user: string, jbcAmount: any, mcAmount: any, event: any) => {
      try {
        const jbcAmountNum = parseFloat(ethers.formatEther(jbcAmount))
        const mcAmountNum = parseFloat(ethers.formatEther(mcAmount))
        if (jbcAmountNum > 0) {
          const price = mcAmountNum / jbcAmountNum
          const timestamp = Math.floor(Date.now() / 1000)

          setRealtimePrices((prev) => {
            const updated = [...prev, { timestamp, price }]
            // Keep only last 500 points to avoid memory issues
            const limited = updated.slice(-500)
            setPriceHistory(formatPriceHistory(limited))
            return limited
          })
        }
      } catch (err) {
        console.error("Error processing SwappedJBCToMC event:", err)
      }
    }

    // Set up event listeners
    protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC)
    protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC)

    // Cleanup listeners on unmount
    return () => {
      protocolContract.removeListener("SwappedMCToJBC", handleSwapMCToJBC)
      protocolContract.removeListener("SwappedJBCToMC", handleSwapJBCToMC)
    }
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
        // 提取 ref= 之后的地址
        let address = referrer.trim()
        const refMatch = address.match(/ref=([^&\s]+)/i)
        if (refMatch) {
          address = refMatch[1]
        }

        // 验证地址格式
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          toast.error(t.referrer.invalidAddress)
          setIsBinding(false)
          return
        }

        const tx = await protocolContract.bindReferrer(address)
        await tx.wait()
        setIsBound(true)
        toast.success(t.referrer.bindSuccess)
      } catch (err: any) {
        console.error(err)
        toast.error(t.referrer.bindError + ": " + (err.reason || err.message))
      } finally {
        setIsBinding(false)
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Section - Neon Green & Gold Theme */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden min-h-[250px] md:min-h-[300px] flex items-center bg-gradient-to-br from-neon-400 via-neon-500 to-neon-600 border border-neon-500/50 shadow-2xl shadow-neon-500/30">
        {/* Texture Overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-neon-500/20 via-transparent to-transparent"></div>

        <div className="relative z-10 p-5 sm:p-6 md:p-12 max-w-2xl w-full">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/20 text-black text-[10px] md:text-xs font-bold uppercase tracking-wider mb-3 md:mb-4 border border-black/10 backdrop-blur-sm">
            {t.stats.protocol}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-extrabold text-black mb-3 md:mb-4 leading-tight drop-shadow-sm">
            {t.stats.title} <br />
            <span className="text-black/90 drop-shadow-md text-xl sm:text-2xl md:text-3xl lg:text-5xl">
              {t.stats.subtitle}
            </span>
          </h1>
          <p className="text-black/80 text-sm sm:text-base md:text-lg mb-5 md:mb-8 max-w-lg font-medium">
            {t.stats.desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
              onClick={onJoinClick}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-black hover:bg-gray-900 text-neon-400 font-bold rounded-lg shadow-xl transition-all transform hover:-translate-y-1 text-sm md:text-base"
            >
              {t.stats.join}
            </button>
            <button
              onClick={onWhitepaperClick}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-black/20 hover:bg-black/30 text-black border border-black/40 font-bold rounded-lg backdrop-blur-md transition-all text-sm md:text-base"
            >
              {t.stats.whitepaper}
            </button>
          </div>
        </div>

        {/* Decorative Ring Element */}
        <div className="hidden lg:block absolute right-10 top-1/2 -translate-y-1/2">
          <div className="relative w-80 h-80">
            {/* Outer Ring */}
            <div
              className="absolute inset-0 rounded-full border-4 border-amber-500/30 animate-spin"
              style={{ animationDuration: "20s" }}
            ></div>
            <div
              className="absolute inset-8 rounded-full border-2 border-neon-400/40 animate-spin"
              style={{ animationDuration: "15s", animationDirection: "reverse" }}
            ></div>
            <div
              className="absolute inset-16 rounded-full border border-amber-400/30 animate-spin"
              style={{ animationDuration: "10s" }}
            ></div>
            {/* Center Glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-neon-300/30 to-amber-500/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bind Referrer Section (Moved from TeamLevel) */}
      <div className="glass-panel p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border-x-4 border-neon-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <div className="bg-neon-500/20 p-2 md:p-3 rounded-full text-neon-400 border border-neon-500/30 shrink-0">
            <Link size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-white">{t.team.bindTitle}</h3>
            <p className="text-xs md:text-sm text-gray-400">{t.team.bindDesc}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          {!isConnected ? (
            <button
              disabled
              className="px-4 py-2.5 md:px-6 md:py-3 bg-gray-800 text-gray-500 font-bold rounded-lg cursor-not-allowed whitespace-nowrap text-sm md:text-base w-full sm:w-auto border border-gray-700"
            >
              Connect Wallet First
            </button>
          ) : isBound ? (
            <div className="px-4 py-2.5 md:px-6 md:py-3 bg-neon-500/20 text-neon-400 font-bold rounded-lg border border-neon-500/30 flex items-center gap-2 text-sm md:text-base justify-center sm:justify-start w-full md:w-auto">
              <span className="w-2 h-2 bg-neon-500 rounded-full shrink-0"></span>
              {t.team.bindSuccess}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
                placeholder={t.team.bindPlaceholder}
                className="w-full sm:w-48 md:w-64 px-3 py-2.5 md:px-4 md:py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-500/50 text-white placeholder-gray-500 text-sm md:text-base"
              />
              <button
                onClick={handleBind}
                disabled={!referrer.trim() || isBinding}
                className="px-4 py-2.5 md:px-6 md:py-3 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors shadow-lg shadow-neon-500/30 whitespace-nowrap text-sm md:text-base w-full sm:w-auto"
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
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-500/40 transition-colors bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs md:text-sm">{t.stats.assets}</span>
              {mcUsdtPrice > 0 && (
                <span className="text-neon-400/80 text-[10px] md:text-xs font-mono mt-0.5">
                  1 MC ≈ ${mcUsdtPrice.toFixed(4)}
                </span>
              )}
            </div>
            <Wallet className="text-neon-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
            {displayStats.balanceMC.toLocaleString()}
          </div>
          {mcUsdtPrice > 0 && (
            <div className="text-xs text-neon-400 font-bold flex items-center gap-1">
              ≈${(displayStats.balanceMC * mcUsdtPrice).toFixed(2)} USDT
            </div>
          )}
        </div>

        {/* Stat 2 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-amber-500/40 transition-colors bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.holding}</span>
            <Coins className="text-amber-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
            {displayStats.balanceJBC.toLocaleString()}
          </div>
          <div className="text-xs text-amber-400 flex items-center gap-1">
            ≈{(displayStats.balanceJBC * parseFloat(jbcPrice)).toFixed(2)} MC (Price:{" "}
            {parseFloat(jbcPrice).toFixed(4)})
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-500/40 transition-colors bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.revenue}</span>
            <TrendingUp className="text-neon-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white mb-1">{rewardTotals.mc.toLocaleString()}</div>
          <div className="text-xs text-gray-400 flex justify-between items-center">
            <span>MC: {rewardTotals.mc.toLocaleString()} · JBC: {rewardTotals.jbc.toLocaleString()}</span>
            {mcUsdtPrice > 0 && (
              <span className="text-neon-400">
                ≈${((rewardTotals.mc + rewardTotals.jbc * parseFloat(jbcPrice)) * mcUsdtPrice).toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-amber-500/40 transition-colors bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-gray-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-400 text-xs md:text-sm">{t.stats.level}</span>
            <Users className="text-amber-400" size={18} />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-400 to-amber-400 mb-1">
            {displayStats.currentLevel}
          </div>
          <div className="text-xs text-gray-500">
            {t.stats.teamCount}: {displayStats.teamCount}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel p-3 sm:p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 md:mb-6">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-white border-l-4 border-neon-500 pl-3">
            {t.stats.chartTitle}
          </h3>
          {!loadingPriceHistory && priceHistory.length > 1 && (
            <div className="grid grid-cols-2 sm:flex sm:gap-2 md:gap-4 text-xs md:text-sm gap-2">
              <div className="text-center bg-gray-800/50 p-2 sm:p-3 rounded">
                <div className="text-gray-400 text-[10px] sm:text-xs">Highest</div>
                <div className="text-amber-400 font-bold text-xs sm:text-sm">${priceStats.high.toFixed(6)}</div>
              </div>
              <div className="text-center bg-gray-800/50 p-2 sm:p-3 rounded">
                <div className="text-gray-400 text-[10px] sm:text-xs">Lowest</div>
                <div className="text-amber-400 font-bold text-xs sm:text-sm">${priceStats.low.toFixed(6)}</div>
              </div>
              <div className="text-center bg-gray-800/50 p-2 sm:p-3 rounded">
                <div className="text-gray-400 text-[10px] sm:text-xs">Change</div>
                <div className={`font-bold text-xs sm:text-sm ${priceStats.change >= 0 ? "text-neon-400" : "text-red-400"}`}>
                  {priceStats.change >= 0 ? "+" : ""}{priceStats.change.toFixed(2)}%
                </div>
              </div>
              <div className="text-center bg-gray-800/50 p-2 sm:p-3 rounded">
                <div className="text-gray-400 text-[10px] sm:text-xs">Average</div>
                <div className="text-neon-400 font-bold text-xs sm:text-sm">${priceStats.avgPrice.toFixed(6)}</div>
              </div>
            </div>
          )}
        </div>

        {loadingPriceHistory ? (
          <div className="h-[200px] sm:h-[250px] md:h-[400px] w-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-neon-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs sm:text-sm text-gray-400">Loading price history...</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px] sm:h-[300px] md:h-[400px] w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={300}>
              <AreaChart
                data={priceHistory}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#01FEAE" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#01FEAE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEma" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FBBF24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Enhanced Grid */}
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#4B5563"
                  vertical={true}
                  horizontalPoints={[]}
                />
                {/* Y Axis with 6 decimal precision - adaptive */}
                <YAxis
                  stroke="#9ca3af"
                  tickFormatter={(value) => value.toFixed(4)}
                  width={60}
                  tick={{ fontSize: 10 }}
                  domain={["dataMin - 0.1%", "dataMax + 0.1%"]}
                  hide={false}
                />
                {/* X Axis - adaptive for mobile */}
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  tick={{ fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                  interval={Math.ceil(priceHistory.length / 5) - 1}
                />
                {/* Enhanced Tooltip */}
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "2px solid #01FEAE",
                    color: "#f3f4f6",
                    borderRadius: "8px",
                    boxShadow: "0 8px 16px -2px rgba(1, 254, 174, 0.2)",
                    padding: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#01FEAE", fontWeight: "bold", marginBottom: "4px", fontSize: "11px" }}
                  formatter={(value: any) => {
                    if (typeof value === "number") {
                      return value.toFixed(6)
                    }
                    return value
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                  cursor={{
                    stroke: "#01FEAE",
                    strokeWidth: 2,
                    strokeDasharray: "5 5",
                  }}
                  contentFormatter={(content: any) => {
                    if (!content.payload || content.payload.length === 0) return null
                    const payload = content.payload[0]?.payload as any
                    return (
                      <div className="bg-gray-900 border border-neon-500 rounded p-2 text-xs">
                        <p className="text-neon-400 font-bold mb-1">{payload.name}</p>
                        <p className="text-gray-300">
                          Price: <span className="text-neon-400 font-mono">${payload.uv.toFixed(6)}</span>
                        </p>
                        {payload.ema && (
                          <p className="text-gray-300">
                            EMA(7): <span className="text-amber-400 font-mono">${payload.ema.toFixed(6)}</span>
                          </p>
                        )}
                        {payload.high && (
                          <p className="text-gray-300">
                            Range: <span className="text-gray-400 font-mono">${payload.low.toFixed(6)}~${payload.high.toFixed(6)}</span>
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                {/* Price Line */}
                <Area
                  type="monotone"
                  dataKey="uv"
                  stroke="#01FEAE"
                  strokeWidth={2}
                  fill="url(#colorUv)"
                  isAnimationActive={true}
                  animationDuration={300}
                  dot={false}
                  name="Price"
                />
                {/* EMA Line */}
                {priceHistory.length > 5 && (
                  <Area
                    type="monotone"
                    dataKey="ema"
                    stroke="#FBBF24"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    fill="url(#colorEma)"
                    isAnimationActive={true}
                    animationDuration={300}
                    dot={false}
                    name="EMA(7)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend - responsive */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-400">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-neon-500"></div>
            <span>Price</span>
          </div>
          {priceHistory.length > 5 && (
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-0.5 sm:w-3 sm:h-1 bg-amber-400"></div>
              <span>EMA(7)</span>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-2 text-gray-500 text-[9px] sm:text-[10px]">
            (Min 10 points)
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatsPanel
