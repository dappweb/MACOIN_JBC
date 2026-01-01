# 升级管理员函数指南

## 概述

本指南说明如何升级合约以添加新的管理员函数：
- `adminSetActiveDirects` - 管理员修改用户活跃直推数量
- `adminSetTeamCount` - 管理员修改用户团队成员数量

## 前置要求

1. **合约所有者权限**: 只有合约所有者可以执行升级
2. **私钥配置**: 需要配置合约所有者的私钥
3. **足够的 Gas**: 确保账户有足够的 MC 代币支付 Gas 费用
4. **网络连接**: 确保可以连接到 MC Chain

## 配置步骤

### 1. 设置环境变量

创建 `.env` 文件（如果不存在）并添加：

```bash
PRIVATE_KEY=你的合约所有者私钥（0x开头）
MC_RPC_URL=https://chain.mcerscan.com/
```

**安全提示**: 
- 不要将 `.env` 文件提交到 Git
- 确保 `.env` 文件在 `.gitignore` 中
- 使用安全的密钥管理工具

### 2. 验证配置

运行检查脚本验证配置：

```bash
npx hardhat run scripts/check-admin-functions.cjs --network mc --config config/hardhat.config.cjs
```

## 执行升级

### 步骤 1: 检查当前状态

```bash
npx hardhat run scripts/check-admin-functions.cjs --network mc --config config/hardhat.config.cjs
```

这会显示：
- 当前合约是否包含新函数
- 合约基本信息
- 是否需要升级

### 步骤 2: 执行升级

```bash
npx hardhat run scripts/upgrade-admin-directs-teamcount.cjs --network mc --config config/hardhat.config.cjs
```

升级过程会：
1. 验证部署者是否为合约所有者
2. 检查当前合约状态
3. 编译新合约代码
4. 执行 UUPS 升级
5. 验证新函数是否可用
6. 保存升级记录

### 步骤 3: 验证升级结果

升级完成后，脚本会自动验证：
- ✅ 新函数是否存在
- ✅ 合约状态是否保持
- ✅ 事件定义是否正确

## 升级后的功能

### adminSetActiveDirects

```solidity
function adminSetActiveDirects(address user, uint256 newActiveDirects) external onlyOwner
```

**功能**: 修改用户的活跃直推数量

**影响**:
- 影响层级奖励的可获得层级数
  - 1个活跃直推 = 5层
  - 2个活跃直推 = 10层
  - 3+个活跃直推 = 15层

**事件**: 触发 `UserDataUpdated` 事件

### adminSetTeamCount

```solidity
function adminSetTeamCount(address user, uint256 newTeamCount) external onlyOwner
```

**功能**: 修改用户的团队成员数量

**影响**:
- 自动检查并触发等级变化（如果等级改变）
- 影响用户的等级（V0-V9）
- 影响极差奖励比例

**事件**: 
- 触发 `TeamCountUpdated` 事件
- 如果等级改变，触发 `UserLevelChanged` 事件

## 升级记录

升级信息会保存到 `deployments/upgrade-admin-directs-teamcount-{timestamp}.json`

包含：
- 升级时间
- 代理地址（不变）
- 新实现地址
- 部署者地址
- 新增功能列表
- 事件列表
- Gas 使用量
- 区块号

## 故障排除

### 错误: 没有可用的签名者账户

**原因**: PRIVATE_KEY 未设置或无效

**解决**:
1. 检查 `.env` 文件是否存在
2. 确认 `PRIVATE_KEY` 已设置
3. 确认私钥格式正确（0x开头）

### 错误: 部署者不是合约所有者

**原因**: 使用的私钥不是合约所有者的私钥

**解决**: 使用合约所有者的私钥

### 错误: Stack too deep

**原因**: Solidity 编译器限制

**解决**: 已在 `config/hardhat.config.cjs` 中启用 `viaIR: true`

### 错误: 存储布局冲突

**原因**: 合约存储变量顺序改变

**解决**: 
- 检查合约存储变量是否与之前版本兼容
- 确保没有删除或重新排序存储变量

### 错误: Gas 不足

**原因**: 账户余额不足

**解决**: 确保账户有足够的 MC 代币支付 Gas 费用

## 安全注意事项

1. **备份**: 升级前备份当前合约状态
2. **测试**: 在测试网络先验证升级
3. **验证**: 升级后验证所有功能正常
4. **监控**: 升级后监控合约事件和状态
5. **文档**: 记录所有升级操作

## 回滚计划

如果升级出现问题：

1. **检查升级记录**: 查看 `deployments/upgrade-*.json` 文件
2. **联系开发团队**: 获取技术支持
3. **准备回滚**: 如果需要，可以部署之前的实现版本

## 联系支持

如有问题，请联系开发团队或查看项目文档。

---

**最后更新**: 2025-01-01  
**版本**: 1.0

