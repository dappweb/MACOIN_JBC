# 门票购买金额分配机制分析

本文档详细分析用户购买门票时，门票金额如何被分配和使用的完整机制。

## 📋 概述

当用户购买门票时，支付的 MC 代币会按照预设的比例自动分配给不同的用途，包括推荐奖励、层级奖励、营销、回购销毁、流动性注入和国库等。

## 🎫 门票金额

### 支持的门票金额

用户只能购买以下固定金额的门票：

- **100 MC** (100 × 10¹⁸ wei)
- **300 MC** (300 × 10¹⁸ wei)
- **500 MC** (500 × 10¹⁸ wei)
- **1000 MC** (1000 × 10¹⁸ wei)

```solidity
// contracts/JinbaoProtocolNative.sol:497-499
if (amount != 100 * 1e18 && amount != 300 * 1e18 && amount != 500 * 1e18 && amount != 1000 * 1e18) {
    revert InvalidAmount();
}
```

## 💰 分配比例（默认值）

### 初始分配配置

```solidity
// contracts/JinbaoProtocolNative.sol:234-239
directRewardPercent = 25;    // 25% - 直推奖励
levelRewardPercent = 15;     // 15% - 层级奖励
marketingPercent = 5;        // 5%  - 营销
buybackPercent = 5;          // 5%  - 回购销毁
lpInjectionPercent = 25;    // 25% - 流动性注入
treasuryPercent = 25;        // 25% - 国库
// 总计: 100%
```

### 可配置性

所有分配比例都可以通过管理员函数 `setDistributionConfig()` 进行调整：

```solidity
function setDistributionConfig(
    uint256 _direct,
    uint256 _level,
    uint256 _marketing,
    uint256 _buyback,
    uint256 _lpInjection,
    uint256 _treasury
) external onlyOwner
```

## 🔄 分配流程

### 完整分配流程图

```
用户购买门票 (100/300/500/1000 MC)
    ↓
┌─────────────────────────────────────┐
│  1. 直推奖励 (25%)                  │
│     ├─ 有推荐人且活跃 → 给推荐人    │
│     └─ 无推荐人/不活跃 → 营销钱包  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  2. 层级奖励 (15%)                  │
│     └─ 向上分配最多15层             │
│     └─ 未分配部分 → levelRewardPool │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  3. 营销 (5%)                       │
│     └─ 直接转给营销钱包              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  4. 回购销毁 (5%)                    │
│     └─ 内部回购并销毁 JBC            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  5. 流动性注入 (25%)                 │
│     └─ 转给流动性注入钱包            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  6. 国库 (25%)                       │
│     └─ 转给国库钱包                  │
└─────────────────────────────────────┘
```

## 📊 详细分配机制

### 1. 直推奖励 (25%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:541-551`

```solidity
address referrerAddr = userInfo[msg.sender].referrer;
if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
    uint256 directAmt = (amount * directRewardPercent) / 100;
    uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
    if (paid > 0) {
        emit ReferralRewardPaid(referrerAddr, msg.sender, paid, 0, REWARD_DIRECT, t.ticketId);
    }
} else {
    _transferNativeMC(marketingWallet, (amount * directRewardPercent) / 100);
}
```

**分配逻辑**:
- ✅ **有推荐人且活跃**: 奖励分配给推荐人
  - 通过 `_distributeReward()` 分配（50% MC + 50% JBC）
  - 受用户收益上限 (`currentCap`) 限制
- ❌ **无推荐人或不活跃**: 奖励转给营销钱包

**示例**:
- 购买 1000 MC 门票
- 直推奖励 = 1000 × 25% = 250 MC
- 如果推荐人活跃：推荐人获得 125 MC + 等值 JBC
- 如果无推荐人：营销钱包获得 250 MC

### 2. 层级奖励 (15%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:1018-1053`

```solidity
function _distributeTicketLevelRewards(address user, uint256 amount) internal {
    address current = userInfo[user].referrer;
    uint256 totalDistributed = 0;
    uint256 layerCount = 0;
    uint256 iterations = 0;
    uint256 rewardPerLayer = (amount * 1) / 100;  // 每层 1%
    
    while (current != address(0) && layerCount < 15 && iterations < 20) {
        if (!userInfo[current].isActive) {
            current = userInfo[current].referrer;
            iterations++;
            continue;
        }
        
        uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
        
        if (maxLayers > layerCount) {
            uint256 paid = _distributeReward(current, rewardPerLayer, REWARD_LEVEL);
            if (paid > 0) {
                totalDistributed += paid;
                emit ReferralRewardPaid(current, user, paid, 0, REWARD_LEVEL, userTicket[user].ticketId);
            }
        }
        
        current = userInfo[current].referrer;
        layerCount++;
        iterations++;
    }
    
    uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;
    uint256 remaining = totalLevelRewardAmount - totalDistributed;
    if (remaining > 0) {
        levelRewardPool += remaining;
        emit LevelRewardPoolUpdated(remaining, levelRewardPool);
    }
}
```

