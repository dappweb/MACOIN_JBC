# 首页JBC价格图表显示机制

## 📊 概述

首页的JBC价格图表通过**实时监听链上Swap事件**和**历史事件查询**来显示真实的价格走势。

---

## 🔄 数据流程

### 1. **数据源层次**

```
链上Swap事件
    ↓
useRealTimePrice Hook (实时监听 + 历史查询)
    ↓
StatsPanel 组件 (格式化 + 渲染)
    ↓
MemoizedPriceChart (Recharts图表组件)
```

---

## 🎯 核心组件

### 1. **useRealTimePrice Hook** (`hooks/useRealTimePrice.ts`)

#### 功能职责
- ✅ 实时监听Swap事件
- ✅ 查询历史Swap事件
- ✅ 计算价格统计数据
- ✅ 维护价格历史（最多500个点）

#### 数据获取机制

**A. 实时监听（事件驱动）**
```typescript
// 监听两种Swap事件
protocolContract.on("SwappedMCToJBC", handleSwapMCToJBC);
protocolContract.on("SwappedJBCToMC", handleSwapJBCToMC);

// 价格计算公式
price = mcAmount / jbcAmount
```

**B. 历史数据初始化**
```typescript
// 查询最近50000个区块的Swap事件
const fromBlock = Math.max(0, currentBlock - 50000);

// 查询两种事件类型
- SwappedMCToJBC(user, mcAmount, jbcAmount, tax)
- SwappedJBCToMC(user, jbcAmount, mcAmount, tax)
```

**C. 价格点添加**
```typescript
// 每次Swap事件触发时
addPricePoint(price) {
  - 添加新价格点（timestamp, price）
  - 保持最近500个点
  - 重新计算统计数据
  - 更新当前价格
}
```

**D. 池子数据变化监听**
```typescript
// 监听poolDataChanged事件
window.addEventListener('poolDataChanged', async () => {
  - 从swapReserveMC和swapReserveJBC计算当前价格
  - 添加新的价格点
});
```

#### 数据格式
```typescript
interface PricePoint {
  timestamp: number;  // Unix时间戳（秒）
  price: number;      // JBC价格（MC计价）
}

interface PriceStats {
  high: number;       // 最高价
  low: number;        // 最低价
  change: number;     // 涨跌幅（%）
  avgPrice: number;   // 平均价
}
```

---

### 2. **StatsPanel 组件** (`components/StatsPanel.tsx`)

#### 数据转换流程

**A. 获取原始数据**
```typescript
const { priceHistory: rawPriceHistory, priceStats, currentPrice } = useRealTimePrice();
```

**B. 格式化数据**
```typescript
const priceHistory: PriceDataPoint[] = useMemo(() => {
  // 如果数据为空，使用模拟数据
  if (rawPriceHistory.length === 0) {
    return generateMockPriceData();
  }
  
  // 转换格式：timestamp -> 时间字符串
  return rawPriceHistory.map((point) => ({
    name: `${HH}:${MM}`,  // 时间格式：08:30
    uv: point.price,      // 价格值
    ema: point.price,     // EMA值（暂未实现）
    high: point.price,
    low: point.price,
    change: 0
  }));
}, [rawPriceHistory]);
```

**C. 渲染图表**
```typescript
<MemoizedPriceChart priceHistory={priceHistory} t={t} />
```

---

### 3. **MemoizedPriceChart 组件** (`components/StatsPanel.tsx`)

#### 图表配置

**A. 图表类型**
- 使用 `Recharts` 的 `AreaChart`（面积图）
- 响应式设计，支持移动端和桌面端

**B. 数据展示**
- **主价格线**：绿色渐变（`#01FEAE`）
- **EMA线**：黄色虚线（`#FBBF24`，数据点>5时显示）
- **Y轴**：显示价格，4位小数精度
- **X轴**：显示时间（HH:MM格式）

**C. 交互功能**
- **Tooltip**：鼠标悬停显示详细信息
  - 时间
  - 价格（6位小数）
  - EMA值（如果存在）
  - 价格区间（如果存在）

**D. 空数据处理**
```typescript
if (!priceHistory || priceHistory.length === 0) {
  return <div>暂无价格数据</div>;
}
```

---

## ⚡ 更新机制

### 1. **实时更新（事件驱动）**

```
用户执行Swap交易
    ↓
链上触发Swap事件
    ↓
useRealTimePrice监听器捕获事件
    ↓
计算价格并添加到历史
    ↓
触发React状态更新
    ↓
图表自动重新渲染
```

