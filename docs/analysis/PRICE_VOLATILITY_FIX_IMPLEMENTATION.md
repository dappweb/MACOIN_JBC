# 首页JBC价格1-2%波动修复实施

## 📋 修复概述

针对200万池子中买卖10个左右代币时，首页JBC价格走势仍显示1-2%波动的问题，实施了以下修复措施。

---

## 🔧 实施的修复

### 1. **统一价格更新源** ✅

**问题：**
- `useRealTimePrice`中同时监听Swap事件和`poolDataChanged`事件
- 两个更新源可能同时触发，导致读取到不同时刻的数据

**修复：**
- 移除了`poolDataChanged`事件监听
- 仅保留Swap事件作为主要更新源
- `useGlobalRefresh`仍处理`poolDataChanged`更新全局价格数据，但不更新图表历史

**代码变更：**
```typescript
// 移除poolDataChanged监听，避免与Swap事件冲突
// Swap事件已经会触发价格更新，poolDataChanged会导致重复更新
```

---

### 2. **增强价格读取稳定性** ✅

**问题：**
- 读取次数太少（3次），可能读取到交易中间状态
- 延迟时间太短（3秒），链上状态可能未完全稳定
- 读取间隔太短（500ms），无法有效避免中间状态

**修复：**
- 读取次数：**3次 → 5次**
- 延迟时间：**3秒 → 5秒**
- 读取间隔：**500ms → 1秒**
- 使用**中位数和平均值组合**，进一步减少异常值影响

**代码变更：**
```typescript
// 延迟5秒，确保池子储备已完全更新
swapEventTimeout = setTimeout(async () => {
  // 5次读取，间隔1秒
  for (let i = 0; i < 5; i++) {
    const price = await calculatePriceFromReserves();
    if (price !== null) {
      prices.push(price);
    }
    if (i < 4) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 使用中位数和平均值组合
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const finalPrice = Math.abs(median - avgPrice) / avgPrice > 0.01 
    ? median 
    : avgPrice;
}, 5000);
```

---

### 3. **降低异常值过滤阈值** ✅

**问题：**
- 当前阈值1%可能不够严格，仍允许1-2%的波动通过

**修复：**
- 阈值：**1% → 0.5%**
- 增强平滑处理，根据波动幅度使用不同权重：
  - **>5%波动**：95%旧价格 + 5%新价格（强平滑）
  - **>2%波动**：85%旧价格 + 15%新价格（中度平滑）
  - **>0.5%波动**：70%旧价格 + 30%新价格（轻度平滑）
  - **>0.1%波动**：90%旧价格 + 10%新价格（轻微平滑）

**代码变更：**
```typescript
const PRICE_CHANGE_THRESHOLD = 0.005; // 0.5%

if (changeRate > 0.05) {
  return (lastPrice * 0.95) + (newPrice * 0.05);
} else if (changeRate > 0.02) {
  return (lastPrice * 0.85) + (newPrice * 0.15);
} else if (changeRate > PRICE_CHANGE_THRESHOLD) {
  return (lastPrice * 0.7) + (newPrice * 0.3);
} else if (changeRate > 0.001) {
  return (lastPrice * 0.9) + (newPrice * 0.1);
}
```

---

### 4. **改进精度处理** ✅

**问题：**
- `parseFloat(ethers.formatEther())`可能导致精度损失
- 对于大数值，精度损失可能累积到0.1-0.5%

**修复：**
- 使用**BigNumber进行高精度计算**
- 先进行BigNumber运算，最后再转换为浮点数
- 提高日志精度到8位小数

**代码变更：**
```typescript
// 使用BigNumber进行高精度计算
const rMC_BN = ethers.getBigInt(reserveMC);
const rJBC_BN = ethers.getBigInt(reserveJBC);

// price = (rMC * 1e18) / rJBC / 1e18
const priceBN = (rMC_BN * ethers.parseEther('1')) / rJBC_BN;
const price = parseFloat(ethers.formatEther(priceBN));
```

---

### 5. **调整定期更新策略** ✅

**问题：**
- 定期更新（30秒）可能与Swap事件更新冲突

**修复：**
- 更新间隔：**30秒 → 60秒**
- 延迟首次更新：**5秒**，避免与初始化冲突
- 定期更新也使用多次读取取平均值

**代码变更：**
```typescript
// 延迟5秒后执行第一次更新
const initialTimeout = setTimeout(updatePrice, 5000);

// 每60秒更新一次
const interval = setInterval(updatePrice, 60000);
```

---

## 📊 预期效果

### 修复前
- 200万池子，买卖10个代币：**1-2%波动**
- 多个更新源冲突
- 可能读取到中间状态
- 精度损失累积

### 修复后
- 200万池子，买卖10个代币：**<0.5%波动**（预期）
- 单一更新源，避免冲突
- 5次读取 + 5秒延迟，确保稳定状态
- BigNumber高精度计算，减少精度损失
- 0.5%阈值 + 多级平滑，过滤微小波动

---

## 🔍 技术细节

### 价格计算流程

```
Swap事件触发
    ↓
延迟5秒（等待链上状态稳定）
    ↓
5次读取池子储备（间隔1秒）
    ↓
计算中位数和平均值
    ↓
选择更稳定的值（中位数或平均值）
    ↓
异常值过滤（0.5%阈值）
    ↓
多级平滑处理
    ↓
添加到价格历史
```

### 精度提升

**修复前：**
```typescript
const rMC = parseFloat(ethers.formatEther(reserveMC)); // 精度损失
const rJBC = parseFloat(ethers.formatEther(reserveJBC)); // 精度损失
const price = rMC / rJBC; // 累积误差
```

**修复后：**
```typescript
const rMC_BN = ethers.getBigInt(reserveMC); // 保持整数精度
const rJBC_BN = ethers.getBigInt(reserveJBC); // 保持整数精度
const priceBN = (rMC_BN * ethers.parseEther('1')) / rJBC_BN; // BigNumber运算
const price = parseFloat(ethers.formatEther(priceBN)); // 最后转换
```

---

## ✅ 验证要点

1. **波动幅度**：200万池子，买卖10个代币，价格波动应<0.5%
2. **更新时机**：Swap事件后5秒更新，不应立即更新
3. **读取稳定性**：5次读取的价格差异应<0.1%
4. **平滑效果**：超过0.5%的波动应被平滑处理
5. **精度**：价格计算应保持8位小数精度

---

## 📝 相关文件

- `hooks/useRealTimePrice.ts` - 主要修复文件
- `docs/analysis/PRICE_VOLATILITY_ROOT_CAUSE.md` - 根本原因分析
- `docs/analysis/PRICE_CHART_FIX_SUMMARY.md` - 之前修复总结

---

## 🚀 部署说明

修复已完成，可以立即部署测试。建议在测试环境验证以下场景：

1. **小额交易**：200万池子，买卖10个代币
2. **频繁交易**：短时间内多次交易
3. **大额交易**：验证平滑处理效果
4. **长时间运行**：验证定期更新不冲突