**分配逻辑**:
1. **向上遍历推荐链**: 从购买者的推荐人开始，向上最多 15 层
2. **每层奖励**: 每层获得门票金额的 **1%**
3. **层级限制**: 根据用户的活跃直推数 (`activeDirects`) 决定能获得多少层奖励
   - 通过 `getLevelRewardLayers()` 函数计算
4. **活跃状态检查**: 只有活跃用户才能获得层级奖励
5. **未分配部分**: 如果层级奖励未完全分配，剩余部分进入 `levelRewardPool`

**层级奖励层数规则**:
- 根据用户的活跃直推数决定
- 活跃直推数越多，能获得的层级奖励层数越多
- 具体规则由 `getLevelRewardLayers()` 函数定义

**示例**:
- 购买 1000 MC 门票
- 层级奖励总额 = 1000 × 15% = 150 MC
- 每层奖励 = 1000 × 1% = 10 MC
- 假设向上有 10 层活跃用户，且都能获得奖励：
  - 分配: 10 层 × 10 MC = 100 MC
  - 剩余: 150 - 100 = 50 MC → 进入 `levelRewardPool`

### 3. 营销 (5%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:555`

```solidity
_transferNativeMC(marketingWallet, (amount * marketingPercent) / 100);
```

**分配逻辑**:
- 直接转账给营销钱包 (`marketingWallet`)
- 用于项目营销和推广活动

**示例**:
- 购买 1000 MC 门票
- 营销 = 1000 × 5% = 50 MC → 营销钱包

### 4. 回购销毁 (5%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:557-558`

```solidity
uint256 buybackAmt = (amount * buybackPercent) / 100;
_internalBuybackAndBurn(buybackAmt);
```

**分配逻辑**:
- 通过 `_internalBuybackAndBurn()` 函数执行
- 使用 MC 购买 JBC，然后销毁 JBC
- 实现代币通缩机制

**示例**:
- 购买 1000 MC 门票
- 回购销毁 = 1000 × 5% = 50 MC
- 使用 50 MC 购买 JBC 并销毁

### 5. 流动性注入 (25%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:560`

```solidity
_transferNativeMC(lpInjectionWallet, (amount * lpInjectionPercent) / 100);
```

**分配逻辑**:
- 直接转账给流动性注入钱包 (`lpInjectionWallet`)
- 用于增加交易对的流动性
- 提高代币价格稳定性

**示例**:
- 购买 1000 MC 门票
- 流动性注入 = 1000 × 25% = 250 MC → 流动性钱包

### 6. 国库 (25%)

**代码位置**: `contracts/JinbaoProtocolNative.sol:561`

```solidity
_transferNativeMC(treasuryWallet, (amount * treasuryPercent) / 100);
```

**分配逻辑**:
- 直接转账给国库钱包 (`treasuryWallet`)
- 用于项目运营、开发、储备等

**示例**:
- 购买 1000 MC 门票
- 国库 = 1000 × 25% = 250 MC → 国库钱包

## 📈 完整分配示例

### 示例：购买 1000 MC 门票

| 分配项目 | 比例 | 金额 (MC) | 接收方/用途 |
|---------|------|-----------|------------|
| **直推奖励** | 25% | 250 MC | 推荐人（如果活跃）或营销钱包 |
| **层级奖励** | 15% | 150 MC | 向上最多15层推荐人（每层1%） |
| **营销** | 5% | 50 MC | 营销钱包 |
| **回购销毁** | 5% | 50 MC | 购买并销毁 JBC |
| **流动性注入** | 25% | 250 MC | 流动性注入钱包 |
| **国库** | 25% | 250 MC | 国库钱包 |
| **总计** | **100%** | **1000 MC** | - |

### 层级奖励详细示例

假设购买者向上有推荐链，且各层用户状态如下：

```
购买者 (User A)
    ↓
推荐人1 (User B) - 活跃，5个活跃直推 → 可获得3层奖励
    ↓
推荐人2 (User C) - 活跃，10个活跃直推 → 可获得5层奖励
    ↓
推荐人3 (User D) - 活跃，20个活跃直推 → 可获得7层奖励
    ↓
推荐人4 (User E) - 不活跃 → 跳过
    ↓
推荐人5 (User F) - 活跃，30个活跃直推 → 可获得10层奖励
    ↓
... (最多15层)
```

