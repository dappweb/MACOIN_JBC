import { useCallback } from 'react';

export interface TransactionCache {
  transactions: any[];
  lastUpdatedBlock: number;
  lastUpdatedTimestamp: number;
  viewMode: 'self' | 'all';
  account: string;
  version: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const BLOCK_CACHE_TTL = 100; // 100个区块内使用缓存
const CACHE_VERSION = '1.0.0';

export const useTransactionCache = (account: string | null, viewMode: 'self' | 'all') => {
  const getCacheKey = useCallback(() => {
    return account ? `transaction_cache_${account.toLowerCase()}_${viewMode}` : null;
  }, [account, viewMode]);

  const getCache = useCallback((): TransactionCache | null => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data: TransactionCache = JSON.parse(cached);

      // 检查缓存版本
      if (data.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // 检查账户是否匹配
      if (data.account?.toLowerCase() !== account?.toLowerCase()) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // 检查视图模式是否匹配
      if (data.viewMode !== viewMode) {
        return null; // 视图模式不匹配，但不删除缓存
      }

      const now = Date.now();
      const timeDiff = now - data.lastUpdatedTimestamp;

      // 检查时间缓存是否过期
      if (timeDiff > CACHE_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Failed to parse transaction cache:', error);
      const cacheKey = getCacheKey();
      if (cacheKey) {
        localStorage.removeItem(cacheKey);
      }
      return null;
    }
  }, [getCacheKey, account, viewMode]);

  const setCache = useCallback(
    (data: Omit<TransactionCache, 'lastUpdatedTimestamp' | 'version'>) => {
      const cacheKey = getCacheKey();
      if (!cacheKey) return;

      try {
        const cacheData: TransactionCache = {
          ...data,
          lastUpdatedTimestamp: Date.now(),
          version: CACHE_VERSION,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to save transaction cache:', error);
        // 如果存储空间不足，尝试清理旧缓存
        try {
          // 清理所有交易缓存
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('transaction_cache_')) {
              localStorage.removeItem(key);
            }
          });
          // 重试保存
          const cacheData: TransactionCache = {
            ...data,
            lastUpdatedTimestamp: Date.now(),
            version: CACHE_VERSION,
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          // 忽略清理错误
        }
      }
    },
    [getCacheKey]
  );

  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
    }
  }, [getCacheKey]);

  const clearAllCaches = useCallback(() => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('transaction_cache_')) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  const isCacheValid = useCallback(
    (currentBlock?: number): boolean => {
      const cached = getCache();
      if (!cached) return false;

      // 如果提供了当前区块号，检查区块缓存
      if (currentBlock !== undefined) {
        const blockDiff = currentBlock - cached.lastUpdatedBlock;
        if (blockDiff > BLOCK_CACHE_TTL) {
          return false;
        }
      }

      return true;
    },
    [getCache]
  );

  return {
    getCache,
    setCache,
    clearCache,
    clearAllCaches,
    isCacheValid,
  };
};

