# 重新部署协议方案

## 📋 方案概述

由于无法直接转移协议 Owner（协议 Owner 是 JBC Token 合约，而 JBC Token 合约没有调用协议合约的功能），可以考虑：

1. **备份所有协议数据**
2. **重新部署新的协议合约**（Owner 设置为 JBC Token Owner）
3. **迁移所有数据到新合约**
4. **更新前端和所有引用**

## ✅ 可行性分析

### 优势
- ✅ 可以设置正确的 Owner（JBC Token Owner）
- ✅ 可以修复 Owner 问题
- ✅ 可以优化合约代码（如果需要）

### 挑战
- ⚠️ 需要迁移所有用户数据
- ⚠️ 需要迁移所有余额
- ⚠️ 需要更新前端引用
- ⚠️ 需要用户重新授权（如果需要）
- ⚠️ 需要确保数据完整性

## 📦 需要备份的数据

### 1. 配置参数
- [x] Owner 地址
- [x] 分配比例（directRewardPercent, levelRewardPercent 等）
- [x] 钱包地址（marketing, treasury, lpInjection, buyback）
- [x] JBC Token 地址
- [x] 费用设置（redemptionFeePercent, swapBuyTax, swapSellTax）
- [x] 操作状态（liquidityEnabled, redeemEnabled, emergencyPaused）
- [x] 其他配置参数

### 2. 余额信息
- [x] Swap Reserve MC
- [x] Swap Reserve JBC
- [x] Level Reward Pool
- [x] 合约原生 MC 余额

### 3. 用户数据
- [x] userInfo (所有用户)
  - referrer
  - activeDirects
  - teamCount
  - totalRevenue
  - currentCap
  - isActive
  - refundFeeAmount
  - teamTotalVolume
  - teamTotalCap
  - maxTicketAmount
  - maxSingleTicketAmount
- [x] userTicket (所有用户)
  - ticketId
  - amount
  - purchaseTime
  - exited
- [ ] userStakes (所有用户的质押数据)
- [ ] directReferrals (推荐关系)
- [ ] ticketPendingRewards (待领取奖励)
- [ ] stakePendingRewards (质押待领取奖励)

### 4. 系统状态
- [ ] nextTicketId
- [ ] nextStakeId
- [ ] lastBurnTime
- [ ] ticketOwner mapping
- [ ] stakeOwner mapping

## 🔄 迁移步骤

### 阶段 1: 数据备份
1. ✅ 备份所有配置参数
2. ✅ 备份所有余额信息
3. ⏳ 备份所有用户数据（需要改进脚本以获取所有用户）
4. ⏳ 备份所有系统状态

### 阶段 2: 新合约部署
1. 部署新的协议合约实现
2. 部署新的代理合约（UUPS）
3. 初始化新合约（使用备份的配置）
4. 设置 Owner 为 JBC Token Owner

### 阶段 3: 数据迁移
1. 迁移所有用户数据（userInfo, userTicket, userStakes）
2. 迁移推荐关系（directReferrals）
3. 迁移待领取奖励（ticketPendingRewards, stakePendingRewards）
4. 迁移系统状态（nextTicketId, nextStakeId 等）

### 阶段 4: 余额迁移
1. 从旧合约提取所有 MC（需要 Owner 权限）
2. 从旧合约提取所有 JBC（需要 Owner 权限）
3. 将余额转入新合约

### 阶段 5: 更新引用
1. 更新前端代码中的合约地址
2. 更新 JBC Token 合约中的 protocolAddress（需要 JBC Token Owner）
3. 更新其他引用该合约的地方

### 阶段 6: 验证和测试
1. 验证所有用户数据正确迁移
2. 验证所有余额正确迁移
3. 测试关键功能（购买门票、质押、领取奖励等）
4. 通知用户

## ⚠️ 重要注意事项

### 1. Owner 权限问题
- **旧合约**: Owner 是 JBC Token 合约，无法直接提取余额
- **解决方案**: 可能需要通过其他方式提取余额，或者接受余额损失

### 2. 用户授权
- 用户可能需要重新授权新合约使用 JBC Token
- 需要通知用户更新授权

### 3. 数据完整性
- 必须确保所有数据正确迁移
- 建议在测试网先进行完整测试

### 4. 停机时间
- 迁移过程中可能需要暂停服务
- 需要提前通知用户

### 5. Gas 费用
- 迁移大量数据需要大量 Gas
- 需要准备足够的 MC 支付 Gas

## 📊 当前备份状态

- ✅ 配置参数: 已备份
- ✅ 余额信息: 已备份
- ⚠️ 用户数据: 需要改进脚本（当前未找到用户）
- ❌ 系统状态: 未备份

## 🔧 下一步行动

1. **改进备份脚本**
   - 修复事件查询（检查实际事件名称）
   - 添加更多数据备份（userStakes, directReferrals 等）
   - 添加系统状态备份

2. **创建迁移脚本**
   - 部署新合约脚本
   - 数据迁移脚本
   - 余额迁移脚本

3. **创建测试计划**
   - 在测试网测试完整流程
   - 验证数据完整性
   - 测试关键功能

4. **准备迁移文档**
   - 详细的迁移步骤
   - 回滚计划
   - 用户通知

## 💡 替代方案

如果重新部署不可行，可以考虑：

1. **接受当前状态**: 保持协议 Owner 为 JBC Token 合约
2. **添加中间层**: 创建一个中间合约来处理 Owner 功能
3. **等待升级**: 等待 JBC Token 合约升级（如果可能）

