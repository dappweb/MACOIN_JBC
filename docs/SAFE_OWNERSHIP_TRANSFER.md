# 安全转移 Owner 地址指南

## 概述

本文档说明如何在**保证数据不变**和**用户利益不受损失**的情况下安全地转移合约 Owner 地址。

## 安全措施

### ✅ 数据完整性保障

1. **自动备份**: 转移前自动备份所有关键数据
2. **数据验证**: 转移后自动验证数据完整性
3. **用户数据保护**: 验证用户数据（余额、收益、门票等）未受影响
4. **配置参数保护**: 验证所有配置参数（奖励比例、钱包地址等）未改变

### ✅ 用户利益保障

1. **余额验证**: 验证合约余额和用户余额未受影响
2. **收益验证**: 验证用户收益数据未受影响
3. **门票验证**: 验证用户门票信息未受影响
4. **推荐关系验证**: 验证推荐关系未受影响

## 使用步骤

### 步骤 1: 准备

1. **确认当前 Owner 地址**:
   ```bash
   node scripts/check-contract-owner.cjs
   ```

2. **准备新 Owner 地址**:
   - 确保新 Owner 地址有效
   - 如果是合约地址，确保可以接收 Owner 权限
   - 确保新 Owner 私钥安全

3. **准备当前 Owner 私钥**:
   - 确保私钥安全，不要泄露
   - 建议使用环境变量或安全的方式传递

### 步骤 2: 执行转移

**方法 1: 使用环境变量（推荐）**
```bash
export NEW_OWNER_ADDRESS=0x你的新Owner地址
export CURRENT_OWNER_PRIVATE_KEY=0x当前Owner私钥
node scripts/safe-transfer-ownership.cjs
```

**方法 2: 使用命令行参数**
```bash
node scripts/safe-transfer-ownership.cjs <新Owner地址> <当前Owner私钥>
```

### 步骤 3: 验证转移结果

转移完成后，使用备份文件验证数据完整性：

```bash
node scripts/verify-ownership-transfer.cjs <备份文件路径>
```

备份文件路径会在转移过程中显示，格式为：
```
scripts/ownership-transfer-backup-<时间戳>.json
```

## 脚本功能

### safe-transfer-ownership.cjs

**功能**:
1. ✅ 验证当前 Owner 身份
2. ✅ 验证新 Owner 地址有效性
3. ✅ **自动备份所有关键数据**:
   - 配置参数（奖励比例、钱包地址等）
   - 合约余额（MC、JBC）
   - 示例用户数据（用于验证）
4. ✅ 执行 Owner 转移
5. ✅ 验证转移结果
6. ✅ 验证数据完整性

**安全特性**:
- 转移前 5 秒倒计时，可以取消
- 自动生成备份文件
- 转移后自动验证
- 详细的日志输出

### verify-ownership-transfer.cjs

**功能**:
1. ✅ 验证 Owner 是否成功转移
2. ✅ 验证配置参数是否一致
3. ✅ 验证用户数据是否一致
4. ✅ 生成验证报告

## 备份数据内容

备份文件包含以下数据：

```json
{
  "timestamp": "转移时间",
  "blockNumber": "区块号",
  "contractAddress": "合约地址",
  "currentOwner": "当前Owner",
  "newOwner": "新Owner",
  "config": {
    "directRewardPercent": "直推奖励比例",
    "levelRewardPercent": "层级奖励比例",
    "marketingWallet": "营销钱包",
    "treasuryWallet": "国库钱包",
    "lpInjectionWallet": "流动性注入钱包",
    "buybackWallet": "回购钱包",
    "jbcToken": "JBC代币地址"
  },
  "balances": {
    "swapReserveMC": "交换储备MC",
    "swapReserveJBC": "交换储备JBC",
    "contractBalance": "合约余额"
  },
  "sampleUsers": [
    {
      "address": "用户地址",
      "userInfo": { ... },
      "ticket": { ... }
    }
  ]
}
```

## 注意事项

### ⚠️ 重要提示

1. **私钥安全**:
   - 永远不要将私钥提交到代码仓库
   - 使用环境变量或安全的方式传递私钥
   - 转移完成后立即清除私钥记录

2. **新 Owner 地址**:
   - 确保新 Owner 地址正确
   - 如果是合约地址，确保可以接收 Owner 权限
   - 建议先在小额测试网络上测试

3. **备份文件**:
   - 妥善保管备份文件
   - 备份文件包含敏感信息，不要公开分享

4. **验证步骤**:
   - 转移后必须执行验证步骤
   - 如果验证失败，立即检查原因

### ✅ 转移后检查清单

- [ ] Owner 地址已成功转移
- [ ] 所有配置参数一致
- [ ] 合约余额未受影响
- [ ] 用户数据未受影响
- [ ] 新 Owner 可以正常执行管理功能
- [ ] 备份文件已妥善保管

## 故障排除

### 问题 1: 签名者不是当前 Owner

**错误**: `签名者不是当前 Owner！`

**解决**: 确保使用的私钥是当前 Owner 的私钥

### 问题 2: 新 Owner 地址无效

**错误**: `新 Owner 地址无效！`

**解决**: 检查新 Owner 地址格式是否正确

### 问题 3: 数据验证失败

**错误**: 部分数据不一致

**可能原因**:
- 转移过程中有正常交易发生（这是正常的）
- 配置参数被修改（需要检查）

**解决**: 
- 检查是否有正常交易发生
- 如果配置参数不一致，需要检查原因

## 示例

### 完整转移流程

```bash
# 1. 检查当前 Owner
node scripts/check-contract-owner.cjs

# 2. 执行转移
export NEW_OWNER_ADDRESS=0x新Owner地址
export CURRENT_OWNER_PRIVATE_KEY=0x当前Owner私钥
node scripts/safe-transfer-ownership.cjs

# 3. 验证转移结果
node scripts/verify-ownership-transfer.cjs scripts/ownership-transfer-backup-<时间戳>.json
```

## 技术支持

如果遇到问题，请：
1. 检查错误日志
2. 查看备份文件
3. 联系技术支持

## 总结

这个转移流程确保了：
- ✅ **数据完整性**: 所有数据在转移前后保持一致
- ✅ **用户利益**: 用户的所有数据和利益都得到保护
- ✅ **安全性**: 多重验证和备份机制
- ✅ **可追溯性**: 详细的日志和备份文件

