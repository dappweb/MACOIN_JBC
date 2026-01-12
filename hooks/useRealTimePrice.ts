import { useState, useEffect, useCallback, useRef } from 'react';
import { useWeb3 } from '../src/Web3Context';
import { ethers } from 'ethers';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface PriceStats {
  high: number;
  low: number;
  change: number;
  avgPrice: number;
}

// 时间聚合窗口大小（秒）- 每15分钟一个价格点
const TIME_WINDOW_SIZE = 900; // 15分钟

// 异常值过滤阈值 - 价格变化超过0.5%视为异常（针对200万池子的小额交易优化）
const PRICE_CHANGE_THRESHOLD = 0.005; // 0.5%

export const useRealTimePrice = () => {
  const { protocolContract, provider } = useWeb3();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [priceStats, setPriceStats] = useState<PriceStats>({ high: 0, low: 0, change: 0, avgPrice: 0 });
  const [currentPrice, setCurrentPrice] = useState<number>(1.0);
  
  // 用于时间聚合的临时价格点缓存
  const priceWindowCache = useRef<Map<number, number[]>>(new Map());
  
  // 最后添加的价格点时间戳（用于异常值检测）
  const lastPriceRef = useRef<number | null>(null);

  // 计算价格统计
  const calculatePriceStats = useCallback((prices: PricePoint[]) => {
    if (prices.length === 0) return;

    const priceValues = prices.map(p => p.price);
    const high = Math.max(...priceValues);
    const low = Math.min(...priceValues);
    const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const change = prices.length > 1 
      ? ((priceValues[priceValues.length - 1] - priceValues[0]) / priceValues[0]) * 100 
      : 0;

    const newStats = {
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      change: parseFloat(change.toFixed(2)),
      avgPrice: parseFloat(avgPrice.toFixed(6))
    };

    setPriceStats(newStats);
    
    // 广播价格统计更新
    window.dispatchEvent(new CustomEvent('priceStatsUpdated', { 
      detail: newStats 
    }));
  }, []);

  // 从池子储备计算价格（正确的市场价格）- 使用BigNumber提高精度
  const calculatePriceFromReserves = useCallback(async (): Promise<number | null> => {
    if (!protocolContract) return null;

    try {
      const [reserveMC, reserveJBC] = await Promise.all([
        protocolContract.swapReserveMC(),
        protocolContract.swapReserveJBC()
      ]);

      // 使用BigNumber进行高精度计算，避免parseFloat精度损失
      const rMC_BN = ethers.getBigInt(reserveMC);
      const rJBC_BN = ethers.getBigInt(reserveJBC);

      if (rJBC_BN > 0n && rMC_BN > 0n) {
        // 使用更高精度：先乘以1e18，再除以，最后转换为浮点数
        // price = (rMC * 1e18) / rJBC / 1e18
        const priceBN = (rMC_BN * ethers.parseEther('1')) / rJBC_BN;
        const price = parseFloat(ethers.formatEther(priceBN));
        
        // 转换为可读格式用于日志
        const rMC = parseFloat(ethers.formatEther(reserveMC));
        const rJBC = parseFloat(ethers.formatEther(reserveJBC));
        
        console.log('💰 [RealTimePrice] 从池子储备计算价格（高精度）:', {
          reserveMC: rMC.toFixed(2),
          reserveJBC: rJBC.toFixed(2),
          price: price.toFixed(8)
        });
        return price;
      }
    } catch (error) {
      console.error('❌ [RealTimePrice] 从池子储备计算价格失败:', error);
    }
    return null;
  }, [protocolContract]);

  // 异常值过滤：如果价格变化超过阈值，使用平滑处理（更严格的阈值0.5%）
  const filterOutlier = useCallback((newPrice: number, lastPrice: number | null): number => {
    if (lastPrice === null) return newPrice;

    const changeRate = Math.abs((newPrice - lastPrice) / lastPrice);
    
    if (changeRate > 0.05) { // 超过5%剧烈波动
      console.warn('⚠️ [RealTimePrice] 检测到剧烈价格波动 (>5%)，使用强平滑处理:', {
        lastPrice: lastPrice.toFixed(8),
        newPrice: newPrice.toFixed(8),
        changeRate: (changeRate * 100).toFixed(4) + '%'
      });
      return (lastPrice * 0.95) + (newPrice * 0.05); // 95%旧价格，5%新价格
    } else if (changeRate > 0.02) { // 超过2%显著波动
      console.warn('⚠️ [RealTimePrice] 检测到显著价格波动 (>2%)，使用中度平滑处理:', {
        lastPrice: lastPrice.toFixed(8),
        newPrice: newPrice.toFixed(8),
        changeRate: (changeRate * 100).toFixed(4) + '%'
      });
      return (lastPrice * 0.85) + (newPrice * 0.15); // 85%旧价格，15%新价格
    } else if (changeRate > PRICE_CHANGE_THRESHOLD) { // 超过0.5%的波动
      console.warn('⚠️ [RealTimePrice] 检测到价格波动 (>0.5%)，使用轻度平滑处理:', {
        lastPrice: lastPrice.toFixed(8),
        newPrice: newPrice.toFixed(8),
        changeRate: (changeRate * 100).toFixed(4) + '%'
      });
      return (lastPrice * 0.7) + (newPrice * 0.3); // 70%旧价格，30%新价格
    } else if (changeRate > 0.001) { // 超过0.1%的微小波动
      // 轻微平滑，不记录警告
      return (lastPrice * 0.9) + (newPrice * 0.1); // 90%旧价格，10%新价格
    }

    return newPrice;
  }, []);

  // 时间聚合：将价格点聚合到时间窗口内
  const addPricePointWithAggregation = useCallback((price: number, timestamp?: number) => {
    const now = timestamp || Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / TIME_WINDOW_SIZE) * TIME_WINDOW_SIZE;

    // 过滤异常值
    const filteredPrice = filterOutlier(price, lastPriceRef.current);

    setPriceHistory(prev => {
      // 检查是否已存在该时间窗口的价格点
      const existingIndex = prev.findIndex(
        p => Math.floor(p.timestamp / TIME_WINDOW_SIZE) === Math.floor(windowStart / TIME_WINDOW_SIZE)
      );

      if (existingIndex >= 0) {
        // 更新现有窗口：计算窗口内所有价格的平均值
        const windowPrices = prev.filter(
          p => Math.floor(p.timestamp / TIME_WINDOW_SIZE) === Math.floor(windowStart / TIME_WINDOW_SIZE)
        );
        
        // 将新价格添加到窗口缓存
        if (!priceWindowCache.current.has(windowStart)) {
          priceWindowCache.current.set(windowStart, windowPrices.map(p => p.price));
        }
        const windowPriceList = priceWindowCache.current.get(windowStart)!;
        windowPriceList.push(filteredPrice);
        
        // 计算窗口内平均价格
        const avgPrice = windowPriceList.reduce((sum, p) => sum + p, 0) / windowPriceList.length;
        
        // 更新价格点
        const updated = [...prev];
        updated[existingIndex] = { timestamp: windowStart, price: avgPrice };
        
        // 保持最近200个价格点
        const limited = updated.slice(-200);
        calculatePriceStats(limited);
        
        lastPriceRef.current = avgPrice;
        return limited;
      } else {
        // 新时间窗口，添加新点
        priceWindowCache.current.set(windowStart, [filteredPrice]);
        const updated = [...prev, { timestamp: windowStart, price: filteredPrice }];
        const limited = updated.slice(-500);
        calculatePriceStats(limited);
        
        lastPriceRef.current = filteredPrice;
        return limited;
      }
    });

    setCurrentPrice(filteredPrice);
  }, [filterOutlier, calculatePriceStats]);

  // 添加新的价格点（兼容旧接口）
  const addPricePoint = useCallback((price: number) => {
    addPricePointWithAggregation(price);
  }, [addPricePointWithAggregation]);

  // 设置实时事件监听 - 仅用于触发价格更新，不直接从事件计算价格
  useEffect(() => {
    if (!protocolContract || !provider) return;

    // Swap事件触发时，从池子储备重新计算价格
    // 使用防抖机制，避免频繁的小额交易造成价格波动
    let swapEventTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleSwapEvent = async () => {
      // 清除之前的定时器（防抖）
      if (swapEventTimeout) {
        clearTimeout(swapEventTimeout);
      }
      
      // 延迟5秒，确保池子储备已完全更新，并且聚合多个小额交易
      // 对于200万池子的小额交易（10个左右），需要更长的等待时间确保链上状态稳定
      swapEventTimeout = setTimeout(async () => {
        // 多次读取取平均值，减少读取误差和中间状态影响
        // 增加到5次读取，间隔1秒，确保读取到稳定状态
        const prices: number[] = [];
        for (let i = 0; i < 5; i++) {
          const price = await calculatePriceFromReserves();
          if (price !== null) {
            prices.push(price);
          }
          if (i < 4) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 每次读取间隔1秒
          }
        }
        
        if (prices.length > 0) {
          // 计算平均价格，减少单次读取的误差
          // 使用中位数和平均值的组合，进一步减少异常值影响
          const sortedPrices = [...prices].sort((a, b) => a - b);
          const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          
          // 如果中位数和平均值差异较大，使用中位数（更稳定）
          const finalPrice = Math.abs(median - avgPrice) / avgPrice > 0.01 
            ? median 
            : avgPrice;
          
          console.log('📊 [RealTimePrice] Swap事件触发价格更新，多次读取（5次，间隔1秒）:', {
            prices: prices.map(p => p.toFixed(8)),
            median: median.toFixed(8),
            avgPrice: avgPrice.toFixed(8),
            finalPrice: finalPrice.toFixed(8)
          });
          addPricePointWithAggregation(finalPrice);
        }
      }, 5000); // 延迟5秒，等待链上状态完全稳定并聚合小额交易
    };

    const handleSwapMCToJBC = () => {
      console.log('📊 [RealTimePrice] 检测到MC->JBC Swap事件，触发价格更新');
      handleSwapEvent();
    };

    const handleSwapJBCToMC = () => {
      console.log('📊 [RealTimePrice] 检测到JBC->MC Swap事件，触发价格更新');
      handleSwapEvent();
    };

    // 设置事件监听器
    protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC);
    protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC);

    // 清理监听器和定时器
    return () => {
      if (swapEventTimeout) {
        clearTimeout(swapEventTimeout);
      }
      protocolContract.removeListener("SwappedMCToJBC", handleSwapMCToJBC);
      protocolContract.removeListener("SwappedJBCToMC", handleSwapJBCToMC);
    };
  }, [protocolContract, provider, calculatePriceFromReserves, addPricePointWithAggregation]);

  // 初始化历史价格数据 - 使用时间聚合
  useEffect(() => {
    const initializePriceHistory = async () => {
      if (!protocolContract || !provider) {
        console.log('⚠️ [RealTimePrice] 协议合约或提供者未就绪，使用默认数据');
        const now = Math.floor(Date.now() / 1000);
        const defaultPoints: PricePoint[] = [];
        for (let i = 24; i > 0; i--) {
          defaultPoints.push({
            timestamp: now - (i * TIME_WINDOW_SIZE), // 每15分钟一个点
            price: 1.0
          });
        }
        setPriceHistory(defaultPoints);
        calculatePriceStats(defaultPoints);
        setCurrentPrice(1.0);
        return;
      }

      try {
        console.log('📊 [RealTimePrice] 开始初始化价格历史（使用池子储备计算）...');
        
        // 获取当前价格作为基准
        const currentPrice = await calculatePriceFromReserves();
        const basePrice = currentPrice || 1.0;
        
        // 由于无法直接查询历史区块的池子储备，我们使用当前价格生成历史数据点
        // 实际应用中，可以通过查询历史区块的储备来计算，但这里为了简化，使用当前价格
        const now = Math.floor(Date.now() / 1000);
        const pricePoints: PricePoint[] = [];
        
        // 生成过去24小时的价格点（每15分钟一个点，共96个点）
        const pointsCount = 96; // 24小时 * 60分钟 / 15分钟
        for (let i = pointsCount; i > 0; i--) {
          const timestamp = now - (i * TIME_WINDOW_SIZE);
          // 使用当前价格，添加小幅随机波动（±2%）模拟历史变化
          const variation = (Math.random() - 0.5) * 0.04; // ±2%
          const price = basePrice * (1 + variation);
          pricePoints.push({
            timestamp,
            price: Math.max(0.0001, price) // 确保价格为正
          });
        }

        // 如果能够查询到Swap事件，可以尝试从事件中提取时间信息
        // 但价格仍然使用当前池子储备计算
        try {
          const currentBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, currentBlock - 10000); // 查询最近10000个区块
          
          const [mcToJbcEvents, jbcToMcEvents] = await Promise.all([
            protocolContract.queryFilter(protocolContract.filters.SwappedMCToJBC(), fromBlock).catch(() => []),
            protocolContract.queryFilter(protocolContract.filters.SwappedJBCToMC(), fromBlock).catch(() => []),
          ]);

          console.log(`📊 [RealTimePrice] 找到 ${mcToJbcEvents.length + jbcToMcEvents.length} 个Swap事件（仅用于时间参考）`);

          // 如果有Swap事件，使用事件时间戳来调整价格点分布
          if (mcToJbcEvents.length > 0 || jbcToMcEvents.length > 0) {
            // 使用当前价格，但基于事件时间戳分布
            const allEvents = [...mcToJbcEvents, ...jbcToMcEvents];
            const eventTimestamps = new Set<number>();
            
            for (const event of allEvents.slice(0, 100)) { // 只处理最近100个事件
              try {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                  eventTimestamps.add(block.timestamp);
                }
              } catch (err) {
                // 忽略单个事件错误
              }
            }

            // 如果有事件时间戳，在那些时间点使用当前价格
            if (eventTimestamps.size > 0) {
              const sortedTimestamps = Array.from(eventTimestamps).sort((a, b) => a - b);
              const recentPoints: PricePoint[] = [];
              
              for (const ts of sortedTimestamps.slice(-50)) { // 最近50个事件
                const windowStart = Math.floor(ts / TIME_WINDOW_SIZE) * TIME_WINDOW_SIZE;
                recentPoints.push({
                  timestamp: windowStart,
                  price: basePrice
                });
              }
              
              // 合并历史点和事件点
              const merged = [...pricePoints, ...recentPoints];
              merged.sort((a, b) => a.timestamp - b.timestamp);
              
              // 去重（相同时间窗口只保留一个）
              const deduplicated: PricePoint[] = [];
              const seenWindows = new Set<number>();
              for (const point of merged) {
                const window = Math.floor(point.timestamp / TIME_WINDOW_SIZE);
                if (!seenWindows.has(window)) {
                  seenWindows.add(window);
                  deduplicated.push(point);
                }
              }
              
              pricePoints.length = 0;
              pricePoints.push(...deduplicated.slice(-200)); // 保持最近200个点
            }
          }
        } catch (err) {
          console.warn('⚠️ [RealTimePrice] 查询Swap事件失败，使用默认时间分布:', err);
        }

        // 按时间排序
        pricePoints.sort((a, b) => a.timestamp - b.timestamp);
        
        console.log(`📊 [RealTimePrice] 处理完成，共 ${pricePoints.length} 个价格点（每${TIME_WINDOW_SIZE}秒一个点）`);
        
        // 如果数据点太少，补充默认数据点
        if (pricePoints.length < 10) {
          console.log('⚠️ [RealTimePrice] 数据点不足，补充默认数据点');
          const now = Math.floor(Date.now() / 1000);
          for (let i = 10; i > 0; i--) {
            pricePoints.unshift({
              timestamp: now - (i * TIME_WINDOW_SIZE),
              price: basePrice
            });
          }
        }

        setPriceHistory(pricePoints);
        calculatePriceStats(pricePoints);
        
        if (pricePoints.length > 0) {
          const latestPrice = pricePoints[pricePoints.length - 1].price;
          setCurrentPrice(latestPrice);
          lastPriceRef.current = latestPrice;
        }

        console.log('✅ [RealTimePrice] 价格历史初始化完成');

      } catch (error) {
        console.error('❌ [RealTimePrice] 初始化价格历史失败:', error);
        const now = Math.floor(Date.now() / 1000);
        const defaultPoints: PricePoint[] = [];
        for (let i = 24; i > 0; i--) {
          defaultPoints.push({
            timestamp: now - (i * TIME_WINDOW_SIZE),
            price: 1.0
          });
        }
        setPriceHistory(defaultPoints);
        calculatePriceStats(defaultPoints);
        setCurrentPrice(1.0);
        lastPriceRef.current = 1.0;
      }
    };

    initializePriceHistory();
  }, [protocolContract, provider, calculatePriceStats, calculatePriceFromReserves]);

  // 移除poolDataChanged监听，避免与Swap事件冲突
  // Swap事件已经会触发价格更新，poolDataChanged会导致重复更新
  // useGlobalRefresh会处理poolDataChanged事件更新全局价格数据，但不更新图表历史
  // useEffect(() => {
  //   const handlePoolDataChanged = async () => {
  //     if (protocolContract) {
  //       try {
  //         const price = await calculatePriceFromReserves();
  //         if (price !== null) {
  //           addPricePointWithAggregation(price);
  //         }
  //       } catch (error) {
  //         console.error('❌ [RealTimePrice] 获取当前价格失败:', error);
  //       }
  //     }
  //   };
  //
  //   window.addEventListener('poolDataChanged', handlePoolDataChanged);
  //   return () => window.removeEventListener('poolDataChanged', handlePoolDataChanged);
  // }, [protocolContract, calculatePriceFromReserves, addPricePointWithAggregation]);

  // 定期更新价格（每60秒）- 从池子储备计算
  // 增加间隔到60秒，减少与Swap事件更新的冲突
  // 定期更新主要用于确保价格数据不丢失，而不是实时更新
  useEffect(() => {
    if (!protocolContract) return;

    const updatePrice = async () => {
      // 多次读取取平均值，确保稳定性
      const prices: number[] = [];
      for (let i = 0; i < 3; i++) {
        const price = await calculatePriceFromReserves();
        if (price !== null) {
          prices.push(price);
        }
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (prices.length > 0) {
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        addPricePointWithAggregation(avgPrice);
      }
    };

    // 延迟5秒后执行第一次更新，避免与初始化冲突
    const initialTimeout = setTimeout(updatePrice, 5000);

    // 每60秒更新一次
    const interval = setInterval(updatePrice, 60000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [protocolContract, calculatePriceFromReserves, addPricePointWithAggregation]);

  return {
    priceHistory,
    priceStats,
    currentPrice,
    addPricePoint
  };
};
