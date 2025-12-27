import React, { useState, useEffect } from "react"
import { Ticket, ArrowLeft, Wallet, AlertCircle, CheckCircle } from "lucide-react"
import { useLanguage } from "../LanguageContext"
import { useWeb3 } from "../Web3Context"
import { ethers } from "ethers"
import toast from "react-hot-toast"
import { formatContractError } from "../utils/errorFormatter"
import { useGlobalRefresh } from "../hooks/useGlobalRefresh"
import { TICKET_TIERS as CONST_TIERS } from "../constants"

interface BuyTicketPanelProps {
  onBack: () => void
}

const TICKET_TIERS = CONST_TIERS.map(t => t.amount)

const BuyTicketPanel: React.FC<BuyTicketPanelProps> = ({ onBack }) => {
  const { t } = useLanguage()
  const { mcContract, protocolContract, account, isConnected } = useWeb3()
  const { balances, refreshAll } = useGlobalRefresh()
  
  const [selectedTier, setSelectedTier] = useState<number>(100)
  const [isLoading, setIsLoading] = useState(false)
  const [userTicket, setUserTicket] = useState<any>(null)
  const [hasActiveTicket, setHasActiveTicket] = useState(false)
  const [maxTicketAmount, setMaxTicketAmount] = useState<number>(0)
  const [maxSingleTicketAmount, setMaxSingleTicketAmount] = useState<number>(0)

  // 检查用户当前门票状态和历史记录
  useEffect(() => {
    const checkTicketStatus = async () => {
      if (protocolContract && account) {
        try {
          const [ticket, userInfo] = await Promise.all([
            protocolContract.userTicket(account),
            protocolContract.userInfo(account)
          ])

          // 获取单张最高记录 (从userInfo获取)
          let maxSingle = 0
          if (userInfo.maxSingleTicketAmount) {
             maxSingle = parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
          }
          setMaxSingleTicketAmount(maxSingle)
          
          setUserTicket(ticket)
          
          // 检查是否有活跃门票
          const hasActive = ticket.amount > 0 && !ticket.isRedeemed
          setHasActiveTicket(hasActive)

          // 获取历史最大门票金额
          if (userInfo && userInfo.maxTicketAmount) {
             setMaxTicketAmount(parseFloat(ethers.formatEther(userInfo.maxTicketAmount)))
          }
        } catch (err) {
          console.error("Failed to check ticket status", err)
        }
      }
    }
    
    checkTicketStatus()
  }, [protocolContract, account])

  // 计算实际需要的流动性（逻辑C：基于历史单张最高）
  // 优先使用 maxSingleTicketAmount，如果没有则回退到 userInfo.maxTicketAmount (如果它是标准Tier)
  const effectiveHistoryMax = maxSingleTicketAmount > 0 
    ? maxSingleTicketAmount 
    : (TICKET_TIERS.includes(maxTicketAmount) ? maxTicketAmount : 0)
  
  const baseAmount = Math.max(selectedTier, effectiveHistoryMax)
  
  const requiredLiquidity = baseAmount * 1.5
  const isHigherLiquidity = baseAmount > selectedTier

  const handleBuyTicket = async () => {
    if (!protocolContract || !mcContract || !account) {
      toast.error("请先连接钱包")
      return
    }

    const amountWei = ethers.parseEther(selectedTier.toString())
    
    // 检查余额
    if (parseFloat(balances.mc) < selectedTier) {
      toast.error(`${t.mining.insufficientMC} ${t.mining.needsMC} ${selectedTier} MC, ${t.mining.currentBalance}: ${parseFloat(balances.mc).toFixed(2)} MC`)
      return
    }

    setIsLoading(true)
    
    try {
      // 检查授权
      const allowance = await mcContract.allowance(account, await protocolContract.getAddress())
      if (allowance < amountWei) {
        toast.error(t.mining.needApprove)
        setIsLoading(false)
        return
      }

      // 购买门票
      const tx = await protocolContract.buyTicket(amountWei)
      await tx.wait()
      
      toast.success(t.mining.ticketBuySuccess)
      
      // 刷新数据
      await refreshAll()
      
      // 重新检查门票状态
      const newTicket = await protocolContract.userTicket(account)
      setUserTicket(newTicket)
      setHasActiveTicket(newTicket.amount > 0 && !newTicket.isRedeemed)
      
    } catch (err: any) {
      console.error("Buy ticket failed", err)
      toast.error(formatContractError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!mcContract || !protocolContract || !account) return
    
    setIsLoading(true)
    try {
      const tx = await mcContract.approve(await protocolContract.getAddress(), ethers.MaxUint256)
      await tx.wait()
      toast.success(t.mining.approveSuccess)
    } catch (err: any) {
      console.error("Approve failed", err)
      toast.error(formatContractError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const checkNeedsApproval = async () => {
    if (!mcContract || !protocolContract || !account) return true
    
    try {
      const amountWei = ethers.parseEther(selectedTier.toString())
      const allowance = await mcContract.allowance(account, await protocolContract.getAddress())
      return allowance < amountWei
    } catch {
      return true
    }
  }

  const [needsApproval, setNeedsApproval] = useState(true)

  useEffect(() => {
    const checkApproval = async () => {
      const needs = await checkNeedsApproval()
      setNeedsApproval(needs)
    }
    checkApproval()
  }, [selectedTier, mcContract, protocolContract, account])

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Ticket className="text-neon-400" size={32} />
            {t.stats.buyTicket}
          </h1>
          <p className="text-gray-400 mt-1">选择门票金额开始您的 DeFi 4.0 挖矿之旅</p>
        </div>
      </div>

      {/* 当前门票状态 - 仅作为信息显示 */}
      {hasActiveTicket && userTicket && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-blue-400" size={20} />
            <div>
              <h3 className="font-bold text-blue-400">当前门票信息</h3>
              <p className="text-blue-300 text-sm">
                当前门票金额: {ethers.formatEther(userTicket.amount)} MC
              </p>
              <p className="text-blue-300 text-sm">
                您可以继续购买新门票，新门票将覆盖当前门票
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 余额显示 */}
      <div className="bg-black/60 border border-gray-700 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="text-neon-400" size={20} />
            <span className="text-gray-300">MC 余额</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {parseFloat(balances.mc).toLocaleString()} MC
          </span>
        </div>
      </div>

      {/* 门票选择 */}
      <div className="bg-black/60 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Ticket className="text-neon-400" size={24} />
          选择门票金额
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {TICKET_TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedTier === tier
                  ? "border-neon-500 bg-neon-500/10 text-neon-400"
                  : "border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500"
              }`}
            >
              <div className="text-2xl font-bold">{tier}</div>
              <div className="text-sm opacity-80">MC</div>
            </button>
          ))}
        </div>

        {/* 门票信息 */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-white mb-3">门票详情</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">门票金额:</span>
              <span className="text-white font-bold">{selectedTier} MC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">需要流动性:</span>
              <span className={`font-bold ${isHigherLiquidity ? 'text-amber-400' : 'text-white'}`}>
                {requiredLiquidity} MC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">有效期:</span>
              <span className="text-white">72 小时</span>
            </div>
          </div>
          
          {isHigherLiquidity && (
            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
              <div className="font-bold flex items-center gap-1 mb-1">
                <AlertCircle size={12} />
                注意：流动性要求提高
              </div>
              检测到您历史购买过更高额度门票（{effectiveHistoryMax} MC）。根据协议规则，您需要按照历史最高门票金额的1.5倍提供流动性。
            </div>
          )}
        </div>

        {/* 重要提示 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-400 mb-2">重要提示</h3>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• 门票购买后需在 72 小时内提供流动性</li>
            <li>• 流动性金额为门票金额（或历史最高）的 1.5 倍</li>
            <li>• 超时未提供流动性的门票将自动过期</li>
            <li>• 门票费用不可退还</li>
            <li>• 购买新门票将覆盖当前未完成的门票</li>
          </ul>
        </div>

        {/* 操作按钮 */}
        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">请先连接钱包</p>
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? "授权中..." : `第一步: 授权 ${selectedTier} MC`}
          </button>
        ) : (
          <button
            onClick={handleBuyTicket}
            disabled={isLoading || parseFloat(balances.mc) < selectedTier}
            className="w-full py-4 bg-gradient-to-r from-neon-500 to-neon-600 hover:from-neon-400 hover:to-neon-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Ticket size={20} />
            {isLoading ? "购买中..." : `购买 ${selectedTier} MC 门票`}
          </button>
        )}
      </div>

      {/* 购买成功后的提示 */}
      {hasActiveTicket && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" size={20} />
            <div>
              <h3 className="font-bold text-green-400">门票购买成功！</h3>
              <p className="text-green-300 text-sm">
                请前往挖矿页面在 72 小时内完成流动性提供
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuyTicketPanel