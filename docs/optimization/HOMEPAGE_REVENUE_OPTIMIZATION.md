# 首页累计收益优化方案

## 📋 当前实现分析

### 现有问题

1. **性能问题**:
   - 每5秒刷新一次（过于频繁）
   - 每次查询最近50,000个区块的事件（成本高、速度慢）
   - 多个合约调用串行执行
   - 无缓存机制，重复计算

2. **数据准确性问题**:
   - 事件查询可能遗漏数据（区块范围限制）
   - 推荐奖励通过事件累加，可能与合约状态不一致
   - 无数据验证机制
   - 可能存在重复计算或遗漏

3. **计算逻辑**:
   ```typescript
   combinedRevenue = baseRevenue + referralRevenue + dynamicTotalEarned
   ```
   - `baseRevenue`: 来自合约 `userInfo[3].totalRevenue`
   - `referralRevenue`: 通过查询 `ReferralRewardPaid` 事件累加
   - `dynamicTotalEarned`: 来自 `getUserDynamicRewards` 函数

## 🎯 优化目标

1. **性能优化**:
   - 减少RPC调用次数
   - 实现智能缓存
   - 降低刷新频率
   - 增量更新机制

2. **准确性保证**:
   - 数据验证机制
   - 多重数据源交叉验证
   - 错误处理和降级方案
   - 数据一致性检查

3. **用户体验**:
   - 快速初始加载
   - 后台静默更新
   - 加载状态提示
   - 错误提示

## 🚀 优化方案

### 方案1: 智能缓存 + 增量更新（推荐）

#### 1.1 缓存策略

```typescript
interface RevenueCache {
  baseRevenue: number;
  referralRevenue: number;
  dynamicTotalEarned: number;
  lastUpdatedBlock: number;
  lastUpdatedTimestamp: number;
  version: string; // 用于缓存失效
}

const CACHE_KEY = `revenue_cache_${account}`;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const BLOCK_CACHE_TTL = 100; // 100个区块内使用缓存
```

**缓存逻辑**:
- 首次加载：从缓存读取（如果存在且有效）
- 后台更新：静默刷新数据
- 缓存失效：超过5分钟或超过100个区块
- 事件触发：立即刷新并更新缓存

#### 1.2 增量更新机制

```typescript
// 只查询自上次更新后的新事件
const fetchIncrementalRevenue = async (lastBlock: number) => {
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = lastBlock + 1;
  
  // 如果区块差距太大，回退到全量查询
  if (currentBlock - lastBlock > 10000) {
    return fetchFullRevenue();
  }
  
  // 增量查询新事件
  const newEvents = await protocolContract.queryFilter(
    protocolContract.filters.ReferralRewardPaid(account),
    fromBlock,
    currentBlock
  );
  
  // 累加到缓存值
  return cachedRevenue + calculateNewRevenue(newEvents);
};
```

#### 1.3 数据验证

```typescript
const validateRevenue = async (
  calculated: number,
  contractState: number
): Promise<boolean> => {
  // 允许5%的误差（由于事件查询可能不完整）
  const tolerance = contractState * 0.05;
  const diff = Math.abs(calculated - contractState);
  
  if (diff > tolerance) {
    console.warn('Revenue mismatch detected:', {
      calculated,
      contractState,
      diff
    });
    // 使用合约状态作为权威数据源
    return false;
  }
  return true;
};
```

### 方案2: 合约状态优先 + 事件补充

#### 2.1 优先使用合约状态

```typescript
// 如果合约有累计收益的getter函数，优先使用
const getRevenueFromContract = async () => {
  try {
    // 尝试从合约直接获取总收益
    if (protocolContract.getUserTotalRevenue) {
      return await protocolContract.getUserTotalRevenue(account);
    }
    
    // 回退到 userInfo
    const userInfo = await protocolContract.userInfo(account);
    return userInfo[3]; // totalRevenue
  } catch (err) {
    console.error('Failed to get revenue from contract', err);
    return null;
  }
};
```

#### 2.2 事件仅用于实时更新

