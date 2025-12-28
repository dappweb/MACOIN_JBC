# 静态奖励显示问题修复设计文档

## 概述

通过对代码的深入分析，发现静态奖励不显示的问题可能源于以下几个方面：
1. 用户没有活跃的质押记录
2. 质押时间不足以产生奖励
3. 用户未调用 claimRewards 函数
4. 前端事件监听或数据解析问题
5. 缓存机制导致的数据不同步

## 架构

### 数据流架构
```
用户质押 → 合约计算静态奖励 → 用户调用claimRewards → 触发RewardClaimed事件 → 前端监听事件 → 更新UI显示
```

### 组件交互
- **MiningPanel**: 提供领取奖励的界面
- **LiquidityPositions**: 显示质押状态和待领取奖励
- **EarningsDetail**: 显示历史奖励记录和统计
- **合约**: 计算和发放静态奖励

## 组件和接口

### 1. 合约接口分析

#### claimRewards 函数
```solidity
function claimRewards() external nonReentrant {
    // 检查用户是否有活跃的门票
    Ticket storage ticket = userTicket[msg.sender];
    if (ticket.amount == 0 || ticket.exited) revert NotActive();
    
    // 遍历用户的质押记录
    Stake[] storage stakes = userStakes[msg.sender];
    uint256 totalPending = 0;
    
    // 计算每个质押的静态奖励
    for (uint256 i = 0; i < stakes.length; i++) {
        if (!stakes[i].active) continue;
        
        // 根据质押周期确定收益率
        uint256 ratePerBillion = 0;
        if (stakes[i].cycleDays == 7) ratePerBillion = 13333334;   // ~1.33%
        else if (stakes[i].cycleDays == 15) ratePerBillion = 16666667; // ~1.67%
        else if (stakes[i].cycleDays == 30) ratePerBillion = 20000000;  // ~2%
        
        // 计算已过时间单位
        uint256 unitsPassed = (block.timestamp - stakes[i].startTime) / SECONDS_IN_UNIT;
        if (unitsPassed > stakes[i].cycleDays) unitsPassed = stakes[i].cycleDays;
        
        // 计算应得奖励
        uint256 totalStaticShouldBe = (stakes[i].amount * ratePerBillion * unitsPassed) / 1000000000;
        
        // 计算待领取奖励
        if (totalStaticShouldBe > stakes[i].paid) {
            uint256 stakePending = totalStaticShouldBe - stakes[i].paid;
            totalPending += stakePending;
            stakes[i].paid += stakePending;
        }
    }
    
    // 检查收益上限
    if (userInfo[msg.sender].totalRevenue + totalPending > userInfo[msg.sender].currentCap) {
        totalPending = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
    }
    
    // 发放奖励并触发事件
    emit RewardClaimed(msg.sender, mcTransferred, jbcTransferred, REWARD_STATIC, ticket.ticketId);
}
```

### 2. 前端数据获取

#### EarningsDetail 组件的 fetchRecords 函数
```typescript
const fetchRecords = async (useCache = true) => {
    // 获取 RewardClaimed 事件
    const rewardEvents = await protocolContract.queryFilter(
        protocolContract.filters.RewardClaimed(targetUser), 
        fromBlock
    );
    
    // 解析事件数据
    for (const event of rewardEvents) {
        const rewardType = event.args ? Number(event.args[3]) : 0;
        // rewardType === 0 表示静态奖励
        if (rewardType === 0) {
            // 添加到记录中
        }
    }
}
```

#### dailyStats 计算逻辑
```typescript
const dailyStats = useMemo(() => {
    const stats = { static: { mc: 0, jbc: 0 } };
    
    records.forEach((row) => {
        if (row.timestamp >= oneDayAgo && row.rewardType === 0) {
            stats.static.mc += parseFloat(row.mcAmount || "0");
            stats.static.jbc += parseFloat(row.jbcAmount || "0");
        }
    });
    
    return stats;
}, [records]);
```

## 数据模型

