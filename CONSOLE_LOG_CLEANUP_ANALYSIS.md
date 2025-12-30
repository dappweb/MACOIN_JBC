# Console Log 清理分析报告

## 概述
分析项目中的 console.log 语句，识别不必要的调试输出，提供清理建议。

## 发现的 Console Log 分类

### 1. 调试信息 (可以清理)

#### StatsPanel.tsx
- **位置**: 多个 console.log 用于调试用户数据获取
- **建议**: 保留错误日志，移除详细调试信息
```typescript
// 可以移除的调试日志
console.log('🔍 [StatsPanel Debug] Checking connection status...');
console.log('🔍 [StatsPanel Debug] Fetching user data for:', account);
console.log('🔍 [StatsPanel Debug] User info:', userInfo);
console.log('🔍 [StatsPanel Debug] Team count:', teamCount);
console.log('🔍 [StatsPanel Debug] Calculated level:', level);
```

#### SwapPanel.tsx
- **位置**: 池子数据获取和LP统计的详细日志
- **建议**: 简化为关键信息日志
```typescript
// 可以简化的日志
console.log('💰 [SwapPanel] MC 池子储备:', poolMcFormatted, 'MC')
console.log('💰 [SwapPanel] JBC 池子储备:', poolJbcFormatted, 'JBC')
console.log('📊 [SwapPanel] ========== LP 总量统计 ==========')
```

#### useGlobalRefresh.tsx
- **位置**: 余额和价格更新的详细日志
- **建议**: 保留成功/失败日志，移除详细数据
```typescript
// 可以简化
console.log('✅ [GlobalRefresh] 余额已更新 (Native MC):', newBalances);
console.log('✅ [GlobalRefresh] 价格已更新:', newPriceData);
```

#### useRealTimePrice.ts
- **位置**: 实时价格监听的详细日志
- **建议**: 保留关键事件，移除详细数据
```typescript
// 可以简化
console.log('📈 [RealTimePrice] 新价格点:', { timestamp, price });
console.log('🔄 [RealTimePrice] MC->JBC 兑换事件:', { user, mcAmount, jbcAmount });
```

### 2. 事件监听日志 (可以简化)

#### 各组件的事件刷新日志
```typescript
// 这些可以移除或简化
console.log('💰 [StatsPanel] 余额更新，刷新显示数据');
console.log('📈 [StatsPanel] 价格更新');
console.log('🏊 [SwapPanel] 池子数据变化，刷新池子储备');
console.log('📡 [EventRefresh] 收到事件: ${eventName}');
```

### 3. 错误日志 (应该保留)

#### 应该保留的错误处理日志
```typescript
// 这些应该保留
console.error("Failed to fetch referral rewards", err)
console.error('ErrorBoundary caught an error:', error, errorInfo);
console.error('❌ [GlobalRefresh] 余额更新失败:', error);
console.warn("Gas estimation failed, proceeding anyway:", error);
```

### 4. 重要业务日志 (应该保留)

#### 关键业务操作日志
```typescript
// 这些应该保留
console.log('🔄 [GlobalRefresh] 交易成功，开始刷新数据: ${type}');
console.log('🎧 [RealTimePrice] 开始监听兑换事件...');
console.log('🔇 [RealTimePrice] 停止监听兑换事件');
```

## 清理建议

### 立即清理 (生产环境)
1. **移除详细调试信息**: 所有包含用户数据、合约状态的详细日志
2. **简化事件日志**: 事件监听的详细日志可以移除
3. **保留错误处理**: 所有 console.error 和 console.warn 应该保留

### 开发环境保留
1. **关键业务流程日志**: 交易成功、重要状态变化
2. **错误和警告**: 所有错误处理日志
3. **性能监控**: Gas 估算失败等性能相关日志

## 推荐的清理方案

### 方案1: 环境变量控制
```typescript
const isDev = process.env.NODE_ENV === 'development';

// 调试日志只在开发环境显示
if (isDev) {
  console.log('🔍 [Debug] Detailed info:', data);
}

// 错误日志始终显示
console.error('❌ Error occurred:', error);
```

### 方案2: 日志级别控制
```typescript
const logger = {
  debug: (msg: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(msg, data);
    }
  },
  info: (msg: string, data?: any) => console.log(msg, data),
  warn: (msg: string, data?: any) => console.warn(msg, data),
  error: (msg: string, data?: any) => console.error(msg, data)
};
```

### 方案3: 直接清理
移除所有标记为"可以清理"的 console.log 语句，保留错误处理和关键业务日志。

## 优先级

### 高优先级 (立即处理)
- StatsPanel.tsx 中的详细调试信息
- SwapPanel.tsx 中的LP统计详细日志
- useRealTimePrice.ts 中的详细价格数据日志

### 中优先级 (可选处理)
- 事件监听的简单通知日志
- useGlobalRefresh.tsx 中的数据更新日志

### 低优先级 (保持现状)
- 错误处理日志
- 关键业务流程日志
- 性能相关警告日志

## 预期效果

### 清理后的好处
1. **减少控制台噪音**: 用户在开发者工具中看到更清晰的日志
2. **提高性能**: 减少不必要的字符串操作和输出
3. **更好的调试体验**: 重要信息更容易被发现
4. **生产环境优化**: 减少生产环境的日志输出

### 建议的保留日志
- 交易成功/失败通知
- 网络连接问题
- 合约调用错误
- 关键状态变化

---

**分析完成时间**: 2025-12-30
**建议优先级**: 中等 (可在下次维护时处理)
**预计清理时间**: 1-2小时