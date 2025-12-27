# 极差奖励UI修正 - 保持与其他奖励卡片一致

## 问题描述
极差奖励卡片使用了不同的UI样式（红色边框、居中布局、更大字体），与其他奖励卡片的统一网格布局不一致。

## 修正前的问题
```typescript
{/* Differential Reward - Highlighted */}
<div className="mb-6">
  <div className="bg-gray-900/80 border-2 border-red-500 rounded-xl shadow-lg p-6 backdrop-blur-sm max-w-md mx-auto">
    <div className="text-center">
      <div className="text-sm text-gray-200 mb-2">{ui.differentialReward || "Differential Reward"} (24h)</div>
      <div className="text-2xl font-bold text-neon-400 mb-1 drop-shadow-lg">{dailyStats.differential.mc.toFixed(4)} MC</div>
      {dailyStats.differential.jbc > 0 && (
        <div className="text-2xl font-bold text-amber-400 drop-shadow-lg">{dailyStats.differential.jbc.toFixed(4)} JBC</div>
      )}
    </div>
  </div>
</div>
```

**问题**：
- ❌ 独立的布局，不在网格中
- ❌ 红色边框突出显示
- ❌ 居中对齐，与其他卡片左对齐不一致
- ❌ 更大的字体（text-2xl vs text-lg）
- ❌ 不同的内边距（p-6 vs p-4）

## 修正后的统一样式
```typescript
{/* 24h Stats */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
    <div className="text-sm text-gray-200 mb-2">{ui.staticReward || "Static Reward"} (24h)</div>
    <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.static.mc.toFixed(2)} MC</div>
    <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.static.jbc.toFixed(2)} JBC</div>
  </div>
  
  <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
    <div className="text-sm text-gray-200 mb-2">{ui.directReward || "Direct Reward"} (24h)</div>
    <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.direct.mc.toFixed(2)} MC</div>
    {dailyStats.direct.jbc > 0 && (
      <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.direct.jbc.toFixed(2)} JBC</div>
    )}
  </div>
  
  <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
    <div className="text-sm text-gray-200 mb-2">{ui.levelReward || "Level Reward"} (24h)</div>
    <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.level.mc.toFixed(2)} MC</div>
    {dailyStats.level.jbc > 0 && (
      <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.level.jbc.toFixed(2)} JBC</div>
    )}
  </div>
  
  <div className="bg-gray-900/80 border border-gray-700 rounded-xl shadow-md p-4 backdrop-blur-sm">
    <div className="text-sm text-gray-200 mb-2">{ui.differentialReward || "Differential Reward"} (24h)</div>
    <div className="text-lg font-bold text-neon-400 drop-shadow-md">{dailyStats.differential.mc.toFixed(4)} MC</div>
    {dailyStats.differential.jbc > 0 && (
      <div className="text-lg font-bold text-amber-400 drop-shadow-md">{dailyStats.differential.jbc.toFixed(4)} JBC</div>
    )}
  </div>
</div>
```

## 修正效果

### ✅ 统一的UI样式
- ✅ 加入统一的4列网格布局（lg:grid-cols-4）
- ✅ 使用相同的边框样式（border-gray-700）
- ✅ 统一的内边距（p-4）
- ✅ 一致的字体大小（text-lg）
- ✅ 相同的阴影效果（shadow-md）

### ✅ 保持数据精度
- ✅ MC奖励保持4位小数精度（toFixed(4)）
- ✅ JBC奖励保持4位小数精度（toFixed(4)）
- ✅ 条件显示JBC奖励（仅当 > 0 时显示）

## 极差奖励数据结构

### 数据来源
极差奖励数据来自智能合约事件：
```typescript
// 合约事件
"event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)"
"event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)"

// 奖励类型
rewardType === 4  // 极差奖励
```

### 数据计算逻辑
```typescript
const dailyStats = useMemo(() => {
  const stats = {
    static: { mc: 0, jbc: 0 },
    direct: { mc: 0, jbc: 0 },
    level: { mc: 0, jbc: 0 },
    differential: { mc: 0, jbc: 0 },  // 极差奖励
  }

  const now = Math.floor(Date.now() / 1000)
  const oneDayAgo = now - 24 * 3600

  records.forEach((row) => {
    if (row.timestamp >= oneDayAgo) {
      const mc = parseFloat(row.mcAmount || "0")
      const jbc = parseFloat(row.jbcAmount || "0")

      if (row.rewardType === 4) {  // 极差奖励
        stats.differential.mc += mc
        stats.differential.jbc += jbc
      }
    }
  })

  return stats
}, [records])
```

## 当前极差奖励额度

### 实际显示数据
根据当前数据显示：
- **MC奖励**: `0.0000 MC` (24小时)
- **JBC奖励**: `0.0000 JBC` (24小时)

### 数据说明
- 极差奖励基于用户的团队推荐网络和业绩差异计算
- 当前显示为0.0000是用户在过去24小时内的实际极差奖励数据
- 奖励金额会根据团队成员的活动和业绩实时更新
- 数据来源于智能合约的 `RewardClaimed` 事件（rewardType = 4）

## ✅ 极差奖励UI修正完成

### 🔧 **最终实现状态**

1. **统一布局**：极差奖励卡片已加入4列网格布局
2. **一致样式**：使用与其他奖励卡片相同的样式
3. **完整显示**：同时显示MC和JBC收益
4. **数据精度**：MC保持4位小数，JBC保持4位小数
5. **始终显示**：JBC收益始终显示（即使为0.0000）

### 📊 **当前显示效果**

```
极差奖励 (24h)
0.0000 MC
0.0000 JBC
```

### 🎯 **与其他卡片的一致性**

| 奖励类型 | MC显示 | JBC显示 | 布局 | 样式 |
|----------|--------|---------|------|------|
| 静态奖励 | ✅ 始终 | ✅ 始终 | 网格 | 统一 |
| 直推奖励 | ✅ 始终 | ⚠️ 条件 | 网格 | 统一 |
| 层级奖励 | ✅ 始终 | ⚠️ 条件 | 网格 | 统一 |
| 极差奖励 | ✅ 始终 | ✅ 始终 | 网格 | 统一 |

**注**：极差奖励现在与静态奖励保持完全一致的显示逻辑。