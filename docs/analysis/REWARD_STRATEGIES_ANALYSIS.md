# 金宝协议奖励策略和页面逻辑分析

## 概述

本文档详细分析了当前已部署合约和前端代码中的各种重要奖励策略实现和页面逻辑。

## 奖励类型定义

根据合约定义，系统包含以下奖励类型：

```solidity
uint8 public constant REWARD_STATIC = 0;      // 静态奖励
uint8 public constant REWARD_DYNAMIC = 1;     // 动态奖励（通用）
uint8 public constant REWARD_DIRECT = 2;      // 直推奖励
uint8 public constant REWARD_LEVEL = 3;       // 层级奖励
uint8 public constant REWARD_DIFFERENTIAL = 4; // 极差奖励
```

## 1. 直推奖励 (Direct Reward) - 25%

### 合约实现策略
- **触发时机**: 用户购买门票时立即分发
- **奖励比例**: 25% 的门票金额
- **分发对象**: 直接推荐人
- **约束条件**: 
  - 推荐人必须有活跃门票且未达到3倍出局
  - 受3倍收益上限约束

### 前端页面逻辑
- **TeamLevel.tsx**: 显示直推奖励为25%，说明为"购买门票时立即获得25%奖励"
- **EarningsDetail.tsx**: 在奖励记录中显示为"Direct Reward"类型，使用UserPlus图标
- **StatsPanel.tsx**: 在24小时统计中单独统计直推奖励收益

## 2. 层级奖励 (Level Reward) - 15%

### 合约实现策略
- **触发时机**: 用户购买门票时计算并分发
- **奖励比例**: 每层1%，最多15层
- **分发逻辑**:
  ```solidity
  function getLevelRewardLayers(uint256 activeDirects) public pure returns (uint256) {
      if (activeDirects >= 3) return 15;  // 3+ 活跃直推 = 15层
      if (activeDirects >= 2) return 10;  // 2 活跃直推 = 10层
      if (activeDirects >= 1) return 5;   // 1 活跃直推 = 5层
      return 0;                           // 无活跃直推 = 0层
  }
  ```
- **未分发处理**: 未分发的奖励进入奖励池(levelRewardPool)

### 前端页面逻辑
- **TeamLevel.tsx**: 显示层级奖励详情：
  - 1层: 5层奖励
  - 2层: 10层奖励  
  - 3+层: 15层奖励
- **EarningsDetail.tsx**: 显示为"Level Reward"类型，使用Layers图标
- **StatsPanel.tsx**: 在24小时统计中单独统计层级奖励

## 3. 极差奖励 (Differential Reward)

### 合约实现策略
- **触发时机**: 用户质押流动性时计算并存储，赎回时释放
- **计算逻辑**: 基于团队等级的差额奖励
- **等级体系**:
  ```
  V0: 0%   (0 活跃直推)
  V1: 5%   (10+ 活跃直推)
  V2: 10%  (30+ 活跃直推)
  V3: 15%  (100+ 活跃直推)
  V4: 20%  (300+ 活跃直推)
  V5: 25%  (1000+ 活跃直推)
  V6: 30%  (3000+ 活跃直推)
  V7: 35%  (10000+ 活跃直推)
  V8: 40%  (30000+ 活跃直推)
  V9: 45%  (100000+ 活跃直推)
  ```
- **存储机制**: 质押时存储在`stakePendingRewards`映射中
- **释放机制**: 赎回流动性时释放给上级

### 前端页面逻辑
- **TeamLevel.tsx**: 显示用户当前等级和对应奖励比例
- **EarningsDetail.tsx**: 显示为"Differential Reward"类型，使用TrendingUp图标
- **StatsPanel.tsx**: 在24小时统计中单独统计极差奖励

## 4. 静态奖励 (Static Reward)

### 合约实现策略
- **触发时机**: 通过`claimRewards()`函数手动领取
- **计算基础**: 基于质押金额和时间的固定收益
- **约束条件**: 受3倍收益上限约束

### 前端页面逻辑
- **EarningsDetail.tsx**: 显示为"Static Reward"类型，使用Pickaxe图标
- **MiningPanel.tsx**: 提供"领取收益"按钮触发静态奖励领取

## 页面组件详细分析

### 1. EarningsDetail.tsx - 收益详情页面

**核心功能**:
- 显示所有类型的奖励记录
- 支持按奖励类型筛选
- 提供分页功能
- 支持管理员查看所有用户记录

