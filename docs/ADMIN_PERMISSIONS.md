# 管理员最大修改权限说明

本文档详细列出了 `JinbaoProtocolV4` 合约中管理员（Owner）可以修改的所有参数和功能。

## 📋 可修改的参数列表

### 1. 钱包地址配置 (4个地址)

**函数**: `setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback)`

可修改的钱包地址：
- `marketingWallet` - 营销钱包地址
- `treasuryWallet` - 金库钱包地址
- `lpInjectionWallet` - 流动性注入钱包地址
- `buybackWallet` - 回购钱包地址

**限制**: 所有地址不能为零地址

---

### 2. 收益分配配置 (6个百分比)

**函数**: `setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lpInjection, uint256 _treasury)`

可修改的分配百分比：
- `directRewardPercent` - 直推奖励百分比
- `levelRewardPercent` - 层级奖励百分比
- `marketingPercent` - 营销分配百分比
- `buybackPercent` - 回购分配百分比
- `lpInjectionPercent` - 流动性注入百分比
- `treasuryPercent` - 金库分配百分比

**注意**: 这些百分比的总和应该等于 100%，但合约中没有强制检查

---

### 3. 交换税率配置 (2个税率)

**函数**: `setSwapTaxes(uint256 _buyTax, uint256 _sellTax)`

可修改的税率：
- `swapBuyTax` - 买入 JBC 的税率（百分比，例如 50 表示 50%）
- `swapSellTax` - 卖出 JBC 的税率（百分比，例如 25 表示 25%）

---

### 4. 赎回手续费百分比 (1个)

**函数**: `setRedemptionFeePercent(uint256 _fee)`

可修改的参数：
- `redemptionFeePercent` - 赎回手续费百分比

---

### 5. 操作状态控制 (2个布尔值)

**函数**: `setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled)`

可修改的状态：
- `liquidityEnabled` - 是否启用流动性质押功能
- `redeemEnabled` - 是否启用赎回功能

**用途**: 可以暂停/恢复核心功能

---

### 6. 门票灵活性时长 (1个)

**函数**: `setTicketFlexibilityDuration(uint256 _duration)`

可修改的参数：
- `ticketFlexibilityDuration` - 门票灵活性时长（秒）

**默认值**: 72 小时（259200 秒）

---

### 7. 用户推荐人管理 (1个)

**函数**: `adminSetReferrer(address user, address newReferrer)`

可修改的参数：
- 用户的推荐人地址

**限制**:
- 用户和新推荐人不能为零地址
- 用户不能将自己设置为推荐人
- 不能形成循环引用

**影响**: 修改推荐人会重新计算整个推荐链的团队人数，从而可能影响用户等级

---

### 8. 紧急暂停/恢复 (1个布尔值)

**函数**: 
- `emergencyPause()` - 紧急暂停合约
- `emergencyUnpause()` - 恢复合约运行

可修改的状态：
- `emergencyPaused` - 紧急暂停状态

**影响**: 暂停后，所有需要 `whenNotPaused` 修饰符的函数都无法执行

---

## 💰 资金管理功能

### 9. 添加流动性

**函数**: `addLiquidity(uint256 jbcAmount) external payable`

功能：
- 向交换池添加 MC（通过 `msg.value`）和 JBC
- 增加 `swapReserveMC` 和 `swapReserveJBC`

---

### 10. 提取交换储备

**函数**: `withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC)`

功能：
- 从交换池提取 MC 和 JBC
- 减少 `swapReserveMC` 和 `swapReserveJBC`

---

### 11. 紧急提取原生 MC

**函数**: `emergencyWithdrawNative(address _to, uint256 _amount)`

功能：
- 紧急提取合约中的原生 MC（Native MC）
- 需要满足 `hasNativeBalance` 修饰符

---

### 12. 救援代币

**函数**: `rescueTokens(address _token, address _to, uint256 _amount)`

功能：
- 救援意外发送到合约的代币
- **限制**: 不能救援 JBC 代币（`jbcToken`）

---

## 🔒 合约升级权限

