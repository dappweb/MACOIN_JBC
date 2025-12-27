# 极差奖励收入来源分析

## 极差奖励概述

极差奖励是基于团队层级和业绩差异的推荐奖励系统，当下级成员提供流动性时，上级推荐人可以获得相应的极差奖励。

## MC和JBC收益来源

### 1. MC收益来源

#### 主要来源：极差奖励计算
```solidity
// 基于团队人数的极差奖励计算
function _calculateAndStoreTeamBasedDifferentialRewards(address user, uint256 amount, uint256 stakeId) internal {
    address current = userInfo[user].referrer;
    uint256 previousPercent = 0;
    
    while (current != address(0) && iterations < 20) {
        // 获取上级的团队等级和奖励比例
        (, uint256 percent) = getLevelByTeamCount(userInfo[current].teamCount);
        
        if (percent > previousPercent) {
            uint256 diffPercent = percent - previousPercent;  // 极差百分比
            uint256 baseAmount = amount;
            if (baseAmount > uplineTicket.amount) {
                baseAmount = uplineTicket.amount;  // 不超过上级门票金额
            }
            uint256 reward = (baseAmount * diffPercent) / 100;  // 计算极差奖励
            
            // 存储待发放的奖励
            stakePendingRewards[stakeId].push(PendingReward({
                upline: current,
                amount: reward
            }));
        }
    }
}
```

#### 奖励等级和比例
```solidity
// 团队等级配置（基于团队总人数）
levelConfigs.push(LevelConfig(10000, 9, 45));  // V9: 10K团队, 45%
levelConfigs.push(LevelConfig(5000, 8, 40));   // V8: 5K团队, 40%
levelConfigs.push(LevelConfig(2000, 7, 35));   // V7: 2K团队, 35%
levelConfigs.push(LevelConfig(1000, 6, 30));   // V6: 1K团队, 30%
levelConfigs.push(LevelConfig(500, 5, 25));    // V5: 500团队, 25%
levelConfigs.push(LevelConfig(200, 4, 20));    // V4: 200团队, 20%
levelConfigs.push(LevelConfig(100, 3, 15));    // V3: 100团队, 15%
levelConfigs.push(LevelConfig(50, 2, 10));     // V2: 50团队, 10%
levelConfigs.push(LevelConfig(20, 1, 5));      // V1: 20团队, 5%
```

#### MC奖励分发逻辑
```solidity
function _distributeReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
    // 检查用户状态和收益上限
    uint256 available = u.currentCap - u.totalRevenue;
    uint256 payout = amount;
    
    if (amount > available) {
        payout = available;  // 不超过3倍收益上限
    }
    
    if (payout > 0) {
        u.totalRevenue += payout;
        mcToken.transfer(user, payout);  // 直接转账MC代币
        emit RewardPaid(user, payout, REWARD_DIFFERENTIAL);
    }
    
    return payout;
}
```

### 2. JBC收益来源

#### JBC奖励机制
极差奖励**主要以MC代币形式发放**，JBC收益来源于以下情况：

1. **静态收益的50/50分配**：
   ```solidity
   // 在claimRewards()中，静态收益按50% MC + 50% JBC分配
   uint256 mcValuePart = (totalPending * 50) / 100;  // 50% MC
   uint256 jbcValuePart = totalPending - mcValuePart; // 50% JBC价值
   
   uint256 jbcPrice = getJBCPrice();
   uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;  // 按当前价格计算JBC数量
   ```

2. **极差奖励的JBC部分**：
   - 极差奖励本身主要是MC代币
   - 但在某些情况下，可能通过合约内部逻辑转换为部分JBC
   - 或者通过用户后续的交换操作获得JBC

## 实际收益示例分析

### 基于截图数据的分析

从提供的截图可以看到：
- **极差奖励 (24h)**: `0.0000 MC`
- **JBC收益**: 未显示（当前为0或很小）

### 收益计算示例

假设用户A推荐了用户B，用户B提供了1000 MC的流动性：

1. **用户A的团队等级**: V3 (100人团队，15%奖励比例)
2. **用户A的上级**: V5 (500人团队，25%奖励比例)

**极差奖励计算**：
- 用户A获得：1000 MC × 15% = 150 MC
- 用户A的上级获得：1000 MC × (25% - 15%) = 100 MC (极差奖励)

## 收益触发条件

### 1. 触发时机
- 下级成员调用 `stakeLiquidity()` 提供流动性时
- 系统自动计算并存储极差奖励
- 在下级成员赎回时释放奖励

### 2. 奖励限制
- **收益上限**: 不超过门票金额的3倍
- **团队要求**: 必须达到相应的团队人数要求
- **活跃状态**: 推荐人必须处于活跃状态
- **门票限制**: 奖励金额不超过推荐人的门票金额

### 3. 奖励释放
```solidity
function _releaseDifferentialRewards(uint256 stakeId) internal {
    PendingReward[] memory rewards = stakePendingRewards[stakeId];
    for (uint256 i = 0; i < rewards.length; i++) {
        uint256 paid = _distributeReward(rewards[i].upline, rewards[i].amount, REWARD_DIFFERENTIAL);
        if (paid > 0) {
            emit ReferralRewardPaid(rewards[i].upline, from, paid, REWARD_DIFFERENTIAL, stakeId);
        }
    }
}
```

## 当前数据说明

### 为什么显示0.0000 MC？

1. **团队规模不足**: 用户可能还没有达到获得极差奖励的最低团队要求（20人）
2. **下级活动少**: 过去24小时内，下级成员没有进行流动性质押操作
3. **奖励已释放**: 之前的奖励可能已经在更早时间释放
4. **收益上限**: 可能已经达到3倍收益上限，无法获得更多奖励

### JBC收益的获得方式

1. **间接获得**: 通过静态收益的50/50分配机制
2. **交换获得**: 使用MC代币通过AMM交换获得JBC
3. **复合收益**: 极差奖励的MC可以用于购买更大门票，从而获得更多静态收益中的JBC部分

## 总结

- **MC收益**: 直接来自极差奖励计算，基于团队层级差异和下级流动性金额
- **JBC收益**: 主要通过静态收益的50/50分配机制获得，极差奖励本身主要是MC代币
- **当前状态**: 显示0.0000 MC是因为用户在过去24小时内没有符合条件的极差奖励触发事件
- **收益潜力**: 随着团队发展和下级活动增加，极差奖励会相应增长