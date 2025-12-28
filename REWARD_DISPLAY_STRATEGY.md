# 静态奖励和极差奖励显示策略

## 📋 奖励类型定义

根据智能合约定义，系统支持以下奖励类型：

```solidity
uint8 public constant REWARD_STATIC = 0;        // 静态奖励（质押收益）
uint8 public constant REWARD_DYNAMIC = 1;       // 动态奖励（已弃用）
uint8 public constant REWARD_DIRECT = 2;        // 直推奖励
uint8 public constant REWARD_LEVEL = 3;         // 层级奖励
uint8 public constant REWARD_DIFFERENTIAL = 4;  // 极差奖励
```

## 🎯 静态奖励策略

### 计算逻辑
- **来源**: 用户质押流动性产生的固定收益
- **计算方式**: 基于质押金额、周期和时间
- **收益率**:
  - 7天周期: 1.33% 日收益率
  - 15天周期: 1.67% 日收益率  
  - 30天周期: 2.0% 日收益率

### 显示策略
1. **实时计算待领取奖励**
2. **历史奖励记录展示**
3. **24小时统计显示**
4. **待领取提示和引导**

## ⚡ 极差奖励策略

### 计算逻辑
- **触发条件**: 下级用户进行质押时
- **计算基础**: 基于团队地址数量的V等级差额
- **奖励比例**: 
  - V1 (10地址): 5%
  - V2 (30地址): 10%
  - V3 (100地址): 15%
  - V4 (300地址): 20%
  - V5 (1000地址): 25%
  - V6 (3000地址): 30%
  - V7 (10000地址): 35%
  - V8 (30000地址): 40%
  - V9 (100000地址): 45%

### 分配机制
- **差额计算**: 上级等级比例 - 下级等级比例
- **向上传递**: 沿推荐链向上分配
- **即时发放**: 质押时立即计算和记录

## 🔧 当前实现状态

### ✅ 已实现功能
1. **静态奖励完整显示**
   - 待领取奖励计算 ✅
   - 历史记录展示 ✅
   - 24小时统计 ✅
   - 用户引导提示 ✅

2. **极差奖励合约逻辑**
   - 等级计算函数 ✅
   - 奖励分配逻辑 ✅
   - 事件记录机制 ✅

### ❌ 需要修复的问题

1. **极差奖励显示不完整**
   - 前端组件能识别极差奖励类型
   - 但可能缺少实际的极差奖励记录

2. **可能的原因**
   - 用户还没有触发极差奖励条件
   - 合约部署后还没有足够的质押活动
   - 需要检查合约事件是否正确触发

## 🛠️ 诊断和修复步骤

### 1. 检查合约状态
```javascript
// 检查用户等级
const userLevel = await protocolContract.getUserLevel(userAddress);
console.log('用户等级:', userLevel);

// 检查团队统计
const userInfo = await protocolContract.userInfo(userAddress);
console.log('团队人数:', userInfo.teamCount);
```

### 2. 检查极差奖励事件
```javascript
// 查询极差奖励记录事件
const differentialEvents = await protocolContract.queryFilter(
  protocolContract.filters.DifferentialRewardRecorded(),
  fromBlock
);
console.log('极差奖励记录:', differentialEvents);
```

### 3. 验证质押触发机制
```javascript
// 检查质押时是否触发极差奖励计算
const stakeEvents = await protocolContract.queryFilter(
  protocolContract.filters.LiquidityStaked(),
  fromBlock
);
```

## 📊 显示优化建议

### 1. 增强极差奖励显示
- 添加极差奖励专门的统计卡片
- 显示等级差额和奖励比例
- 提供极差奖励的详细说明

### 2. 实时状态监控
- 监听质押事件自动刷新极差奖励
- 显示团队等级变化对极差奖励的影响
- 提供极差奖励预估计算器

### 3. 用户教育
- 解释极差奖励的触发条件
- 显示如何提升团队等级获得更多极差奖励
- 提供团队建设指导

## 🎯 下一步行动计划

1. **立即诊断**: 检查当前用户是否有极差奖励记录
2. **合约验证**: 确认极差奖励逻辑是否正确触发
3. **前端优化**: 增强极差奖励的显示和说明
4. **用户引导**: 添加极差奖励获取指南

## 💡 用户使用指南

### 获得静态奖励
1. 购买门票（100/300/500/1000 MC）
2. 进行质押（门票金额的150%）
3. 等待时间积累收益
4. 定期领取静态奖励

### 获得极差奖励
1. 建设团队，增加直推用户
2. 帮助团队成员进行质押
3. 提升自己的V等级
4. 当下级质押时自动获得极差奖励

这个策略确保了两种核心奖励机制都能正确显示和分发。