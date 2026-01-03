# 首页累计收益优化 - 快速实施指南

## 🎯 核心问题

当前实现存在以下问题：
1. **性能**: 每5秒刷新，查询50,000个区块事件，无缓存
2. **准确性**: 事件查询可能遗漏，无验证机制
3. **用户体验**: 加载慢，频繁刷新

## 🚀 快速实施方案（按优先级）

### 优先级1: 缓存机制 ⭐⭐⭐

**目标**: 减少重复计算，提升加载速度

**实施步骤**:
1. 创建 `hooks/useRevenueCache.ts`
2. 在 `StatsPanel.tsx` 中集成缓存
3. 缓存有效期：5分钟或100个区块

**预期效果**: 初始加载时间减少70-80%

### 优先级2: 刷新频率优化 ⭐⭐⭐

**目标**: 减少不必要的刷新

**当前**: 每5秒刷新
**优化后**: 
- 活跃状态：30秒
- 后台状态：5分钟
- 事件触发：立即

**实施步骤**:
1. 修改 `useEffect` 中的 `setInterval` 时间
2. 添加页面可见性检测
3. 根据用户活跃度调整刷新频率

**预期效果**: RPC调用减少80%

### 优先级3: 增量更新 ⭐⭐

**目标**: 只查询新数据，不重复查询历史

**实施步骤**:
1. 记录上次查询的区块号
2. 只查询自上次更新后的新事件
3. 如果区块差距>10,000，回退到全量查询

**预期效果**: 事件查询时间减少90%

### 优先级4: 数据验证 ⭐⭐

**目标**: 确保数据准确性

**实施步骤**:
1. 对比事件累加值与合约状态
2. 如果差异>5%，使用合约数据
3. 添加错误日志和降级方案

**预期效果**: 数据准确性提升到99%+

### 优先级5: 并行查询 ⭐

**目标**: 减少总查询时间

**实施步骤**:
1. 使用 `Promise.all` 并行查询
2. 优化查询顺序

**预期效果**: 查询时间减少30-50%

## 📋 实施检查清单

### 阶段1: 基础优化（1-2天）

- [ ] 实现缓存机制
- [ ] 优化刷新频率
- [ ] 添加页面可见性检测
- [ ] 测试缓存读写

### 阶段2: 高级优化（2-3天）

- [ ] 实现增量更新
- [ ] 添加数据验证
- [ ] 实现并行查询
- [ ] 添加错误处理

### 阶段3: 测试和优化（1-2天）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 用户体验测试

## 🔧 快速开始

### 1. 创建缓存Hook

```typescript
// hooks/useRevenueCache.ts
import { useState, useEffect } from 'react';

interface RevenueCache {
  baseRevenue: number;
  referralRevenue: number;
  dynamicTotalEarned: number;
  combinedRevenue: number;
  lastUpdatedBlock: number;
  lastUpdatedTimestamp: number;
}

export const useRevenueCache = (account: string | null) => {
  const CACHE_KEY = account ? `revenue_cache_${account}` : null;
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟
  
  const getCache = (): RevenueCache | null => {
    if (!CACHE_KEY) return null;
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    try {
      const data: RevenueCache = JSON.parse(cached);
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - data.lastUpdatedTimestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  };
  
  const setCache = (data: Omit<RevenueCache, 'lastUpdatedTimestamp'>) => {
    if (!CACHE_KEY) return;
    
    const cacheData: RevenueCache = {
      ...data,
      lastUpdatedTimestamp: Date.now()
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  };
  
  return { getCache, setCache };
};
```

### 2. 修改 StatsPanel.tsx

```typescript
// 在 StatsPanel 组件中添加
const { getCache, setCache } = useRevenueCache(account);

const fetchData = useCallback(async () => {
  if (isConnected && account && protocolContract) {
    // 1. 先尝试从缓存读取
    const cached = getCache();
    if (cached) {
      setDisplayStats(prev => ({
        ...prev,
        totalRevenue: cached.combinedRevenue
      }));
    }
    
    try {
      // 2. 后台更新数据
      const userInfo = await protocolContract.userInfo(account);
      const baseRevenue = parseFloat(ethers.formatEther(userInfo[3]));
      
      // ... 其他计算逻辑
      
      const combinedRevenue = baseRevenue + referralRevenue + dynamicTotalEarned;
      
      // 3. 更新缓存
      setCache({
        baseRevenue,
        referralRevenue,
        dynamicTotalEarned,
        combinedRevenue,
        lastUpdatedBlock: await provider.getBlockNumber()
      });
      
      setDisplayStats(prev => ({
        ...prev,
        totalRevenue: combinedRevenue
      }));
    } catch (err) {
      console.error("Error fetching stats", err);
    }
  }
}, [isConnected, account, protocolContract, getCache, setCache]);

// 修改刷新频率
useEffect(() => {
  if (!isConnected || !account) return;
  
  // 初始加载
  fetchData();
  
  // 根据页面可见性调整刷新频率
  const getRefreshInterval = () => {
    if (document.hidden) {
      return 5 * 60 * 1000; // 后台：5分钟
    }
    return 30 * 1000; // 活跃：30秒
  };
  
  const timer = setInterval(fetchData, getRefreshInterval());
  
  // 页面可见性变化时调整
  const handleVisibilityChange = () => {
    clearInterval(timer);
    const newTimer = setInterval(fetchData, getRefreshInterval());
    return () => clearInterval(newTimer);
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [fetchData, isConnected, account]);
```

## 📊 预期改进

| 指标 | 当前 | 优化后 | 改进 |
|------|------|--------|------|
| 初始加载时间 | 3-5秒 | 0.5-1秒 | **70-80%** ↓ |
| 刷新频率 | 每5秒 | 30秒/5分钟 | **80%** ↓ |
| RPC调用次数 | 高 | 低 | **60-80%** ↓ |
| 数据准确性 | ~95% | 99%+ | **4%** ↑ |

## ⚠️ 注意事项

1. **缓存失效**: 确保在关键事件（如领取奖励）后清除缓存
2. **数据一致性**: 定期验证缓存数据与合约数据的一致性
3. **错误处理**: 缓存失败时回退到实时查询
4. **向后兼容**: 不影响现有功能

## 🔍 验证方法

1. **性能验证**:
   - 打开浏览器开发者工具
   - 查看Network标签，统计RPC调用次数
   - 测量页面加载时间

2. **准确性验证**:
   - 对比缓存值与实时查询值
   - 检查控制台是否有数据不一致警告
   - 验证事件触发后数据是否正确更新

3. **用户体验验证**:
   - 测试首次加载速度
   - 测试页面切换后的刷新行为
   - 测试后台/前台切换

## 📚 相关文档

- [完整优化方案](./HOMEPAGE_REVENUE_OPTIMIZATION.md)
- [性能优化文档](../PERFORMANCE_OPTIMIZATION.md)
- [缓存策略文档](../CACHING_STRATEGY.md)

