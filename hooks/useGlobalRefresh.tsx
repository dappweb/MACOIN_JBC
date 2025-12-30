import { useCallback, useContext, createContext, ReactNode, useState, useEffect } from 'react';
import { useWeb3 } from '../src/Web3Context';
import { ethers } from 'ethers';

interface GlobalRefreshContextType {
  // 余额数据
  balances: {
    mc: string;
    jbc: string;
    lastUpdated: number;
  };
  
  // 价格数据
  priceData: {
    jbcPrice: number;
    mcUsdtPrice: number;
    lastUpdated: number;
  };
  
  // 刷新函数
  refreshBalances: () => Promise<void>;
  refreshPriceData: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // 交易后刷新
  onTransactionSuccess: (type: TransactionType) => Promise<void>;
  
  // 加载状态
  isRefreshing: boolean;
}

type TransactionType = 'ticket_purchase' | 'liquidity_stake' | 'swap' | 'redeem' | 'claim';

const GlobalRefreshContext = createContext<GlobalRefreshContextType | null>(null);

export const GlobalRefreshProvider = ({ children }: { children: ReactNode }) => {
  const { provider, jbcContract, protocolContract, account, isConnected, mcBalance, refreshMcBalance } = useWeb3();
  
  const [balances, setBalances] = useState({
    mc: '0',
    jbc: '0',
    lastUpdated: 0
  });
  
  const [priceData, setPriceData] = useState({
    jbcPrice: 1.0,
    mcUsdtPrice: 0,
    lastUpdated: 0
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 刷新余额 - 使用原生MC余额
  const refreshBalances = useCallback(async () => {
    if (!isConnected || !account || !provider || !jbcContract) return;
    
    try {
      const [jbcBal] = await Promise.all([
        jbcContract.balanceOf(account)
      ]);
      
      // 使用Web3Context中的原生MC余额
      const mcBalanceFormatted = mcBalance ? ethers.formatEther(mcBalance) : '0';
      
      const newBalances = {
        mc: mcBalanceFormatted,
        jbc: ethers.formatEther(jbcBal),
        lastUpdated: Date.now()
      };
      
      setBalances(newBalances);
      
      // 广播余额更新事件
      window.dispatchEvent(new CustomEvent('balanceUpdated', { 
        detail: newBalances 
      }));
      
    } catch (error) {
      console.error('❌ [GlobalRefresh] 余额更新失败:', error);
    }
  }, [isConnected, account, provider, jbcContract, mcBalance]);

  // 刷新价格数据
  const refreshPriceData = useCallback(async () => {
    try {
      const promises = [];
      
      // 获取JBC价格
      if (protocolContract) {
        promises.push(
          Promise.all([
             protocolContract.swapReserveMC(),
             protocolContract.swapReserveJBC()
          ]).then(([reserveMC, reserveJBC]) => {
              const rMC = parseFloat(ethers.formatEther(reserveMC));
              const rJBC = parseFloat(ethers.formatEther(reserveJBC));
              return rJBC > 0 ? rMC / rJBC : 1.0;
          }).catch((err) => {
              console.warn("Failed to fetch reserves for price", err);
              return 1.0;
          })
        );
      } else {
        promises.push(Promise.resolve(1.0));
      }
      
      // 获取MC/USDT价格
      promises.push(
        fetch('https://api.macoin.ai/market/symbol-thumb')
          .then(res => res.json())
          .then(data => {
            const mcData = data.find((item: any) => item.symbol === 'MC/USDT');
            return mcData ? parseFloat(mcData.close) : 0;
          })
          .catch(() => 0)
      );
      
      const [jbcPrice, mcUsdtPrice] = await Promise.all(promises);
      
      const newPriceData = {
        jbcPrice,
        mcUsdtPrice,
        lastUpdated: Date.now()
      };
      
      setPriceData(newPriceData);
      
      // 广播价格更新事件
      window.dispatchEvent(new CustomEvent('priceUpdated', { 
        detail: newPriceData 
      }));
      
    } catch (error) {
      console.error('❌ [GlobalRefresh] 价格更新失败:', error);
    }
  }, [protocolContract]);

  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshBalances(),
        refreshPriceData()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshBalances, refreshPriceData]);

  // 交易成功后的刷新策略
  const onTransactionSuccess = useCallback(async (type: TransactionType) => {
    setIsRefreshing(true);
    
    try {
      switch (type) {
        case 'ticket_purchase':
          // 购买门票后：刷新原生MC余额 + 广播门票状态更新 + 可能的等级变化
          await refreshMcBalance(); // 刷新原生MC余额
          await refreshBalances();
          window.dispatchEvent(new CustomEvent('ticketStatusChanged'));
          window.dispatchEvent(new CustomEvent('userLevelChanged'));
          break;
          
        case 'liquidity_stake':
          // 质押流动性后：刷新原生MC余额 + 广播质押状态更新
          await refreshMcBalance(); // 刷新原生MC余额
          await refreshBalances();
          window.dispatchEvent(new CustomEvent('stakingStatusChanged'));
          break;
          
        case 'swap':
          // 兑换后：刷新原生MC余额 + JBC余额 + 价格 + 广播池子数据更新
          await refreshMcBalance(); // 刷新原生MC余额
          await Promise.all([
            refreshBalances(),
            refreshPriceData()
          ]);
          window.dispatchEvent(new CustomEvent('poolDataChanged'));
          break;
          
        case 'redeem':
        case 'claim':
          // 赎回/领取后：刷新原生MC余额 + JBC余额 + 广播收益数据更新
          await refreshMcBalance(); // 刷新原生MC余额
          await refreshBalances();
          window.dispatchEvent(new CustomEvent('rewardsChanged'));
          break;
          
        default:
          // 默认刷新所有数据
          await refreshAll();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshBalances, refreshPriceData, refreshAll, refreshMcBalance]);

  // 定期刷新价格数据（降低频率到60秒）
  useEffect(() => {
    if (isConnected) {
      refreshPriceData(); // 立即刷新一次
      const interval = setInterval(refreshPriceData, 60000); // 60秒间隔
      return () => clearInterval(interval);
    }
  }, [isConnected, refreshPriceData]);

  // 定期刷新余额（30秒间隔）
  useEffect(() => {
    if (isConnected) {
      refreshBalances(); // 立即刷新一次
      const interval = setInterval(refreshBalances, 30000); // 30秒间隔
      return () => clearInterval(interval);
    }
  }, [isConnected, refreshBalances]);

  const value: GlobalRefreshContextType = {
    balances,
    priceData,
    refreshBalances,
    refreshPriceData,
    refreshAll,
    onTransactionSuccess,
    isRefreshing
  };

  return (
    <GlobalRefreshContext.Provider value={value}>
      {children}
    </GlobalRefreshContext.Provider>
  );
};

export const useGlobalRefresh = () => {
  const context = useContext(GlobalRefreshContext);
  if (!context) {
    throw new Error('useGlobalRefresh must be used within GlobalRefreshProvider');
  }
  return context;
};

// 自定义Hook：监听特定事件并刷新
export const useEventRefresh = (eventName: string, callback: () => void) => {
  useEffect(() => {
    const handleEvent = () => {
      callback();
    };
    
    window.addEventListener(eventName, handleEvent);
    return () => window.removeEventListener(eventName, handleEvent);
  }, [eventName, callback]);
};
