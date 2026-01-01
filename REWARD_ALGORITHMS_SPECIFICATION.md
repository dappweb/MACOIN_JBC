# 🏆 Jinbao Protocol 四种奖励机制算法详细规范

## 📋 概述

基于合约代码分析，为您提供四种奖励机制的完整算法规范，用于核实当前实现是否与确认的机制匹配。

---

## 1️⃣ 💎 静态奖励 (REWARD_STATIC = 0)

### 🎯 基本机制
静态奖励是用户通过质押流动性获得的固定收益，采用**50% MC + 50% JBC**的双币分配模式。

### 📊 算法规范

#### 收益率计算
```solidity
function _getRate(uint256 cycleDays) private pure returns (uint256) {
    if (cycleDays == 7) return 13333334;   // 1.33% 日收益率
    if (cycleDays == 15) return 16666667;  // 1.67% 日收益率
    return 20000000;                       // 2.0% 日收益率 (30天)
}
```

#### 静态奖励计算公式
```solidity
function _calculateStakeReward(Stake storage stake) internal view returns (uint256) {
    uint256 ratePerBillion = _getRate(stake.cycleDays);
    uint256 unitsPassed = (block.timestamp - stake.startTime) / SECONDS_IN_UNIT;
    if (unitsPassed > stake.cycleDays) unitsPassed = stake.cycleDays;
    
    if (unitsPassed == 0) return 0;
    
    uint256 totalStaticShouldBe = (stake.amount * ratePerBillion * unitsPassed) / 1000000000;
    if (totalStaticShouldBe > stake.paid) {
        return totalStaticShouldBe - stake.paid;
    }
    return 0;
}
```

#### 分配机制
```solidity
// 50% MC + 50% JBC 分配
uint256 mcPart = totalPending / 2;
uint256 jbcValuePart = totalPending / 2;

// JBC数量根据当前汇率计算
uint256 jbcPrice = (swapReserveMC * 1e18) / swapReserveJBC;
uint256 jbcAmount = (jbcValuePart * 1e18) / jbcPrice;
```

### 📈 算法参数
| 参数 | Test环境 | P-Prod环境 | 说明 |
|------|---------|-----------|------|
| **时间单位** | 60秒 | 86400秒 | SECONDS_IN_UNIT |
| **7天收益率** | 1.33%/天 | 1.33%/天 | 13333334/1e9 |
| **15天收益率** | 1.67%/天 | 1.67%/天 | 16666667/1e9 |
| **30天收益率** | 2.0%/天 | 2.0%/天 | 20000000/1e9 |

### 🔄 触发条件
- 用户必须有有效门票 (`ticket.amount > 0`)
- 用户未退出 (`!ticket.exited`)
- 质押周期为 7/15/30 天
- 质押时间 > 0

---

## 2️⃣ ⚡ 动态奖励 (REWARD_DYNAMIC = 1) - 已弃用

### ❌ 当前状态
```solidity
uint8 public constant REWARD_DYNAMIC = 1;  // 已弃用，不再分发
```

### 🔍 算法规范
- **计算逻辑**: 无 (已完全弃用)
- **分配方式**: 无
- **触发条件**: 无
- **返回值**: 始终为 0

### 💡 替代机制
动态奖励已被**级差奖励 (REWARD_DIFFERENTIAL)**完全取代。

---

## 3️⃣ 📊 级差奖励 (REWARD_DIFFERENTIAL = 4)

### 🎯 基本机制
级差奖励是基于团队建设的核心奖励系统，采用**V0-V9等级制度**和**50% MC + 50% JBC**分配模式。

### 📊 算法规范

#### V等级计算
```solidity
function _getLevel(uint256 teamCount) internal pure returns (uint256 level, uint256 percent) {
    if (teamCount >= 100000) return (9, 45);  // V9: 100,000人，45%
    if (teamCount >= 30000) return (8, 40);   // V8: 30,000人，40%
    if (teamCount >= 10000) return (7, 35);   // V7: 10,000人，35%
    if (teamCount >= 3000) return (6, 30);    // V6: 3,000人，30%
    if (teamCount >= 1000) return (5, 25);    // V5: 1,000人，25%
    if (teamCount >= 300) return (4, 20);     // V4: 300人，20%
    if (teamCount >= 100) return (3, 15);     // V3: 100人，15%
    if (teamCount >= 30) return (2, 10);      // V2: 30人，10%
    if (teamCount >= 10) return (1, 5);       // V1: 10人，5%
    return (0, 0);                            // V0: <10人，0%
}
```

