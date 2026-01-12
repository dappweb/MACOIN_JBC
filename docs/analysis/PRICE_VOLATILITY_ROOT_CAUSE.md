# 首页JBC价格1-2%波动根本原因分析

## 🔍 问题描述

对于200万池子，买卖10个左右的代币，首页JBC价格走势显示1-2%的波动。

理论上，这种小额交易对价格的影响应该<0.01%，不应该出现1-2%的波动。

---

## 🎯 根本原因分析

### 1. **多个价格更新源冲突** ⚠️

当前系统中有**4个独立的价格更新源**同时工作：

#### A. Swap事件触发更新
```typescript
// hooks/useRealTimePrice.ts
protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC);
protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC);
// 延迟3秒后更新价格
```

#### B. poolDataChanged事件触发更新
```typescript
// hooks/useRealTimePrice.ts
window.addEventListener('poolDataChanged', handlePoolDataChanged);
// Swap交易成功后触发
```

#### C. 定期更新（每30秒）
```typescript
// hooks/useRealTimePrice.ts
setInterval(updatePrice, 30000);
```

#### D. useGlobalRefresh定期更新（每30秒）
```typescript
// hooks/useGlobalRefresh.tsx
setInterval(refreshPriceData, 30000);
```

**问题：**
- 这些更新源可能**同时触发**
- 读取池子储备的**时机不同**，可能读取到**不同时刻**的数据
- 如果读取时正好有交易在进行，可能读取到**中间状态**

---

### 2. **链上数据读取时机问题** ⚠️

#### 问题场景

**场景1：读取时交易正在进行**
```
时间线：
T0: 用户发起Swap交易
T1: 交易在链上执行中（池子储备正在变化）
T2: 价格更新逻辑读取池子储备 ← 可能读取到中间状态
T3: 交易完成，池子储备更新完成
```

**场景2：多个交易同时进行**
```
时间线：
T0: 交易A开始
T1: 交易B开始（交易A还在进行）
T2: 价格更新读取池子储备 ← 读取到交易A和B的混合状态
T3: 交易A完成
T4: 交易B完成
```

**结果：**
- 读取到的池子储备可能不是**稳定状态**
- 导致计算出的价格有**1-2%的偏差**

---

### 3. **精度和舍入误差累积** ⚠️

#### 计算精度问题

```typescript
// 当前实现
const rMC = parseFloat(ethers.formatEther(reserveMC));
const rJBC = parseFloat(ethers.formatEther(reserveJBC));
const price = rMC / rJBC;
```

**问题：**
- `ethers.formatEther()` 转换为字符串，再 `parseFloat()` 转回数字
- 这个过程可能有**精度损失**
- 对于大数值（200万），精度损失可能累积到**0.1-0.5%**

#### 示例计算

假设池子储备：
- MC: 2,000,000.123456789 MC
- JBC: 1,000,000.987654321 JBC

**精确价格：**
```
price = 2,000,000.123456789 / 1,000,000.987654321
     = 1.999998... MC
```

**经过formatEther + parseFloat后：**
```
rMC = 2000000.123456789 → formatEther → "2000000.123456789" → parseFloat → 2000000.123456789
rJBC = 1000000.987654321 → formatEther → "1000000.987654321" → parseFloat → 1000000.987654321
price = 2000000.123456789 / 1000000.987654321
     = 1.999998... MC
```

但实际上，JavaScript的`parseFloat`对很大或很小的数字可能有精度问题。

---

### 4. **时间聚合窗口内的价格点冲突** ⚠️

#### 问题场景

时间聚合窗口是15分钟（900秒），但：
- 如果15分钟内有多笔交易
- 每次交易都触发价格更新
- 这些价格点会被聚合到同一个时间窗口

**问题：**
- 如果这些价格点之间有1-2%的差异（由于读取时机不同）
- 聚合后的平均价格可能仍然显示1-2%的波动
- 特别是如果时间窗口内只有少量价格点（如2-3个）

---

### 5. **异常值过滤阈值不够严格** ⚠️

当前设置：
```typescript
const PRICE_CHANGE_THRESHOLD = 0.01; // 1%
```

**问题：**
- 1-2%的波动**刚好超过阈值**
- 但平滑处理可能不够强
- 特别是如果连续多次读取都有1-2%的差异

---

## 🔧 解决方案

### 方案1：统一价格更新源（推荐）✅

**实现：**
- 只保留**一个**价格更新源
- 其他更新源只触发标志，不直接更新价格
- 使用**防抖机制**聚合多个触发