### 质押记录结构
```typescript
interface StakePosition {
    id: string;
    amount: string;        // 质押金额
    startTime: number;     // 开始时间
    cycleDays: number;     // 质押周期 (7/15/30天)
    active: boolean;       // 是否活跃
    paid: string;          // 已支付金额
    staticReward: string;  // 待领取静态奖励
    pendingMc: string;     // 待领取MC
    pendingJbc: string;    // 待领取JBC
}
```

### 奖励记录结构
```typescript
interface RewardRecord {
    hash: string;          // 交易哈希
    user: string;          // 用户地址
    mcAmount: string;      // MC奖励金额
    jbcAmount: string;     // JBC奖励金额
    rewardType: number;    // 奖励类型 (0=静态奖励)
    ticketId: string;      // 门票ID
    timestamp: number;     // 时间戳
    status: string;        // 状态
}
```

## 问题诊断流程

### 1. 检查用户质押状态
```typescript
// 检查用户是否有质押记录
const stakes = await protocolContract.userStakes(account, 0);
if (!stakes || stakes.amount === 0n) {
    console.log("用户没有质押记录");
    return;
}

// 检查质押是否活跃
if (!stakes.active) {
    console.log("质押已结束或被赎回");
    return;
}
```

### 2. 检查门票状态
```typescript
// 检查用户是否有有效门票
const ticket = await protocolContract.userTicket(account);
if (ticket.amount === 0n || ticket.exited) {
    console.log("用户没有有效门票，无法领取静态奖励");
    return;
}
```

### 3. 计算待领取奖励
```typescript
// 计算当前应得的静态奖励
const currentTime = Math.floor(Date.now() / 1000);
const unitsPassed = Math.floor((currentTime - stakes.startTime) / SECONDS_IN_UNIT);
const ratePerBillion = stakes.cycleDays === 7 ? 13333334 : 
                      stakes.cycleDays === 15 ? 16666667 : 20000000;

const totalStaticShouldBe = (stakes.amount * BigInt(ratePerBillion) * BigInt(unitsPassed)) / 1000000000n;
const pending = totalStaticShouldBe > stakes.paid ? totalStaticShouldBe - stakes.paid : 0n;

console.log("待领取静态奖励:", ethers.formatEther(pending), "MC");
```

### 4. 检查收益上限
```typescript
// 检查用户是否达到收益上限
const userInfo = await protocolContract.userInfo(account);
const remainingCap = userInfo.currentCap - userInfo.totalRevenue;

if (remainingCap <= 0n) {
    console.log("用户已达到收益上限，无法继续获得奖励");
    return;
}
```

## 错误处理

### 常见错误场景

1. **NoRewards 错误**: 用户没有待领取的静态奖励
   - 原因：质押时间不足或已全部领取
   - 解决：等待更多时间或检查质押状态

2. **NotActive 错误**: 用户没有活跃的门票
   - 原因：门票已过期或被退出
   - 解决：重新购买门票

3. **事件解析失败**: 前端无法正确解析 RewardClaimed 事件
   - 原因：ABI不匹配或事件结构变化
   - 解决：更新ABI或修复解析逻辑

4. **缓存问题**: 显示的是旧数据
   - 原因：缓存未及时更新
   - 解决：强制刷新或清除缓存

## 测试策略

### 单元测试
- 测试 dailyStats 计算逻辑的正确性
- 测试事件解析函数的各种输入场景
- 测试缓存机制的读写操作

### 集成测试
- 测试完整的质押→领取→显示流程
- 测试不同质押周期的奖励计算
- 测试收益上限的约束逻辑

### 属性测试
- **属性1**: 对于任何有效的质押记录，如果时间足够，应该能计算出正确的静态奖励
- **属性2**: 对于任何 RewardClaimed 事件，如果 rewardType 为 0，应该被正确分类为静态奖励
- **属性3**: 对于任何24小时内的静态奖励记录，dailyStats 的计算结果应该等于所有记录的总和

**验证需求**: 
- 属性1 验证需求 2.1, 2.4
- 属性2 验证需求 1.3, 1.4  
- 属性3 验证需求 1.5, 3.3