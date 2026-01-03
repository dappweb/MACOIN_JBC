import { useCallback } from 'react';

export interface RevenueCache {
  baseRevenue: number;
  referralRevenue: number;
  dynamicTotalEarned: number;
  combinedRevenue: number;
  lastUpdatedBlock: number;
  lastUpdatedTimestamp: number;
  version: string; // 用于缓存版本控制
}

const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const BLOCK_CACHE_TTL = 100; // 100个区块内使用缓存
const CACHE_VERSION = '1.0.0'; // 缓存版本号

export const useRevenueCache = (account: string | null) => {
  const getCacheKey = useCallback(() => {
    return account ? `revenue_cache_${account.toLowerCase()}` : null;
  }, [account]);

  const getCache = useCallback((): RevenueCache | null => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data: RevenueCache = JSON.parse(cached);

      // 检查缓存版本
      if (data.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey);
        return null;
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
      console.warn('Failed to parse revenue cache:', error);
      localStorage.removeItem(cacheKey || '');
      return null;
    }
  }, [getCacheKey]);

  const setCache = useCallback(
    (data: Omit<RevenueCache, 'lastUpdatedTimestamp' | 'version'>) => {
      const cacheKey = getCacheKey();
      if (!cacheKey) return;

      try {
        const cacheData: RevenueCache = {
          ...data,
          lastUpdatedTimestamp: Date.now(),
          version: CACHE_VERSION,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to save revenue cache:', error);
        // 如果存储空间不足，尝试清理旧缓存
        try {
          localStorage.removeItem(cacheKey);
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
    isCacheValid,
  };
};

