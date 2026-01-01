# 收益详情显示修复 V2

## 问题描述
客户反映收益详情中没有显示某些已经在链上结算的收益。

## 问题分析

### 1. 事件重复显示问题
前端代码同时处理了 `RewardPaid` 和 `RewardClaimed` 事件，导致同一笔收益可能显示两次：
- `RewardPaid`: 记录总金额（MC等值），但没有详细的MC和JBC分配
- `RewardClaimed`: 记录实际的MC和JBC转账金额，信息更准确

### 2. 区块查询范围可能不足
- 测试环境：50K 区块范围可能不够
- 生产环境：200K 区块范围可能不够，特别是对于历史数据

### 3. 事件处理逻辑问题
- 没有去重机制，可能导致重复记录
- 优先使用 `RewardPaid` 而不是更准确的 `RewardClaimed`

## 修复内容

### 1. 修复事件去重逻辑 ✅
- **优先使用 `RewardClaimed` 事件**：因为它包含准确的MC和JBC金额
- **避免重复记录**：使用 `Map` 跟踪已处理的事件，避免同一交易的事件重复显示
- **降级方案**：对于没有 `RewardClaimed` 的 `RewardPaid` 事件，才使用 `RewardPaid`（作为补充）

```typescript
// 使用 Map 来跟踪已处理的事件，避免重复
const processedEventsMap = new Map<string, boolean>()

// 优先处理 RewardClaimed 事件（包含准确的 MC 和 JBC 金额）
for (const event of rewardClaimedEvents) {
  const eventKey = `${event.transactionHash}-${event.blockNumber}-${rewardType}-claimed`
  if (!processedEventsMap.has(eventKey)) {
    // 处理事件...
    processedEventsMap.set(eventKey, true)
  }
}

// 处理 RewardPaid 事件（只处理没有对应 RewardClaimed 的事件）
for (const event of rewardPaidEvents) {
  const eventKey = `${event.transactionHash}-${event.blockNumber}-${rewardType}-claimed`
  // 如果已经有对应的 RewardClaimed 事件，跳过 RewardPaid
  if (processedEventsMap.has(eventKey)) {
    continue
  }
  // 处理事件...
}
```

### 2. 增加区块查询范围 ✅
- **测试环境**：从 50K 增加到 **100K** 区块
- **生产环境**：从 200K 增加到 **500K** 区块

```typescript
if (timeUnit === 60) {
  blockRange = 100000; // 增加到100K以确保不遗漏
} else if (timeUnit === 86400) {
  blockRange = 500000; // 增加到500K以确保不遗漏历史数据
}
```

### 3. 增强日志记录 ✅
- 添加详细的查询范围日志
- 添加事件处理统计日志
- 添加事件类型统计日志

```typescript
console.log(`🔍 [EarningsDetail] 查询范围: 区块 ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)`)
console.log(`📊 [EarningsDetail] 事件处理完成: 成功 ${processedEvents} 条, 失败 ${failedEvents} 条`)
console.log(`📊 [EarningsDetail] 事件统计: RewardPaid=${rewardPaidEvents.length}, RewardClaimed=${rewardClaimedEvents.length}, Referral=${referralEvents.length}, Differential=${differentialEvents.length}`)
```

## 诊断工具

创建了诊断脚本 `scripts/diagnose-missing-earnings.js` 来帮助排查问题：

```bash
node scripts/diagnose-missing-earnings.js <userAddress> [rpcUrl] [contractAddress]
```

该脚本会：
- 查询所有相关事件（包括前端未查询的事件）
- 对比 `RewardPaid` 和 `RewardClaimed` 事件
- 检查是否有遗漏的事件
- 统计总收益
- 提供修复建议

## 测试建议

1. **清除缓存测试**：
   - 清除浏览器缓存
   - 点击"Clear Cache"按钮
   - 刷新收益详情页面

2. **检查控制台日志**：
   - 打开浏览器开发者工具
   - 查看控制台中的事件统计信息
   - 确认查询范围和事件数量

3. **使用诊断脚本**：
   - 运行诊断脚本检查链上实际事件
   - 对比前端显示的数据和链上数据

4. **验证修复效果**：
   - 检查是否还有重复记录
   - 检查是否显示了所有收益类型
   - 检查MC和JBC金额是否准确

## 可能的原因

如果修复后仍有问题，可能的原因包括：

1. **区块范围仍然不够**：
   - 某些收益发生在更早的区块
   - 建议：考虑实现分页查询或从合约部署区块开始查询

2. **事件过滤问题**：
   - 某些事件可能因为过滤条件被遗漏
   - 建议：检查事件过滤逻辑

3. **合约版本差异**：
   - 不同版本的合约可能发出不同的事件
   - 建议：检查合约版本和事件格式

4. **RPC节点问题**：
   - RPC节点可能没有完整的历史数据
   - 建议：尝试使用不同的RPC节点

## 后续优化建议

1. **实现分页查询**：
   - 如果区块范围很大，考虑分页查询以提高性能
   - 或者从合约部署区块开始逐步查询

2. **添加事件索引**：
   - 考虑使用 The Graph 或其他索引服务
   - 提供更快速和准确的事件查询

3. **缓存优化**：
   - 实现更智能的缓存策略
   - 只缓存已确认的事件，实时更新新事件

4. **用户反馈机制**：
   - 添加"报告问题"功能
   - 允许用户报告缺失的收益记录

## 相关文件

- `components/EarningsDetail.tsx` - 收益详情组件（已修复）
- `scripts/diagnose-missing-earnings.js` - 诊断脚本（新建）

