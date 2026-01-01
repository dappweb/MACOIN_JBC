# Direct Reward (24h) 和 Level Reward (24h) 机制算法详解

## 概述

本文档详细说明直推奖励（Direct Reward）和层级奖励（Level Reward）的机制、算法和实现细节。

---

## 1. Direct Reward (直推奖励) - 25%

### 1.1 基本机制

**触发时机**: 用户购买门票时立即分发

**奖励比例**: 门票金额的 **25%**

**分发对象**: 直接推荐人（Referrer）

### 1.2 算法实现

#### 合约代码 (JinbaoProtocolV4.sol)

```solidity
function _distributeTicketRewards(address user, uint256 amount, uint256 ticketId) internal {
    // 直推奖励
    address referrerAddr = userInfo[user].referrer;
    if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
        uint256 directAmt = (amount * directRewardPercent) / 100;  // 25%
        uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
        if (paid > 0) {
            emit ReferralRewardPaid(referrerAddr, user, paid, 0, REWARD_DIRECT, ticketId);
        }
    } else {
        // 如果没有推荐人或推荐人不活跃，奖励转入营销钱包
        _transferNativeMC(marketingWallet, (amount * directRewardPercent) / 100);
    }
}
```

#### 计算公式

```
直推奖励金额 = 门票金额 × 25% / 100
```

**示例**:
- 用户购买 1000 MC 门票
- 直推奖励 = 1000 × 25% = **250 MC**
- 立即分发给推荐人

### 1.3 约束条件

1. **推荐人必须存在**: `referrerAddr != address(0)`
2. **推荐人必须活跃**: `userInfo[referrerAddr].isActive == true`
   - 拥有有效门票
   - 门票未退出（`ticket.exited == false`）
   - 门票金额 > 0
3. **3倍收益上限**: 奖励受用户收益上限约束
   ```solidity
   uint256 available = u.currentCap - u.totalRevenue;
   if (amount > available) {
       payout = available;  // 超出部分被截断
   }
   ```
4. **合约余额检查**: 确保合约有足够余额支付奖励

### 1.4 分发流程

```
用户购买门票
    ↓
检查推荐人是否存在且活跃
    ↓
是 → 计算奖励 (25%)
    ↓
检查推荐人收益上限
    ↓
分发奖励 (纯 MC)
    ↓
触发事件 ReferralRewardPaid
```

### 1.5 特殊情况处理

- **无推荐人**: 25% 奖励转入营销钱包
- **推荐人不活跃**: 25% 奖励转入营销钱包
- **达到收益上限**: 只分发可用部分，剩余部分丢失
- **合约余额不足**: 奖励分发失败，触发 `RewardCapped` 事件

---

## 2. Level Reward (层级奖励) - 15%

### 2.1 基本机制

**触发时机**: 用户购买门票时计算并分发

**总奖励池**: 门票金额的 **15%**

**分发方式**: 按层级逐层分发，每层 **1%**

**最大层级**: 最多 **15 层**

### 2.2 层级计算算法

#### 核心函数 (Tokenomics.sol)

```solidity
function getLevelRewardLayers(uint256 activeDirects) internal pure returns (uint256 layers) {
    if (activeDirects >= 3) return 15;  // 3+ 活跃直推 = 15层
    if (activeDirects >= 2) return 10;  // 2 活跃直推 = 10层
    if (activeDirects >= 1) return 5;    // 1 活跃直推 = 5层
    return 0;                           // 无活跃直推 = 0层
}
```

#### 层级规则表

| 活跃直推数 | 可获得层级数 | 每层奖励 | 总奖励 |
|-----------|------------|---------|--------|
| 0 | 0 层 | 0% | 0% |
| 1 | 5 层 | 1% | 5% |
| 2 | 10 层 | 1% | 10% |
| 3+ | 15 层 | 1% | 15% |

### 2.3 算法实现

#### 合约代码 (JinbaoProtocolV4.sol)

```solidity
function _distributeTicketLevelRewards(address user, uint256 amount) internal {
    address current = userInfo[user].referrer;  // 从直接推荐人开始
    uint256 totalDistributed = 0;
    uint256 layerCount = 0;
    uint256 iterations = 0;
    uint256 rewardPerLayer = (amount * TokenomicsLib.LEVEL_REWARD_PER_LAYER) / 100;  // 1%
    
    // 向上遍历推荐链，最多15层，最多迭代20次
    while (current != address(0) && layerCount < TokenomicsLib.MAX_LEVEL_LAYERS && iterations < 20) {
        // 跳过不活跃的用户
        if (!userInfo[current].isActive) {
            current = userInfo[current].referrer;
            iterations++;
            continue;
        }
        
        // 计算该用户可获得的最高层级数
        uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
        
        // 如果该用户可获得的层级数 > 当前层级，则分发奖励
        if (maxLayers > layerCount) {
            uint256 paid = _distributeReward(current, rewardPerLayer, REWARD_LEVEL);
            if (paid > 0) {
                totalDistributed += paid;
                emit ReferralRewardPaid(current, user, paid, 0, REWARD_LEVEL, userTicket[user].ticketId);
            }
        }
        
        // 继续向上遍历
        current = userInfo[current].referrer;
        layerCount++;
        iterations++;
    }
    
    // 计算未分发的奖励
    uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;  // 15%
    uint256 remaining = totalLevelRewardAmount - totalDistributed;
    if (remaining > 0) {
        levelRewardPool += remaining;  // 未分发部分进入奖励池
    }
}
```

