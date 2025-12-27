import { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../Web3Context';
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
    
    console.log('📈 [RealTimePrice] 新价格点:', { timestamp, price });
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

    console.log('🎧 [RealTimePrice] 开始监听兑换事件...');

    const handleSwapMCToJBC = (user: string, mcAmount: any, jbcAmount: any, event: any) => {
      console.log('🔄 [RealTimePrice] MC->JBC 兑换事件:', { user, mcAmount: mcAmount.toString(), jbcAmount: jbcAmount.toString() });
      calculatePriceFromSwap(mcAmount, jbcAmount);
    };

    const handleSwapJBCToMC = (user: string, jbcAmount: any, mcAmount: any, event: any) => {
      console.log('🔄 [RealTimePrice] JBC->MC 兑换事件:', { user, jbcAmount: jbcAmount.toString(), mcAmount: mcAmount.toString() });
      calculatePriceFromSwap(mcAmount, jbcAmount);
    };

    // 设置事件监听器
    protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC);
    protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC);

    // 清理监听器
    return () => {
      console.log('🔇 [RealTimePrice] 停止监听兑换事件');
      protocolContract.removeListener("SwappedMCToJBC", handleSwapMCToJBC);
      protocolContract.removeListener("SwappedJBCToMC", handleSwapJBCToMC);
    };
  }, [protocolContract, provider, calculatePriceFromSwap]);

  // 初始化历史价格数据
  useEffect(() => {
    const initializePriceHistory = async () => {
      if (!protocolContract || !provider) return;

      try {
        console.log('📊 [RealTimePrice] 初始化价格历史数据...');
        
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000); // 减少查询范围提高性能

        // 查询最近的兑换事件
        const [mcToJbcEvents, jbcToMcEvents] = await Promise.all([
          protocolContract.queryFilter(protocolContract.filters.SwappedMCToJBC(), fromBlock),
          protocolContract.queryFilter(protocolContract.filters.SwappedJBCToMC(), fromBlock),
        ]);

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
        
        // 如果数据点太少，添加一些基础数据点
        if (pricePoints.length < 10) {
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

        console.log('✅ [RealTimePrice] 价格历史数据初始化完成:', pricePoints.length, '个数据点');
      } catch (error) {
        console.error('❌ [RealTimePrice] 初始化价格历史失败:', error);
      }
    };

    initializePriceHistory();
  }, [protocolContract, provider, calculatePriceStats]);

  // 监听池子数据变化事件，重新获取当前价格
  useEffect(() => {
    const handlePoolDataChanged = async () => {
      if (protocolContract) {
        try {
          const priceWei = await protocolContract.getJBCPrice();
          const price = parseFloat(ethers.formatEther(priceWei));
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