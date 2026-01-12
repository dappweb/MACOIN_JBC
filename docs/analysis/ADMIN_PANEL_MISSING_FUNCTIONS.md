# 管理员面板无法使用的功能清单

## 📋 概述

本文档列出了合约中存在但管理员面板中**无法使用**或**未实现**的功能。

---

## ❌ 无法使用的功能

### 1. **设置团队总交易量** (`adminSetTeamTotalVolume`)

**合约函数：**
```solidity
function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external onlyOwner
```

**状态：** ❌ 未实现
- 合约中存在此函数
- AdminPanel 和 AdminUserManager 中都没有实现此功能
- 用户界面中无法修改 `teamTotalVolume`

**影响：**
- 无法通过管理面板恢复或修正用户的团队总交易量数据

---

### 2. **设置累计收益** (`adminSetTotalRevenue`)

**合约函数：**
```solidity
function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external onlyOwner
```

**状态：** ✅ 已实现
- 合约中存在此函数
- AdminUserManager 中**显示并可以编辑** `totalRevenue`
- 在编辑模式下可以修改，保存时会调用 `adminSetTotalRevenue`

**实现位置：**
- `components/AdminUserManager.tsx` - 编辑界面和保存逻辑
- `src/Web3Context.tsx` - ABI定义

---

### 3. **设置收益上限** (`adminSetCurrentCap`)

**合约函数：**
```solidity
function adminSetCurrentCap(address user, uint256 newCurrentCap) external onlyOwner
```

**状态：** ✅ 已实现
- 合约中存在此函数
- AdminUserManager 中**显示并可以编辑** `currentCap`
- 在编辑模式下可以修改，保存时会调用 `adminSetCurrentCap`

**实现位置：**
- `components/AdminUserManager.tsx` - 编辑界面和保存逻辑
- `src/Web3Context.tsx` - ABI定义

---

### 4. **设置最大门票金额** (`adminSetMaxTicketAmounts`)

**合约函数：**
```solidity
function adminSetMaxTicketAmounts(
    address user, 
    uint256 newMaxTicketAmount, 
    uint256 newMaxSingleTicketAmount
) external onlyOwner
```

**状态：** ❌ 未实现
- 合约中存在此函数
- AdminPanel 和 AdminUserManager 中都没有实现此功能
- 用户界面中无法修改 `maxTicketAmount` 和 `maxSingleTicketAmount`

**影响：**
- 无法通过管理面板恢复或修正用户的最大门票金额数据

---

### 5. **设置退款费用** (`adminSetRefundFeeAmount`)

**合约函数：**
```solidity
function adminSetRefundFeeAmount(address user, uint256 newRefundFeeAmount) external onlyOwner
```

**状态：** ✅ 已实现
- 合约中存在此函数
- AdminUserManager 中**显示并可以编辑** `refundFeeAmount`
- 在编辑模式下可以修改，保存时会调用 `adminSetRefundFeeAmount`

**实现位置：**
- `components/AdminUserManager.tsx` - 编辑界面和保存逻辑
- `src/Web3Context.tsx` - ABI定义

---

### 6. **批量更新用户数据** (`adminUpdateUserData`)

**合约函数：**
```solidity
// 注意：此函数可能不存在于合约中
function adminUpdateUserData(
    address user,
    bool updateActiveDirects, uint256 newActiveDirects,
    bool updateTeamCount, uint256 newTeamCount,
    bool updateTotalRevenue, uint256 newTotalRevenue,
    bool updateCurrentCap, uint256 newCurrentCap,
    bool updateRefundFee, uint256 newRefundFee
) external onlyOwner
```

**状态：** ❌ 可能不存在
- AdminUserManager 中**尝试使用**此函数（第250行）
- 但合约中可能**没有此函数**
- 代码中有回退逻辑，使用单独的 `adminSetActiveDirects` 和 `adminSetTeamCount`

**影响：**
- 无法一次性批量更新多个用户数据字段
- 需要多次交易才能更新多个字段

---

## ✅ 已实现的功能

以下功能在管理员面板中**已实现**并可以正常使用：

