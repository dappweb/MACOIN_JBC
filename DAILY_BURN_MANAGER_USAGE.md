
# 每日燃烧管理合约使用说明

## 合约地址
- DailyBurnManager: 0x6C2FdDEb939D92E0dde178845F570FC4E0d213bc
- Protocol: 0x515871E9eADbF976b546113BbD48964383f86E61
- JBC Token: 0xA743cB357a9f59D349efB7985072779a094658dD

## 使用方法

### 1. 检查燃烧状态
```javascript
const canBurn = await dailyBurnManager.canBurn();
const burnAmount = await dailyBurnManager.getBurnAmount();
const timeUntilNext = await dailyBurnManager.timeUntilNextBurn();
```

### 2. 执行燃烧
```javascript
const tx = await dailyBurnManager.dailyBurn();
await tx.wait();
```

### 3. 前端集成
更新 Web3Context.tsx 中的合约地址：
```typescript
const DAILY_BURN_MANAGER = "0x6C2FdDEb939D92E0dde178845F570FC4E0d213bc";
```

## 注意事项
- 任何人都可以调用 dailyBurn() 函数
- 燃烧间隔：24小时
- 燃烧比例：池子JBC储备的1%
- 当前版本只记录事件，需要主合约支持才能实际燃烧
