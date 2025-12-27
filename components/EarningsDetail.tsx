import React, { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { Clock, ExternalLink, Gift, RefreshCw, Filter, X, ChevronRight, Copy, CheckCircle, Pickaxe, Zap, UserPlus, Layers, TrendingUp, ChevronLeft, AlertCircle } from "lucide-react"
import { useWeb3 } from "../Web3Context"
import { useLanguage } from "../LanguageContext"
import { useEventRefresh } from "../hooks/useGlobalRefresh"
import toast from "react-hot-toast"

interface RewardRecord {
  hash: string
  user: string
  mcAmount: string
  jbcAmount: string
  rewardType: number
  ticketId: string
  source?: string
  blockNumber: number
  timestamp: number
  status: "confirmed" | "pending"
}

const EarningsDetail: React.FC = () => {
  const { protocolContract, account, provider } = useWeb3()
  const { t } = useLanguage()
  const [records, setRecords] = useState<RewardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [viewMode, setViewMode] = useState<"self" | "all">("self")
  const [filterType, setFilterType] = useState<number | 'all'>('all')
  const [selectedRecord, setSelectedRecord] = useState<RewardRecord | null>(null)
  const [copied, setCopied] = useState(false)
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage] = useState(20)
  
  // 错误状态
  const [error, setError] = useState<string | null>(null)
  
  // 缓存键
  const getCacheKey = (account: string, viewMode: string) => 
    `earnings_cache_${account}_${viewMode}`
  
  // 缓存状态
  const [cacheStatus, setCacheStatus] = useState<'none' | 'loading' | 'loaded'>('none')

  useEffect(() => {
    const checkOwner = async () => {
      if (protocolContract && account) {
        try {
          const owner = await protocolContract.owner()
          const isOwnerAccount = owner.toLowerCase() === account.toLowerCase()
          setIsOwner(isOwnerAccount)
          if (isOwnerAccount) {
            setViewMode("all")
          }
        } catch (err) {
          console.error("Failed to check owner", err)
          setIsOwner(false)
          setError("Failed to verify admin permissions")
        }
      }
    }
    checkOwner()
  }, [protocolContract, account])

  // 从缓存加载数据
  const loadFromCache = () => {
    if (!account) return false
    
    try {
      const cacheKey = getCacheKey(account, viewMode)
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        // 缓存有效期：5分钟
        const cacheAge = Date.now() - timestamp
        if (cacheAge < 5 * 60 * 1000) {
          setRecords(data)
          setLoading(false)
          setCacheStatus('loaded')
          return true
        }
      }
    } catch (err) {
      console.warn("Failed to load from cache:", err)
    }
    setCacheStatus('none')
    return false
  }

  // 保存到缓存
  const saveToCache = (data: RewardRecord[]) => {
    if (!account) return
    
    try {
      const cacheKey = getCacheKey(account, viewMode)
      const cacheData = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      setCacheStatus('loaded')
    } catch (err) {
      console.warn("Failed to save to cache:", err)
    }
  }

  // 清除缓存
  const clearCache = () => {
    if (!account) return
    
    try {
      const cacheKey = getCacheKey(account, viewMode)
      localStorage.removeItem(cacheKey)
      setCacheStatus('none')
      toast.success("Cache cleared successfully")
    } catch (err) {
      console.warn("Failed to clear cache:", err)
      toast.error("Failed to clear cache")
    }
  }

  // 监听收益相关事件，自动刷新收益记录
  useEventRefresh('rewardsChanged', () => {
    console.log('🎁 [EarningsDetail] 收益变化，刷新收益记录');
    fetchRecords(false); // 强制刷新，不使用缓存
  });

  useEventRefresh('ticketStatusChanged', () => {
    console.log('🎫 [EarningsDetail] 门票状态变化，刷新收益记录');
    fetchRecords(false); // 强制刷新，不使用缓存
  });

  const fetchRecords = async (useCache = true) => {
    if (!protocolContract || !account || !provider) {
      setLoading(false)
      setError("Wallet not connected or contracts not loaded")
      return
    }

    // 尝试从缓存加载
    if (useCache && loadFromCache()) {
      return
    }

    try {
      setRefreshing(true)
      setError(null)
      
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 100000)

      const targetUser = isOwner && viewMode === "all" ? null : account
      
      // 分别处理两种事件，提供更详细的错误信息
      let rewardEvents: any[] = []
      let referralEvents: any[] = []
      
      try {
        rewardEvents = await protocolContract.queryFilter(
          protocolContract.filters.RewardClaimed(targetUser), 
          fromBlock
        )
      } catch (err) {
        console.error("Failed to fetch reward events:", err)
        toast.error("Failed to load reward events")
      }

      try {
        referralEvents = await protocolContract.queryFilter(
          protocolContract.filters.ReferralRewardPaid(targetUser), 
          fromBlock
        )
      } catch (err) {
        console.error("Failed to fetch referral events:", err)
        toast.error("Failed to load referral events")
      }

      const rows: RewardRecord[] = []
      let processedEvents = 0
      let failedEvents = 0

      // 处理奖励事件
      for (const event of rewardEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          const mcAmount = event.args ? ethers.formatEther(event.args[1]) : "0"
          const jbcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
          const rewardType = event.args ? Number(event.args[3]) : 0
          const ticketId = event.args ? event.args[4].toString() : ""

          rows.push({
            hash: event.transactionHash,
            user: event.args ? event.args[0] : "",
            mcAmount,
            jbcAmount,
            rewardType,
            ticketId,
            blockNumber: event.blockNumber,
            timestamp: block ? block.timestamp : 0,
            status: "confirmed",
          })
          processedEvents++
        } catch (err) {
          console.error("Error parsing reward event:", err, event)
          failedEvents++
        }
      }

      // 处理推荐奖励事件
      for (const event of referralEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          const mcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
          const rewardType = event.args ? Number(event.args[3]) : 0
          const ticketId = event.args ? event.args[4].toString() : ""

          rows.push({
            hash: event.transactionHash,
            user: event.args ? event.args[0] : "",
            source: event.args ? event.args[1] : "",
            mcAmount,
            jbcAmount: "0",
            rewardType,
            ticketId,
            blockNumber: event.blockNumber,
            timestamp: block ? block.timestamp : 0,
            status: "confirmed",
          })
          processedEvents++
        } catch (err) {
          console.error("Error parsing referral reward event:", err, event)
          failedEvents++
        }
      }

      // 按时间戳排序
      rows.sort((a, b) => b.timestamp - a.timestamp)
      
      setRecords(rows)
      saveToCache(rows)
      
      // 显示处理结果
      if (failedEvents > 0) {
        toast.error(`Loaded ${processedEvents} records, ${failedEvents} failed to parse`)
      } else if (processedEvents > 0) {
        toast.success(`Loaded ${processedEvents} earnings records`)
      }
      
    } catch (err: any) {
      console.error("Failed to fetch earnings records:", err)
      setError(`Failed to load earnings data: ${err.message || 'Unknown error'}`)
      toast.error("Failed to load earnings data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [protocolContract, account, viewMode, isOwner])

  // 添加分页逻辑 - 过滤掉动态奖励记录
  const filteredRecords = filterType === 'all' 
    ? records.filter(r => r.rewardType !== 1) // 排除动态奖励
    : records.filter(r => r.rewardType === filterType && r.rewardType !== 1) // 排除动态奖励

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage)
  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const currentRecords = filteredRecords.slice(startIndex, endIndex)

  // 重置分页当过滤器改变时
  useEffect(() => {
    setCurrentPage(1)
  }, [filterType])

  const totals = useMemo(() => {
    return records.reduce(
      (acc, row) => {
        acc.mc += parseFloat(row.mcAmount || "0")
        acc.jbc += parseFloat(row.jbcAmount || "0")
        return acc
      },
      { mc: 0, jbc: 0 }
    )
  }, [records])

  const dailyStats = useMemo(() => {
    const stats = {
      static: { mc: 0, jbc: 0 },
      direct: { mc: 0, jbc: 0 },
      level: { mc: 0, jbc: 0 },
      differential: { mc: 0, jbc: 0 },
    }

    const now = Math.floor(Date.now() / 1000)
    const oneDayAgo = now - 24 * 3600

    records.forEach((row) => {
      if (row.timestamp >= oneDayAgo) {
        const mc = parseFloat(row.mcAmount || "0")
        const jbc = parseFloat(row.jbcAmount || "0")

        if (row.rewardType === 0) {
          stats.static.mc += mc
          stats.static.jbc += jbc
        } else if (row.rewardType === 2) {
          stats.direct.mc += mc
          stats.direct.jbc += jbc
        } else if (row.rewardType === 3) {
          stats.level.mc += mc
          stats.level.jbc += jbc
        } else if (row.rewardType === 4) {
          stats.differential.mc += mc
          stats.differential.jbc += jbc
        }
      }
    })

    return stats
  }, [records])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const explorerUrl = "https://sepolia.etherscan.io"
  const ui = t.earnings || {}
  
  const getRewardTypeLabel = (value: number) => {
    if (value === 0) return ui.staticReward || "Static Reward"
    if (value === 2) return ui.directReward || "Direct Reward"
    if (value === 3) return ui.levelReward || "Level Reward"
    if (value === 4) return ui.differentialReward || "Differential Reward"
    return ui.unknownType || "Unknown"
  }

  const rewardTypes = [
    { value: 0, label: ui.staticReward || "Static Reward" },
    { value: 2, label: ui.directReward || "Direct Reward" },
    { value: 3, label: ui.levelReward || "Level Reward" },
    { value: 4, label: ui.differentialReward || "Differential Reward" },
  ]

  const getRewardIcon = (type: number, className: string) => {
    switch (type) {
      case 0: // Static
        return <Pickaxe className={className} />
      case 2: // Direct
        return <UserPlus className={className} />
      case 3: // Level
        return <Layers className={className} />
      case 4: // Differential
        return <TrendingUp className={className} />
      default:
        return <Gift className={className} />
    }
  }

  if (!account) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-gray-900/80 border border-gray-700 rounded-2xl shadow-lg p-8 text-center backdrop-blur-sm">
          <Gift className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-bold text-gray-50 mb-2">{ui.connectWallet || "Connect Your Wallet"}</h3>
          <p className="text-gray-200">{ui.connectWalletDesc || "Connect your wallet to view earnings details"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <div className="bg-gradient-to-r from-neon-500 to-neon-600 rounded-2xl shadow-xl shadow-neon-500/30 p-6 mb-6 border border-neon-400/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-black" />
            <div>
              <h2 className="text-2xl font-bold text-black">{ui.title || "Earnings Details"}</h2>
              <div className="flex items-center gap-2">
                <p className="text-black/80">{ui.subtitle || "View your on-chain reward history"}</p>
                {cacheStatus === 'loaded' && (
                  <span className="px-2 py-1 bg-black/20 text-black text-xs rounded-full">
                    Cached
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => setViewMode("self")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === "self" ? "bg-black text-neon-400" : "bg-black/20 text-black hover:bg-black/30"
                  }`}
                >
                  {ui.mySelf || "My Earnings"}
                </button>
                <button
                  onClick={() => setViewMode("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === "all" ? "bg-black text-neon-400" : "bg-black/20 text-black hover:bg-black/30"
                  }`}
                >
                  {ui.allUsers || "All Users"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRecords(false)} // 强制刷新，不使用缓存
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/30 rounded-lg text-black transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                {ui.refresh || "Refresh"}
              </button>
              
              <button
                onClick={clearCache}
                className="px-3 py-2 bg-black/10 hover:bg-black/20 rounded-lg text-black text-sm transition-colors"
                title="Clear cache"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-5 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.totalMc || "Total MC Rewards"}</div>
          <div className="text-2xl font-bold text-neon-400 drop-shadow-lg">{totals.mc.toFixed(4)} MC</div>
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-5 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.totalJbc || "Total JBC Rewards"}</div>
          <div className="text-2xl font-bold text-amber-400 drop-shadow-lg">{totals.jbc.toFixed(4)} JBC</div>
        </div>
      </div>

      {/* 24h Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.staticReward || "Static Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.static.mc.toFixed(2)} MC</div>
          <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.static.jbc.toFixed(2)} JBC</div>
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.directReward || "Direct Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.direct.mc.toFixed(2)} MC</div>
          {dailyStats.direct.jbc > 0 && (
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.direct.jbc.toFixed(2)} JBC</div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.levelReward || "Level Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.level.mc.toFixed(2)} MC</div>
          {dailyStats.level.jbc > 0 && (
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.level.jbc.toFixed(2)} JBC</div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.differentialReward || "Differential Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.differential.mc.toFixed(4)} MC</div>
          <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.differential.jbc.toFixed(4)} JBC</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 mb-6 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 no-scrollbar">
          <Filter className="w-5 h-5 text-gray-300 flex-shrink-0" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              filterType === 'all'
                ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-600 hover:text-white border border-gray-600'
            }`}
          >
            {t.history?.all || "All"}
          </button>
          {rewardTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                filterType === type.value
                  ? 'bg-neon-500/20 text-neon-400 border border-neon-500/30'
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-600 hover:text-white border border-gray-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-12 text-center backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-neon-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-200">{ui.loading || "Loading..."}</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-12 text-center backdrop-blur-sm">
          <Gift className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-bold text-gray-50 mb-2">{ui.noRecords || "No Reward Records"}</h3>
          <p className="text-gray-200">{ui.noRecordsDesc || "No reward claims yet."}</p>
        </div>
      ) : (
        <>
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <h4 className="text-red-400 font-semibold">Error Loading Data</h4>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 分页信息 */}
          {totalPages > 1 && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 mb-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm text-gray-200">
                <span>
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
                </span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>
            </div>
          )}

          {/* 记录列表 */}
          <div className="space-y-3">
            {currentRecords.map((row, index) => (
            <div
              key={`${row.hash}-${index}`}
              onClick={() => setSelectedRecord(row)}
              className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md hover:shadow-lg hover:border-neon-500/50 hover:bg-gray-900/90 transition-all cursor-pointer backdrop-blur-sm"
            >
              {/* Desktop View */}
              <div className="hidden md:block p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getRewardIcon(row.rewardType, "w-5 h-5 text-neon-400")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-gray-50">{t.history.reward_claimed || "Reward Claimed"}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neon-500/30 text-neon-300 border border-neon-500/50">
                          {t.history.confirmed || "Confirmed"}
                        </span>
                        {isOwner && viewMode === "all" && row.user && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-500/30 text-blue-300 border border-blue-500/50">
                            {row.user.slice(0, 6)}...{row.user.slice(-4)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 mb-2">
                        {parseFloat(row.mcAmount) > 0 && (
                          <p className="text-sm text-gray-200">
                            {ui.mcAmount || "MC Reward"}:{" "}
                            <span className="font-semibold text-neon-400 drop-shadow-sm">{parseFloat(row.mcAmount).toFixed(4)} MC</span>
                          </p>
                        )}
                        {parseFloat(row.jbcAmount) > 0 && (
                          <p className="text-sm text-gray-200">
                            {ui.jbcAmount || "JBC Reward"}:{" "}
                            <span className="font-semibold text-amber-400 drop-shadow-sm">{parseFloat(row.jbcAmount).toFixed(4)} JBC</span>
                          </p>
                        )}
                        {row.source && (
                          <p className="text-sm text-gray-300">
                            {ui.rewardFrom || "From"}:{" "}
                            <span className="font-mono text-gray-200">
                              {row.source.slice(0, 6)}...{row.source.slice(-4)}
                            </span>
                          </p>
                        )}
                        <p className="text-sm text-gray-300">
                          {ui.rewardType || "Reward Type"}:{" "}
                          <span className="font-semibold text-gray-100">{getRewardTypeLabel(row.rewardType)}</span>
                        </p>
                        {row.ticketId && (
                          <p className="text-sm text-gray-200">
                            {ui.ticketId || "Ticket ID"}:{" "}
                            <span className="font-semibold text-gray-100">{row.ticketId}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-300">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(row.timestamp)}
                        </div>
                        <div>
                          {ui.block || "Block"}: {row.blockNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <a
                      href={`${explorerUrl}/tx/${row.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-600 border border-gray-600 rounded-lg text-sm font-mono text-gray-200 hover:text-white transition-colors"
                    >
                      {row.hash.slice(0, 6)}...{row.hash.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Mobile Compact View */}
              <div className="md:hidden p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      {getRewardIcon(row.rewardType, "w-5 h-5 text-neon-400")}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-50 text-sm">{getRewardTypeLabel(row.rewardType)}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
                        <span>{formatDate(row.timestamp).split(' ')[0]}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-neon-500/20 text-neon-300">
                          {t.history.confirmed || "Confirmed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="space-y-0.5">
                      {parseFloat(row.mcAmount) > 0 && (
                        <p className="text-sm text-right font-semibold text-neon-400">+{parseFloat(row.mcAmount).toFixed(2)} MC</p>
                      )}
                      {parseFloat(row.jbcAmount) > 0 && (
                        <p className="text-sm text-right font-semibold text-amber-400">+{parseFloat(row.jbcAmount).toFixed(2)} JBC</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 mt-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-gray-100 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-neon-500 text-black'
                          : 'bg-gray-800 hover:bg-gray-600 text-gray-100 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-gray-100 hover:text-white transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4" onClick={() => setSelectedRecord(null)}>
          <div 
            className="bg-gray-900/90 border-t md:border border-gray-700 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-50">{t.history.details || '交易详情'}</h3>
              <button onClick={() => setSelectedRecord(null)} className="p-2 rounded-lg hover:bg-gray-700 text-gray-200 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Type & Status */}
              <div className="flex items-center justify-between p-4 bg-gray-800/70 rounded-xl border border-gray-700">
                <div className="flex items-center gap-3">
                  {getRewardIcon(selectedRecord.rewardType, "w-8 h-8 text-neon-400")}
                  <div>
                    <div className="font-bold text-gray-50">{getRewardTypeLabel(selectedRecord.rewardType)}</div>
                    <div className="text-xs text-gray-200">{formatDate(selectedRecord.timestamp)}</div>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-lg text-xs font-bold bg-neon-500/30 text-neon-300 border border-neon-500/50">
                  {t.history.confirmed || "Confirmed"}
                </span>
              </div>

              {/* Amounts */}
              <div className="space-y-3">
                <div className="text-sm text-gray-200 uppercase font-mono tracking-wider">{ui.mcAmount || "MC Reward"}</div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  {parseFloat(selectedRecord.mcAmount) > 0 && (
                    <div className={`flex justify-between items-center ${parseFloat(selectedRecord.jbcAmount) > 0 ? 'mb-2' : ''}`}>
                      <span className="text-gray-200">MC</span>
                      <span className="font-bold text-neon-400 text-lg drop-shadow-sm">{parseFloat(selectedRecord.mcAmount).toFixed(4)}</span>
                    </div>
                  )}
                  {parseFloat(selectedRecord.jbcAmount) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-200">JBC</span>
                      <span className="font-bold text-amber-400 text-lg drop-shadow-sm">{parseFloat(selectedRecord.jbcAmount).toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Info */}
              <div className="space-y-3">
                <div className="text-sm text-gray-200 uppercase font-mono tracking-wider">{t.history.info || '信息'}</div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200 text-sm">{ui.block || "Block"}:</span>
                    <span className="text-gray-50 font-mono">{selectedRecord.blockNumber}</span>
                  </div>
                  
                  {selectedRecord.ticketId && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-200 text-sm">{ui.ticketId || "Ticket ID"}:</span>
                      <span className="text-gray-50 font-mono">{selectedRecord.ticketId}</span>
                    </div>
                  )}

                  {selectedRecord.source && (
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-200 text-sm">{ui.rewardFrom || "From"}:</span>
                      <span className="text-gray-50 font-mono text-xs break-all bg-black/30 p-2 rounded w-full">
                        {selectedRecord.source}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-gray-200 text-sm">Hash:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-50 font-mono text-xs break-all bg-black/30 p-2 rounded w-full">
                        {selectedRecord.hash}
                      </span>
                      <button 
                        onClick={() => copyToClipboard(selectedRecord.hash)}
                        className="p-2 hover:bg-gray-600 rounded-lg text-gray-200 hover:text-white transition-colors"
                      >
                        {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <a
                href={`${explorerUrl}/tx/${selectedRecord.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-neon-500 hover:bg-neon-600 text-black font-bold rounded-xl text-center transition-colors"
              >
                {t.history.viewOnExplorer || '在浏览器中查看'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EarningsDetail
