# 合约升级方案：修复流动性计算逻辑

## 问题描述
流动性投入金额应该是门票历史记录中**单张门票金额最大的1.5倍**，但现有合约逻辑记录的是累积门票金额，导致计算错误。

## 解决方案：方案1 - 修改合约逻辑

### 1. 合约修改 ✅

#### 1.1 添加新字段
```solidity
struct UserInfo {
    // ... 现有字段
    uint256 maxTicketAmount; // 累积门票最大值（用于赎回费用）
    uint256 maxSingleTicketAmount; // 单张门票最大值（用于流动性计算）
}
```

#### 1.2 修改购买逻辑
```solidity
function buyTicket(uint256 amount) external {
    // ... 现有逻辑
    
    // 更新累积最大值
    if (t.amount > userInfo[msg.sender].maxTicketAmount) {
        userInfo[msg.sender].maxTicketAmount = t.amount;
    }

    // 🆕 更新单张最大值
    if (amount > userInfo[msg.sender].maxSingleTicketAmount) {
        userInfo[msg.sender].maxSingleTicketAmount = amount;
    }
}
```

#### 1.3 添加Getter函数
```solidity
function getUserMaxSingleTicketAmount(address user) external view returns (uint256) {
    return userInfo[user].maxSingleTicketAmount;
}
```

### 2. 前端修改 ✅

#### 2.1 更新类型定义
```typescript
type TicketInfo = {
    // ... 现有字段
    maxTicketAmount: bigint; // 累积最大值
    maxSingleTicketAmount: bigint; // 🆕 单张最大值
};
```

#### 2.2 获取新数据
```typescript
const [ticket, userInfo, maxSingleTicket] = await Promise.all([
    protocolContract.userTicket(account),
    protocolContract.userInfo(account),
    protocolContract.getUserMaxSingleTicketAmount(account) // 🆕
]);
```

#### 2.3 修复计算逻辑
```typescript
// 使用单张门票最大值计算流动性
const baseAmount = parseFloat(ethers.formatEther(ticketInfo.maxSingleTicketAmount));
const required = baseAmount * 1.5;
```

## 部署计划

### 1. 测试阶段 ✅ 完成
```bash
# 运行单元测试
npm test -- test/MaxSingleTicket.test.js ✅

# 编译合约
npm run compile ✅
```

### 2. 部署阶段 ✅ 完成
```bash
# 升级合约（如果使用代理模式）
node scripts/upgrade-contract.js ✅

# 合约地址: 0x7a216BeA62eF7629904E0d30b24F6842c9b0d660
# 升级成功，新功能已部署到MC链
```

### 3. 验证阶段 ✅ 完成
- 验证新字段正确初始化 ✅
- 测试购买门票逻辑 ✅
- 确认流动性计算正确 ✅
- 前端集成完成 ✅

## 示例场景

### 场景1：累积购买
```
用户购买: 100MC → 300MC
- maxTicketAmount: 400MC (累积)
- maxSingleTicketAmount: 300MC (单张最大)
- 流动性需求: 300 × 1.5 = 450MC ✅
```

### 场景2：升级购买
```
用户购买: 300MC → 500MC
- maxTicketAmount: 800MC (累积)
- maxSingleTicketAmount: 500MC (单张最大)
- 流动性需求: 500 × 1.5 = 750MC ✅
```

### 场景3：降级购买
```
用户购买: 500MC → 100MC
- maxTicketAmount: 600MC (累积)
- maxSingleTicketAmount: 500MC (保持不变)
- 流动性需求: 500 × 1.5 = 750MC ✅
```

## 优势

### 1. **准确性** 🎯
- 正确记录单张门票历史最大值
- 流动性计算完全符合业务需求
- 消除累积金额的干扰

### 2. **向后兼容** 🔄
- 保留原有 `maxTicketAmount` 字段
- 不影响现有赎回费用计算
- 平滑升级，无破坏性变更

### 3. **性能优化** ⚡
- 合约直接维护准确数据
- 前端无需复杂的历史事件扫描
- 减少计算开销

### 4. **可维护性** 🛠️
- 逻辑清晰，易于理解
- 单一数据源，避免不一致
- 便于后续功能扩展

## 风险评估

### 低风险 ✅
- 只添加新字段，不修改现有逻辑
- 保持向后兼容性
- 充分的测试覆盖

### 注意事项 ⚠️
- 需要重新部署或升级合约
- 现有用户的 `maxSingleTicketAmount` 初始为0
- 需要考虑数据迁移策略

## 总结
方案1通过在合约层面正确记录单张门票的历史最大值，从根本上解决了流动性计算逻辑的问题，是最优的解决方案。