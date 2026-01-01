import React, { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { Clock, ExternalLink, Gift, RefreshCw, Filter, X, ChevronRight, Copy, CheckCircle, Pickaxe, Zap, UserPlus, Layers, TrendingUp, ChevronLeft, AlertCircle } from "lucide-react"
import { useWeb3 } from "../src/Web3Context"
import { useLanguage } from "../src/LanguageContext"
import { useEventRefresh } from "../hooks/useGlobalRefresh"
import { AppTab } from "../src/types"
import toast from "react-hot-toast"
import { formatMC, formatJBC, formatPrice, formatAmount, formatTotalValue, formatDateTime, formatAddress, formatTxHash, formatBlockNumber, parseTokenAmount } from "../utils/formatUtils"

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

const EarningsDetail: React.FC<{ onNavigateToMining?: () => void }> = ({ onNavigateToMining }) => {
  const { protocolContract, account, provider } = useWeb3()
  const { t } = useLanguage()
  const [records, setRecords] = useState<RewardRecord[]>([])
  const [pendingRewards, setPendingRewards] = useState<{mc: number, jbc: number}>({mc: 0, jbc: 0})
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
  
  // JBC 价格状态
  const [currentJBCPrice, setCurrentJBCPrice] = useState(0)
  const [reserveInfo, setReserveInfo] = useState<{mc: string, jbc: string}>({mc: "0", jbc: "0"})
  
  // 强制刷新函数
  const forceRefresh = async () => {
    clearCache();
    setError(null);
    await Promise.all([
      fetchRecords(false), // 强制刷新，不使用缓存
      fetchPendingRewards() // 刷新待领取奖励
    ]);
  };

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
        // 延长缓存有效期：15分钟
        const cacheAge = Date.now() - timestamp
        if (cacheAge < 15 * 60 * 1000) {
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
    fetchRecords(false); // 强制刷新，不使用缓存
    fetchPendingRewards(); // 同时刷新待领取奖励
  });

  useEventRefresh('ticketStatusChanged', () => {
    fetchRecords(false); // 强制刷新，不使用缓存
    fetchPendingRewards(); // 同时刷新待领取奖励
  });

  // 获取待领取的静态奖励
  const fetchPendingRewards = async (retryCount = 0) => {
    if (!protocolContract || !account) {
      setPendingRewards({mc: 0, jbc: 0});
      return;
    }

    try {
      // 检查用户门票状态
      const ticket = await protocolContract.userTicket(account);
      
      if (ticket.amount === 0n || ticket.exited) {
        setPendingRewards({mc: 0, jbc: 0});
        return;
      }

      // 检查收益上限
      const userInfo = await protocolContract.userInfo(account);
      const remainingCap = userInfo.currentCap - userInfo.totalRevenue;
      
      if (remainingCap <= 0n) {
        setPendingRewards({mc: 0, jbc: 0});
        return;
      }

      // 获取时间单位，默认为60秒（如果获取失败）
      let secondsInUnit = 60n;
      try {
        secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
      } catch (e) {
        console.warn('⚠️ [EarningsDetail] Failed to fetch SECONDS_IN_UNIT, using default 60s', e);
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      
      let totalPendingRewards = 0n;
      let activeStakesCount = 0;
      
      // 遍历用户的质押记录
      for (let i = 0; i < 20; i++) { // 增加到检查前20条记录
        try {
          // 使用 userStakes 获取质押信息
          // 注意：如果 i 超过了用户的质押数量，合约可能会 revert
          // 所以我们需要用 try-catch 包裹每次调用
          const stake = await protocolContract.userStakes(account, i);
          
          // 如果 amount 为 0，通常表示该索引没有有效质押（或者是空的结构体）
          // 但在某些实现中，可能是被删除了。我们假设遇到空记录就停止，或者继续检查。
          // 安全起见，如果连续遇到3个空记录才停止？
          // 这里假设 amount > 0 才是有效记录
          if (stake.amount === 0n) {
             // 检查是否是真的结束了，还是只是中间有空洞
             // 通常 userStakes 是数组，不会有空洞，除非 pop 了
             // 暂时假设遇到 0 amount 就结束
             break;
          }
          
          if (stake.active) {
            activeStakesCount++;
            
            // 计算已过时间单位
            const unitSeconds = Number(secondsInUnit) || 60; // 防止除以0
            const unitsPassed = Math.floor((currentTime - Number(stake.startTime)) / unitSeconds);
            const maxUnits = Number(stake.cycleDays);
            const actualUnits = Math.min(unitsPassed, maxUnits);
            
            if (actualUnits > 0) {
              // 根据周期确定收益率
              let ratePerBillion = 0;
              const days = Number(stake.cycleDays);
              
              if (days === 7) ratePerBillion = 13333334;
              else if (days === 15) ratePerBillion = 16666667;
              else if (days === 30) ratePerBillion = 20000000;
              else {
                 // 如果是非标准周期，尝试根据比例估算？或者暂时忽略
                 // 假设 30 天是基准？
                 console.warn(`⚠️ [EarningsDetail] Unknown cycle days: ${days}, skipping reward calc for stake #${i}`);
                 continue;
              }
              
              // 计算应得奖励
              const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
              const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
              
              totalPendingRewards += pending;
            }
          }
        } catch (error) {
          // 索引越界，结束遍历
          break;
        }
      }
      
      // 应用收益上限约束
      const actualClaimable = totalPendingRewards > remainingCap ? remainingCap : totalPendingRewards;
      
      if (actualClaimable === 0n) {
        setPendingRewards({mc: 0, jbc: 0});
        return;
      }
      
      // 分配50%MC和50%JBC（按价值计算）
      const mcPart = BigInt(actualClaimable) / 2n;
      const jbcValuePart = BigInt(actualClaimable) / 2n;
      
      // 获取JBC价格来计算JBC数量
      const reserveMC = await protocolContract.swapReserveMC();
      const reserveJBC = await protocolContract.swapReserveJBC();
      
      // 更新储备信息状态
      setReserveInfo({
        mc: ethers.formatEther(reserveMC),
        jbc: ethers.formatEther(reserveJBC)
      });
      
      let jbcAmount = 0;
      let calculatedJBCPrice = 0;
      if (reserveMC > 0n && reserveJBC > 0n) {
        const jbcPrice = (reserveMC * 1000000000000000000n) / reserveJBC; // 1e18 scaled
        const jbcAmountBigInt = (jbcValuePart * 1000000000000000000n) / jbcPrice;
        jbcAmount = Number(ethers.formatEther(jbcAmountBigInt));
        calculatedJBCPrice = Number(ethers.formatEther(jbcPrice));
      } else {
        // 如果没有流动性，按1:1计算
        jbcAmount = Number(ethers.formatEther(jbcValuePart));
        calculatedJBCPrice = 1;
      }
      
      // 更新JBC价格状态
      setCurrentJBCPrice(calculatedJBCPrice);
      
      const result = {
        mc: Number(ethers.formatEther(mcPart)),
        jbc: jbcAmount
      };
      
      setPendingRewards(result);
      
    } catch (error) {
      console.error('❌ [EarningsDetail] 获取待领取奖励失败:', error);
      
      // 添加重试机制
      if (retryCount < 2) {
        setTimeout(() => {
          fetchPendingRewards(retryCount + 1);
        }, 1000 * (retryCount + 1));
        return;
      }
      
      setPendingRewards({mc: 0, jbc: 0});
      
      // 显示用户友好的错误提示
      let errorMessage = '获取待领取奖励失败';
      if (error instanceof Error) {
        if (error.message.includes('call revert')) {
          errorMessage = '合约调用失败，请检查网络连接或稍后重试';
        } else if (error.message.includes('network')) {
          errorMessage = '网络连接问题，请检查网络设置';
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请稍后重试';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '账户余额不足';
        }
      }
      
      // 不设置全局错误状态，只在控制台记录
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [EarningsDetail] Pending rewards fetch failed:', errorMessage);
      }
    }
  };

  const fetchRecords = async (useCache = true, retryCount = 0) => {
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
      // 根据时间单位动态调整查询范围
      let blockRange = 100000; // 默认范围
      
      try {
        const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
        const timeUnit = Number(secondsInUnit);
        
        if (timeUnit === 60) {
          // 测试环境 (分钟单位) - 较小范围即可
          blockRange = 100000; // 增加到100K以确保不遗漏
          console.log('🔍 [EarningsDetail] 检测到测试环境 (60s单位)，使用100K区块范围');
        } else if (timeUnit === 86400) {
          // 生产环境 (天单位) - 需要更大范围
          blockRange = 500000; // 增加到500K以确保不遗漏历史数据
          console.log('🔍 [EarningsDetail] 检测到生产环境 (86400s单位)，使用500K区块范围');
        }
      } catch (e) {
        console.warn('⚠️ [EarningsDetail] 无法检测时间单位，使用默认范围');
      }
      
      const fromBlock = Math.max(0, currentBlock - blockRange)
      console.log(`🔍 [EarningsDetail] 查询范围: 区块 ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)`)

      const targetUser = isOwner && viewMode === "all" ? null : account

      // 并行查询四种事件
      // 使用 Promise.allSettled 避免其中一个失败导致整体失败
      const [rewardPaidResults, rewardClaimedResults, referralResults, differentialResults] = await Promise.allSettled([
        protocolContract.queryFilter(
          protocolContract.filters.RewardPaid(targetUser), 
          fromBlock
        ),
        protocolContract.queryFilter(
          protocolContract.filters.RewardClaimed(targetUser), 
          fromBlock
        ),
        protocolContract.queryFilter(
          protocolContract.filters.ReferralRewardPaid(targetUser), 
          fromBlock
        ),
        protocolContract.queryFilter(
          protocolContract.filters.DifferentialRewardDistributed(targetUser), 
          fromBlock
        )
      ])
      
      let rewardPaidEvents: any[] = []
      let rewardClaimedEvents: any[] = []
      let referralEvents: any[] = []
      let differentialEvents: any[] = []

      if (rewardPaidResults.status === 'fulfilled') {
        rewardPaidEvents = rewardPaidResults.value
      } else {
        console.error("Failed to fetch RewardPaid events:", rewardPaidResults.reason)
        toast.error("Failed to load RewardPaid events")
      }

      if (rewardClaimedResults.status === 'fulfilled') {
        rewardClaimedEvents = rewardClaimedResults.value
      } else {
        console.error("Failed to fetch RewardClaimed events:", rewardClaimedResults.reason)
        toast.error("Failed to load RewardClaimed events")
      }

      if (referralResults.status === 'fulfilled') {
        referralEvents = referralResults.value
      } else {
        console.error("Failed to fetch referral events:", referralResults.reason)
        toast.error("Failed to load referral events")
      }

      if (differentialResults.status === 'fulfilled') {
        differentialEvents = differentialResults.value
      } else {
        console.error("Failed to fetch differential events:", differentialResults.reason)
        // 不显示错误，因为这是新事件，旧合约可能没有
      }

      const rows: RewardRecord[] = []
      let processedEvents = 0
      let failedEvents = 0

      // 使用 Map 来跟踪已处理的事件，避免重复
      // key: transactionHash-blockNumber-rewardType
      const processedEventsMap = new Map<string, boolean>()

      // 优先处理 RewardClaimed 事件（包含准确的 MC 和 JBC 金额）
      for (const event of rewardClaimedEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          const mcAmount = event.args ? ethers.formatEther(event.args[1]) : "0"
          const jbcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
          const rewardType = event.args ? Number(event.args[3]) : 0
          const ticketId = event.args ? event.args[4].toString() : ""

          // 创建唯一键来避免重复
          const eventKey = `${event.transactionHash}-${event.blockNumber}-${rewardType}-claimed`
          
          if (!processedEventsMap.has(eventKey)) {
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
            processedEventsMap.set(eventKey, true)
            processedEvents++
          }
        } catch (err) {
          console.error("Error parsing RewardClaimed event:", err, event)
          failedEvents++
        }
      }

      // 处理 RewardPaid 事件（作为补充，只处理没有对应 RewardClaimed 的事件）
      // 因为 RewardPaid 和 RewardClaimed 通常在同一个交易中成对出现
      for (const event of rewardPaidEvents) {
        try {
          const rewardType = event.args ? Number(event.args[2]) : 0
          const eventKey = `${event.transactionHash}-${event.blockNumber}-${rewardType}-claimed`
          
          // 如果已经有对应的 RewardClaimed 事件，跳过 RewardPaid
          if (processedEventsMap.has(eventKey)) {
            continue
          }

          const block = await provider.getBlock(event.blockNumber)
          const amount = event.args ? ethers.formatEther(event.args[1]) : "0"

          // RewardPaid事件只有总金额，需要根据类型判断是MC还是JBC
          // 对于静态收益，通常是50%MC + 50%JBC
          let mcAmount = "0"
          let jbcAmount = "0"
          
          if (rewardType === 0) { // 静态收益
            mcAmount = (parseFloat(amount) / 2).toString()
            jbcAmount = (parseFloat(amount) / 2).toString()
          } else {
            // 其他类型收益通常只是MC
            mcAmount = amount
          }

          const paidEventKey = `${event.transactionHash}-${event.blockNumber}-${rewardType}-paid`
          if (!processedEventsMap.has(paidEventKey)) {
            rows.push({
              hash: event.transactionHash,
              user: event.args ? event.args[0] : "",
              mcAmount,
              jbcAmount,
              rewardType,
              ticketId: "", // RewardPaid事件没有ticketId
              blockNumber: event.blockNumber,
              timestamp: block ? block.timestamp : 0,
              status: "confirmed",
            })
            processedEventsMap.set(paidEventKey, true)
            processedEvents++
          }
        } catch (err) {
          console.error("Error parsing RewardPaid event:", err, event)
          failedEvents++
        }
      }

      // 处理推荐奖励事件
      for (const event of referralEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          
          // 检查事件参数数量来判断是新格式还是旧格式
          const isNewFormat = event.args && event.args.length >= 6 // 新格式有6个参数
          
          let mcAmount = "0"
          let jbcAmount = "0"
          let rewardType = 0
          let ticketId = ""
          
          if (isNewFormat) {
            // 新格式: ReferralRewardPaid(user, from, mcAmount, jbcAmount, rewardType, ticketId)
            mcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
            jbcAmount = event.args ? ethers.formatEther(event.args[3]) : "0"
            rewardType = event.args ? Number(event.args[4]) : 0
            ticketId = event.args ? event.args[5].toString() : ""
          } else {
            // 旧格式: ReferralRewardPaid(user, from, mcAmount, rewardType, ticketId)
            mcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
            jbcAmount = "0"
            rewardType = event.args ? Number(event.args[3]) : 0
            ticketId = event.args ? event.args[4].toString() : ""
          }

          rows.push({
            hash: event.transactionHash,
            user: event.args ? event.args[0] : "",
            source: event.args ? event.args[1] : "",
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
          console.error("Error parsing referral reward event:", err, event)
          failedEvents++
        }
      }

      // 处理新的 DifferentialRewardDistributed 事件
      for (const event of differentialEvents) {
        try {
          const block = await provider.getBlock(event.blockNumber)
          const mcAmount = event.args ? ethers.formatEther(event.args[1]) : "0"
          const jbcAmount = event.args ? ethers.formatEther(event.args[2]) : "0"
          const jbcPrice = event.args ? ethers.formatEther(event.args[3]) : "0"

          rows.push({
            hash: event.transactionHash,
            user: event.args ? event.args[0] : "",
            mcAmount,
            jbcAmount,
            rewardType: 4, // 級差獎勵
            ticketId: "", // DifferentialRewardDistributed 事件沒有 ticketId
            blockNumber: event.blockNumber,
            timestamp: block ? block.timestamp : 0,
            status: "confirmed",
          })
          processedEvents++
        } catch (err) {
          console.error("Error parsing differential reward event:", err, event)
          failedEvents++
        }
      }

      // 按时间戳排序
      rows.sort((a, b) => b.timestamp - a.timestamp)
      
      setRecords(rows)
      saveToCache(rows)
      
      // 显示处理结果
      console.log(`📊 [EarningsDetail] 事件处理完成: 成功 ${processedEvents} 条, 失败 ${failedEvents} 条`)
      console.log(`📊 [EarningsDetail] 事件统计: RewardPaid=${rewardPaidEvents.length}, RewardClaimed=${rewardClaimedEvents.length}, Referral=${referralEvents.length}, Differential=${differentialEvents.length}`)
      
      if (failedEvents > 0) {
        toast.error(`Loaded ${processedEvents} records, ${failedEvents} failed to parse`)
      } else if (processedEvents > 0) {
        toast.success(`Loaded ${processedEvents} earnings records`)
      } else {
        console.warn('⚠️ [EarningsDetail] 没有找到任何收益记录，尝试降级方案')
        // 如果没有记录，尝试获取合约状态作为降级方案
        await fetchContractStateFallback();
      }
      
    } catch (err: any) {
      console.error("Failed to fetch earnings records:", err)
      
      // 添加重试机制
      if (retryCount < 3) {
        setTimeout(() => {
          fetchRecords(false, retryCount + 1);
        }, 2000 * (retryCount + 1)); // 递增延迟
        return;
      }
      
      // 静默处理错误，不显示用户错误提示
      // 尝试降级方案
      await fetchContractStateFallback();
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 降级方案：直接从合约状态获取数据
  const fetchContractStateFallback = async () => {
    if (!protocolContract || !account) return;
    
    try {
      // 获取用户基本信息
      const userInfo = await protocolContract.userInfo(account);
      const totalRevenue = parseFloat(ethers.formatEther(userInfo.totalRevenue));
      
      if (totalRevenue > 0) {
        // 创建一个基于合约状态的记录
        const fallbackRecord: RewardRecord = {
          hash: "contract-state",
          user: account,
          mcAmount: (totalRevenue / 2).toString(), // 假设50/50分配
          jbcAmount: (totalRevenue / 2).toString(),
          rewardType: 0, // 静态收益
          ticketId: "fallback",
          blockNumber: 0,
          timestamp: Math.floor(Date.now() / 1000),
          status: "confirmed",
        };
        
        setRecords([fallbackRecord]);
        toast.success("Loaded earnings data from contract state");
      } else {
        // No revenue found in contract state
      }
    } catch (fallbackErr) {
      console.error('❌ [EarningsDetail] Fallback also failed:', fallbackErr);
    }
  }

  useEffect(() => {
    fetchRecords()
    fetchPendingRewards()
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

    // 如果是查看自己的数据，添加待领取的静态奖励到显示中
    if (viewMode === "self" && account) {
      // 注意：这里不直接加到stats中，而是在显示时特别处理
      // 因为待领取奖励不是24小时内的历史记录
    }

    return stats
  }, [records, viewMode, account])

  // formatDate 已从 formatUtils 导入

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
                onClick={forceRefresh}
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

      {/* 网络状态和错误提示 */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-red-400 font-semibold">数据加载失败</h4>
              <p className="text-red-300 text-sm mt-1">{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => fetchRecords(false)}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={clearCache}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                >
                  清除缓存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 缓存状态提示 */}
      {cacheStatus === 'loaded' && !error && (
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-3 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-blue-300">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>正在使用缓存数据，点击刷新获取最新数据</span>
          </div>
        </div>
      )}
      {currentJBCPrice > 0 && reserveInfo.mc !== "0" && reserveInfo.jbc !== "0" && (
        <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/40 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-400 mb-1">💱 当前汇率信息</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-blue-800/30 rounded-lg p-3">
                  <div className="text-xs text-blue-400 mb-1">JBC 价格</div>
                  <div className="font-bold text-blue-300">1 JBC = {formatPrice(currentJBCPrice)} MC</div>
                </div>
                <div className="bg-blue-800/30 rounded-lg p-3">
                  <div className="text-xs text-blue-400 mb-1">MC 储备</div>
                  <div className="font-bold text-blue-300">{formatMC(reserveInfo.mc, 2)}</div>
                </div>
                <div className="bg-blue-800/30 rounded-lg p-3">
                  <div className="text-xs text-blue-400 mb-1">JBC 储备</div>
                  <div className="font-bold text-blue-300">{formatJBC(reserveInfo.jbc, 2)}</div>
                </div>
              </div>
              <p className="text-xs text-blue-400 mt-2">
                💡 静态奖励按 50% MC + 50% JBC (等值) 分配，JBC 数量根据当前汇率计算
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 待领取奖励提示 */}
      {viewMode === "self" && (pendingRewards.mc > 0 || pendingRewards.jbc > 0) && (
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Pickaxe className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-400 mb-1">{ui.pendingRewards || "有待领取的静态奖励！"}</h3>
              
              {/* 50/50 分配说明 */}
              <div className="bg-green-900/20 rounded-lg p-3 mb-2 border border-green-500/20">
                <div className="text-sm text-green-300 mb-2">
                  <span className="font-semibold">📊 分配机制:</span> 50% MC + 50% JBC (按当前汇率计算)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-800/30 rounded-lg p-2">
                    <div className="text-xs text-green-400 mb-1">MC 部分 (50%)</div>
                    <div className="font-bold text-green-300">{formatMC(pendingRewards.mc)}</div>
                  </div>
                  <div className="bg-yellow-800/30 rounded-lg p-2">
                    <div className="text-xs text-yellow-400 mb-1">JBC 部分 (50%)</div>
                    <div className="font-bold text-yellow-300">{formatJBC(pendingRewards.jbc)}</div>
                  </div>
                </div>
                
                {/* 当前汇率显示 */}
                {currentJBCPrice > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <div className="text-xs text-green-400">
                      💱 当前汇率: 1 JBC = {formatPrice(currentJBCPrice)} MC
                    </div>
                    <div className="text-xs text-green-400">
                      💰 总价值: {formatTotalValue(pendingRewards.mc, pendingRewards.jbc, currentJBCPrice)} MC
                    </div>
                  </div>
                )}
                
                {/* 流动性池信息 */}
                {reserveInfo.mc !== "0" && reserveInfo.jbc !== "0" && (
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <div className="text-xs text-green-400">
                      🏊 流动性池: {formatMC(reserveInfo.mc, 2)} / {formatJBC(reserveInfo.jbc, 2)}
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-green-400 mt-1">
                💡 {ui.claimHint || "请前往挖矿页面点击'领取收益'按钮来领取您的静态奖励"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.href = '#/mining'}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {ui.goToClaim || "去领取"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 无奖励状态提示 */}
      {viewMode === "self" && pendingRewards.mc === 0 && pendingRewards.jbc === 0 && records.length === 0 && !loading && (
        <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/40 rounded-xl p-4 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-400 mb-1">{ui.noStakingTitle || "暂无静态奖励"}</h3>
              <p className="text-sm text-blue-300">
                {ui.noStakingDesc || "您还没有进行质押或质押时间不足。静态奖励需要先购买门票并进行质押。"}
              </p>
              <p className="text-xs text-blue-400 mt-1">
                💡 {ui.stakingHint || "前往挖矿页面购买门票并进行质押来获得静态奖励"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (onNavigateToMining) {
                    onNavigateToMining();
                  } else {
                    // 降级方案：使用自定义事件通知父组件
                    const event = new CustomEvent('navigateToMining');
                    window.dispatchEvent(event);
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {ui.goToStake || "去质押"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-5 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.totalMc || "Total MC Rewards"}</div>
          <div className="text-2xl font-bold text-neon-400 drop-shadow-lg">{formatMC(totals.mc)}</div>
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-5 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.totalJbc || "Total JBC Rewards"}</div>
          <div className="text-2xl font-bold text-amber-400 drop-shadow-lg">{formatJBC(totals.jbc)}</div>
        </div>
      </div>

      {/* 24h Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.staticReward || "Static Reward"} (24h)</div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-neon-400 drop-shadow-md">{formatMC(dailyStats.static.mc, 2)}</div>
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{formatJBC(dailyStats.static.jbc, 2)}</div>
            
            {/* 显示总价值 */}
            {currentJBCPrice > 0 && (dailyStats.static.mc > 0 || dailyStats.static.jbc > 0) && (
              <div className="text-sm text-gray-400 mt-2 pt-2 border-t border-gray-600/50">
                💰 总价值: {formatTotalValue(dailyStats.static.mc, dailyStats.static.jbc, currentJBCPrice)} MC
              </div>
            )}
            
            {/* 50/50 机制说明 */}
            {(dailyStats.static.mc > 0 || dailyStats.static.jbc > 0) && (
              <div className="text-xs text-gray-500 mt-1">
                📊 50% MC + 50% JBC 分配
              </div>
            )}
          </div>
          
          {/* 显示待领取的静态奖励 */}
          {viewMode === "self" && (pendingRewards.mc > 0 || pendingRewards.jbc > 0) && (
            <div className="mt-2 pt-2 border-t border-gray-600/50">
              <div className="text-xs text-gray-400 mb-1">待领取 (Pending)</div>
              <div className="text-sm font-bold text-green-400">+{formatMC(pendingRewards.mc)}</div>
              <div className="text-sm font-bold text-yellow-400">+{formatJBC(pendingRewards.jbc)}</div>
              {currentJBCPrice > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  价值: +{formatTotalValue(pendingRewards.mc, pendingRewards.jbc, currentJBCPrice)} MC
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.directReward || "Direct Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{formatMC(dailyStats.direct.mc, 2)}</div>
          {dailyStats.direct.jbc > 0 && (
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{formatJBC(dailyStats.direct.jbc, 2)}</div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2">{ui.levelReward || "Level Reward"} (24h)</div>
          <div className="text-lg font-bold text-neon-400 drop-shadow-md">{formatMC(dailyStats.level.mc, 2)}</div>
          {dailyStats.level.jbc > 0 && (
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{formatJBC(dailyStats.level.jbc, 2)}</div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
          <div className="text-sm text-gray-200 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {ui.differentialReward || "Differential Reward"} (24h)
            <span className="px-2 py-0.5 bg-gradient-to-r from-neon-500/20 to-amber-500/20 text-xs rounded-full border border-neon-500/30">
              50% MC + 50% JBC
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-neon-400 drop-shadow-md">{formatMC(dailyStats.differential.mc)}</div>
            <div className="text-lg font-bold text-amber-400 drop-shadow-md">{formatJBC(dailyStats.differential.jbc)}</div>
            
            {/* 显示总价值 */}
            {currentJBCPrice > 0 && (dailyStats.differential.mc > 0 || dailyStats.differential.jbc > 0) && (
              <div className="text-sm text-gray-400 mt-2 pt-2 border-t border-gray-600/50">
                💰 总价值: {formatTotalValue(dailyStats.differential.mc, dailyStats.differential.jbc, currentJBCPrice)} MC
              </div>
            )}
          </div>
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
                        {/* 静态奖励特殊显示 */}
                        {row.rewardType === 0 && (parseFloat(row.mcAmount) > 0 || parseFloat(row.jbcAmount) > 0) && (
                          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/50">
                            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                              <Pickaxe className="w-3 h-3" />
                              静态奖励 - 50% MC + 50% JBC 分配
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-neon-500/10 rounded p-2">
                                <div className="text-xs text-neon-400">MC 部分 (50%)</div>
                                <div className="font-semibold text-neon-400">{formatMC(row.mcAmount)} MC</div>
                              </div>
                              <div className="bg-amber-500/10 rounded p-2">
                                <div className="text-xs text-amber-400">JBC 部分 (50%)</div>
                                <div className="font-semibold text-amber-400">{formatJBC(row.jbcAmount)} JBC</div>
                              </div>
                            </div>
                            {currentJBCPrice > 0 && (
                              <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600/30">
                                💰 总价值: {formatTotalValue(row.mcAmount, row.jbcAmount, currentJBCPrice)} MC
                                <span className="ml-2">💱 汇率: 1 JBC = {formatPrice(currentJBCPrice)} MC</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 級差獎勵特殊顯示 */}
                        {row.rewardType === 4 && (parseFloat(row.mcAmount) > 0 || parseFloat(row.jbcAmount) > 0) && (
                          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-600/50">
                            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              級差獎勵 - 50% MC + 50% JBC 分配
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-neon-500/10 rounded p-2">
                                <div className="text-xs text-neon-400">MC 部分 (50%)</div>
                                <div className="font-semibold text-neon-400">{formatMC(row.mcAmount)} MC</div>
                              </div>
                              <div className="bg-amber-500/10 rounded p-2">
                                <div className="text-xs text-amber-400">JBC 部分 (50%)</div>
                                <div className="font-semibold text-amber-400">{formatJBC(row.jbcAmount)} JBC</div>
                              </div>
                            </div>
                            {currentJBCPrice > 0 && (
                              <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600/30">
                                💰 总价值: {formatTotalValue(row.mcAmount, row.jbcAmount, currentJBCPrice)} MC
                                <span className="ml-2">💱 汇率: 1 JBC = {formatPrice(currentJBCPrice)} MC</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 非級差獎勵的常規顯示 */}
                        {row.rewardType !== 0 && row.rewardType !== 4 && (
                          <>
                            {parseFloat(row.mcAmount) > 0 && (
                              <p className="text-sm text-gray-200">
                                {ui.mcAmount || "MC Reward"}:{" "}
                                <span className="font-semibold text-neon-400 drop-shadow-sm">{formatMC(row.mcAmount)}</span>
                              </p>
                            )}
                            {parseFloat(row.jbcAmount) > 0 && (
                              <p className="text-sm text-gray-200">
                                {ui.jbcAmount || "JBC Reward"}:{" "}
                                <span className="font-semibold text-amber-400 drop-shadow-sm">{formatJBC(row.jbcAmount)}</span>
                              </p>
                            )}
                          </>
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
                          {formatDateTime(row.timestamp)}
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
                        <span>{formatDateTime(row.timestamp).split(' ')[0]}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-neon-500/20 text-neon-300">
                          {t.history.confirmed || "Confirmed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {/* 静态奖励特殊显示 */}
                    {row.rewardType === 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-400 mb-1">50% MC + 50% JBC</div>
                        {parseFloat(row.mcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-neon-400">+{formatMC(row.mcAmount, 2)} MC</p>
                        )}
                        {parseFloat(row.jbcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-amber-400">+{formatJBC(row.jbcAmount, 2)} JBC</p>
                        )}
                        {currentJBCPrice > 0 && (
                          <div className="text-xs text-gray-500">
                            ≈ {formatTotalValue(row.mcAmount, row.jbcAmount, currentJBCPrice, 2)} MC
                          </div>
                        )}
                      </div>
                    ) : row.rewardType === 4 ? (
                      /* 級差獎勵特殊顯示 */
                      <div className="space-y-1">
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          50% MC + 50% JBC
                        </div>
                        {parseFloat(row.mcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-neon-400">+{formatMC(row.mcAmount, 2)} MC</p>
                        )}
                        {parseFloat(row.jbcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-amber-400">+{formatJBC(row.jbcAmount, 2)} JBC</p>
                        )}
                        {currentJBCPrice > 0 && (
                          <div className="text-xs text-gray-500">
                            ≈ {formatTotalValue(row.mcAmount, row.jbcAmount, currentJBCPrice, 2)} MC
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {parseFloat(row.mcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-neon-400">+{formatMC(row.mcAmount, 2)} MC</p>
                        )}
                        {parseFloat(row.jbcAmount) > 0 && (
                          <p className="text-sm text-right font-semibold text-amber-400">+{formatJBC(row.jbcAmount, 2)} JBC</p>
                        )}
                      </div>
                    )}
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
                <div className="text-sm text-gray-200 uppercase font-mono tracking-wider">
                  {selectedRecord.rewardType === 0 ? "静态奖励分配 (50% MC + 50% JBC)" : 
                   selectedRecord.rewardType === 4 ? "級差奖励分配 (50% MC + 50% JBC)" : 
                   (ui.mcAmount || "Reward Amount")}
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  {(selectedRecord.rewardType === 0 || selectedRecord.rewardType === 4) ? (
                    /* 静态奖励和級差獎勵特殊显示 */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-neon-500/10 rounded-lg p-3 border border-neon-500/20">
                          <div className="text-xs text-neon-400 mb-1">MC 部分 (50%)</div>
                          <div className="font-bold text-neon-400 text-lg">{formatAmount(selectedRecord.mcAmount)}</div>
                        </div>
                        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                          <div className="text-xs text-amber-400 mb-1">JBC 部分 (50%)</div>
                          <div className="font-bold text-amber-400 text-lg">{formatAmount(selectedRecord.jbcAmount)}</div>
                        </div>
                      </div>
                      {currentJBCPrice > 0 && (
                        <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50">
                          <div className="text-xs text-gray-400 mb-2">价值计算</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-300">MC 价值:</span>
                              <span className="text-neon-400">{formatMC(selectedRecord.mcAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">JBC 价值:</span>
                              <span className="text-amber-400">{(parseFloat(selectedRecord.jbcAmount) * currentJBCPrice).toFixed(4)} MC</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-gray-600 pt-1">
                              <span className="text-gray-200">总价值:</span>
                              <span className="text-green-400">{(parseFloat(selectedRecord.mcAmount) + parseFloat(selectedRecord.jbcAmount) * currentJBCPrice).toFixed(4)} MC</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            汇率: 1 JBC = {currentJBCPrice.toFixed(6)} MC
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 非静态奖励常规显示 */
                    <div>
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