### 2.4 分发流程详解

#### 步骤 1: 初始化
```
当前层级 = 0
每层奖励 = 门票金额 × 1%
总已分发 = 0
```

#### 步骤 2: 向上遍历推荐链
```
从直接推荐人开始，逐层向上遍历：
    ↓
检查用户是否活跃
    ↓
是 → 计算该用户可获得的最高层级数
    ↓
如果 最高层级数 > 当前层级
    ↓
分发 1% 奖励给该用户
    ↓
当前层级 +1
    ↓
继续向上遍历
```

#### 步骤 3: 处理未分发奖励
```
总奖励池 = 门票金额 × 15%
未分发 = 总奖励池 - 已分发
    ↓
如果 未分发 > 0
    ↓
存入 levelRewardPool
```

### 2.5 计算示例

#### 示例 1: 完整分发

**场景**: 用户购买 1000 MC 门票，推荐链完整且所有用户都活跃

```
门票金额: 1000 MC
总层级奖励池: 1000 × 15% = 150 MC
每层奖励: 1000 × 1% = 10 MC

推荐链结构:
- 第1层推荐人: 3个活跃直推 → 可获得15层 → 获得 10 MC
- 第2层推荐人: 2个活跃直推 → 可获得10层 → 获得 10 MC
- 第3层推荐人: 1个活跃直推 → 可获得5层 → 获得 10 MC
- 第4-15层推荐人: 各获得 10 MC

总分发: 15层 × 10 MC = 150 MC
未分发: 0 MC
```

#### 示例 2: 部分分发

**场景**: 用户购买 1000 MC 门票，但推荐链不完整

```
门票金额: 1000 MC
总层级奖励池: 150 MC
每层奖励: 10 MC

推荐链结构:
- 第1层推荐人: 3个活跃直推 → 获得 10 MC
- 第2层推荐人: 2个活跃直推 → 获得 10 MC
- 第3层推荐人: 1个活跃直推 → 获得 10 MC
- 第4层推荐人: 0个活跃直推 → 跳过（不活跃）
- 第5层推荐人: 不存在 → 停止遍历

实际分发: 3层 × 10 MC = 30 MC
未分发: 150 - 30 = 120 MC → 进入 levelRewardPool
```

#### 示例 3: 层级限制

**场景**: 第1层推荐人只有1个活跃直推

```
门票金额: 1000 MC
每层奖励: 10 MC

推荐链结构:
- 第1层推荐人: 1个活跃直推 → 只能获得5层 → 获得 10 MC
- 第2层推荐人: 3个活跃直推 → 只能获得5层（因为当前层级=1，maxLayers=15，15>1）→ 获得 10 MC
- 第3层推荐人: 2个活跃直推 → 只能获得5层（maxLayers=10，10>2）→ 获得 10 MC
- 第4-5层推荐人: 各获得 10 MC
- 第6层推荐人: 虽然存在，但 maxLayers(10) 不大于当前层级(5)，不获得奖励

实际分发: 5层 × 10 MC = 50 MC
未分发: 150 - 50 = 100 MC → 进入 levelRewardPool
```

### 2.6 约束条件

1. **用户必须活跃**: 只有活跃用户才能获得层级奖励
2. **层级限制**: 根据活跃直推数决定可获得的最高层级
3. **3倍收益上限**: 每层奖励受用户收益上限约束
4. **遍历限制**: 最多遍历20次，防止无限循环
5. **最大层级**: 最多分发15层

### 2.7 奖励池机制

**未分发奖励处理**:
- 如果总奖励池（15%）未完全分发
- 剩余部分存入 `levelRewardPool`
- 管理员可以通过 `withdrawLevelRewardPool()` 提取

**奖励池用途**:
- 补偿因推荐链不完整导致的未分发奖励
- 可用于未来奖励机制调整
- 可由管理员提取用于其他用途

---

## 3. 24小时统计机制

### 3.1 前端统计逻辑 (EarningsDetail.tsx)

