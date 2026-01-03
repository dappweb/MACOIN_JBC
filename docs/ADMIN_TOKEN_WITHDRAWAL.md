# 协议合约中管理员代币提取功能说明

## 概述

协议合约提供了多个管理员函数用于提取代币，但为了用户资金安全，设置了相应的保护机制。

---

## 可提取的代币类型

### 1. JBC 代币提取

#### ✅ 可以提取的部分

**交换储备池中的 JBC**
- **函数**: `withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC)`
- **权限**: 仅管理员 (`onlyOwner`)
- **说明**: 可以提取交换储备池 (`swapReserveJBC`) 中的 JBC
- **用途**: 管理交换流动性
- **前端位置**: 管理面板 → 流动性管理 → 移除 JBC 流动性

```solidity
// 合约代码
function withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC) external onlyOwner {
    if (_amountJBC > 0) {
        swapReserveJBC -= _amountJBC;
        jbcToken.transfer(_toJBC, _amountJBC);
    }
}
```

#### ❌ 不能提取的部分

**协议合约中用于奖励分配的 JBC**
- **保护机制**: `rescueTokens` 函数中明确禁止提取 JBC
- **原因**: 这些 JBC 是用于用户奖励分配的，必须受到保护

```solidity
// 合约代码 - JinbaoProtocolNative.sol
function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
    if (_token == address(jbcToken)) revert InvalidAddress(); // ❌ 禁止提取 JBC
    if (_to == address(0)) revert InvalidAddress();
    
    IERC20(_token).transfer(_to, _amount);
}
```

**说明**: 
- 协议合约中的 JBC 余额主要用于：
  - 用户奖励分配（50% MC + 50% JBC）
  - 交换储备池
- 这些资金受到合约保护，不能通过 `rescueTokens` 提取

---

### 2. MC 代币（原生）提取

#### ✅ 可以提取的方式

**方式 1: 提取交换储备池中的 MC**
- **函数**: `withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC)`
- **权限**: 仅管理员
- **说明**: 可以提取交换储备池 (`swapReserveMC`) 中的原生 MC
- **前端位置**: 管理面板 → 流动性管理 → 移除 MC 流动性

```solidity
function withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC) external onlyOwner {
    if (_amountMC > 0) {
        if (address(this).balance < _amountMC) revert InsufficientNativeBalance();
        swapReserveMC -= _amountMC;
        
        (bool success, ) = _toMC.call{value: _amountMC}("");
        if (!success) revert NativeTransferFailed();
    }
}
```

**方式 2: 提取等级奖励池中的 MC**
- **函数**: `withdrawLevelRewardPool(address _to, uint256 _amount)`
- **权限**: 仅管理员
- **说明**: 可以提取等级奖励池 (`levelRewardPool`) 中未分发的 MC
- **用途**: 管理未分发的层级奖励资金

```solidity
function withdrawLevelRewardPool(address _to, uint256 _amount) external onlyOwner hasNativeBalance(_amount) {
    levelRewardPool -= _amount;
    
    (bool success, ) = _to.call{value: _amount}("");
    if (!success) revert NativeTransferFailed();
    
    emit LevelRewardPoolWithdrawn(_to, _amount);
}
```

**方式 3: 紧急提取原生 MC**
- **函数**: `emergencyWithdrawNative(address _to, uint256 _amount)`
- **权限**: 仅管理员
- **说明**: 可以提取合约中的任意原生 MC 余额
- **用途**: 紧急情况下的资金救援
- **注意**: 需要确保不会影响用户资金

```solidity
function emergencyWithdrawNative(address _to, uint256 _amount) external onlyOwner hasNativeBalance(_amount) {
    (bool success, ) = _to.call{value: _amount}("");
    if (!success) revert NativeTransferFailed();
    
    emit NativeMCWithdrawn(_to, _amount);
}
```

---

### 3. 其他 ERC20 代币提取

#### ✅ 可以提取

**函数**: `rescueTokens(address _token, address _to, uint256 _amount)`
- **权限**: 仅管理员
- **说明**: 可以提取合约中的任意 ERC20 代币（除了 JBC）
- **限制**: 
  - ❌ 不能提取 JBC 代币（受保护）
  - ❌ 不能提取到零地址
- **用途**: 紧急情况下提取误转入合约的其他代币

```solidity
function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
    if (_token == address(jbcToken)) revert InvalidAddress(); // ❌ 禁止提取 JBC
    if (_to == address(0)) revert InvalidAddress();
    
    IERC20(_token).transfer(_to, _amount);
    emit TokensRescued(_token, _to, _amount);
}
```

---

## 前端管理面板功能

### 1. 流动性管理

