import { useState, useEffect, useCallback } from 'react';
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

export const useRealTimePrice = () => {
  const { protocolContract, provider } = useWeb3();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [priceStats, setPriceStats] = useState<PriceStats>({ high: 0, low: 0, change: 0, avgPrice: 0 });
  const [currentPrice, setCurrentPrice] = useState<number>(1.0);

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

  // 添加新的价格点
  const addPricePoint = useCallback((price: number) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const newPoint = { timestamp, price };
    
    setPriceHistory(prev => {
      const updated = [...prev, newPoint];
      // 保持最近500个价格点
      const limited = updated.slice(-500);
      
      // 重新计算统计数据
      calculatePriceStats(limited);
      
      return limited;
    });
    
    setCurrentPrice(price);
    
  }, [calculatePriceStats]);

  // 从兑换事件计算价格
  const calculatePriceFromSwap = useCallback((mcAmount: any, jbcAmount: any) => {
    try {
      const mcAmountNum = parseFloat(ethers.formatEther(mcAmount));
      const jbcAmountNum = parseFloat(ethers.formatEther(jbcAmount));
      
      if (jbcAmountNum > 0) {
        const price = mcAmountNum / jbcAmountNum;
        addPricePoint(price);
        return price;
      }
    } catch (error) {
      console.error('❌ [RealTimePrice] 价格计算失败:', error);
    }
    return null;
  }, [addPricePoint]);

  // 设置实时事件监听
  useEffect(() => {
    if (!protocolContract || !provider) return;

    const handleSwapMCToJBC = (user: string, mcAmount: any, jbcAmount: any, event: any) => {
      calculatePriceFromSwap(mcAmount, jbcAmount);
    };

    const handleSwapJBCToMC = (user: string, jbcAmount: any, mcAmount: any, event: any) => {
      calculatePriceFromSwap(mcAmount, jbcAmount);
    };

    // 设置事件监听器
    protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC);
    protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC);

    // 清理监听器
    return () => {
      protocolContract.removeListener("SwappedMCToJBC", handleSwapMCToJBC);
      protocolContract.removeListener("SwappedJBCToMC", handleSwapJBCToMC);
    };
  }, [protocolContract, provider, calculatePriceFromSwap]);

  // 初始化历史价格数据
  useEffect(() => {
    const initializePriceHistory = async () => {
      if (!protocolContract || !provider) {
        console.log('⚠️ [RealTimePrice] 协议合约或提供者未就绪，使用默认数据');
        // 即使没有合约，也生成一些默认数据点以确保图表显示
        const now = Math.floor(Date.now() / 1000);
        const defaultPoints: PricePoint[] = [];
        for (let i = 24; i > 0; i--) {
          defaultPoints.push({
            timestamp: now - (i * 3600),
            price: 1.0
          });
        }
        setPriceHistory(defaultPoints);
        calculatePriceStats(defaultPoints);
        setCurrentPrice(1.0);
        return;
      }

      try {
        console.log('📊 [RealTimePrice] 开始初始化价格历史...');
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000); // 减少查询范围提高性能
        console.log(`📊 [RealTimePrice] 查询区块范围: ${fromBlock} - ${currentBlock}`);

        // 查询最近的兑换事件
        const [mcToJbcEvents, jbcToMcEvents] = await Promise.all([
          protocolContract.queryFilter(protocolContract.filters.SwappedMCToJBC(), fromBlock).catch(err => {
            console.warn('⚠️ [RealTimePrice] 查询SwappedMCToJBC事件失败:', err);
            return [];
          }),
          protocolContract.queryFilter(protocolContract.filters.SwappedJBCToMC(), fromBlock).catch(err => {
            console.warn('⚠️ [RealTimePrice] 查询SwappedJBCToMC事件失败:', err);
            return [];
          }),
        ]);

        console.log(`📊 [RealTimePrice] 找到 ${mcToJbcEvents.length} 个MC->JBC事件, ${jbcToMcEvents.length} 个JBC->MC事件`);

        const pricePoints: PricePoint[] = [];

        // 处理MC->JBC兑换事件
        for (const event of mcToJbcEvents) {
          try {
            const block = await provider.getBlock(event.blockNumber);
            if (event.args && block) {
              const mcAmount = parseFloat(ethers.formatEther(event.args[1]));
              const jbcAmount = parseFloat(ethers.formatEther(event.args[2]));
              if (jbcAmount > 0) {
                const price = mcAmount / jbcAmount;
                pricePoints.push({
                  timestamp: block.timestamp,
                  price: price,
                });
              }
            }
          } catch (err) {
            console.error("❌ [RealTimePrice] 处理MC->JBC事件失败:", err);
          }
        }

        // 处理JBC->MC兑换事件
        for (const event of jbcToMcEvents) {
          try {
            const block = await provider.getBlock(event.blockNumber);
            if (event.args && block) {
              const jbcAmount = parseFloat(ethers.formatEther(event.args[1]));
              const mcAmount = parseFloat(ethers.formatEther(event.args[2]));
              if (jbcAmount > 0) {
                const price = mcAmount / jbcAmount;
                pricePoints.push({
                  timestamp: block.timestamp,
                  price: price,
                });
              }
            }
          } catch (err) {
            console.error("❌ [RealTimePrice] 处理JBC->MC事件失败:", err);
          }
        }

        // 按时间排序
        pricePoints.sort((a, b) => a.timestamp - b.timestamp);
        
        console.log(`📊 [RealTimePrice] 处理完成，共 ${pricePoints.length} 个价格点`);
        
        // 如果数据点太少，添加一些基础数据点
        if (pricePoints.length < 10) {
          console.log('⚠️ [RealTimePrice] 数据点不足，补充默认数据点');
          const now = Math.floor(Date.now() / 1000);
          const basePrice = pricePoints.length > 0 ? pricePoints[pricePoints.length - 1].price : 1.0;
          
          for (let i = 10; i > 0; i--) {
            pricePoints.unshift({
              timestamp: now - (i * 3600), // 每小时一个点
              price: basePrice
            });
          }
        }

        setPriceHistory(pricePoints);
        calculatePriceStats(pricePoints);
        
        if (pricePoints.length > 0) {
          setCurrentPrice(pricePoints[pricePoints.length - 1].price);
        }

        console.log('✅ [RealTimePrice] 价格历史初始化完成');

      } catch (error) {
        console.error('❌ [RealTimePrice] 初始化价格历史失败:', error);
        // 即使出错，也生成默认数据点以确保图表显示
        const now = Math.floor(Date.now() / 1000);
        const defaultPoints: PricePoint[] = [];
        for (let i = 24; i > 0; i--) {
          defaultPoints.push({
            timestamp: now - (i * 3600),
            price: 1.0
          });
        }
        setPriceHistory(defaultPoints);
        calculatePriceStats(defaultPoints);
        setCurrentPrice(1.0);
      }
    };

    initializePriceHistory();
  }, [protocolContract, provider, calculatePriceStats]);

  // 监听池子数据变化事件，重新获取当前价格
  useEffect(() => {
    const handlePoolDataChanged = async () => {
      if (protocolContract) {
        try {
          // Calculate JBC price inline since getJBCPrice was removed
          const swapReserveMC = await protocolContract.swapReserveMC();
          const swapReserveJBC = await protocolContract.swapReserveJBC();
          
          let price = 1; // Default price
          if (swapReserveJBC > 0 && swapReserveMC >= ethers.parseEther('1000')) {
            price = parseFloat(ethers.formatEther(swapReserveMC)) / parseFloat(ethers.formatEther(swapReserveJBC));
          }
          
          addPricePoint(price);
        } catch (error) {
          console.error('❌ [RealTimePrice] 获取当前价格失败:', error);
        }
      }
    };

    window.addEventListener('poolDataChanged', handlePoolDataChanged);
    return () => window.removeEventListener('poolDataChanged', handlePoolDataChanged);
  }, [protocolContract, addPricePoint]);

  return {
    priceHistory,
    priceStats,
    currentPrice,
    addPricePoint
  };
};