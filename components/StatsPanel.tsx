import React, { useEffect, useState, useMemo, useCallback } from "react"
import { UserStats } from "../src/types"
import { Wallet, TrendingUp, Users, Coins, Link, Ticket } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useLanguage } from "../src/LanguageContext"
import { useWeb3 } from "../src/Web3Context"
import { useGlobalRefresh, useEventRefresh } from "../hooks/useGlobalRefresh"
import { useRealTimePrice } from "../hooks/useRealTimePrice"
import { ethers } from "ethers"
import toast from "react-hot-toast"
import { formatContractError } from "../utils/errorFormatter"

// 价格数据点类型定义
interface PriceDataPoint {
  name: string;
  uv: number;
  ema?: number;
  high: number;
  low: number;
  change: number;
}

interface StatsPanelProps {
  stats: UserStats
  onJoinClick: () => void
  onBuyTicketClick?: () => void
}

// Mock data generator for fallback
const generateMockPriceData = (): PriceDataPoint[] => {
  const now = Date.now()
  const data: PriceDataPoint[] = []
  const price = 1.0
  for (let i = 0; i < 24; i++) {
    const time = now - (24 - i) * 3600 * 1000
    data.push({
      name: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      uv: price,
      ema: price,
      high: price,
      low: price,
      change: 0
    })
  }
  return data
}

// This will be replaced with real price history data from blockchain

