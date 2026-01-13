# 修复团队人数小于直推人数问题

## 问题描述

发现1个用户的团队人数小于直推人数，这是数据不一致的问题。

### 问题用户
- **用户地址**: `0x7aa68892f013d981dffac7ae403faa886938552b`
- **直推人数**: 6
- **当前团队人数**: 0
- **问题**: 团队人数应该至少等于直推人数

## 修复方案

### 方案1: 简单修复（推荐）

直接将团队人数设置为至少等于直推人数（6）。

**脚本**: `scripts/fix-team-count-simple.cjs`

**使用方法**:
```bash
# 1. 设置环境变量
export PRIVATE_KEY=your_private_key_here
export RPC_URL=https://chain.mcerscan.com/
export PROTOCOL_ADDRESS=0x0897Cee05E43B2eCf331cd80f881c211eb86844E

# 2. 运行修复脚本
node scripts/fix-team-count-simple.cjs
```

**修复内容**:
- 将用户 `0x7aa68892f013d981dffac7ae403faa886938552b` 的团队人数从 0 设置为 6

### 方案2: 完整修复（需要RPC连接稳定）

递归计算所有直推用户的团队人数，得到更精确的团队人数。

**脚本**: `scripts/fix-team-count-issue.cjs`

**使用方法**:
```bash
export PRIVATE_KEY=your_private_key_here
node scripts/fix-team-count-issue.cjs
```

## 权限要求

需要合约 Owner 权限。根据部署信息：
- **协议合约 Owner**: `0x1Bf9ACe2485BC3391150762a109886d0B85f40Da` (JBC Token合约)
- **JBC Token Owner**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**注意**: 如果协议合约的Owner是JBC Token合约，可能需要通过JBC Token Owner来执行操作。

## 验证修复

修复后，运行一致性检查脚本验证：

```bash
node scripts/check-data-consistency.cjs
```

应该不再有"团队人数小于直推人数"的逻辑错误。

## 注意事项

1. **私钥安全**: 确保私钥安全，不要泄露
2. **RPC连接**: 如果RPC连接不稳定，可能需要多次重试
3. **Gas费用**: 修复操作需要支付Gas费用
4. **备份**: 建议在修复前备份当前数据

## 修复后的影响

- ✅ 数据一致性得到修复
- ✅ 用户的等级可能会自动更新（如果团队人数达到等级要求）
- ✅ 用户的收益计算会更准确
