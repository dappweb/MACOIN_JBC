# 修复指南

## 修复前准备状态

✅ **已完成**:
- 数据备份完成
- 数据一致性检查完成
- 修复脚本已准备
- 修复检查清单已创建

⚠️ **需要设置**:
- PRIVATE_KEY环境变量（合约owner的私钥）

## 待修复问题

### 逻辑错误（1个）

**用户地址**: `0x7aa68892f013d981dffac7ae403faa886938552b`

**问题详情**:
- 直推人数: 6
- 当前团队人数: 0
- 问题: 团队人数 < 直推人数（逻辑错误）

**需要修复为**: 团队人数至少等于直推人数（6）

## 修复步骤

### 步骤1: 设置环境变量

```bash
# 设置合约owner的私钥
export PRIVATE_KEY=your_private_key_here

# 可选：设置RPC URL（如果使用不同的RPC节点）
export RPC_URL=https://chain.mcerscan.com/

# 可选：设置协议合约地址（如果使用不同的合约）
export PROTOCOL_ADDRESS=0x0897Cee05E43B2eCf331cd80f881c211eb86844E
```

### 步骤2: 运行修复脚本

```bash
node scripts/fix-team-count-simple.cjs
```

### 步骤3: 验证修复结果

修复完成后，运行数据一致性检查验证：

```bash
node scripts/check-data-consistency.cjs
```

应该显示：逻辑错误: 0个

## 修复脚本说明

### fix-team-count-simple.cjs

**功能**: 修复团队人数小于直推人数的逻辑错误

**修复逻辑**:
1. 从数据一致性报告读取问题用户
2. 查询用户当前数据（直推人数、团队人数）
3. 如果团队人数 < 直推人数，将团队人数设置为至少等于直推人数
4. 使用 `adminSetTeamCount` 函数更新
5. 验证修复结果

**注意事项**:
- 需要合约owner权限
- 需要支付Gas费用
- 如果RPC连接不稳定，可能需要重试

## 修复后验证

### 1. 检查修复结果

```bash
node scripts/check-data-consistency.cjs
```

### 2. 验证用户数据

```bash
node scripts/check-user-mining-access.cjs 0x7aa68892f013d981dffac7ae403faa886938552b
```

### 3. 检查等级变化

修复后，如果团队人数从0增加到6，用户等级可能从V0升级到V1（因为V1需要10人，所以还是V0）。

## 预期结果

修复成功后：
- ✅ 用户 `0x7aa68892f013d981dffac7ae403faa886938552b` 的团队人数 >= 6
- ✅ 数据一致性检查显示：逻辑错误: 0个
- ✅ 用户数据恢复正常

## 如果修复失败

### 问题1: RPC连接超时

**解决方案**:
- 等待一段时间后重试
- 或者使用其他RPC节点

### 问题2: Gas费用不足

**解决方案**:
- 确保账户有足够的MC作为Gas费用
- 检查Gas价格设置

### 问题3: 权限不足

**解决方案**:
- 确认PRIVATE_KEY对应的地址是合约owner
- 检查合约owner地址：`node scripts/check-contract-owner.cjs`

## 联系支持

如果修复过程中遇到问题，请提供：
1. 错误信息
2. 修复脚本的输出
3. 数据一致性检查报告