**关键特性**:
- **缓存机制**: 5分钟缓存有效期，提升加载性能
- **实时刷新**: 监听收益变化事件自动刷新
- **过滤功能**: 排除动态奖励记录（`r.rewardType !== 1`）
- **统计功能**: 
  - 总收益统计（MC + JBC）
  - 24小时各类型奖励统计
  - 按类型分组显示

**数据获取逻辑**:
```typescript
// 获取奖励事件
const rewardEvents = await protocolContract.queryFilter(
  protocolContract.filters.RewardClaimed(targetUser), 
  fromBlock
)

// 获取推荐奖励事件
const referralEvents = await protocolContract.queryFilter(
  protocolContract.filters.ReferralRewardPaid(targetUser), 
  fromBlock
)
```

### 2. TeamLevel.tsx - 团队等级页面

**核心功能**:
- 显示用户当前等级和奖励比例
- 展示等级升级条件
- 管理推荐链接
- 显示直推网络数据

**关键特性**:
- **等级计算**: 基于活跃直推数量自动计算等级
- **推荐系统**: 
  - 推荐链接生成和复制
  - 推荐人绑定功能
  - 直推用户列表显示
- **网络统计**:
  - 直推用户总门票金额
  - 预期总收益上限（3倍）
  - 用户活跃状态

### 3. StatsPanel.tsx - 统计面板

**核心功能**:
- 显示用户资产概览
- 实时价格图表
- 收益统计

**关键特性**:
- **实时数据**: 使用全局刷新机制和实时价格Hook
- **价格图表**: 24小时价格走势，支持EMA指标
- **多维统计**:
  - MC/JBC余额及USDT价值
  - 总收益（包含推荐奖励）
  - 团队等级和规模

### 4. TransactionHistory.tsx - 交易历史

**核心功能**:
- 显示所有交易记录
- 支持多维度筛选
- 交易详情查看

**支持的交易类型**:
- `ticket_purchased`: 门票购买
- `liquidity_staked`: 流动性质押
- `reward_claimed`: 奖励领取
- `redeemed`: 赎回操作
- `swap_mc_to_jbc`: MC换JBC
- `swap_jbc_to_mc`: JBC换MC

## 奖励分发流程

### 1. 门票购买时的奖励分发

```
用户购买门票 → 
├── 直推奖励 (25%) → 立即分发给推荐人
├── 层级奖励 (15%) → 按层级分发，未分发部分进入奖励池
├── 营销钱包 (10%)
├── 回购销毁 (20%)
├── LP注入 (20%)
└── 国库 (10%)
```

### 2. 流动性质押时的奖励计算

```
用户质押流动性 → 
├── 计算极差奖励 → 存储在stakePendingRewards中
└── 等待赎回时释放
```

### 3. 收益领取流程

```
用户调用claimRewards() → 
├── 检查门票状态
├── 计算静态收益
├── 检查3倍上限
└── 分发MC奖励
```

## 约束机制

### 1. 3倍收益上限
- 所有奖励都受用户门票金额3倍上限约束
- 达到上限后自动触发出局机制
- 出局时强制赎回所有质押（扣除手续费）

### 2. 活跃用户限制
- 只有拥有活跃门票且未出局的用户才能获得奖励
- 活跃状态影响推荐人的活跃直推数量统计

### 3. 时间约束
- 门票有效期限制（可配置）
- 质押周期限制

## 前端状态管理

### 1. 全局刷新机制
- 使用`useGlobalRefresh` Hook统一管理数据刷新
- 监听区块链事件自动触发相关组件刷新

### 2. 事件监听
各组件监听相关事件：
- `rewardsChanged`: 奖励变化
- `ticketStatusChanged`: 门票状态变化
- `stakingStatusChanged`: 质押状态变化
- `balanceUpdated`: 余额更新
- `priceUpdated`: 价格更新

### 3. 缓存策略
- EarningsDetail使用localStorage缓存奖励记录
- 5分钟缓存有效期
- 支持手动清除缓存

## 总结

当前系统实现了完整的多层次奖励机制：

1. **直推奖励**: 25%立即分发，激励直接推广
2. **层级奖励**: 15%按层级分发，激励团队建设
3. **极差奖励**: 基于等级差额的延迟奖励，激励等级提升
4. **静态奖励**: 基于质押的固定收益

前端页面提供了完整的奖励查看、统计和管理功能，通过实时数据更新和事件监听确保用户体验的流畅性。所有奖励都受到3倍收益上限的约束，确保系统的可持续性。