```typescript
// 事件仅用于检测新收益，不用于全量计算
const subscribeToRevenueEvents = () => {
  protocolContract.on('ReferralRewardPaid', (user, amount) => {
    if (user.toLowerCase() === account.toLowerCase()) {
      // 增量更新
      updateRevenueCache({
        referralRevenue: cached.referralRevenue + amount
      });
    }
  });
};
```

### 方案3: 批量查询优化

#### 3.1 并行查询

```typescript
const fetchRevenueData = async () => {
  const [userInfo, dynamicRewards, currentBlock] = await Promise.all([
    protocolContract.userInfo(account),
    protocolContract.getUserDynamicRewards?.(account) || Promise.resolve(null),
    provider.getBlockNumber()
  ]);
  
  // 并行查询事件（如果必须）
  const fromBlock = Math.max(0, currentBlock - 50000);
  const [referralEvents, rewardEvents] = await Promise.all([
    protocolContract.queryFilter(
      protocolContract.filters.ReferralRewardPaid(account),
      fromBlock
    ),
    protocolContract.queryFilter(
      protocolContract.filters.RewardClaimed(account),
      fromBlock
    )
  ]);
  
  return { userInfo, dynamicRewards, referralEvents, rewardEvents };
};
```

#### 3.2 查询范围优化

```typescript
// 智能确定查询范围
const getOptimalBlockRange = async (account: string) => {
  // 从缓存获取上次查询的区块
  const cached = getRevenueCache(account);
  if (cached?.lastUpdatedBlock) {
    const currentBlock = await provider.getBlockNumber();
    const blocksSinceUpdate = currentBlock - cached.lastUpdatedBlock;
    
    // 如果距离上次更新不超过1000个区块，只查询增量
    if (blocksSinceUpdate < 1000) {
      return {
        fromBlock: cached.lastUpdatedBlock + 1,
        useIncremental: true
      };
    }
  }
  
  // 否则查询最近50,000个区块
  const currentBlock = await provider.getBlockNumber();
  return {
    fromBlock: Math.max(0, currentBlock - 50000),
    useIncremental: false
  };
};
```

### 方案4: 刷新频率优化

#### 4.1 智能刷新策略

```typescript
const REFRESH_STRATEGIES = {
  // 初始加载：立即
  INITIAL: 0,
  // 活跃用户：30秒
  ACTIVE: 30 * 1000,
  // 后台：5分钟
  BACKGROUND: 5 * 60 * 1000,
  // 事件触发：立即
  EVENT_TRIGGERED: 0
};

const getRefreshInterval = (isActive: boolean) => {
  if (isActive && document.hasFocus()) {
    return REFRESH_STRATEGIES.ACTIVE;
  }
  return REFRESH_STRATEGIES.BACKGROUND;
};
```