#### 级差奖励计算
```solidity
function _distributeDifferentialReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
    // 50/50 分配
    uint256 mcPart = amount / 2;
    uint256 jbcValuePart = amount / 2;
    
    // 计算 JBC 价格和数量
    uint256 jbcPrice = _getCurrentJBCPrice();
    uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
    
    // 安全转账
    (uint256 mcTransferred, uint256 jbcTransferred) = _safeTransferDifferentialReward(user, mcPart, jbcAmount);
    
    // 计算实际分配的总价值
    uint256 actualValue = mcTransferred + ((jbcTransferred * jbcPrice) / 1 ether);
    
    return actualValue;
}
```

#### JBC价格计算
```solidity
function _getCurrentJBCPrice() internal view returns (uint256) {
    // 检查最小流动性
    if (swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY) {
        return 1 ether; // 1:1 默认比例
    }
    
    // 计算价格: JBC价格 = MC储备 / JBC储备
    uint256 rawPrice = (swapReserveMC * 1 ether) / swapReserveJBC;
    
    // 应用价格保护 (0.1 - 10 MC per JBC)
    return _applyPriceProtection(rawPrice);
}
```

### 🏅 V等级体系
| 等级 | 团队要求 | 级差收益率 | 算法常量 |
|------|---------|-----------|----------|
| **V0** | <10人 | 0% | (0, 0) |
| **V1** | ≥10人 | 5% | (1, 5) |
| **V2** | ≥30人 | 10% | (2, 10) |
| **V3** | ≥100人 | 15% | (3, 15) |
| **V4** | ≥300人 | 20% | (4, 20) |
| **V5** | ≥1,000人 | 25% | (5, 25) |
| **V6** | ≥3,000人 | 30% | (6, 30) |
| **V7** | ≥10,000人 | 35% | (7, 35) |
| **V8** | ≥30,000人 | 40% | (8, 40) |
| **V9** | ≥100,000人 | 45% | (9, 45) |

### 🔄 触发条件
- 下级用户进行质押时触发
- 基于质押金额和上级V等级计算
- 沿推荐链向上分发

---

## 4️⃣ 🔗 层级奖励 (REWARD_LEVEL = 3)

### 🎯 基本机制
层级奖励是多层级的推荐奖励系统，根据推荐人的活跃直推数量决定可获得的奖励层数。

### 📊 算法规范

#### 层级配置计算
```solidity
function getLevelRewardLayers(uint256 activeDirects) public pure returns (uint256) {
    if (activeDirects >= 3) return 15;  // 15层，每层1%
    if (activeDirects >= 2) return 10;  // 10层，每层1%
    if (activeDirects >= 1) return 5;   // 5层，每层1%
    return 0;                           // 无层级奖励
}
```

#### 层级奖励分发算法
```solidity
function _distributeTicketLevelRewards(address user, uint256 amount) internal {
    address current = userInfo[user].referrer;
    uint256 totalDistributed = 0;
    uint256 layerCount = 0;
    uint256 iterations = 0;
    uint256 rewardPerLayer = (amount * 1) / 100; // 每层1%
    
    while (current != address(0) && layerCount < 15 && iterations < 20) {
        if (!userInfo[current].isActive) {
            current = userInfo[current].referrer;
            iterations++;
            continue;
        }
        
        uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
        
        if (maxLayers > layerCount) {
            uint256 paid = _distributeReward(current, rewardPerLayer, REWARD_LEVEL);
            
            if (paid > 0) {
                totalDistributed += paid;
                emit ReferralRewardPaid(current, user, paid, 0, REWARD_LEVEL, userTicket[user].ticketId);
            }
        }
        
        current = userInfo[current].referrer;
        layerCount++;
        iterations++;
    }
    
    // 处理剩余奖励池
    uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;
    uint256 remaining = totalLevelRewardAmount - totalDistributed;
    if (remaining > 0) {
        levelRewardPool += remaining;
    }
}
```

