# 协议 Owner 恢复操作指南

## 📋 当前情况

- **协议 Owner**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da` (JBC Token 合约)
- **JBC Token Owner**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48` (私钥可用 ✅)
- **恢复方式**: 使用 JBC Token Owner 转移协议 Owner

## 🎯 恢复步骤

### 步骤 1: 准备新 Owner 地址

**重要**: 建议使用多签钱包作为新 Owner，更安全且可以恢复。

1. **创建或选择新 Owner 地址**
   - 推荐: 使用 Gnosis Safe 多签钱包
   - 备选: 使用硬件钱包
   - 确保私钥安全备份

2. **验证新地址**
   - 确保地址有效
   - 确保可以接收 Owner 权限

### 步骤 2: 准备 JBC Token Owner 私钥

1. **确认私钥**
   - JBC Token Owner 地址: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`
   - 确保私钥正确且可用
   - 确保有足够的 MC 支付 Gas 费用

2. **检查余额**
   ```bash
   # 需要足够的 MC 支付 Gas 费用（建议至少 0.1 MC）
   ```

### 步骤 3: 执行恢复

**方法 1: 使用环境变量（推荐，更安全）**

```bash
# 设置环境变量
export NEW_OWNER_ADDRESS=0x你的新Owner地址
export JBC_TOKEN_OWNER_PRIVATE_KEY=0xJBC Token Owner私钥

# 执行恢复
node scripts/recover-protocol-owner.cjs
```

**方法 2: 使用命令行参数**

```bash
node scripts/recover-protocol-owner.cjs <新Owner地址> <JBC Token Owner私钥>
```

### 步骤 4: 确认操作

脚本会：
1. ✅ 验证签名者身份（必须是 JBC Token Owner）
2. ✅ 验证当前协议 Owner（必须是 JBC Token 合约）
3. ✅ 验证新 Owner 地址
4. ✅ **自动备份所有关键数据**
5. ✅ 执行 Owner 转移
6. ✅ 验证转移结果
7. ✅ 验证数据完整性

### 步骤 5: 验证恢复结果

恢复完成后，使用备份文件验证：

```bash
node scripts/verify-ownership-transfer.cjs scripts/owner-recovery-backup-<时间戳>.json
```

## 🔒 安全保障

### 数据完整性保障

- ✅ **自动备份**: 转移前自动备份所有关键数据
- ✅ **数据验证**: 转移后自动验证数据完整性
- ✅ **用户数据保护**: 验证用户数据（余额、收益、门票等）未受影响
- ✅ **配置参数保护**: 验证所有配置参数（奖励比例、钱包地址等）未改变

### 用户利益保障

- ✅ **余额验证**: 验证合约余额和用户余额未受影响
- ✅ **收益验证**: 验证用户收益数据未受影响
- ✅ **门票验证**: 验证用户门票信息未受影响
- ✅ **推荐关系验证**: 验证推荐关系未受影响

## ⚠️ 重要提示

### 执行前检查

- [ ] 新 Owner 地址已准备（建议多签钱包）
- [ ] JBC Token Owner 私钥可用
- [ ] JBC Token Owner 有足够的 MC 支付 Gas
- [ ] 新 Owner 地址已验证

### 执行后检查

- [ ] Owner 已成功转移
- [ ] 所有配置参数一致
- [ ] 用户数据未受影响
- [ ] 新 Owner 可以正常执行管理功能
- [ ] 备份文件已妥善保管

### 安全建议

1. **新 Owner 使用多签钱包**
   - 更安全
   - 可以恢复
   - 需要多个签名者同意

2. **私钥安全**
   - 不要将私钥提交到代码仓库
   - 使用环境变量传递私钥
   - 恢复完成后立即清除私钥记录

3. **备份文件**
   - 妥善保管备份文件
   - 备份文件包含敏感信息，不要公开分享

## 📊 恢复流程

```
1. 准备新 Owner 地址
   ↓
2. 准备 JBC Token Owner 私钥
   ↓
3. 执行恢复脚本
   ↓
4. 脚本自动备份数据
   ↓
5. 脚本执行 Owner 转移
   ↓
6. 脚本验证转移结果
   ↓
7. 脚本验证数据完整性
   ↓
8. 使用验证脚本确认
   ↓
9. 完成 ✅
```

## 🛠️ 可用工具

1. **`scripts/recover-protocol-owner.cjs`** - 恢复协议 Owner（使用 JBC Token Owner）
2. **`scripts/verify-ownership-transfer.cjs`** - 验证转移后的数据完整性
3. **`scripts/check-contract-owner.cjs`** - 检查当前 Owner

## 📞 故障排除

### 问题 1: 签名者不是 JBC Token Owner

**错误**: `签名者不是 JBC Token Owner！`

**解决**: 确保使用的私钥是 JBC Token Owner (`0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`) 的私钥

### 问题 2: 余额不足

**错误**: `余额不足支付 Gas 费用！`

**解决**: 向 JBC Token Owner 地址充值足够的 MC（建议至少 0.1 MC）

### 问题 3: 新 Owner 地址无效

**错误**: `新 Owner 地址无效！`

**解决**: 检查新 Owner 地址格式是否正确

## ✅ 完成检查清单

- [ ] Owner 已成功转移
- [ ] 所有配置参数一致
- [ ] 用户数据未受影响
- [ ] 新 Owner 可以正常执行管理功能
- [ ] 备份文件已妥善保管
- [ ] 新 Owner 私钥已安全备份
- [ ] 已测试新 Owner 的管理功能

## 📖 相关文档

- `docs/OWNER_RECOVERY_SOLUTION.md` - 恢复方案详细说明
- `docs/SAFE_OWNERSHIP_TRANSFER.md` - 安全转移 Owner 指南

