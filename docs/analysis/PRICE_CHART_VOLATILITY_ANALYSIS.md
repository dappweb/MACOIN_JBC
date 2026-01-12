# 首页JBC价格曲线波动过大原因分析

## 🔍 问题描述

客户反馈首页JBC价格曲线波动太大，影响用户体验。

---

## 🎯 根本原因

### 1. **价格计算方式错误**

#### 当前实现（错误）
```typescript
// hooks/useRealTimePrice.ts
const calculatePriceFromSwap = (mcAmount, jbcAmount) => {
  const price = mcAmount / jbcAmount;  // ❌ 错误！
  addPricePoint(price);
}
```

#### 问题分析

**A. 事件参数理解错误**

从合约代码看，Swap事件的实际参数是：

```solidity
// MC -> JBC 兑换
emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
// 参数：用户地址, 输入的MC数量, 用户实际得到的JBC数量（已扣税）, 税费

// JBC -> MC 兑换  
emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
// 参数：用户地址, 输入的JBC数量, 用户实际得到的MC数量, 税费
```

**当前代码的问题：**
- `SwappedMCToJBC` 事件中，`jbcAmount` 参数实际上是 `amountToUser`（扣除税费后的数量）
- `SwappedJBCToMC` 事件中，`mcAmount` 参数实际上是 `mcOutput`（用户实际得到的数量）
- 直接用 `mcAmount / jbcAmount` 计算价格是**错误的**，因为：
  1. 税费已经扣除，价格被扭曲
  2. 单笔交易的输入输出不能代表真实市场价格
  3. 大额交易会产生滑点，价格偏差更大

**B. 正确的价格应该是池子储备比**

真实的市场价格应该基于**池子储备**计算：
```typescript
price = swapReserveMC / swapReserveJBC
```

而不是基于单笔交易的输入输出。

---

### 2. **缺少数据平滑处理**

#### 当前实现
- 每个Swap事件都会立即添加一个价格点
- 没有对价格进行平滑处理（如移动平均）
- 没有过滤异常值（如大额交易造成的价格波动）

#### 影响
- 大额Swap交易会导致价格剧烈波动
- 小额交易也会产生价格点，造成图表抖动
- 没有时间聚合，每个事件都是独立的价格点

---

### 3. **税费和滑点影响**

#### 税费影响
- **买入JBC**：50%税费（`swapBuyTax = 50`）
- **卖出JBC**：25%税费（`swapSellTax = 25`）

税费会显著影响单笔交易的价格计算：
```typescript
// MC -> JBC: 用户输入 mcAmount，得到 amountToUser（已扣50%税）
// 如果用 mcAmount / amountToUser 计算，价格会被高估
```

#### 滑点影响
- AMM公式：`dy = (y * dx) / (x + dx)`
- 大额交易会产生价格滑点
- 单笔交易的价格不能代表真实市场价格

---

### 4. **时间粒度问题**

#### 当前实现
- 每个Swap事件都添加一个价格点
- 没有按时间聚合（如每小时、每天）
- 交易频繁时会产生大量价格点

#### 影响
- 图表显示过于密集
- 短期波动被放大
- 无法看清长期趋势

---

## 🔧 解决方案

### 方案1：使用池子储备计算价格（推荐）

**修改 `useRealTimePrice.ts`：**

```typescript
// 从池子储备计算价格，而不是从Swap事件
const calculatePriceFromReserves = async () => {
  if (!protocolContract) return;
  
  try {
    const [reserveMC, reserveJBC] = await Promise.all([
      protocolContract.swapReserveMC(),
      protocolContract.swapReserveJBC()
    ]);
    
    const rMC = parseFloat(ethers.formatEther(reserveMC));
    const rJBC = parseFloat(ethers.formatEther(reserveJBC));
    
    if (rJBC > 0) {
      const price = rMC / rJBC;  // ✅ 正确的市场价格
      addPricePoint(price);
    }
  } catch (error) {
    console.error('计算价格失败:', error);
  }
};

// 监听池子变化事件
useEffect(() => {
  const handlePoolDataChanged = () => {
    calculatePriceFromReserves();
  };
  
  window.addEventListener('poolDataChanged', handlePoolDataChanged);
  return () => window.removeEventListener('poolDataChanged', handlePoolDataChanged);
}, [protocolContract]);
```

