# 推荐人要求恢复分析

## 📋 改动概述

本次升级恢复了购买门票的推荐人要求。用户必须先绑定推荐人才能购买门票。

## 🔄 改动详情

### 修改前（当前版本）

```solidity
function buyTicket() external payable nonReentrant whenNotPaused {
    uint256 amount = msg.value;
    _expireTicketIfNeeded(msg.sender);
    
    // 没有推荐人检查
    // 如果无推荐人，直推奖励会转到营销钱包
    // ...
}
```

**行为**:
- ✅ 允许无推荐人购买门票
- ✅ 如果无推荐人，直推奖励（25%）转到营销钱包
- ✅ 用户可以随时购买门票

### 修改后（升级后）

```solidity
function buyTicket() external payable nonReentrant whenNotPaused {
    // 检查是否已绑定推荐人
    if (userInfo[msg.sender].referrer == address(0)) {
        revert MustBindReferrer();
    }
    
    uint256 amount = msg.value;
    _expireTicketIfNeeded(msg.sender);
    // ...
}
```

**行为**:
- ⚠️ 必须先绑定推荐人才能购买门票
- ⚠️ 未绑定推荐人时购买会失败（抛出 `MustBindReferrer()` 错误）
- ✅ 绑定推荐人后可以正常购买门票

## 🆕 新增错误

```solidity
error MustBindReferrer();
```

当用户未绑定推荐人时尝试购买门票，会抛出此错误。

## 📊 影响分析

### 对现有用户的影响

| 用户类型 | 影响 | 说明 |
|---------|------|------|
| **已绑定推荐人** | ✅ 无影响 | 可以正常购买门票 |
| **未绑定推荐人** | ⚠️ 无法购买 | 需要先调用 `bindReferrer()` |

### 对新用户的影响

1. **注册流程变化**:
   - 之前: 可以直接购买门票（无推荐人时奖励转到营销钱包）
   - 现在: 必须先绑定推荐人，然后才能购买门票

2. **推荐人绑定**:
   - 新用户必须调用 `bindReferrer(address referrer)` 绑定推荐人
   - 绑定后可以正常购买门票

### 对前端的影响

前端需要：
1. ✅ 检查用户是否已绑定推荐人
2. ✅ 如果未绑定，提示用户先绑定推荐人
3. ✅ 提供推荐人绑定界面
4. ✅ 购买门票前验证推荐人状态

## 🔍 代码变更

### 合约代码

**文件**: `contracts/JinbaoProtocolNative.sol`

**变更**:
1. 新增错误定义: `error MustBindReferrer();`
2. 在 `buyTicket()` 函数开头添加推荐人检查

### 前端代码

前端需要更新：
- 购买门票前检查推荐人状态
- 显示推荐人绑定提示
- 处理 `MustBindReferrer()` 错误

## ✅ 验证步骤

升级后验证：

1. **未绑定推荐人用户**:
   ```javascript
   // 应该失败
   await protocolContract.buyTicket({ value: ethers.parseEther("100") });
   // 预期: 抛出 MustBindReferrer() 错误
   ```

2. **绑定推荐人后**:
   ```javascript
   // 先绑定推荐人
   await protocolContract.bindReferrer(REFERRER_ADDRESS);
   
   // 然后可以购买门票
   await protocolContract.buyTicket({ value: ethers.parseEther("100") });
   // 预期: 成功
   ```

## 📝 相关函数

### bindReferrer()

```solidity
function bindReferrer(address referrer) external {
    // 绑定推荐人
    // 只能绑定一次
    // 不能绑定自己
    // 不能绑定地址(0)
}
```

### buyTicket()

```solidity
function buyTicket() external payable {
    // 现在需要先检查推荐人
    if (userInfo[msg.sender].referrer == address(0)) {
        revert MustBindReferrer();
    }
    // ...
}
```

## ⚠️ 注意事项

1. **用户体验**: 
   - 新用户必须先绑定推荐人，可能增加注册门槛
   - 建议前端提供清晰的推荐人绑定引导

2. **推荐人系统**:
   - 确保推荐人系统正常工作
   - 提供推荐人查找/验证功能

3. **错误处理**:
   - 前端需要捕获 `MustBindReferrer()` 错误
   - 提供友好的错误提示和解决方案

## 🔗 相关文档

- [升级总结](../UPGRADE_SUMMARY.md)
- [升级变化详情](./UPGRADE_CHANGES_DETAIL.md)
- [升级安全性分析](./UPGRADE_SAFETY_ANALYSIS.md)

---

**改动类型**: 功能恢复  
**影响范围**: 所有用户（特别是新用户）  
**升级优先级**: 高（与回购机制更新一起升级）













