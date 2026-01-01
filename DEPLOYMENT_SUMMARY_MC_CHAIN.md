# MC Chain 部署摘要 - JinbaoProtocolV4

## 🎯 本次部署的核心更新

### 级差奖励机制重大改进

1. **计算时机变更**
   - ❌ 之前: 质押流动性时计算
   - ✅ 现在: 赎回流动性时计算

2. **计算基础变更**
   - ❌ 之前: 基于质押金额（流动性本金）
   - ✅ 现在: 基于静态收益（`totalYield`）

3. **分配机制变更** ⭐ **新增**
   - ❌ 之前: 级差奖励的MC和JBC独立计算
   - ✅ 现在: **级差奖励的MC和JBC从静态奖励的MC和JBC中按比例分配**

4. **JBC获取方式** ⭐ **新增**
   - ❌ 之前: 直接从合约余额转账
   - ✅ 现在: 通过AMM交换MC获得JBC（如果余额不足）

## 📊 完整变更列表

### 合约代码变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `JinbaoProtocolV4.sol` | 移除 | `stakeLiquidity()` 中移除级差奖励计算 |
| `JinbaoProtocolV4.sol` | 新增 | `_calculateAndStoreDifferentialRewardsFromStatic()` 函数 |
| `JinbaoProtocolV4.sol` | 新增 | `_distributeDifferentialRewardFromStatic()` 函数 |
| `JinbaoProtocolV4.sol` | 修改 | `PendingReward` 结构添加 `mcAmount` 和 `jbcAmount` |
| `JinbaoProtocolV4.sol` | 修改 | `redeem()` 函数中基于静态奖励计算级差奖励 |

### 部署脚本更新

| 文件 | 更新内容 |
|------|---------|
| `deploy-v4-mc-chain.cjs` | 更新变更说明和特性列表 |
| `upgrade-mc-chain.cjs` | 更新变更说明和验证逻辑 |

### 文档更新

| 文件 | 更新内容 |
|------|---------|
| `DEPLOY_MC_CHAIN_V4.md` | 添加级差奖励从静态奖励分配的说明 |
| `DIFFERENTIAL_REWARD_FROM_STATIC_REWARD.md` | 详细说明级差奖励与静态奖励的关系 |
| `FRONTEND_UPDATE_REQUIRED.md` | 前端说明文字更新指南 |

## 🚀 快速部署命令

### 升级现有合约

```bash
# 1. 设置环境变量
export PROXY_ADDRESS=0x你的代理地址
export PRIVATE_KEY=your_private_key

# 2. 编译合约
npx hardhat compile --network mc

# 3. 升级合约
npx hardhat run scripts/deploy-v4-mc-chain.cjs --network mc
```

### 全新部署

```bash
# 1. 设置环境变量（不设置 PROXY_ADDRESS）
export PRIVATE_KEY=your_private_key
export MC_ADDRESS=0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF
export JBC_ADDRESS=0xA743cB357a9f59D349efB7985072779a094658dD

# 2. 编译合约
npx hardhat compile --network mc

# 3. 部署合约
npx hardhat run scripts/deploy-v4-mc-chain.cjs --network mc
```

## ✅ 部署后验证清单

- [ ] 合约编译成功
- [ ] 合约部署/升级成功
- [ ] 代理地址和实现地址已记录
- [ ] 合约基本功能验证通过
- [ ] 级差奖励逻辑验证：
  - [ ] 质押时不触发级差奖励
  - [ ] 赎回时基于静态收益计算级差奖励
  - [ ] 级差奖励的MC和JBC从静态奖励中按比例分配
  - [ ] 级差奖励保持50% MC + 50% JBC比例

## 📝 重要提醒

1. **前端需要更新**: 已更新说明文字，需要重新构建和部署前端
2. **测试建议**: 部署后先在测试环境验证级差奖励逻辑
3. **数据备份**: 升级前备份当前合约状态和用户数据

---

**部署脚本**: `scripts/deploy-v4-mc-chain.cjs`  
**升级脚本**: `scripts/upgrade-mc-chain.cjs`  
**网络**: MC Chain (Chain ID: 88813)  
**最后更新**: 2024年12月