**优点：**
- ✅ 价格准确，反映真实市场价格
- ✅ 不受单笔交易税费和滑点影响
- ✅ 波动更平滑

**缺点：**
- ⚠️ 需要定期轮询或监听池子变化
- ⚠️ 不能完全实时（需要等待池子更新）

---

### 方案2：时间聚合 + 移动平均

**修改价格点添加逻辑：**

```typescript
// 按时间窗口聚合价格点（如每5分钟一个点）
const addPricePointWithAggregation = (price: number) => {
  const now = Math.floor(Date.now() / 1000);
  const windowSize = 300; // 5分钟窗口
  const windowStart = Math.floor(now / windowSize) * windowSize;
  
  setPriceHistory(prev => {
    // 找到当前时间窗口的价格点
    const windowIndex = prev.findIndex(
      p => Math.floor(p.timestamp / windowSize) === Math.floor(windowStart / windowSize)
    );
    
    if (windowIndex >= 0) {
      // 更新窗口内的价格（使用移动平均）
      const windowPrices = prev.filter(
        p => Math.floor(p.timestamp / windowSize) === Math.floor(windowStart / windowSize)
      );
      const avgPrice = (windowPrices.reduce((sum, p) => sum + p.price, 0) + price) / (windowPrices.length + 1);
      
      const updated = [...prev];
      updated[windowIndex] = { timestamp: windowStart, price: avgPrice };
      return updated;
    } else {
      // 新时间窗口，添加新点
      return [...prev, { timestamp: windowStart, price }].slice(-500);
    }
  });
};
```

**优点：**
- ✅ 平滑价格波动
- ✅ 减少数据点数量
- ✅ 更清晰的趋势

---

### 方案3：过滤异常值

**添加价格变化率检查：**

```typescript
const addPricePoint = (price: number) => {
  setPriceHistory(prev => {
    if (prev.length > 0) {
      const lastPrice = prev[prev.length - 1].price;
      const changeRate = Math.abs((price - lastPrice) / lastPrice);
      
      // 如果价格变化超过20%，可能是异常值，使用平滑处理
      if (changeRate > 0.2) {
        // 使用移动平均平滑
        price = (lastPrice * 0.7) + (price * 0.3);
      }
    }
    
    return [...prev, { timestamp: Date.now(), price }].slice(-500);
  });
};
```

---

## 📊 推荐实施方案

### 组合方案：方案1 + 方案2

1. **主要使用池子储备计算价格**（方案1）
   - 准确反映市场价格
   - 不受单笔交易影响

2. **添加时间聚合**（方案2）
   - 每5-10分钟一个价格点
   - 使用窗口内平均价格

3. **保留事件监听作为补充**
   - 监听Swap事件触发池子更新
   - 但不直接从事件计算价格

---

## 🔍 当前代码问题位置

### 文件：`hooks/useRealTimePrice.ts`

**问题1：第71-85行**
```typescript
const calculatePriceFromSwap = (mcAmount, jbcAmount) => {
  const price = mcAmount / jbcAmount;  // ❌ 错误的价格计算
  addPricePoint(price);
}
```

**问题2：第91-97行**
```typescript
const handleSwapMCToJBC = (user, mcAmount, jbcAmount, event) => {
  calculatePriceFromSwap(mcAmount, jbcAmount);  // ❌ jbcAmount是扣税后的数量
};

const handleSwapJBCToMC = (user, jbcAmount, mcAmount, event) => {
  calculatePriceFromSwap(mcAmount, jbcAmount);  // ❌ mcAmount是用户得到的数量
};
```

**问题3：第152-190行**
```typescript
// 处理历史事件时，同样使用了错误的价格计算
const price = mcAmount / jbcAmount;  // ❌ 错误
```

---

## ✅ 修复建议

1. **立即修复**：改用池子储备计算价格
2. **优化**：添加时间聚合（5-10分钟窗口）
3. **增强**：添加异常值过滤
4. **保留**：事件监听用于触发更新，但不直接计算价格

---

## 📝 总结

价格曲线波动过大的根本原因是：

1. ❌ **价格计算错误**：使用单笔交易的输入输出，而不是池子储备
2. ❌ **税费影响**：没有考虑税费对价格计算的扭曲
3. ❌ **缺少平滑**：没有时间聚合和移动平均
4. ❌ **异常值**：大额交易造成的价格波动没有被过滤

**解决方案**：使用池子储备计算价格 + 时间聚合 + 异常值过滤
