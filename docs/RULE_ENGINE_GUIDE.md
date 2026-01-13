# 规则引擎使用指南

## 什么是规则引擎？

规则引擎是一种将业务逻辑从代码中分离出来的技术，允许通过配置的方式定义和执行规则，而不需要修改代码。

## 核心概念

### 1. 规则 (Rule)
规则由两部分组成：
- **条件 (Condition)**: 什么时候触发规则
- **动作 (Action)**: 触发后执行什么操作

```
IF (条件满足) THEN (执行动作)
```

### 2. 事实 (Fact)
规则引擎处理的数据对象，例如：
- 当前价格
- 持仓数量
- 盈亏情况
- 市场数据

### 3. 工作内存 (Working Memory)
存储当前所有事实的内存空间。

## 在 JBC 项目中的应用

### 交易策略规则

#### 示例1: 低价买入
```typescript
import { RuleEngine, TradingRules } from '../utils/ruleEngine';

const engine = new RuleEngine();

// 添加规则：当价格低于100时买入10个代币
engine.addRule(TradingRules.lowPriceBuy(100, 10));

// 设置当前价格
engine.setFact('price', 95);

// 执行规则
await engine.execute(); // 会触发买入操作
```

#### 示例2: 止损规则
```typescript
// 添加止损规则：亏损超过1000时止损
engine.addRule(TradingRules.stopLoss(1000));

// 设置当前亏损
engine.setFact('loss', 1200);

// 执行规则
await engine.execute(); // 会触发止损操作
```

#### 示例3: 套利机会
```typescript
// 添加套利规则：价差超过10时执行套利
engine.addRule(TradingRules.arbitrage(10));

// 设置两个市场的价格
engine.setFact('priceA', 100);
engine.setFact('priceB', 115); // 价差15

// 执行规则
await engine.execute(); // 会触发套利操作
```

### 使用 RuleBuilder 创建自定义规则

```typescript
import { RuleBuilder } from '../utils/ruleEngine';

const customRule = new RuleBuilder()
  .name('成交量放大买入')
  .description('当成交量放大3倍时买入')
  .condition((facts) => {
    const currentVolume = facts.volume as number;
    const avgVolume = facts.avgVolume as number;
    return currentVolume > avgVolume * 3;
  })
  .action(async (facts) => {
    console.log('成交量放大，执行买入');
    // 执行买入逻辑
  })
  .priority(30)
  .enabled(true)
  .build();

engine.addRule(customRule);
```

## 规则优先级

规则可以设置优先级，数字越大优先级越高：

```typescript
// 止损规则优先级最高（100）
engine.addRule(TradingRules.stopLoss(1000));

// 普通交易规则优先级较低（10）
engine.addRule(TradingRules.lowPriceBuy(100, 10));
```

## 规则启用/禁用

可以动态启用或禁用规则：

```typescript
const rule = TradingRules.lowPriceBuy(100, 10);
rule.enabled = false; // 禁用规则
engine.addRule(rule);

// 稍后可以重新启用
rule.enabled = true;
```

## 实际应用场景

### 场景1: 自动交易策略

```typescript
// 创建规则引擎
const tradingEngine = createTradingRuleEngine();

// 定期更新市场数据并执行规则
setInterval(async () => {
  // 更新事实（市场数据）
  const currentPrice = await getCurrentPrice();
  const currentLoss = await getCurrentLoss();
  
  tradingEngine.setFacts({
    price: currentPrice,
    loss: currentLoss,
    position: await getPosition(),
  });
  
  // 执行规则
  const executedRules = await tradingEngine.execute();
  if (executedRules.length > 0) {
    console.log('执行的规则:', executedRules.map(r => r.name));
  }
}, 5000); // 每5秒执行一次
```

### 场景2: 风控系统

```typescript
const riskEngine = new RuleEngine();

// 添加风控规则
riskEngine.addRule(TradingRules.stopLoss(1000));
riskEngine.addRule(TradingRules.positionLimit(1000));

// 在每次交易前检查
async function beforeTrade() {
  riskEngine.setFacts({
    loss: await getCurrentLoss(),
    position: await getPosition(),
  });
  
  const executedRules = await riskEngine.execute();
  if (executedRules.length > 0) {
    console.warn('风控规则触发，阻止交易');
    return false; // 阻止交易
  }
  return true; // 允许交易
}
```

### 场景3: 套利机器人

```typescript
const arbitrageEngine = new RuleEngine();

// 添加套利规则
arbitrageEngine.addRule(TradingRules.arbitrage(10));

// 监控多个市场
setInterval(async () => {
  const priceA = await getPriceFromMarketA();
  const priceB = await getPriceFromMarketB();
  
  arbitrageEngine.setFacts({
    priceA,
    priceB,
  });
  
  await arbitrageEngine.execute();
}, 1000); // 每秒检查一次
```

## 规则引擎的优势

1. **灵活性**: 可以动态添加、修改、删除规则，无需修改代码
2. **可维护性**: 规则和代码分离，更容易维护
3. **可测试性**: 可以单独测试每个规则
4. **可扩展性**: 可以轻松添加新规则
5. **可读性**: 规则以声明式方式表达，更容易理解

## 注意事项

1. **性能**: 规则引擎需要遍历所有规则，规则数量过多可能影响性能
2. **顺序**: 规则按优先级执行，需要注意规则之间的依赖关系
3. **错误处理**: 规则执行失败不应该影响其他规则
4. **状态管理**: 注意事实的更新时机，避免使用过期的数据

## 扩展建议

1. **规则持久化**: 将规则保存到数据库或配置文件
2. **规则版本管理**: 支持规则的版本控制和回滚
3. **规则监控**: 记录规则的执行历史和统计信息
4. **规则优化**: 优化规则匹配算法，提高性能
5. **可视化配置**: 提供UI界面配置规则