### 📈 层级配置表
| 活跃直推数 | 可获得层数 | 每层奖励 | 总奖励上限 |
|-----------|-----------|----------|-----------|
| **≥3人** | 15层 | 1% | 15% |
| **≥2人** | 10层 | 1% | 10% |
| **≥1人** | 5层 | 1% | 5% |
| **0人** | 0层 | 0% | 0% |

### 🔄 分配逻辑
1. **向上遍历**: 从购买者的推荐人开始
2. **活跃检查**: 只有活跃用户才能获得奖励
3. **层数限制**: 根据活跃直推数确定层数
4. **剩余处理**: 未分发完的进入层级奖励池

### 💰 奖励计算公式
```
总层级奖励池 = 门票金额 × 15%
每层奖励 = 门票金额 × 1%
实际分发层数 = min(15, 推荐人活跃直推对应层数)
剩余奖励 = 总奖励池 - 实际分发金额 → 进入levelRewardPool
```

---

## 🔄 奖励分发流程对比

### 门票购买触发
```solidity
function buyTicket(uint256 amount) external {
    // 1. 直推奖励 (25% MC)
    uint256 directAmt = (amount * directRewardPercent) / 100;
    _distributeReward(referrer, directAmt, REWARD_DIRECT);
    
    // 2. 层级奖励 (15% MC，分15层)
    _distributeTicketLevelRewards(msg.sender, amount);
    
    // 3. 其他费用分配
    // 营销 5% + 回购 5% + LP 25% + 国库 25%
}
```

### 质押流动性触发
```solidity
function stakeLiquidity(uint256 amount, uint256 cycleDays) external {
    // 1. 级差奖励计算和记录
    _recordDifferentialRewards(msg.sender, amount);
    
    // 2. 静态奖励开始计算
    // 基于质押金额、周期和时间累积
}
```

---

## 📊 算法参数对比表

| 奖励类型 | 触发条件 | 计算基础 | 分配方式 | 分配比例 |
|----------|----------|----------|----------|----------|
| **静态奖励** | 质押流动性 | 质押金额×时间×收益率 | 50% MC + 50% JBC | 1.33%-2.0%/天 |
| **动态奖励** | 无 (已弃用) | 无 | 无 | 0% |
| **级差奖励** | 下级质押 | 质押金额×V等级收益率 | 50% MC + 50% JBC | 0%-45% |
| **层级奖励** | 门票购买 | 门票金额×层级比例 | 纯MC | 每层1%，最多15层 |

---

## 🔍 核实要点

### 1. **静态奖励核实**
- ✅ 收益率: 7天1.33%、15天1.67%、30天2.0%
- ✅ 分配方式: 50% MC + 50% JBC
- ✅ 时间单位: Test环境60秒，Prod环境86400秒

### 2. **动态奖励核实**
- ✅ 状态: 完全弃用，不再分发
- ✅ 替代: 级差奖励系统

### 3. **级差奖励核实**
- ✅ V等级: V0(0%) 到 V9(45%)
- ✅ 团队要求: V1需要10人，V9需要100,000人
- ✅ 分配方式: 50% MC + 50% JBC

### 4. **层级奖励核实**
- ✅ 层级配置: 1人5层、2人10层、3人15层
- ✅ 每层奖励: 1%
- ✅ 分配方式: 纯MC

---

## 💡 算法优化建议

### 性能优化
1. **递归深度限制**: 所有向上遍历限制在20-30层
2. **Gas优化**: 批量处理和事件优化
3. **状态检查**: 提前检查用户活跃状态

### 安全机制
1. **收益上限**: 门票价格的3倍
2. **流动性保护**: JBC分配不超过储备的5%
3. **价格保护**: JBC价格限制在0.1-10 MC范围

### 用户体验
1. **透明计算**: 所有算法公开透明
2. **实时查询**: 支持实时收益查询
3. **事件记录**: 完整的奖励分发事件

---

**📅 规范日期**: 2025年12月31日  
**🔍 数据来源**: 合约源码分析  
**🎯 用途**: 算法核实和实现验证