```typescript
const dailyStats = useMemo(() => {
    const stats = {
        static: { mc: 0, jbc: 0 },
        direct: { mc: 0, jbc: 0 },
        level: { mc: 0, jbc: 0 },
        differential: { mc: 0, jbc: 0 },
    }

    const now = Math.floor(Date.now() / 1000)
    const oneDayAgo = now - 24 * 3600

    records.forEach((row) => {
        if (row.timestamp >= oneDayAgo) {  // 24小时内
            const mc = parseFloat(row.mcAmount || "0")
            const jbc = parseFloat(row.jbcAmount || "0")

            if (row.rewardType === 2) {  // Direct Reward
                stats.direct.mc += mc
                stats.direct.jbc += jbc
            } else if (row.rewardType === 3) {  // Level Reward
                stats.level.mc += mc
                stats.level.jbc += jbc
            }
        }
    })

    return stats
}, [records, viewMode, account])
```

### 3.2 数据来源

**事件监听**:
- `ReferralRewardPaid`: 包含直推奖励和层级奖励事件
- 事件参数:
  ```solidity
  event ReferralRewardPaid(
      address indexed user,      // 接收奖励的用户
      address indexed from,       // 触发奖励的用户
      uint256 mcAmount,          // MC 奖励金额
      uint256 jbcAmount,         // JBC 奖励金额（层级奖励为0）
      uint8 rewardType,          // 2=直推, 3=层级
      uint256 ticketId           // 门票ID
  )
  ```

### 3.3 显示逻辑

**Direct Reward (24h)**:
- 显示过去24小时内所有直推奖励的 MC 总和
- 如果 JBC > 0，也显示 JBC 总和（通常为0，因为直推奖励是纯MC）

**Level Reward (24h)**:
- 显示过去24小时内所有层级奖励的 MC 总和
- 如果 JBC > 0，也显示 JBC 总和（通常为0，因为层级奖励是纯MC）

---

## 4. 对比总结

| 特性 | Direct Reward | Level Reward |
|-----|--------------|--------------|
| **奖励比例** | 25% | 15% (总池) |
| **分发方式** | 立即分发，一次性 | 逐层分发，每层1% |
| **分发对象** | 直接推荐人 | 推荐链上的多个用户 |
| **最大层级** | 1层 | 15层 |
| **每层奖励** | 25% | 1% |
| **约束条件** | 推荐人必须活跃 | 每层用户必须活跃且有足够活跃直推 |
| **未分发处理** | 转入营销钱包 | 进入奖励池 |
| **奖励类型** | REWARD_DIRECT (2) | REWARD_LEVEL (3) |
| **代币类型** | 纯 MC | 纯 MC |

---

## 5. 关键代码位置

### 合约代码
- **直推奖励分发**: `contracts/JinbaoProtocolV4.sol:681-692`
- **层级奖励分发**: `contracts/JinbaoProtocolV4.sol:818-852`
- **层级计算**: `contracts/Tokenomics.sol:303-308`
- **奖励分发核心**: `contracts/JinbaoProtocolV4.sol:743-780`

### 前端代码
- **24小时统计**: `components/EarningsDetail.tsx:642-681`
- **事件监听**: `components/EarningsDetail.tsx:470-514`
- **UI显示**: `components/EarningsDetail.tsx:1014-1027`

---

## 6. 常见问题

### Q1: 为什么我的层级奖励显示为0？
**A**: 可能原因：
1. 推荐链不完整（推荐人不存在）
2. 推荐链上的用户不活跃
3. 推荐链上的用户活跃直推数不足，无法获得对应层级
4. 24小时内没有新的层级奖励事件

### Q2: 层级奖励的"15%"是如何分配的？
**A**: 
- 总池是15%，但按每层1%分发
- 最多分发15层，每层1%
- 如果推荐链不完整，未分发部分进入奖励池

### Q3: 直推奖励和层级奖励可以同时获得吗？
**A**: 可以。当用户购买门票时：
- 直接推荐人获得25%直推奖励
- 推荐链上的多个用户可能获得层级奖励（每层1%）

### Q4: 为什么有些层级奖励没有分发？
**A**: 可能原因：
1. 推荐链上的用户不活跃
2. 用户的活跃直推数不足，无法获得对应层级
3. 推荐链不完整（推荐人不存在）
4. 用户达到收益上限，无法接收更多奖励

---

## 7. 优化建议

1. **奖励池利用**: 考虑将未分发的层级奖励用于其他激励机制
2. **层级优化**: 可以考虑根据团队规模动态调整层级奖励比例
3. **透明度**: 在前端显示奖励池余额和未分发原因
4. **统计优化**: 增加更详细的层级奖励统计，如每层分发情况

---

**文档版本**: 1.0  
**最后更新**: 2024  
**维护者**: 开发团队