### 13. 授权升级

**函数**: `_authorizeUpgrade(address newImplementation) internal override onlyOwner`

功能：
- 授权合约升级到新的实现地址
- 使用 OpenZeppelin UUPS 升级模式

---

## ❌ 无法修改的参数

以下参数由系统自动计算和维护，管理员无法直接修改：

1. **用户等级 (Level)**
   - 根据 `teamCount` 自动计算
   - 无法直接修改

2. **团队人数 (teamCount)**
   - 由推荐链自动计算
   - 无法直接修改

3. **活跃直推数量 (activeDirects)**
   - 由系统自动维护
   - 无法直接修改

4. **用户总收益 (totalRevenue)**
   - 由系统自动累计
   - 无法直接修改

5. **当前上限 (currentCap)**
   - 由系统自动计算（门票金额的 3 倍）
   - 无法直接修改

6. **退款费用 (refundFeeAmount)**
   - 由系统自动计算
   - 无法直接修改

7. **时间单位 (SECONDS_IN_UNIT)**
   - 在初始化时设置，之后不可修改
   - 用于计算质押周期

8. **最小流动性 (MIN_LIQUIDITY)**
   - 常量，不可修改
   - 默认值: 1000 * 1e18

9. **最大价格影响 (MAX_PRICE_IMPACT)**
   - 常量，不可修改
   - 默认值: 1000 (10%)

---

## 📊 权限总结

| 类别 | 可修改参数数量 | 说明 |
|------|---------------|------|
| 钱包地址 | 4 | 营销、金库、流动性注入、回购钱包 |
| 分配配置 | 6 | 各种收益分配百分比 |
| 税率配置 | 2 | 买入和卖出税率 |
| 手续费 | 1 | 赎回手续费百分比 |
| 操作状态 | 2 | 流动性和赎回功能开关 |
| 时间配置 | 1 | 门票灵活性时长 |
| 用户管理 | 1 | 用户推荐人 |
| 紧急控制 | 1 | 紧急暂停状态 |
| 资金管理 | 4 | 添加/提取流动性、紧急提取、救援代币 |
| **总计** | **22+** | 包括所有可配置参数和功能 |

---

## ⚠️ 重要注意事项

1. **分配百分比总和**: 虽然合约不强制检查，但建议确保所有分配百分比的总和等于 100%

2. **税率设置**: 税率过高可能影响用户体验，建议谨慎设置

3. **紧急暂停**: 紧急暂停会影响所有用户操作，仅在紧急情况下使用

4. **推荐人修改**: 修改推荐人会重新计算整个推荐链，可能影响多个用户的等级和收益

5. **资金提取**: 提取资金会影响交换池的流动性，可能影响价格和用户体验

6. **合约升级**: 升级合约需要谨慎，确保新实现与现有数据兼容

---

## 🔍 查看当前配置

管理员可以通过以下方式查看当前配置：

1. **读取状态变量**: 所有配置参数都是 `public` 状态变量，可以直接读取
2. **事件日志**: 配置修改会触发相应的事件，可以通过事件日志追踪历史修改
3. **前端管理面板**: 通过 `AdminPanel` 组件查看和修改配置

---

## 📝 相关事件

所有配置修改都会触发相应的事件，便于追踪：

- `DistributionConfigUpdated` - 分配配置更新
- `SwapTaxesUpdated` - 税率更新
- `RedemptionFeeUpdated` - 赎回手续费更新
- `WalletsUpdated` - 钱包地址更新
- `LiquidityStatusUpdated` - 流动性状态更新
- `RedeemStatusUpdated` - 赎回状态更新
- `TicketFlexibilityDurationUpdated` - 门票灵活性时长更新
- `ReferrerChanged` - 推荐人变更
- `EmergencyPaused` / `EmergencyUnpaused` - 紧急暂停/恢复
- `LiquidityAdded` - 流动性添加
- `SwapReservesWithdrawn` - 交换储备提取
- `NativeMCWithdrawn` - 原生 MC 提取
- `TokensRescued` - 代币救援

