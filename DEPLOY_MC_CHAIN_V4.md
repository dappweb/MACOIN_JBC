# MC Chain 部署指南 - JinbaoProtocolV4

## 📋 更新内容

本次更新主要修改了**级差奖励**的计算逻辑：

### 🔄 变更说明

**之前（错误）:**
- 级差奖励在质押流动性时计算
- 基于质押金额（流动性本金）计算
- 级差奖励的MC和JBC独立计算

**现在（正确）:**
- 级差奖励在赎回时计算
- 基于赎回的静态收益（`totalYield`）计算
- **级差奖励的MC和JBC从静态奖励的MC和JBC中按比例分配**
- 级差奖励的MC和JBC比例与静态奖励一致（50% MC + 50% JBC）

### 📝 代码变更

1. **移除质押时的级差奖励计算**
   - 文件: `contracts/JinbaoProtocolV4.sol`
   - 位置: `stakeLiquidity()` 函数
   - 移除: `_calculateAndStoreDifferentialRewards(msg.sender, amount, nextStakeId)`

2. **在赎回时基于静态收益计算级差奖励**
   - 文件: `contracts/JinbaoProtocolV4.sol`
   - 位置: `redeem()` 函数
   - 添加: 基于 `pending`（静态收益）计算并分配级差奖励

3. **级差奖励从静态奖励的MC和JBC中按比例分配**
   - 文件: `contracts/JinbaoProtocolV4.sol`
   - 新增函数: `_calculateAndStoreDifferentialRewardsFromStatic()`
   - 新增函数: `_distributeDifferentialRewardFromStatic()`
   - 修改结构: `PendingReward` 添加 `mcAmount` 和 `jbcAmount` 字段
   - 级差奖励的MC和JBC比例与静态奖励一致（50% MC + 50% JBC）

4. **JBC通过AMM交换获得**
   - 如果合约JBC余额不足，通过交换MC获得JBC
   - 使用 `swapMCToJBC` 的交换逻辑
   - 扣除交换税收并销毁

## 🚀 部署步骤

### 前置条件

1. 确保已安装依赖:
```bash
npm install
```

2. 配置环境变量 (`.env` 文件):
```env
PRIVATE_KEY=your_private_key
MC_ADDRESS=0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF
JBC_ADDRESS=0xA743cB357a9f59D349efB7985072779a094658dD
PROXY_ADDRESS=0x...  # 如果是升级，需要设置代理地址
MARKETING_WALLET=0x...
TREASURY_WALLET=0x...
LP_WALLET=0x...
BUYBACK_WALLET=0x...
```

3. 确保账户有足够的 MC 代币（至少 5 MC）

### 方式一: 全新部署

如果这是第一次部署，或者需要部署全新的合约:

```bash
# 编译合约
npx hardhat compile --network mc

# 部署合约
npx hardhat run scripts/deploy-v4-mc-chain.cjs --network mc
```

**注意**: 全新部署时，不要设置 `PROXY_ADDRESS` 环境变量，或者设置为空。

### 方式二: 升级现有合约

如果已有代理合约，需要升级:

```bash
# 1. 设置代理地址
export PROXY_ADDRESS=0x你的代理合约地址

# 2. 编译合约
npx hardhat compile --network mc

# 3. 升级合约
npx hardhat run scripts/upgrade-mc-chain.cjs --network mc

# 或者使用新的部署脚本（会自动检测 PROXY_ADDRESS）
npx hardhat run scripts/deploy-v4-mc-chain.cjs --network mc
```

## 📊 部署信息

部署完成后，脚本会：

1. 显示部署/升级信息:
   - 代理地址
   - 实现合约地址
   - 部署账户
   - 配置的钱包地址

2. 验证合约:
   - MC Token 地址
   - JBC Token 地址
   - 合约所有者

3. 保存部署信息到 `deployments/` 目录:
   - 文件名格式: `mc-chain-deployment-{timestamp}.json` 或 `mc-chain-upgrade-{timestamp}.json`
   - 包含完整的部署配置和变更记录

## ✅ 验证部署

部署完成后，建议进行以下验证:

### 1. 检查合约地址

```bash
# 查看部署信息文件
cat deployments/mc-chain-*.json
```

### 2. 在区块浏览器验证

访问 [MCerscan](https://mcerscan.com) 并搜索合约地址，确认:
- 合约已成功部署/升级
- 交易已确认
- 合约代码已验证（如果可能）

### 3. 功能测试

```bash
# 测试合约连接
npx hardhat run scripts/test-mc-chain.cjs --network mc

# 测试门票购买
npx hardhat run scripts/test-ticket-purchase-mc-chain.cjs --network mc
```

## 🔍 关键变更验证

升级后，验证级差奖励逻辑是否正确:

1. **质押流动性**: 不应该触发级差奖励计算
2. **赎回流动性**: 应该基于静态收益计算级差奖励

### 测试步骤

1. 用户A质押流动性（例如: 1000 MC）
2. 等待质押周期结束
3. 用户A赎回流动性，获得静态收益（例如: 60 MC）
   - 静态奖励分配: 30 MC + 30 MC等值JBC（假设价格0.25，即120 JBC）
4. 检查用户A的上级是否收到级差奖励:
   - 级差奖励总额 = 60 MC × 级差比例（例如10%）= 6 MC
   - 级差奖励MC = 6 MC × (30 MC / 60 MC) = 3 MC
   - 级差奖励JBC = 6 MC × (120 JBC / 60 MC) = 12 JBC
   - 验证: 上级应该收到 3 MC + 12 JBC，而不是基于 1000 MC（质押金额）计算的奖励

## 📝 注意事项

1. **升级风险**: 升级会替换实现合约，但不会影响现有数据
2. **Gas费用**: 确保账户有足够的 MC 代币支付 Gas 费用
3. **网络连接**: 确保可以连接到 MC Chain RPC (`https://chain.mcerscan.com/`)
4. **备份**: 升级前建议备份当前合约状态

## 🆘 故障排除

### 问题: 编译失败

```bash
# 清理缓存并重新编译
npx hardhat clean
npx hardhat compile --network mc
```

### 问题: 部署超时

- 检查网络连接
- 增加超时时间（脚本中已设置为 5 分钟）
- 检查 RPC 节点是否正常

### 问题: 升级失败

- 确认代理地址正确
- 确认合约名称匹配（JinbaoProtocolV4 或 JinbaoProtocol）
- 检查是否有足够的 Gas

## 📞 支持

如有问题，请检查:
- 部署日志文件
- 区块浏览器交易记录
- 合约事件日志

---

**最后更新**: 2024年12月
**合约版本**: JinbaoProtocolV4
**网络**: MC Chain (Chain ID: 88813)