### 2. **定期更新**

```typescript
// useGlobalRefresh每30秒刷新价格
useEffect(() => {
  const interval = setInterval(refreshPriceData, 30000);
  return () => clearInterval(interval);
}, []);
```

### 3. **池子变化更新**

```typescript
// 监听poolDataChanged事件
window.addEventListener('poolDataChanged', () => {
  // 重新计算当前价格
  // 添加新的价格点
});
```

---

## 🛡️ 容错机制

### 1. **数据缺失处理**

**场景A：没有历史Swap事件**
```typescript
if (pricePoints.length < 10) {
  // 生成24个默认数据点（每小时一个）
  // 使用基础价格1.0 MC
}
```

**场景B：合约未连接**
```typescript
if (!protocolContract || !provider) {
  // 生成24个默认数据点
  // 价格设为1.0 MC
}
```

**场景C：事件查询失败**
```typescript
.catch(err => {
  console.warn('查询事件失败:', err);
  return []; // 返回空数组，使用默认数据
});
```

### 2. **性能优化**

- **数据限制**：最多保存500个价格点
- **查询范围**：只查询最近50000个区块
- **图表优化**：使用`React.memo`避免不必要的重渲染
- **异步处理**：事件查询使用Promise.all并行处理

---

## 📈 价格计算逻辑

### 1. **从Swap事件计算**

**MC -> JBC 兑换**
```typescript
price = mcAmount / jbcAmount
```

**JBC -> MC 兑换**
```typescript
price = mcAmount / jbcAmount
```

### 2. **从池子储备计算**

```typescript
const swapReserveMC = await protocolContract.swapReserveMC();
const swapReserveJBC = await protocolContract.swapReserveJBC();

if (swapReserveJBC > 0 && swapReserveMC >= 1000) {
  price = parseFloat(ethers.formatEther(swapReserveMC)) / 
          parseFloat(ethers.formatEther(swapReserveJBC));
}
```

---

## 🔍 调试信息

### 控制台日志

**useRealTimePrice Hook**
```
📊 [RealTimePrice] 开始初始化价格历史...
📊 [RealTimePrice] 查询区块范围: X - Y
📊 [RealTimePrice] 找到 N 个MC->JBC事件, M 个JBC->MC事件
📊 [RealTimePrice] 处理完成，共 K 个价格点
✅ [RealTimePrice] 价格历史初始化完成
```

**StatsPanel 组件**
```
📊 [StatsPanel] 格式化价格历史数据, rawPriceHistory长度: N
✅ [StatsPanel] 格式化完成，共 N 个数据点
🏠 [StatsPanel] JBC价格更新: { price, source, timestamp }
```

**MemoizedPriceChart 组件**
```
📈 [MemoizedPriceChart] 渲染图表，数据点数量: N
```

---

## 🎨 显示格式

### 1. **价格精度**
- **图表Y轴**：4位小数
- **Tooltip**：6位小数
- **价格统计**：6位小数

### 2. **时间格式**
- **X轴标签**：`HH:MM`（如：08:30）
- **Tooltip**：完整时间信息

### 3. **颜色方案**
- **主价格线**：绿色（`#01FEAE`）
- **EMA线**：黄色（`#FBBF24`）
- **网格线**：灰色（`#4B5563`）
- **背景渐变**：半透明绿色渐变

---

## 🔗 与其他组件的同步

### 1. **与Swap面板同步**

```typescript
// 两者都使用useGlobalRefresh的priceData.jbcPrice
const { priceData } = useGlobalRefresh();

// 显示格式统一为6位小数
parseFloat(priceData.jbcPrice.toString()).toFixed(6)
```

### 2. **价格更新广播**

```typescript
// useRealTimePrice广播价格统计更新
window.dispatchEvent(new CustomEvent('priceStatsUpdated', { 
  detail: newStats 
}));
```

---

## 📝 总结

首页JBC价格图表通过以下机制实现：

1. **数据源**：链上Swap事件（实时监听 + 历史查询）
2. **数据处理**：useRealTimePrice Hook统一管理
3. **数据展示**：StatsPanel格式化 + MemoizedPriceChart渲染
4. **更新机制**：事件驱动 + 定期刷新 + 池子变化监听
5. **容错处理**：默认数据 + 错误捕获 + 性能优化

整个机制确保了价格数据的**真实性**、**实时性**和**可靠性**。