**位置**: 管理面板 → 系统设置 → 流动性管理

**功能**:
- ✅ 添加 MC 流动性
- ✅ 添加 JBC 流动性
- ✅ 移除 MC 流动性（调用 `withdrawSwapReserves`）
- ✅ 移除 JBC 流动性（调用 `withdrawSwapReserves`）

### 2. 紧急提取

**位置**: 管理面板 → 系统设置 → 紧急提取

**功能**:
- ✅ 提取所有 MC（调用 `withdrawSwapReserves` + `emergencyWithdrawNative`）
- ✅ 提取所有 JBC（调用 `withdrawSwapReserves` + `rescueTokens`）

**注意**: 
- JBC 的提取只能提取交换储备池中的部分
- 协议合约中用于奖励分配的 JBC 无法提取（受保护）

### 3. JBC 代币管理器

**位置**: 管理面板 → JBC管理

**功能**:
- ✅ 查看协议合约 JBC 余额
- ✅ 转账 JBC 到协议合约
- ✅ 从协议合约提取 JBC（调用 `rescueTokens`，但受限制）
- ✅ 转账 JBC 到任意地址

**限制**: 
- 从协议提取时，只能提取非 JBC 代币或交换储备池中的 JBC
- 协议合约中用于奖励分配的 JBC 余额无法直接提取

---

## 安全机制总结

### ✅ 可以提取的资金

1. **交换储备池中的 MC 和 JBC**
   - 通过 `withdrawSwapReserves` 提取
   - 这些是用于交换功能的流动性

2. **等级奖励池中的 MC**
   - 通过 `withdrawLevelRewardPool` 提取
   - 这些是未分发的层级奖励

3. **合约中的其他 ERC20 代币**
   - 通过 `rescueTokens` 提取
   - 用于提取误转入合约的其他代币

4. **合约中的原生 MC 余额**
   - 通过 `emergencyWithdrawNative` 提取
   - 紧急情况下使用

### ❌ 受保护的资金

1. **协议合约中用于奖励分配的 JBC**
   - 不能通过 `rescueTokens` 提取
   - 这些是用户奖励资金，必须受到保护

2. **用户质押的流动性**
   - 用户资金受合约逻辑保护
   - 只能通过正常的赎回流程提取

---

## 使用建议

### 1. 提取交换储备池资金
```javascript
// 提取 MC
await protocolContract.withdrawSwapReserves(
    adminAddress,  // MC 接收地址
    ethers.parseEther("1000"),  // MC 数量
    ethers.ZeroAddress,  // JBC 接收地址（不需要）
    0  // JBC 数量（不需要）
);

// 提取 JBC
await protocolContract.withdrawSwapReserves(
    ethers.ZeroAddress,  // MC 接收地址（不需要）
    0,  // MC 数量（不需要）
    adminAddress,  // JBC 接收地址
    ethers.parseEther("5000")  // JBC 数量
);
```

### 2. 提取等级奖励池
```javascript
await protocolContract.withdrawLevelRewardPool(
    adminAddress,  // 接收地址
    ethers.parseEther("100")  // MC 数量
);
```

### 3. 紧急提取原生 MC
```javascript
await protocolContract.emergencyWithdrawNative(
    adminAddress,  // 接收地址
    ethers.parseEther("1000")  // MC 数量
);
```

### 4. 提取其他代币（非 JBC）
```javascript
await protocolContract.rescueTokens(
    tokenAddress,  // 代币合约地址（不能是 JBC）
    adminAddress,  // 接收地址
    ethers.parseEther("100")  // 代币数量
);
```

---

## 重要提醒

1. ⚠️ **JBC 代币保护**: 协议合约中的 JBC 余额主要用于用户奖励分配，不能通过 `rescueTokens` 提取，这是为了保护用户资金安全。

2. ⚠️ **用户资金安全**: 用户质押的流动性受合约逻辑保护，只能通过正常的赎回流程提取。

3. ⚠️ **权限要求**: 所有提取功能都需要管理员权限（`onlyOwner`），确保只有合约所有者可以执行。

4. ⚠️ **谨慎操作**: 提取资金前请确认：
   - 不会影响用户正常使用
   - 不会影响奖励分配
   - 有合理的提取理由

---

## 相关文档

- [合约地址和功能说明](./CONTRACT_ADDRESSES_AND_FUNCTIONS.md)
- [管理员权限分析](./analysis/ADMIN_PRIVILEGES_ANALYSIS.md)
- [JBC 代币生成机制](./analysis/JBC_GENERATION_ANALYSIS.md)

---

**最后更新**: 2025-01-03
**合约版本**: V4 (Native MC Version)