1. ✅ `adminSetReferrer` - 设置推荐人
2. ✅ `adminSetActiveDirects` - 设置活跃直推数
3. ✅ `adminSetTeamCount` - 设置团队人数
4. ✅ `adminSetTotalRevenue` - 设置累计收益（**新实现**）
5. ✅ `adminSetCurrentCap` - 设置收益上限（**新实现**）
6. ✅ `adminSetRefundFeeAmount` - 设置退款费用（**新实现**）
7. ✅ `setDistributionConfig` - 设置分配比例
8. ✅ `setSwapTaxes` - 设置交换税费
9. ✅ `setRedemptionFeePercent` - 设置赎回手续费
10. ✅ `setWallets` - 设置钱包地址
11. ✅ `addLiquidity` - 添加流动性
12. ✅ `withdrawSwapReserves` - 提取交换储备
13. ✅ `rescueTokens` - 紧急提取代币
14. ✅ `transferOwnership` - 转移所有权
15. ✅ `setOperationalStatus` - 设置运营状态
16. ✅ `setTicketFlexibilityDuration` - 设置门票灵活期
17. ✅ `setJbcToken` - 设置JBC代币地址
18. ✅ `dailyBurn` - 每日燃烧（通过DailyBurnManager）

---

## 🔧 建议修复

### 优先级 1（高优先级）✅ 已完成

1. **在 AdminUserManager 中添加编辑功能：**
   - ✅ `totalRevenue` - 累计收益（已实现）
   - ✅ `currentCap` - 收益上限（已实现）
   - ✅ `refundFeeAmount` - 退款费用（已实现）

### 优先级 2（中优先级）

2. **在 AdminPanel 或 AdminUserManager 中添加新功能：**
   - `adminSetTeamTotalVolume` - 设置团队总交易量
   - `adminSetMaxTicketAmounts` - 设置最大门票金额

### 优先级 3（低优先级）

3. **检查并实现（如果合约支持）：**
   - `adminUpdateUserData` - 批量更新用户数据（如果合约中有此函数）

---

## 📝 实现示例

### 在 AdminUserManager 中添加编辑功能

```typescript
// 在 EditableUserData 接口中添加字段
interface EditableUserData {
    referrer: string;
    activeDirects: string;
    teamCount: string;
    totalRevenue: string;        // 新增
    currentCap: string;          // 新增
    refundFeeAmount: string;     // 新增
}

// 在 handleSaveChanges 中添加更新逻辑
if (shouldUpdateTotalRevenue && protocolContract.adminSetTotalRevenue) {
    const tx = await protocolContract.adminSetTotalRevenue(
        userInfo.address,
        ethers.parseEther(editData.totalRevenue)
    );
    await tx.wait();
}

if (shouldUpdateCurrentCap && protocolContract.adminSetCurrentCap) {
    const tx = await protocolContract.adminSetCurrentCap(
        userInfo.address,
        ethers.parseEther(editData.currentCap)
    );
    await tx.wait();
}

if (shouldUpdateRefundFee && protocolContract.adminSetRefundFeeAmount) {
    const tx = await protocolContract.adminSetRefundFeeAmount(
        userInfo.address,
        ethers.parseEther(editData.refundFeeAmount)
    );
    await tx.wait();
}
```

---

## 🔍 验证方法

要验证这些功能是否可用，可以：

1. **检查合约ABI：**
   ```bash
   node scripts/check-admin-functions.cjs
   ```

2. **测试函数调用：**
   - 在浏览器控制台中尝试调用这些函数
   - 检查是否返回错误或成功

3. **查看合约源码：**
   - 检查 `contracts/JinbaoProtocolNative.sol` 中是否有这些函数

---

## 📊 总结

| 功能 | 合约中存在 | 前端显示 | 前端可编辑 | 状态 |
|------|-----------|---------|-----------|------|
| `adminSetTeamTotalVolume` | ✅ | ❌ | ❌ | ❌ 未实现 |
| `adminSetTotalRevenue` | ✅ | ✅ | ✅ | ✅ **已实现** |
| `adminSetCurrentCap` | ✅ | ✅ | ✅ | ✅ **已实现** |
| `adminSetMaxTicketAmounts` | ✅ | ❌ | ❌ | ❌ 未实现 |
| `adminSetRefundFeeAmount` | ✅ | ✅ | ✅ | ✅ **已实现** |
| `adminUpdateUserData` | ❓ | ❌ | ❌ | ❌ 可能不存在 |

---

**最后更新：** 2024年（根据代码分析）
