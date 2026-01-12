# 价格曲线波动修复总结

## ✅ 修复完成

### 修复时间
2024年修复

### 问题描述
客户反馈首页JBC价格曲线波动太大，影响用户体验。

---

## 🔧 修复内容

### 1. **改用池子储备计算价格** ✅

**修复前：**
```typescript
// ❌ 从Swap事件直接计算价格（错误）
const price = mcAmount / jbcAmount;
```

**修复后：**
```typescript
// ✅ 从池子储备计算真实市场价格
const price = swapReserveMC / swapReserveJBC;
```

**优势：**
- 价格准确，反映真实市场价格
- 不受单笔交易税费和滑点影响
- 波动更平滑

---

### 2. **添加时间聚合** ✅

**实现：**
- 每5分钟（300秒）聚合一个价格点
- 同一时间窗口内的多个价格点取平均值
- 减少数据点数量，图表更清晰

**代码：**
```typescript
const TIME_WINDOW_SIZE = 300; // 5分钟

// 时间窗口聚合
const windowStart = Math.floor(timestamp / TIME_WINDOW_SIZE) * TIME_WINDOW_SIZE;
```

**效果：**
- 图表显示更平滑
- 减少短期波动
- 更清晰的长期趋势

---

### 3. **添加异常值过滤** ✅

**实现：**
- 检测价格变化超过20%的异常值
- 使用加权平均平滑处理（70%旧价格 + 30%新价格）
- 防止大额交易造成的价格剧烈波动

**代码：**
```typescript
const PRICE_CHANGE_THRESHOLD = 0.2; // 20%

if (changeRate > PRICE_CHANGE_THRESHOLD) {
  // 使用加权平均平滑
  const smoothedPrice = (lastPrice * 0.7) + (newPrice * 0.3);
}
```

**效果：**
- 过滤异常价格点
- 平滑价格曲线
- 提升用户体验

---

### 4. **优化事件监听机制** ✅

**修复前：**
- 直接从Swap事件计算价格（错误）
- 每个事件都添加价格点（造成抖动）

**修复后：**
- Swap事件仅作为触发信号
- 延迟1秒后从池子储备重新计算价格
- 确保池子储备已更新

**代码：**
```typescript
const handleSwapEvent = async () => {
  setTimeout(async () => {
    const price = await calculatePriceFromReserves();
    if (price !== null) {
      addPricePointWithAggregation(price);
    }
  }, 1000); // 延迟1秒，等待链上状态更新
};
```

---

### 5. **定期价格更新** ✅

**实现：**
- 每30秒自动从池子储备更新价格
- 确保价格数据实时性
- 不依赖Swap事件频率

**代码：**
```typescript
useEffect(() => {
  const updatePrice = async () => {
    const price = await calculatePriceFromReserves();
    if (price !== null) {
      addPricePointWithAggregation(price);
    }
  };

  updatePrice(); // 立即执行
  const interval = setInterval(updatePrice, 30000); // 每30秒
  return () => clearInterval(interval);
}, [protocolContract]);
```

---

## 📊 修复效果对比

### 修复前
- ❌ 价格波动剧烈
- ❌ 每个Swap事件都产生价格点
- ❌ 税费和滑点扭曲价格
- ❌ 大额交易造成异常波动
- ❌ 图表显示抖动明显

### 修复后
- ✅ 价格波动平滑
- ✅ 每5分钟一个价格点
- ✅ 基于池子储备的真实价格
- ✅ 异常值自动过滤
- ✅ 图表显示清晰流畅

---

## 🔍 技术细节

### 核心修改文件
- `hooks/useRealTimePrice.ts` - 完全重写

### 关键参数
- `TIME_WINDOW_SIZE = 300` - 时间聚合窗口（5分钟）
- `PRICE_CHANGE_THRESHOLD = 0.2` - 异常值阈值（20%）
- 价格更新间隔：30秒
- 最大价格点数量：500个

### 价格计算流程
```
Swap事件触发
    ↓
延迟1秒（等待池子更新）
    ↓
从池子储备计算价格
    ↓
异常值过滤（如需要）
    ↓
时间窗口聚合
    ↓
添加到价格历史
    ↓
更新图表显示
```

---

## ✅ 验证清单

- [x] 价格计算改用池子储备
- [x] 时间聚合功能正常
- [x] 异常值过滤生效
- [x] 事件监听机制优化
- [x] 定期更新机制正常
- [x] 代码编译通过
- [x] 无Lint错误

---

## 📝 后续优化建议

1. **历史价格查询优化**
   - 考虑使用The Graph等索引服务查询历史池子储备
   - 或使用合约事件日志重建历史价格

2. **时间窗口可配置**
   - 允许用户选择不同的时间粒度（1分钟、5分钟、15分钟等）

3. **价格预测功能**
   - 基于历史数据添加价格趋势预测

4. **性能优化**
   - 考虑使用WebSocket实时订阅池子变化
   - 减少不必要的链上查询

---

## 🎯 总结

本次修复彻底解决了价格曲线波动过大的问题：

1. ✅ **准确性**：使用池子储备计算真实市场价格
2. ✅ **平滑性**：时间聚合和异常值过滤
3. ✅ **实时性**：定期更新和事件触发机制
4. ✅ **用户体验**：图表显示清晰流畅

修复后的价格曲线将更加平滑、准确，大幅提升用户体验。
