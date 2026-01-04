# 执行 Owner 转移操作指南

## 🚀 快速执行

### 方法 1: 使用环境变量（推荐）

```bash
# 设置环境变量
export JBC_TOKEN_OWNER_PRIVATE_KEY=0x你的JBC Token Owner私钥

# 执行转移
node scripts/transfer-owner-to-jbc-owner.cjs
```

### 方法 2: 使用命令行参数

```bash
node scripts/transfer-owner-to-jbc-owner.cjs <JBC Token Owner私钥>
```

## 📋 执行前检查清单

- [ ] JBC Token Owner 私钥已准备
- [ ] JBC Token Owner 地址: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`
- [ ] JBC Token Owner 有足够的 MC 支付 Gas（建议至少 0.1 MC）
- [ ] 已确认要执行转移

## ⚠️ 重要提示

1. **私钥安全**:
   - 不要将私钥提交到代码仓库
   - 使用环境变量传递私钥
   - 执行完成后立即清除环境变量

2. **Gas 费用**:
   - 确保 JBC Token Owner 有足够的 MC
   - 建议至少 0.1 MC
   - 脚本会自动检查余额

3. **执行过程**:
   - 脚本会先备份所有数据
   - 然后等待 10 秒（可以按 Ctrl+C 取消）
   - 最后执行转移并验证

## 📊 转移详情

- **从**: JBC Token 合约 (`0x1Bf9ACe2485BC3391150762a109886d0B85f40Da`)
- **到**: JBC Token Owner (`0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`)

## ✅ 执行后验证

转移完成后，脚本会自动：
1. ✅ 验证 Owner 是否成功转移
2. ✅ 验证配置参数是否一致
3. ✅ 验证用户数据是否一致

也可以手动验证：
```bash
node scripts/check-contract-owner.cjs
```

## 🔒 安全保障

- ✅ 自动备份所有关键数据
- ✅ 转移后自动验证数据完整性
- ✅ 保护用户利益
- ✅ 保护配置参数