**分配结果**:
- 第1层 (User B): 10 MC（在 User B 的3层范围内）
- 第2层 (User C): 10 MC（在 User C 的5层范围内）
- 第3层 (User D): 10 MC（在 User D 的7层范围内）
- 第4层 (User E): 0 MC（不活跃，跳过）
- 第5层 (User F): 10 MC（在 User F 的10层范围内）
- ... (继续向上分配)

**总分配**: 假设分配了 100 MC
**剩余**: 150 - 100 = 50 MC → 进入 `levelRewardPool`

## 🔍 关键函数

### `_distributeReward()`

**功能**: 分配奖励给用户（50% MC + 50% JBC）

```solidity
function _distributeReward(address user, uint256 amount, uint8 rType) 
    internal returns (uint256)
```

**特点**:
- 检查用户是否活跃
- 检查收益上限 (`currentCap`)
- 50% MC + 50% JBC 分配
- 如果 JBC 余额不足，只分配 MC 部分

### `getLevelRewardLayers()`

**功能**: 根据活跃直推数计算能获得的层级奖励层数

```solidity
function getLevelRewardLayers(uint256 activeDirects) public pure returns (uint256)
```

**规则**: 活跃直推数越多，能获得的层级奖励层数越多

### `_internalBuybackAndBurn()`

**功能**: 内部回购并销毁 JBC

```solidity
function _internalBuybackAndBurn(uint256 mcAmount) internal
```

**流程**:
1. 使用 MC 从交换储备池购买 JBC
2. 销毁购买的 JBC
3. 实现代币通缩

## 📝 事件

### `TicketPurchased`

```solidity
event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
```

### `ReferralRewardPaid`

```solidity
event ReferralRewardPaid(
    address indexed user,
    address indexed from,
    uint256 mcAmount,
    uint256 jbcAmount,
    uint8 rewardType,
    uint256 ticketId
);
```

### `LevelRewardPoolUpdated`

```solidity
event LevelRewardPoolUpdated(uint256 added, uint256 newTotal);
```

## ⚠️ 注意事项

### 1. 收益上限限制

- 所有奖励分配都受用户收益上限 (`currentCap`) 限制
- `currentCap = 门票金额 × 3`
- 如果用户已达到收益上限，奖励可能无法完全分配

### 2. JBC 余额限制

- 奖励分配需要协议合约有足够的 JBC 余额
- 如果 JBC 余额不足，只能分配 MC 部分
- 当前协议合约 JBC 余额严重不足（仅 10,100 JBC）

### 3. 活跃状态要求

- 只有活跃用户才能获得推荐奖励和层级奖励
- 用户必须有活跃的质押才能保持活跃状态

### 4. 层级奖励池

- 未分配的层级奖励会进入 `levelRewardPool`
- 可以通过其他机制（如等级奖励）进行分配

## 🔧 配置管理

### 查看当前配置

```solidity
// 查询当前分配比例
directRewardPercent()
levelRewardPercent()
marketingPercent()
buybackPercent()
lpInjectionPercent()
treasuryPercent()
```

### 修改配置（仅所有者）

```solidity
function setDistributionConfig(
    uint256 _direct,      // 直推奖励比例
    uint256 _level,       // 层级奖励比例
    uint256 _marketing,   // 营销比例
    uint256 _buyback,     // 回购比例
    uint256 _lpInjection, // 流动性注入比例
    uint256 _treasury     // 国库比例
) external onlyOwner
```

**要求**: 所有比例之和必须等于 100

## 📊 数据验证

### 验证分配完整性

每次购买门票后，可以通过以下方式验证：

1. **检查事件**: 监听 `TicketPurchased` 和 `ReferralRewardPaid` 事件
2. **检查余额**: 验证各钱包余额变化
3. **检查池子**: 验证 `levelRewardPool` 的变化
4. **检查销毁**: 验证 JBC 总供应量的减少

## 🎯 总结

门票购买金额分配机制是一个精心设计的系统，实现了：

1. ✅ **推荐激励**: 通过直推和层级奖励激励用户推广
2. ✅ **代币通缩**: 通过回购销毁实现 JBC 通缩
3. ✅ **流动性支持**: 通过流动性注入维持价格稳定
4. ✅ **项目运营**: 通过营销和国库支持项目发展
5. ✅ **公平分配**: 根据用户贡献（活跃直推数）分配层级奖励

**关键特点**:
- 100% 分配（无剩余）
- 可配置比例
- 受收益上限限制
- 需要足够的 JBC 余额支持

**当前风险**:
- ⚠️ 协议合约 JBC 余额严重不足，可能影响奖励分配
- ⚠️ 需要确保各钱包地址正确配置