**代码：**
```typescript
// 统一的价格更新函数
let priceUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
const updatePriceUnified = async () => {
  if (priceUpdateTimeout) {
    clearTimeout(priceUpdateTimeout);
  }
  
  priceUpdateTimeout = setTimeout(async () => {
    // 多次读取取平均值
    const prices = await getMultiplePriceReadings(5); // 读取5次
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    addPricePointWithAggregation(avgPrice);
  }, 2000); // 防抖2秒
};

// 所有更新源都调用这个函数
handleSwapEvent → updatePriceUnified()
handlePoolDataChanged → updatePriceUnified()
定期更新 → updatePriceUnified()
```

---

### 方案2：增加读取次数和间隔 ✅

**实现：**
- 每次更新价格时，读取**5-10次**池子储备
- 每次读取间隔**1-2秒**
- 计算平均值，过滤异常值

**代码：**
```typescript
const getMultiplePriceReadings = async (count: number = 5): Promise<number[]> => {
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    const price = await calculatePriceFromReserves();
    if (price !== null) {
      prices.push(price);
    }
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔1秒
    }
  }
  return prices;
};
```

---

### 方案3：使用BigNumber提高精度 ✅

**实现：**
- 使用`ethers.BigNumber`进行精确计算
- 只在最后一步转换为浮点数

**代码：**
```typescript
const calculatePriceFromReserves = async (): Promise<number | null> => {
  const [reserveMC, reserveJBC] = await Promise.all([
    protocolContract.swapReserveMC(),
    protocolContract.swapReserveJBC()
  ]);

  if (reserveJBC > 0n && reserveMC > 0n) {
    // 使用BigNumber进行精确计算
    // price = (reserveMC * 1e18) / reserveJBC
    const priceBN = (reserveMC * ethers.parseEther('1')) / reserveJBC;
    const price = parseFloat(ethers.formatEther(priceBN));
    return price;
  }
  return null;
};
```

---

### 方案4：更严格的异常值过滤 ✅

**实现：**
- 降低阈值到0.5%
- 增加平滑强度
- 对于连续的小波动，使用移动平均

**代码：**
```typescript
const PRICE_CHANGE_THRESHOLD = 0.005; // 0.5%

// 更平滑的处理
if (changeRate > 0.005) {
  // 变化>0.5%，使用更强的平滑
  const smoothedPrice = (lastPrice * 0.95) + (newPrice * 0.05);
}
```

---

### 方案5：延迟读取，确保交易完成 ✅

**实现：**
- Swap事件触发后，延迟**5-10秒**再读取
- 确保所有相关交易都已完成
- 读取稳定的池子状态

**代码：**
```typescript
const handleSwapEvent = async () => {
  setTimeout(async () => {
    // 延迟5秒，确保交易完成
    const price = await calculatePriceFromReserves();
    // ...
  }, 5000);
};
```

---

## 📊 推荐实施方案

### 组合方案：方案1 + 方案2 + 方案4

1. **统一价格更新源**（方案1）
   - 避免多个更新源冲突
   - 使用防抖机制

2. **增加读取次数**（方案2）
   - 每次更新读取5-10次
   - 取平均值，减少单次读取误差

3. **更严格的过滤**（方案4）
   - 阈值降低到0.5%
   - 增强平滑处理

---

## 🔍 验证方法

### 1. 添加详细日志

```typescript
console.log('💰 [PriceUpdate] 价格更新详情:', {
  source: 'swap_event|pool_changed|periodic',
  reserveMC: rMC.toFixed(6),
  reserveJBC: rJBC.toFixed(6),
  price: price.toFixed(8),
  lastPrice: lastPriceRef.current?.toFixed(8),
  changeRate: changeRate.toFixed(6) + '%',
  timestamp: new Date().toISOString()
});
```

### 2. 监控价格变化

在浏览器控制台观察：
- 每次价格更新的来源
- 价格变化的幅度
- 更新频率

### 3. 测试场景

- 小额交易（10个左右）：应该<0.01%波动
- 中等交易（100个左右）：应该<0.1%波动
- 大额交易（1000个以上）：可能有1-2%波动（正常）

---

## 📝 总结

出现1-2%波动的主要原因：

1. ❌ **多个价格更新源冲突**：4个更新源可能同时触发
2. ❌ **读取时机问题**：可能读取到交易中间状态
3. ❌ **精度损失**：formatEther + parseFloat可能有精度问题
4. ❌ **异常值过滤不够严格**：1%阈值对1-2%波动无效
5. ❌ **时间聚合不足**：15分钟窗口内价格点可能冲突

**解决方案：**
- 统一更新源 + 防抖机制
- 多次读取取平均值
- 更严格的异常值过滤（0.5%阈值）
- 延迟读取确保交易完成