// Memoized Chart Component
const MemoizedPriceChart = React.memo(({ priceHistory, t }: { priceHistory: PriceDataPoint[], t: any }) => {
  return (
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
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="#4B5563"
            vertical={true}
            horizontalPoints={[]}
          />
          <YAxis
            stroke="#9ca3af"
            tickFormatter={(value) => value.toFixed(4)}
            width={60}
            tick={{ fontSize: 10 }}
            domain={([dataMin, dataMax]) => {
              const range = dataMax - dataMin
              if (range <= 0.000001) {
                const buffer = dataMin * 0.1 || 0.1
                return [parseFloat((dataMin - buffer).toFixed(6)), parseFloat((dataMax + buffer).toFixed(6))]
              }
              const padding = range * 0.05
              return [parseFloat((dataMin - padding).toFixed(6)), parseFloat((dataMax + padding).toFixed(6))]
            }}
            allowDecimals={true}
            hide={false}
          />
          <XAxis
            dataKey="name"
            stroke="#9ca3af"
            tick={{ fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            height={50}
            interval={Math.ceil(priceHistory.length / 5) - 1}
          />
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
            formatter={(value: number | string) => {
              if (typeof value === "number") {
                return value.toFixed(6)
              }
              return value
            }}
            labelFormatter={(label) => `${t.stats.time || "Time"}: ${label}`}
            cursor={{
              stroke: "#01FEAE",
              strokeWidth: 2,
              strokeDasharray: "5 5",
            }}
            content={(content: any) => {
              if (!content.payload || content.payload.length === 0) return null
              const payload = content.payload[0]?.payload as any
              return (
                <div className="bg-gray-900 border border-neon-500 rounded p-2 text-xs">
                  <p className="text-neon-400 font-bold mb-1">{payload.name}</p>
                  <p className="text-gray-300">
                    {t.stats.price || "Price"}: <span className="text-neon-400 font-mono">${payload.uv.toFixed(6)}</span>
                  </p>
                  {payload.ema && (
                    <p className="text-gray-300">
                      EMA(7): <span className="text-amber-400 font-mono">${payload.ema.toFixed(6)}</span>
                    </p>
                  )}
                  {payload.high && (
                    <p className="text-gray-300">
                      {t.stats.range || "Range"}: <span className="text-gray-400 font-mono">${payload.low.toFixed(6)}~${payload.high.toFixed(6)}</span>
                    </p>
                  )}
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="uv"
            stroke="#01FEAE"
            strokeWidth={2}
            fill="url(#colorUv)"
            isAnimationActive={false}
            dot={false}
            name={t.stats.price || "Price"}
          />
          {priceHistory.length > 5 && (
            <Area
              type="monotone"
              dataKey="ema"
              stroke="#FBBF24"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              fill="url(#colorEma)"
              isAnimationActive={false}
              dot={false}
              name="EMA(7)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})

const StatsPanel: React.FC<StatsPanelProps> = ({ stats: initialStats, onJoinClick, onBuyTicketClick }) => {
  const { t } = useLanguage()
  const { jbcContract, protocolContract, account, isConnected, provider, mcBalance } = useWeb3()
  
  // 使用全局刷新机制
  const { balances, priceData, refreshAll } = useGlobalRefresh()
  
  // 使用实时价格更新
  const { priceHistory: rawPriceHistory, priceStats, currentPrice } = useRealTimePrice()
  
  const [displayStats, setDisplayStats] = useState<UserStats>(initialStats)
  const [rewardTotals, setRewardTotals] = useState({ mc: 0, jbc: 0 })

  // 从全局状态获取价格数据
  const jbcPrice = priceData.jbcPrice.toString()
  const mcUsdtPrice = priceData.mcUsdtPrice

  // 格式化价格历史数据用于图表显示
  const priceHistory: PriceDataPoint[] = useMemo(() => {
    if (rawPriceHistory.length === 0) {
      return generateMockPriceData()
    }

    // 转换实时价格数据为图表格式
    return rawPriceHistory.map((point: any) => {
      const date = new Date(point.timestamp * 1000)
      const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
      
      return {
        name: timeStr,
        uv: point.price,
        ema: point.price, // EMA 计算已在 hook 中处理
        high: point.price,
        low: point.price,
        change: 0
      }
    })
  }, [rawPriceHistory])

  // 监听余额变化事件
  useEventRefresh('balanceUpdated', () => {
    console.log('💰 [StatsPanel] 余额更新，刷新显示数据');
    // 余额数据已通过全局状态自动更新
  });

  // 监听价格变化事件
  useEventRefresh('priceUpdated', () => {
    console.log('📈 [StatsPanel] 价格更新');
    // 价格数据已通过全局状态和实时价格Hook自动更新
  });

  // Bind Referrer State
  const [referrer, setReferrer] = useState("")
  const [isBound, setIsBound] = useState(false)
  const [isBinding, setIsBinding] = useState(false)

  // 提取fetchData函数，以便在事件监听器中使用
  const fetchData = useCallback(async () => {
    console.log('🔍 [StatsPanel Debug] Checking connection status...');
    console.log('isConnected:', isConnected);
    console.log('account:', account);
    console.log('protocolContract:', !!protocolContract);
    
    if (isConnected && account && jbcContract && protocolContract) {
      try {
        console.log('🔍 [StatsPanel Debug] Fetching user data for:', account);
        
        // 余额数据现在从全局状态获取，不需要重复获取

        // Fetch Protocol Info
        const userInfo = await protocolContract.userInfo(account)
        console.log('🔍 [StatsPanel Debug] User info:', userInfo);
        
        // userInfo returns: (referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive, refundFeeAmount, teamTotalVolume, teamTotalCap)

        // Check referrer binding
        const currentReferrer = userInfo[0]
        // Updated check: Ensure referrer is not zero address AND not user's own address (self-ref protection)
        if (currentReferrer && currentReferrer !== ethers.ZeroAddress && currentReferrer.toLowerCase() !== account.toLowerCase()) {
          setIsBound(true)
        } else {
          // Unbound, check URL
          const urlParams = new URLSearchParams(window.location.search)
          const refParam = urlParams.get("ref")
          if (refParam && !referrer) {
            setReferrer(refParam)
          }
        }

        // Calculate Level based on teamCount (userInfo[2]) - Updated standards
        let level = "V0"
        const teamCount = Number(userInfo[2])
        
        console.log('🔍 [StatsPanel Debug] Team count:', teamCount);
        
        // 更新的极差裂变机制等级标准
        if (teamCount >= 100000) level = "V9"      // V9: 100,000个地址，45%极差收益
        else if (teamCount >= 30000) level = "V8"  // V8: 30,000个地址，40%极差收益
        else if (teamCount >= 10000) level = "V7"  // V7: 10,000个地址，35%极差收益
        else if (teamCount >= 3000) level = "V6"   // V6: 3,000个地址，30%极差收益
        else if (teamCount >= 1000) level = "V5"   // V5: 1,000个地址，25%极差收益
        else if (teamCount >= 300) level = "V4"    // V4: 300个地址，20%极差收益
        else if (teamCount >= 100) level = "V3"    // V3: 100个地址，15%极差收益
        else if (teamCount >= 30) level = "V2"     // V2: 30个地址，10%极差收益
        else if (teamCount >= 10) level = "V1"     // V1: 10个地址，5%极差收益

        console.log('🔍 [StatsPanel Debug] Calculated level:', level);

        let referralRevenue = 0
        let rewardMc = 0
        let rewardJbc = 0
        try {
          if (provider) {
            const currentBlock = await provider.getBlockNumber()
            // 统一查询范围到 50,000 区块，与 EarningsDetail 保持一致
            const fromBlock = Math.max(0, currentBlock - 50000)
            
            console.log('🔍 [StatsPanel] Querying events from block', fromBlock, 'to', currentBlock);
            
            const [referralEvents, rewardEvents] = await Promise.all([
              protocolContract.queryFilter(protocolContract.filters.ReferralRewardPaid(account), fromBlock),
              protocolContract.queryFilter(protocolContract.filters.RewardClaimed(account), fromBlock),
            ])
            
            console.log('🔍 [StatsPanel] Found events:', {
              referralEvents: referralEvents.length,
              rewardEvents: rewardEvents.length
            });
            
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
            
            console.log('🔍 [StatsPanel] Calculated rewards:', {
              referralRevenue,
              rewardMc,
              rewardJbc
            });
          }
        } catch (err) {
          console.error("Failed to fetch referral rewards", err)
          // 不要因为事件查询失败就阻止整个数据更新
          console.log('⚠️ [StatsPanel] Event query failed, continuing with contract state only');
        }

        const baseRevenue = parseFloat(ethers.formatEther(userInfo[3]))
        const combinedRevenue = baseRevenue + referralRevenue
        setRewardTotals({
          mc: rewardMc + referralRevenue,
          jbc: rewardJbc,
        })

        setDisplayStats((prev: UserStats) => ({
          ...prev,
          balanceMC: parseFloat(balances.mc), // 使用全局状态的余额
          balanceJBC: parseFloat(balances.jbc), // 使用全局状态的余额
          totalRevenue: combinedRevenue,
          teamCount: Number(userInfo[2]),
          currentLevel: level,
        }))
        
        console.log('🔍 [StatsPanel Debug] Updated display stats:', {
          teamCount: Number(userInfo[2]),
          currentLevel: level,
          balanceMC: parseFloat(balances.mc),
          balanceJBC: parseFloat(balances.jbc)
        });
      } catch (err) {
        console.error("Error fetching stats", err)
      }
    } else {
        console.log('🔍 [StatsPanel Debug] Not ready to fetch data:', {
          isConnected,
          hasAccount: !!account,
          hasJbcContract: !!jbcContract,
          hasProtocolContract: !!protocolContract
        });
      }
  }, [isConnected, account, jbcContract, protocolContract, provider, balances.mc, balances.jbc, referrer])

  // 监听用户等级变化事件
  useEventRefresh('userLevelChanged', () => {
    console.log('📊 [StatsPanel] 用户等级变化，刷新用户数据');
    fetchData();
  });

  // 监听门票状态变化事件（可能影响等级）
  useEventRefresh('ticketStatusChanged', () => {
    console.log('🎫 [StatsPanel] 门票状态变化，刷新用户数据');
    fetchData();
  });

  // 初始化数据获取和定期刷新
  useEffect(() => {
    const timer = setInterval(fetchData, 5000) // Refresh every 5s
    fetchData()
    return () => clearInterval(timer)
  }, [fetchData])

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
        toast.error(formatContractError(err))
      } finally {
        setIsBinding(false)
      }
    }
  }

  const handleBuyTicketClick = () => {
    // Navigate to dedicated buy ticket page
    if (onBuyTicketClick) {
      onBuyTicketClick()
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
              onClick={handleBuyTicketClick}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 text-black font-bold rounded-lg shadow-xl transition-all transform hover:-translate-y-1 text-sm md:text-base flex items-center gap-2"
            >
              <Ticket size={16} className="md:w-5 md:h-5" />
              {t.stats.buyTicket}
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
      <div className="glass-panel p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl bg-black/60 border-x-4 border-neon-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <div className="bg-neon-500/20 p-2 md:p-3 rounded-full text-neon-400 border border-neon-500/30 shrink-0">
            <Link size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-white">{t.team.bindTitle}</h3>
            <p className="text-xs md:text-sm text-gray-300">{t.team.bindDesc}</p>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferrer(e.target.value)}
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
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-500/40 transition-colors bg-black/60 border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex flex-col">
              <span className="text-gray-300 text-xs md:text-sm font-medium">{t.stats.assets}</span>
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
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-amber-500/40 transition-colors bg-black/60 border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-300 text-xs md:text-sm font-medium">{t.stats.holding}</span>
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

        {/* Stat 3 - 修正累计收益显示 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-500/40 transition-colors bg-black/60 border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-300 text-xs md:text-sm font-medium">{t.stats.revenue}</span>
            <TrendingUp className="text-neon-400" size={18} />
          </div>
          
          {/* 显示真实的累计收益 */}
          <div className="text-2xl md:text-3xl font-bold text-white mb-2">
            {displayStats.totalRevenue.toFixed(4)} MC
          </div>
          <div className="text-xs text-gray-400 mb-3">
            来自合约状态的真实累计收益
          </div>
          
          {/* 历史奖励统计（作为补充信息） */}
          <div className="border-t border-gray-600/50 pt-3">
            <div className="text-xs text-gray-400 mb-2">历史奖励统计 (事件)</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-neon-400 font-bold text-xs">MC</span>
                <span className="text-sm font-bold text-white">{rewardTotals.mc.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold text-xs">JBC</span>
                <span className="text-sm font-bold text-white">{rewardTotals.jbc.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-gray-300 flex justify-end items-center mt-2">
            {mcUsdtPrice > 0 && (
              <span className="text-neon-400">
                ≈${(displayStats.totalRevenue * mcUsdtPrice).toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">{t.stats.settlement}</div>
        </div>

        {/* Stat 4 */}
        <div className="glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-amber-500/40 transition-colors bg-gradient-to-br from-black/40 to-gray-900/60 border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-gray-300 text-xs md:text-sm font-medium">{t.stats.level}</span>
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
      <div className="glass-panel p-3 sm:p-4 md:p-6 rounded-xl md:rounded-2xl bg-black/60 border border-gray-700 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 md:mb-6">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-white border-l-4 border-neon-500 pl-3">
            {t.stats.chartTitle}
          </h3>
          {priceHistory.length > 1 && (
            <div className="grid grid-cols-2 sm:flex sm:gap-2 md:gap-4 text-xs md:text-sm gap-2">
              <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                <div className="text-gray-300 text-[10px] sm:text-xs font-medium">{t.stats.high}</div>
                <div className="text-amber-400 font-bold text-xs sm:text-sm">${priceStats.high.toFixed(6)}</div>
              </div>
              <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                <div className="text-gray-300 text-[10px] sm:text-xs font-medium">{t.stats.low}</div>
                <div className="text-amber-400 font-bold text-xs sm:text-sm">${priceStats.low.toFixed(6)}</div>
              </div>
              <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                <div className="text-gray-300 text-[10px] sm:text-xs font-medium">{t.stats.change}</div>
                <div className={`font-bold text-xs sm:text-sm ${priceStats.change >= 0 ? "text-neon-400" : "text-red-400"}`}>
                  {priceStats.change >= 0 ? "+" : ""}{priceStats.change.toFixed(2)}%
                </div>
              </div>
              <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                <div className="text-gray-300 text-[10px] sm:text-xs font-medium">{t.stats.avg}</div>
                <div className="text-neon-400 font-bold text-xs sm:text-sm">${priceStats.avgPrice.toFixed(6)}</div>
              </div>
            </div>
          )}
        </div>

        <MemoizedPriceChart priceHistory={priceHistory} t={t} />

        {/* Legend - responsive */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-300">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-neon-500"></div>
            <span>{t.stats.price || "Price"}</span>
          </div>
          {priceHistory.length > 5 && (
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-2 h-0.5 sm:w-3 sm:h-1 bg-amber-400"></div>
              <span>EMA(7)</span>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400 text-[9px] sm:text-[10px]">
            {t.stats.minPoints || "(Min 10 points)"}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatsPanel
