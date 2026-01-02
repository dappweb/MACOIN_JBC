# 静态收益计算方法 (Static Reward Calculation)

## 📋 概述

静态收益是基于用户提供的流动性（Liquidity）计算的每日收益。用户可以选择不同的质押周期（7天、15天、30天），每个周期对应不同的日收益率。

## 🔢 核心计算公式

### 基本公式

```
总应得收益 = (质押金额 × 日收益率 × 已过天数) / 1,000,000,000
待领取收益 = 总应得收益 - 已领取收益
```

### 代码实现

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

## 📊 收益率配置

### 生产环境 (Production)

| 周期 | 天数 | 日收益率 (ratePerBillion) | 日收益率 (%) | 总收益率 (%) |
|------|------|---------------------------|--------------|--------------|
| 短期 | 7天  | 13,333,334                | 1.3333334%   | 9.33%        |
| 中期 | 15天 | 16,666,667                | 1.6666667%   | 25.00%       |
| 长期 | 30天 | 20,000,000                | 2.0%         | 60.00%       |

### 收益率获取函数

```solidity
function _getRate(uint256 cycleDays) private pure returns (uint256) {
    if (cycleDays == 7) return 13333334;
    if (cycleDays == 15) return 16666667;
    return 20000000;  // 30天
}
```

## ⏰ 时间单位

### 生产环境
- `SECONDS_IN_UNIT = 86400` (1天 = 24小时 × 60分钟 × 60秒)
- 按天数计算收益

### 测试环境
- `SECONDS_IN_UNIT = 60` (1分钟)
- 按分钟计算收益（用于快速测试）

## 💰 计算示例

### 示例 1: 7天周期

**参数：**
- 质押金额: 1000 MC
- 周期: 7天
- 已过天数: 3天
- 已领取收益: 0 MC

**计算：**
```
日收益率 = 13,333,334 / 1,000,000,000 = 0.013333334 (1.3333334%)
总应得收益 = (1000 × 13,333,334 × 3) / 1,000,000,000 = 40 MC
待领取收益 = 40 - 0 = 40 MC
```

### 示例 2: 30天周期

**参数：**
- 质押金额: 5000 MC
- 周期: 30天
- 已过天数: 15天
- 已领取收益: 1000 MC

**计算：**
```
日收益率 = 20,000,000 / 1,000,000,000 = 0.02 (2.0%)
总应得收益 = (5000 × 20,000,000 × 15) / 1,000,000,000 = 1500 MC
待领取收益 = 1500 - 1000 = 500 MC
```

## 🎯 收益分配机制

### 50% MC + 50% JBC 分配

静态收益按价值等分分配：
- **50% MC**: 直接以 MC 代币支付
- **50% JBC**: 按当前汇率计算等值的 JBC 代币

### 分配代码

```solidity
uint256 mcPart = totalPending / 2;
uint256 jbcValuePart = totalPending / 2;

// 根据流动性池计算 JBC 数量
uint256 jbcPrice = (reserveMC * 1 ether) / reserveJBC;
uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
```

### 汇率计算

```
JBC 价格 = MC 储备量 / JBC 储备量
JBC 数量 = (MC 价值部分 × 1e18) / JBC 价格
```

## 📈 收益上限约束

### 收益上限 (Current Cap)

每个用户都有收益上限，基于其门票等级：

```solidity
if (userInfo[msg.sender].totalRevenue + totalPending > userInfo[msg.sender].currentCap) {
    totalPending = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
}
```

### 达到上限后的处理

当用户达到收益上限时：
- 自动触发退出流程 (`_handleExit`)
- 停止产生新的静态收益
- 可以赎回流动性

## 🔄 多笔质押处理

如果用户有多笔质押，系统会遍历所有活跃质押：

```solidity
for (uint256 i = 0; i < stakes.length; i++) {
    if (!stakes[i].active) continue;
    
    uint256 pending = _calculateStakeReward(stakes[i]);
    totalPending += pending;
}
```

## 📝 前端计算示例

### JavaScript/TypeScript 实现

```typescript
function calculateStaticReward(
  stakeAmount: bigint,
  cycleDays: number,
  startTime: number,
  paidAmount: bigint,
  secondsInUnit: number = 86400
): bigint {
  // 获取日收益率
  let ratePerBillion = 0n;
  if (cycleDays === 7) ratePerBillion = 13333334n;
  else if (cycleDays === 15) ratePerBillion = 16666667n;
  else if (cycleDays === 30) ratePerBillion = 20000000n;
  else return 0n;
  
  // 计算已过天数
  const currentTime = Math.floor(Date.now() / 1000);
  const unitsPassed = Math.floor((currentTime - startTime) / secondsInUnit);
  const actualUnits = Math.min(unitsPassed, cycleDays);
  
  if (actualUnits <= 0) return 0n;
  
  // 计算总应得收益
  const totalStaticShouldBe = (stakeAmount * ratePerBillion * BigInt(actualUnits)) / 1000000000n;
  
  // 计算待领取收益
  const pending = totalStaticShouldBe > paidAmount 
    ? totalStaticShouldBe - paidAmount 
    : 0n;
  
  return pending;
}
```

## ⚠️ 重要注意事项

1. **时间单位**: 生产环境使用天数（86400秒），测试环境使用分钟（60秒）
2. **收益上限**: 受用户 `currentCap` 限制
3. **周期限制**: 已过天数不能超过质押周期
4. **精度**: 使用 `ratePerBillion` (十亿分之一) 保证计算精度
5. **分配比例**: 固定为 50% MC + 50% JBC（按价值）

## 🔍 相关文件

- 合约实现: `contracts/JinbaoProtocolV4.sol`
- 前端计算: `components/EarningsDetail.tsx`
- 配置文件: `src/config/production.ts`
- 工具函数: `contracts/Tokenomics.sol` (TokenomicsLib)

## 📚 参考

- [收益策略分析](./analysis/REWARD_STRATEGIES_ANALYSIS.md)
- [代币经济学文档](./analysis/TOKENOMICS.md)