#### 4.2 页面可见性检测

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // 页面隐藏时，停止自动刷新
      clearInterval(refreshTimer);
    } else {
      // 页面可见时，恢复刷新
      startAutoRefresh();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

## 📝 实施步骤

### 阶段1: 缓存机制（优先级：高）

1. 实现 `RevenueCache` 接口
2. 添加 localStorage 缓存
3. 实现缓存读取和写入
4. 添加缓存失效逻辑

### 阶段2: 增量更新（优先级：高）

1. 实现区块号追踪
2. 实现增量事件查询
3. 实现增量数据合并
4. 添加回退到全量查询的逻辑

### 阶段3: 数据验证（优先级：中）

1. 实现数据交叉验证
2. 添加误差容忍度检查
3. 实现降级方案
4. 添加错误日志

### 阶段4: 性能优化（优先级：中）

1. 优化刷新频率
2. 实现并行查询
3. 添加页面可见性检测
4. 优化查询范围

### 阶段5: 用户体验（优先级：低）

1. 添加加载状态
2. 实现骨架屏
3. 添加错误提示
4. 优化过渡动画

## 🔍 数据准确性保证

### 验证机制

1. **多重验证**:
   ```typescript
   const verifyRevenue = async () => {
     // 方法1: 合约状态
     const contractRevenue = await getContractRevenue();
     
     // 方法2: 事件累加
     const eventRevenue = await calculateEventRevenue();
     
     // 方法3: 历史记录（如果有）
     const historyRevenue = await getHistoryRevenue();
     
     // 交叉验证
     return crossValidate([contractRevenue, eventRevenue, historyRevenue]);
   };
   ```

2. **数据一致性检查**:
   ```typescript
   const checkConsistency = (calculated: number, contract: number) => {
     const diff = Math.abs(calculated - contract);
     const percentDiff = (diff / contract) * 100;
     
     if (percentDiff > 5) {
       // 差异超过5%，使用合约数据
       console.warn('Large revenue discrepancy detected');
       return contract;
     }
     
     return calculated;
   };
   ```

3. **错误处理**:
   ```typescript
   try {
     const revenue = await calculateRevenue();
   } catch (error) {
     // 降级到缓存数据
     const cached = getCachedRevenue();
     if (cached) {
       return cached;
     }
     
     // 降级到合约数据
     const contract = await getContractRevenue();
     return contract;
   }
   ```

## 📊 预期效果

### 性能提升

- **初始加载时间**: 从 ~3-5秒 降低到 ~0.5-1秒（使用缓存）
- **刷新频率**: 从每5秒降低到每30秒（活跃）或5分钟（后台）
- **RPC调用次数**: 减少60-80%
- **事件查询范围**: 从固定50,000区块降低到增量查询（通常<1000区块）

### 准确性提升

- **数据一致性**: 通过多重验证，确保99%+准确性
- **错误恢复**: 自动降级到可靠数据源
- **实时性**: 事件触发立即更新

### 用户体验提升

- **加载速度**: 首次加载快3-5倍
- **流畅度**: 减少不必要的刷新
- **可靠性**: 更好的错误处理

## 🛠️ 技术实现细节

### 缓存实现

```typescript
// hooks/useRevenueCache.ts
export const useRevenueCache = (account: string) => {
  const getCache = (): RevenueCache | null => {
    const cached = localStorage.getItem(`revenue_${account}`);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const now = Date.now();
    const blockDiff = getCurrentBlock() - data.lastUpdatedBlock;
    
    // 检查缓存是否过期
    if (now - data.lastUpdatedTimestamp > CACHE_TTL || blockDiff > BLOCK_CACHE_TTL) {
      return null;
    }
    
    return data;
  };
  
  const setCache = (data: RevenueCache) => {
    localStorage.setItem(`revenue_${account}`, JSON.stringify(data));
  };
  
  return { getCache, setCache };
};
```

### 增量更新实现

```typescript
// hooks/useIncrementalRevenue.ts
export const useIncrementalRevenue = () => {
  const fetchIncremental = async (
    account: string,
    lastBlock: number
  ): Promise<number> => {
    const currentBlock = await provider.getBlockNumber();
    const blockDiff = currentBlock - lastBlock;
    
    // 如果区块差距太大，使用全量查询
    if (blockDiff > 10000) {
      return fetchFullRevenue(account);
    }
    
    // 增量查询
    const events = await protocolContract.queryFilter(
      protocolContract.filters.ReferralRewardPaid(account),
      lastBlock + 1,
      currentBlock
    );
    
    // 计算新增收益
    const newRevenue = events.reduce((sum, event) => {
      return sum + parseFloat(ethers.formatEther(event.args[2]));
    }, 0);
    
    return newRevenue;
  };
  
  return { fetchIncremental };
};
```

## ✅ 测试计划

1. **单元测试**:
   - 缓存读写测试
   - 增量计算测试
   - 数据验证测试

2. **集成测试**:
   - 端到端数据流测试
   - 错误场景测试
   - 性能测试

3. **用户测试**:
   - 加载速度测试
   - 数据准确性验证
   - 用户体验测试

## 📌 注意事项

1. **向后兼容**: 确保新实现不影响现有功能
2. **错误处理**: 所有数据源都可能失败，需要降级方案
3. **缓存失效**: 确保缓存不会导致显示过时数据
4. **区块确认**: 考虑未确认区块的处理
5. **网络优化**: 考虑使用RPC代理和缓存

