import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../src/LanguageContext';
import { useWeb3, CONTRACT_ADDRESSES } from '../src/Web3Context';
import { useGlobalRefresh, useEventRefresh } from '../hooks/useGlobalRefresh';
import { useRealTimePrice } from '../hooks/useRealTimePrice';
import { ArrowLeftRight, RotateCw, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatContractError } from '../utils/errorFormatter';
import { SwapErrorHandler, SwapValidationResult } from '../utils/swapErrorHandler';
import SwapErrorModal from './SwapErrorModal';
import SwapValidationAlert from './SwapValidationAlert';
import AdminLiquidityPanel from './AdminLiquidityPanel';
import DailyBurnPanel from './DailyBurnPanel';
import { SkeletonSwapPanel } from './LoadingSkeletons';
import ToastEnhancer from '../utils/toastEnhancer';
import AnimatedButton from './AnimatedButton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 价格数据点类型定义
interface PriceDataPoint {
  name: string;
  uv: number;
  ema?: number;
  high: number;
  low: number;
  change: number;
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

// Memoized Chart Component
const MemoizedPriceChart = React.memo(({ priceHistory, t }: { priceHistory: PriceDataPoint[], t: any }) => {
  console.log('📈 [MemoizedPriceChart] 渲染图表，数据点数量:', priceHistory.length);
  
  if (!priceHistory || priceHistory.length === 0) {
    console.warn('⚠️ [MemoizedPriceChart] 价格历史数据为空，显示占位符');
    return (
      <div className="h-[200px] sm:h-[300px] md:h-[400px] w-full flex items-center justify-center bg-gray-900/50 rounded border border-gray-700">
        <p className="text-gray-400 text-sm">暂无价格数据</p>
      </div>
    );
  }
  
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
            labelFormatter={(label) => `时间: ${label}`}
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
                    价格: <span className="text-neon-400 font-mono">${payload.uv.toFixed(6)}</span>
                  </p>
                  {payload.ema && (
                    <p className="text-gray-300">
                      EMA(7): <span className="text-amber-400 font-mono">${payload.ema.toFixed(6)}</span>
                    </p>
                  )}
                  {payload.high && (
                    <p className="text-gray-300">
                      范围: <span className="text-gray-400 font-mono">${payload.low.toFixed(6)}~${payload.high.toFixed(6)}</span>
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
            name="价格"
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
});

const SwapPanel: React.FC = () => {
  const { t } = useLanguage();
  const { jbcContract, protocolContract, account, isConnected, provider, hasReferrer, isOwner, mcBalance } = useWeb3();
  
  // 使用全局刷新机制
  const { balances, priceData, onTransactionSuccess } = useGlobalRefresh();
  
  // 使用实时价格更新（用于价格图表）
  const { priceHistory: rawPriceHistory, priceStats, currentPrice } = useRealTimePrice();
  
  // 格式化价格历史数据用于图表显示
  const priceHistory: PriceDataPoint[] = useMemo(() => {
    if (rawPriceHistory.length === 0) {
      return generateMockPriceData()
    }

    // 转换实时价格数据为图表格式
    const formatted = rawPriceHistory.map((point: any) => {
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
    
    return formatted;
  }, [rawPriceHistory])
  
  const [payAmount, setPayAmount] = useState('');
  const [getAmount, setGetAmount] = useState('');
  const [isSelling, setIsSelling] = useState(false); // false = Buy JBC (Pay MC), true = Sell JBC (Pay JBC)
  const [poolMC, setPoolMC] = useState<string>('0.0');
  const [poolJBC, setPoolJBC] = useState<string>('0.0');
  const [isLoading, setIsLoading] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  
  // Enhanced loading states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingPoolData, setIsLoadingPoolData] = useState(false);
  
  // 新增状态：错误处理和验证
  const [validationResult, setValidationResult] = useState<SwapValidationResult>({ isValid: true });
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState({ title: '', message: '', suggestion: '' });
  
  // 授权相关状态
  const [approvalStatus, setApprovalStatus] = useState<{
    isApproved: boolean;
    isChecking: boolean;
    isApproving: boolean;
  }>({ isApproved: false, isChecking: false, isApproving: false });

  // 价格波动检测
  const [priceImpact, setPriceImpact] = useState<{
    currentPrice: number;
    expectedPrice: number;
    priceChange: number;
    isHighImpact: boolean;
    tradeRatio?: number; // 交易金额占池子的比例
    showWarning?: boolean; // 是否显示警告
  } | null>(null);

  // 从全局状态和原生余额获取余额
  const balanceMC = mcBalance ? ethers.formatEther(mcBalance) : '0';
  const balanceJBC = balances.jbc;

  // 监听池子数据变化事件
  useEventRefresh('poolDataChanged', () => {
    fetchPoolData();
  });

  // 提取池子数据获取逻辑
  const fetchPoolData = async () => {
    if (protocolContract) {
        setIsLoadingPoolData(true);
        try {
            const poolMcBal = await protocolContract.swapReserveMC();
            const poolMcFormatted = ethers.formatEther(poolMcBal);
            setPoolMC(poolMcFormatted);

            const poolJbcBal = await protocolContract.swapReserveJBC();
            const poolJbcFormatted = ethers.formatEther(poolJbcBal);
            setPoolJBC(poolJbcFormatted);
            
            // 计算 LP 总量
            const mcAmount = parseFloat(poolMcFormatted);
            const jbcAmount = parseFloat(poolJbcFormatted);
            const totalLpTokens = mcAmount + jbcAmount;
            
            // 数据加载成功，不显示错误提醒
        } catch (error) {
            console.error('Failed to load pool data:', error);
            ToastEnhancer.error('Failed to load pool data. Please refresh the page.');
        } finally {
            setIsLoadingPoolData(false);
        }
    } else {
        // protocolContract not initialized
    }
  };

  // 提取余额获取逻辑为独立函数，方便在交易后刷新
  const fetchBalances = async () => {
    // 池子数据获取
    await fetchPoolData();

    // 用户余额现在从全局状态获取，无需单独获取
  };

  useEffect(() => {
    const initializeSwapPanel = async () => {
      setIsInitializing(true);
      await fetchBalances();
      setIsInitializing(false);
    };
    
    initializeSwapPanel();
    const interval = setInterval(fetchPoolData, 30000); // 只刷新池子数据，余额由全局状态管理
    return () => clearInterval(interval);
  }, [isConnected, account, jbcContract, protocolContract, provider]);

  // Debounce effect for calculating estimate and validation
  // 调试：验证价格同步（与首页同步）
  useEffect(() => {
    console.log('💱 [SwapPanel] JBC价格更新:', {
      price: parseFloat(priceData.jbcPrice.toString()).toFixed(6),
      source: 'useGlobalRefresh',
      timestamp: priceData.lastUpdated
    });
  }, [priceData.jbcPrice, priceData.lastUpdated]);

  useEffect(() => {
    const timer = setTimeout(() => {
      calculateEstimate(payAmount);
      validateSwap(payAmount);
      checkApprovalStatus(payAmount);
    }, 1000);

    return () => clearTimeout(timer);
  }, [payAmount, isSelling, poolMC, poolJBC, balanceMC, balanceJBC]);

  // 验证兑换条件
  const validateSwap = async (amount: string) => {
    if (!amount || !protocolContract || !account) {
      setValidationResult({ isValid: true });
      return;
    }

    const result = await SwapErrorHandler.validateSwapConditions(
      amount,
      isSelling,
      balanceMC,
      balanceJBC,
      poolMC,
      poolJBC,
      null, // mcContract no longer needed for native MC
      jbcContract,
      protocolContract,
      account
    );

    setValidationResult(result);
  };

  // 检查授权状态 - 只检查JBC，原生MC不需要授权
  const checkApprovalStatus = async (amount: string) => {
    if (!amount || !protocolContract || !account) {
      setApprovalStatus({ isApproved: false, isChecking: false, isApproving: false });
      return;
    }

    // 原生MC不需要授权
    if (!isSelling) {
      setApprovalStatus({ isApproved: true, isChecking: false, isApproving: false });
      return;
    }

    setApprovalStatus(prev => ({ ...prev, isChecking: true }));

    try {
      // 只检查JBC授权
      if (jbcContract) {
        const allowance = await jbcContract.allowance(account, CONTRACT_ADDRESSES.PROTOCOL);
        const requiredAmount = ethers.parseEther(amount);
        const isApproved = allowance >= requiredAmount;
        
        setApprovalStatus({ 
          isApproved, 
          isChecking: false, 
          isApproving: false 
        });
      }
    } catch (error) {
      console.error('检查授权状态失败:', error);
      setApprovalStatus({ isApproved: false, isChecking: false, isApproving: false });
    }
  };

  // 单独的授权函数
  const handleApproval = async () => {
    if (!protocolContract || !payAmount) return;

    setApprovalStatus(prev => ({ ...prev, isApproving: true }));

    try {
      // 原生MC不需要授权，只有JBC需要授权
      if (isSelling && jbcContract) {
        const tokenName = 'JBC';
        
        toast.loading(`正在授权${tokenName}代币...`, { id: 'approve' });
        const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
        await approveTx.wait();
        toast.success(`${tokenName}授权成功！`, { id: 'approve' });
        
        // 重新检查授权状态
        await checkApprovalStatus(payAmount);
      } else if (!isSelling) {
        // MC→JBC 不需要授权，直接设置为已授权
        setApprovalStatus({ isApproved: true, isChecking: false, isApproving: false });
        toast.success('原生MC无需授权！', { id: 'approve' });
      }
    } catch (error: any) {
      console.error('授权失败:', error);
      toast.error('授权失败，请重试', { id: 'approve' });
      
      const errorDetails = SwapErrorHandler.formatSwapError(error);
      setErrorDetails({
        title: '授权失败',
        message: errorDetails.message,
        suggestion: errorDetails.suggestion
      });
      setShowErrorModal(true);
    } finally {
      setApprovalStatus(prev => ({ ...prev, isApproving: false }));
    }
  };

  const handleSwap = async () => {
      if (!protocolContract || !payAmount) return;
      
      // 预验证 - 更新为原生MC验证
      const validation = await SwapErrorHandler.validateSwapConditions(
        payAmount,
        isSelling,
        balanceMC,
        balanceJBC,
        poolMC,
        poolJBC,
        null, // mcContract no longer needed for native MC
        jbcContract,
        protocolContract,
        account
      );

      if (!validation.isValid) {
        const errorDetails = SwapErrorHandler.formatSwapError({ message: validation.error });
        setErrorDetails({
          title: errorDetails.title,
          message: validation.error || errorDetails.message,
          suggestion: validation.suggestion || errorDetails.suggestion
        });
        setShowErrorModal(true);
        return;
      }

      // 检查授权状态 - 只有JBC需要授权，原生MC不需要
      if (isSelling && !approvalStatus.isApproved) {
        ToastEnhancer.error('请先授权JBC代币使用权限');
        return;
      }

      setIsLoading(true);
      try {
          const amount = ethers.parseEther(payAmount);
          let tx;

          if (isSelling) {
              // Sell JBC -> SwapJBCToMC (保持不变)
              ToastEnhancer.transaction.pending('正在执行JBC兑换...', 'swap');
              tx = await protocolContract.swapJBCToMC(amount);
          } else {
              // Buy JBC -> SwapMCToJBC (使用原生MC - payable)
              ToastEnhancer.transaction.pending('正在执行MC兑换...', 'swap');
              
              // 检查原生MC余额和Gas费用
              const currentMcBalance = mcBalance || 0n;
              if (currentMcBalance < amount) {
                ToastEnhancer.error(`MC余额不足，需要 ${payAmount} MC`);
                return;
              }
              
              // 估算Gas费用
              try {
                const gasEstimate = await protocolContract.swapMCToJBC.estimateGas({ value: amount });
                const feeData = await provider.getFeeData();
                const gasCost = gasEstimate * (feeData.gasPrice || 0n);
                const totalRequired = amount + gasCost;
                
                if (currentMcBalance < totalRequired) {
                  const shortfall = ethers.formatEther(totalRequired - currentMcBalance);
                  ToastEnhancer.error(`余额不足，还需要 ${shortfall} MC 作为Gas费用`);
                  return;
                }
              } catch (error) {
                console.warn("Gas estimation failed, proceeding anyway:", error);
              }
              
              // 执行原生MC交换
              tx = await protocolContract.swapMCToJBC({ value: amount });
          }
          
          await tx.wait();
          ToastEnhancer.transaction.success("兑换成功！", 'swap');
          setPayAmount('');
          setGetAmount('');
          setValidationResult({ isValid: true });
          setApprovalStatus({ isApproved: false, isChecking: false, isApproving: false });
          
          // 使用全局刷新机制
          await onTransactionSuccess('swap');
      } catch (err: any) {
          console.error('兑换失败:', err);
          
          const errorDetails = SwapErrorHandler.formatSwapError(err);
          ToastEnhancer.transaction.error(errorDetails.message, 'swap');
          setErrorDetails(errorDetails);
          setShowErrorModal(true);
      } finally {
          setIsLoading(false);
      }
  };

  const calculateEstimate = (val: string) => {
      if (!val) {
          setGetAmount('');
          setPriceImpact(null);
          return;
      }
      
      const amount = parseFloat(val);
      if (isNaN(amount) || amount <= 0) {
          setGetAmount('');
          setPriceImpact(null);
          return;
      }

      const rMc = parseFloat(poolMC);
      const rJbc = parseFloat(poolJBC);

      if (rMc <= 0 || rJbc <= 0) {
          setGetAmount('');
          setPriceImpact(null);
          return;
      }

      // 计算当前价格
      const currentPrice = rMc / rJbc;

      let received = 0;
      let newReserveMC = rMc;
      let newReserveJBC = rJbc;

      // AMM Formula: dy = (y * dx) / (x + dx)
      // x = ReserveIn, y = ReserveOut, dx = AmountIn
      
      if (isSelling) {
          // Sell JBC (Input JBC) -> Get MC
          // 1. Tax 25% on Input
          const tax = amount * 0.25;
          const amountToSwap = amount - tax;
          
          // 2. AMM Swap (Input JBC, Output MC)
          // ReserveIn = JBC Pool, ReserveOut = MC Pool
              received = (amountToSwap * rMc) / (rJbc + amountToSwap);
          
          // 计算交易后的池子储备
          newReserveMC = rMc - received;
          newReserveJBC = rJbc + amountToSwap;
      } else {
          // Buy JBC (Input MC) -> Get JBC
          // 1. AMM Swap (Input MC, Output JBC)
          // ReserveIn = MC Pool, ReserveOut = JBC Pool
          const outPreTax = (amount * rJbc) / (rMc + amount);
          
          // 2. Tax 50% on Output
          const tax = outPreTax * 0.50;
          received = outPreTax - tax;
          
          // 计算交易后的池子储备
          newReserveMC = rMc + amount;
          newReserveJBC = rJbc - outPreTax;
      }
      
      setGetAmount(received.toFixed(4));

      // 计算交易后的预期价格
      const expectedPrice = newReserveMC / newReserveJBC;
      const priceChange = ((expectedPrice - currentPrice) / currentPrice) * 100;
      
      // 计算交易金额占池子的比例
      let tradeRatio = 0;
      if (isSelling) {
          // 卖出JBC，计算输入JBC占池子JBC的比例
          tradeRatio = (amount / rJbc) * 100;
      } else {
          // 买入JBC，计算输入MC占池子MC的比例
          tradeRatio = (amount / rMc) * 100;
      }
      
      // 动态调整阈值：小额交易（<0.1%池子）不显示警告，中等交易（0.1%-1%）显示提示，大额交易（>1%）显示警告
      // 价格变化阈值也根据交易规模调整
      let isHighImpact = false;
      let showWarning = true;
      
      if (tradeRatio < 0.1) {
          // 极小交易（<0.1%池子），价格影响应该很小，不显示警告
          showWarning = Math.abs(priceChange) > 0.5; // 只有价格变化>0.5%才显示
          isHighImpact = Math.abs(priceChange) > 1; // 价格变化>1%才视为高影响
      } else if (tradeRatio < 1) {
          // 小额交易（0.1%-1%池子）
          showWarning = Math.abs(priceChange) > 0.3;
          isHighImpact = Math.abs(priceChange) > 0.5; // 价格变化>0.5%视为高影响
      } else {
          // 大额交易（>1%池子）
          showWarning = true;
          isHighImpact = Math.abs(priceChange) > 0.3; // 价格变化>0.3%视为高影响
      }

      setPriceImpact({
          currentPrice,
          expectedPrice,
          priceChange,
          isHighImpact,
          tradeRatio,
          showWarning
      });
  };

  const handleInput = (val: string) => {
      // Get current balance based on selling or buying
      const currentBalance = parseFloat(isSelling ? balanceJBC : balanceMC);
      const inputAmount = parseFloat(val);
      
      // Check if input exceeds balance
      if (!isNaN(inputAmount) && inputAmount > currentBalance) {
          toast.error(`Insufficient balance. Max: ${currentBalance.toFixed(4)} ${isSelling ? 'JBC' : 'MC'}`);
          setPayAmount(currentBalance.toString());
          return;
      }
      
      setPayAmount(val);
  };

  const toggleDirection = () => {
      setIsSelling(!isSelling);
      setIsRotated(!isRotated);
      setPayAmount('');
      setGetAmount('');
      setValidationResult({ isValid: true });
      setApprovalStatus({ isApproved: false, isChecking: false, isApproving: false });
  };

  // Show loading skeleton during initialization
  if (isInitializing) {
    return (
      <div className="max-w-md mx-auto mt-4 md:mt-10">
        <SkeletonSwapPanel />
      </div>
    );
  }

  return (
    <>
      {/* 管理员流动性面板 - 只对合约拥有者显示 */}
      {isConnected && isOwner && <AdminLiquidityPanel />}
      
      {/* 管理员每日燃烧面板 - 只对合约拥有者显示 */}
      {isConnected && isOwner && <DailyBurnPanel />}
      
      <div className="max-w-md mx-auto mt-4 md:mt-10 glass-panel p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl relative animate-fade-in bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
        <div className="absolute inset-0 bg-neon-500/5 blur-3xl rounded-full"></div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-center relative z-10 text-white">{t.swap.title}</h2>

        {/* 推荐人提示 - 非管理员且未绑定推荐人时显示 */}
        {isConnected && !hasReferrer && !isOwner && (
          <div className="bg-amber-900/20 border-2 border-amber-500/50 rounded-xl p-4 mb-4 relative z-10 backdrop-blur-sm">
            <p className="text-amber-300 text-sm font-bold text-center">
              ⚠️ {t.referrer.noReferrer}
            </p>
            <p className="text-amber-200/80 text-xs text-center mt-1">
              Please go to Mining panel to bind a referrer first
            </p>
          </div>
        )}

        {/* JBC Price Chart - 移到顶部，交易前显示价格走势 */}
        <div className="glass-panel p-3 sm:p-4 md:p-6 rounded-xl md:rounded-2xl bg-black/60 border border-gray-700 backdrop-blur-sm mb-4 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 md:mb-6">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-white border-l-4 border-neon-500 pl-3">
                    JBC 价格走势
                </h3>
                {priceHistory.length > 1 && (
                    <div className="grid grid-cols-2 sm:flex sm:gap-2 md:gap-4 text-xs md:text-sm gap-2">
                        <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                            <div className="text-gray-300 text-[10px] sm:text-xs font-medium">最高</div>
                            <div className="text-amber-400 font-bold text-xs sm:text-sm font-mono">${priceStats.high.toFixed(6)}</div>
                        </div>
                        <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                            <div className="text-gray-300 text-[10px] sm:text-xs font-medium">最低</div>
                            <div className="text-amber-400 font-bold text-xs sm:text-sm font-mono">${priceStats.low.toFixed(6)}</div>
                        </div>
                        <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                            <div className="text-gray-300 text-[10px] sm:text-xs font-medium">涨跌</div>
                            <div className={`font-bold text-xs sm:text-sm font-mono ${priceStats.change >= 0 ? "text-neon-400" : "text-red-400"}`}>
                                {priceStats.change >= 0 ? "+" : ""}{priceStats.change.toFixed(2)}%
                            </div>
                        </div>
                        <div className="text-center bg-gray-900/70 p-2 sm:p-3 rounded border border-gray-700">
                            <div className="text-gray-300 text-[10px] sm:text-xs font-medium">平均</div>
                            <div className="text-neon-400 font-bold text-xs sm:text-sm font-mono">${priceStats.avgPrice.toFixed(6)}</div>
                        </div>
                    </div>
                )}
            </div>

            <MemoizedPriceChart priceHistory={priceHistory} t={t} />

            {/* Legend */}
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-300">
                <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-neon-500"></div>
                    <span>价格</span>
                </div>
                {priceHistory.length > 5 && (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <div className="w-2 h-0.5 sm:w-3 sm:h-1 bg-amber-400"></div>
                        <span>EMA(7)</span>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-3 md:space-y-4 relative z-10">
            {/* Pay Input */}
            <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-700 transition-all focus-within:ring-2 focus-within:ring-neon-500/50">
                <div className="flex justify-between text-xs md:text-sm text-gray-400 mb-2">
                    <span>{t.swap.pay}</span>
                    <span className="truncate ml-2">{t.swap.balance}: {isSelling ? balanceJBC : balanceMC} {isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => handleInput(e.target.value)}
                        placeholder="0.0"
                        className="bg-transparent text-xl md:text-2xl font-bold focus:outline-none w-full text-white placeholder-gray-600"
                    />
                    <span className={`pl-2 pr-4 md:px-3 py-1 rounded-lg font-bold border shadow-sm text-sm md:text-base whitespace-nowrap flex items-center gap-1 ${isSelling ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-900 text-gray-300 border-gray-700'}`}>
                        {isSelling ? (
                            <>
                                <img src="/mc_chain.png" alt="JBC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                JBC
                            </>
                        ) : (
                            <>
                                <img src="/logo.png" alt="MC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                MC
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-1.5 md:-my-2 relative z-20">
                <button
                    onClick={toggleDirection}
                    className={`bg-gray-900 border-2 border-neon-500 p-1.5 md:p-2 rounded-full text-neon-400 transition-all duration-500 shadow-lg shadow-neon-500/30 hover:shadow-neon-500/50 transform active:scale-95 hover:scale-110 ${isRotated ? 'rotate-180' : ''}`}
                >
                    <ArrowLeftRight size={18} className="md:w-5 md:h-5" />
                </button>
            </div>

            {/* Receive Input */}
            <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-700">
                    <div className="flex justify-between text-xs md:text-sm text-gray-400 mb-2">
                    <span>{t.swap.get}</span>
                    <span className="truncate ml-2">{t.swap.balance}: {!isSelling ? balanceJBC : balanceMC} {!isSelling ? 'JBC' : 'MC'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <input
                        type="text"
                        value={getAmount}
                        disabled
                        placeholder="0.0"
                        className="bg-transparent text-xl md:text-2xl font-bold focus:outline-none w-full text-gray-500 placeholder-gray-700"
                    />
                    <span className={`pl-2 pr-4 md:px-3 py-1 rounded-lg font-bold border shadow-sm text-sm md:text-base whitespace-nowrap flex items-center gap-1 ${!isSelling ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-gray-900 text-gray-300 border-gray-700'}`}>
                        {!isSelling ? (
                            <>
                                <img src="/mc_chain.png" alt="JBC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                JBC
                            </>
                        ) : (
                            <>
                                <img src="/logo.png" alt="MC" className="w-4 h-4 md:w-5 md:h-5 rounded-full" />
                                MC
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Slippage Info */}
            <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg text-xs text-red-300 flex flex-col gap-1 backdrop-blur-sm">
                <div className={`flex justify-between ${isSelling ? 'font-bold' : 'opacity-50'}`}>
                    <span>{t.swap.slipSell}</span>
                    {isSelling && <span>(Active)</span>}
                </div>
                <div className={`flex justify-between ${!isSelling ? 'font-bold' : 'opacity-50'}`}>
                    <span>{t.swap.slipBuy}</span>
                    {!isSelling && <span>(Active)</span>}
                </div>
            </div>

            {/* Pool Liquidity Info */}
            <div className="bg-gray-800/50 p-3 rounded-lg text-xs text-gray-400 border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold flex items-center gap-2">
                        {isLoadingPoolData && <Loader2 className="animate-spin w-3 h-3" />}
                        {t.swap.poolLiquidity}:
                    </span>
                    <div className="flex gap-3">
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-neon-500"></div> 
                            {isLoadingPoolData ? '...' : parseFloat(poolMC).toLocaleString()} MC
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div> 
                            {isLoadingPoolData ? '...' : parseFloat(poolJBC).toLocaleString()} JBC
                        </span>
                    </div>
                </div>
                {/* JBC Price Display - 与首页同步 */}
                <div className="pt-2 border-t border-gray-700/50 flex justify-between items-center">
                    <span className="text-gray-500">JBC 价格:</span>
                    <span className="text-amber-400 font-bold font-mono">
                        1 JBC = {parseFloat(priceData.jbcPrice.toString()).toFixed(6)} MC
                    </span>
                </div>
            </div>

            {/* Price Impact Warning - 价格波动警告 */}
            {priceImpact && payAmount && parseFloat(payAmount) > 0 && priceImpact.showWarning && (
                <div className={`p-3 rounded-lg text-xs border backdrop-blur-sm ${
                    priceImpact.isHighImpact 
                        ? 'bg-red-900/20 border-red-500/30 text-red-300' 
                        : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300'
                }`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold">价格影响:</span>
                        <span className={`font-mono font-bold ${
                            priceImpact.isHighImpact ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                            {priceImpact.priceChange > 0 ? '+' : ''}{priceImpact.priceChange.toFixed(4)}%
                        </span>
                    </div>
                    <div className="text-xs opacity-80 space-y-0.5">
                        <div className="flex justify-between">
                            <span>当前价格:</span>
                            <span className="font-mono">{priceImpact.currentPrice.toFixed(6)} MC</span>
                        </div>
                        <div className="flex justify-between">
                            <span>预期价格:</span>
                            <span className="font-mono">{priceImpact.expectedPrice.toFixed(6)} MC</span>
                        </div>
                        {priceImpact.tradeRatio !== undefined && (
                            <div className="flex justify-between">
                                <span>交易占比:</span>
                                <span className="font-mono">{priceImpact.tradeRatio.toFixed(4)}%</span>
                            </div>
                        )}
                    </div>
                    {priceImpact.isHighImpact && (
                        <div className="mt-2 pt-2 border-t border-red-500/30 text-red-200">
                            ⚠️ 警告：此交易将导致价格波动较大，请谨慎操作
                        </div>
                    )}
                </div>
            )}

            {/* Validation Alert */}
            {!validationResult.isValid && (
              <SwapValidationAlert
                type="error"
                message={validationResult.error || '兑换验证失败'}
                suggestion={validationResult.suggestion}
                className="mb-4"
              />
            )}

            {/* Authorization Status */}
            {payAmount && parseFloat(payAmount) > 0 && (
              <div className={`p-3 rounded-lg border text-sm ${
                approvalStatus.isChecking 
                  ? 'bg-blue-900/20 border-blue-500/30 text-blue-300'
                  : approvalStatus.isApproved 
                    ? 'bg-green-900/20 border-green-500/30 text-green-300'
                    : 'bg-amber-900/20 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {approvalStatus.isChecking ? (
                      <>
                        <RotateCw className="animate-spin w-4 h-4" />
                        <span>检查授权状态...</span>
                      </>
                    ) : approvalStatus.isApproved ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>✅ {isSelling ? 'JBC' : 'MC'} 代币已授权</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span>⚠️ 需要授权 {isSelling ? 'JBC' : 'MC'} 代币</span>
                      </>
                    )}
                  </div>
                  
                  {!approvalStatus.isApproved && !approvalStatus.isChecking && (
                    <button
                      onClick={handleApproval}
                      disabled={approvalStatus.isApproving}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {approvalStatus.isApproving && <RotateCw className="animate-spin w-3 h-3" />}
                      {approvalStatus.isApproving ? '授权中...' : '立即授权'}
                    </button>
                  )}
                </div>
                
                {!approvalStatus.isApproved && !approvalStatus.isChecking && (
                  <div className="mt-2 text-xs opacity-80">
                    💡 授权后可以使用 {isSelling ? 'JBC' : 'MC'} 代币进行兑换，这是一次性操作
                  </div>
                )}
              </div>
            )}


            {/* Action Button */}
            {!isConnected ? (
                 <AnimatedButton 
                    disabled 
                    variant="secondary" 
                    size="lg" 
                    fullWidth
                 >
                    Connect Wallet
                 </AnimatedButton>
            ) : !hasReferrer && !isOwner ? (
                <AnimatedButton 
                    disabled 
                    variant="warning" 
                    size="lg" 
                    fullWidth
                >
                    ⚠️ {t.referrer.noReferrer}
                </AnimatedButton>
            ) : !payAmount || parseFloat(payAmount) <= 0 ? (
                <AnimatedButton 
                    disabled 
                    variant="secondary" 
                    size="lg" 
                    fullWidth
                >
                    请输入兑换数量
                </AnimatedButton>
            ) : !validationResult.isValid ? (
                <AnimatedButton 
                    disabled 
                    variant="danger" 
                    size="lg" 
                    fullWidth
                >
                    {validationResult.error}
                </AnimatedButton>
            ) : !approvalStatus.isApproved && !approvalStatus.isChecking ? (
                <AnimatedButton 
                    onClick={handleApproval}
                    loading={approvalStatus.isApproving}
                    variant="warning"
                    size="lg"
                    fullWidth
                    icon={approvalStatus.isApproving ? undefined : <RotateCw size={20} />}
                >
                    {approvalStatus.isApproving ? '授权中...' : `授权 ${isSelling ? 'JBC' : 'MC'} 代币`}
                </AnimatedButton>
            ) : (
                <AnimatedButton 
                    onClick={handleSwap}
                    loading={isLoading}
                    disabled={!approvalStatus.isApproved}
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={isLoading ? undefined : <ArrowLeftRight size={20} />}
                >
                    {isLoading ? '兑换中...' : t.swap.confirm}
                </AnimatedButton>
            )}
        </div>

        {/* Error Modal */}
        <SwapErrorModal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title={errorDetails.title}
          message={errorDetails.message}
          suggestion={errorDetails.suggestion}
          onRetry={() => handleSwap()}
          showContactSupport={true}
        />
    </div>
    </>
  );
};

export default SwapPanel;
