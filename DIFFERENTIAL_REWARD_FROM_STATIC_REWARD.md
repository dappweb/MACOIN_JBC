# 级差奖励与静态奖励的关系说明

## 📋 核心关系

**级差奖励的MC和JBC来源于静态奖励的MC和JBC，按比例分配。**

## 🔄 分配机制

### 静态奖励分配
```
静态奖励总额 = 100 MC
├─ 静态奖励MC = 50 MC (50%)
└─ 静态奖励JBC = 50 MC等值 = 200 JBC (50%, 假设价格0.25 MC/JBC)
```

### 级差奖励分配（从静态奖励中按比例分配）
```
级差奖励总额 = 静态收益总额 × 级差比例 = 100 MC × 10% = 10 MC

计算方式:
1. 静态奖励总额 = 静态MC + 静态JBC价值 = 50 MC + 50 MC = 100 MC
2. 级差奖励总额 = 100 MC × 10% = 10 MC
3. 按静态奖励的MC和JBC比例分配:
   - 级差MC = 10 MC × (50 MC / 100 MC) = 5 MC
   - 级差JBC价值 = 10 MC - 5 MC = 5 MC等值
   - 级差JBC数量 = 5 MC ÷ 0.25 = 20 JBC

结果:
├─ 级差奖励MC = 5 MC (从静态奖励的50 MC中分配)
└─ 级差奖励JBC = 20 JBC (从静态奖励的200 JBC中分配)
```

## 💡 详细示例

### 场景设置
- **用户A** 质押流动性，获得静态收益：100 MC
- **用户B** 是用户A的上级，V等级为V3 (15%)
- **用户C** 是用户B的上级，V等级为V5 (25%)

### 静态奖励分配（用户A）
```
静态奖励总额: 100 MC
├─ MC部分: 50 MC → 直接转账给用户A
└─ JBC部分: 50 MC等值 = 200 JBC (价格0.25) → 直接转账给用户A
```

### 级差奖励分配（用户B）
```
级差奖励总额: 100 MC × 15% = 15 MC

计算过程:
1. 静态奖励总额 = 50 MC + 50 MC等值 = 100 MC
2. 级差奖励总额 = 100 MC × 15% = 15 MC
3. 按静态奖励的MC和JBC比例分配:
   - 级差MC = 15 MC × (50 MC / 100 MC) = 7.5 MC
   - 级差JBC价值 = 15 MC - 7.5 MC = 7.5 MC等值
   - 级差JBC数量 = 7.5 MC ÷ 0.25 = 30 JBC

分配结果:
├─ 从静态奖励的50 MC中分配 7.5 MC 给用户B
└─ 从静态奖励的200 JBC中分配 30 JBC 给用户B

用户B获得: 7.5 MC + 30 JBC
```

### 级差奖励分配（用户C）
```
级差奖励总额: 100 MC × (25% - 15%) = 10 MC (级差)

计算过程:
1. 用户C的V等级比例 = 25%
2. 用户B的V等级比例 = 15%
3. 级差比例 = 25% - 15% = 10%
4. 级差奖励总额 = 100 MC × 10% = 10 MC
5. 按静态奖励的MC和JBC比例分配:
   - 级差MC = 10 MC × (50 MC / 100 MC) = 5 MC
   - 级差JBC价值 = 10 MC - 5 MC = 5 MC等值
   - 级差JBC数量 = 5 MC ÷ 0.25 = 20 JBC

分配结果:
├─ 从静态奖励的50 MC中分配 5 MC 给用户C
└─ 从静态奖励的200 JBC中分配 20 JBC 给用户C

用户C获得: 5 MC + 20 JBC
```

## 🔧 技术实现

### 合约逻辑流程

#### 1. 赎回时计算静态奖励（`redeem()` 函数）

```solidity
// 计算静态奖励的MC和JBC
uint256 staticMCPart = totalYield / 2;  // 50% MC
uint256 staticJBCValuePart = totalYield / 2;  // 50% MC等值
uint256 jbcPrice = _getCurrentJBCPrice();
uint256 staticJBCAmount = (staticJBCValuePart * 1 ether) / jbcPrice;  // 转换为JBC数量

// 分配静态奖励给用户
_transferNativeMC(msg.sender, staticMCPart);  // 50 MC
jbcToken.transfer(msg.sender, staticJBCAmount);  // 200 JBC
```

#### 2. 计算每个Stake的静态奖励比例

```solidity
// 对于每个赎回的stake，计算其在总静态收益中的比例
for (uint256 i = 0; i < stakes.length; i++) {
    if (!stakes[i].active) {
        uint256 pending = _calculateStakeReward(stakes[i]);
        if (pending > 0) {
            // 计算该stake在总静态收益中的比例
            uint256 stakeRatio = (pending * 1 ether) / totalYield;
            uint256 stakeMC = (staticMCPart * stakeRatio) / 1 ether;
            uint256 stakeJBC = (staticJBCAmount * stakeRatio) / 1 ether;
            
            // 基于该stake的静态奖励MC和JBC计算级差奖励
            _calculateAndStoreDifferentialRewardsFromStatic(msg.sender, stakeMC, stakeJBC, stakes[i].id);
            _releaseDifferentialRewards(stakes[i].id);
        }
    }
}
```

#### 3. 计算级差奖励（`_calculateAndStoreDifferentialRewardsFromStatic` 函数）

```solidity
// 计算静态奖励总额（MC等值）
uint256 jbcPrice = _getCurrentJBCPrice();
uint256 staticJBCValue = (staticJBC * jbcPrice) / 1 ether;
uint256 staticTotal = staticMC + staticJBCValue;

// 计算级差奖励总额
uint256 rewardTotal = (staticTotal * diffPercent) / 100;

// 按静态奖励的MC和JBC比例分配级差奖励
uint256 rewardMC = (rewardTotal * staticMC) / staticTotal;
uint256 rewardJBCValue = rewardTotal - rewardMC;
uint256 rewardJBC = (rewardJBCValue * 1 ether) / jbcPrice;

// 存储到 PendingReward 结构
stakePendingRewards[stakeId].push(PendingReward({
    upline: current,
    amount: rewardTotal,
    mcAmount: rewardMC,      // 从静态奖励MC中分配
    jbcAmount: rewardJBC     // 从静态奖励JBC中分配
}));
```

#### 4. 分配级差奖励（`_distributeDifferentialRewardFromStatic` 函数）

```solidity
// 直接从静态奖励的MC和JBC中分配级差奖励
// mcAmount 和 jbcAmount 已经是从静态奖励中按比例计算的级差奖励MC和JBC

// 直接转账MC部分（从静态奖励的MC中分配）
if (mcAmount > 0 && address(this).balance >= mcAmount) {
    _transferNativeMC(user, mcAmount);
    mcTransferred = mcAmount;
}

// 直接转账JBC部分（从静态奖励的JBC中分配）
if (jbcAmount > 0 && jbcToken.balanceOf(address(this)) >= jbcAmount) {
    jbcToken.transfer(user, jbcAmount);
    jbcTransferred = jbcAmount;
} else {
    // 如果JBC余额不足，通过交换MC获得JBC
    // 使用AMM交换逻辑
}
```

## 📊 关系总结

| 项目 | 静态奖励 | 级差奖励 |
|------|---------|---------|
| **总额** | 100 MC | 10 MC (10%) |
| **MC来源** | 合约余额 | 从静态奖励MC中分配 (5 MC) |
| **JBC来源** | 合约余额 | 从静态奖励JBC中分配 (20 JBC) |
| **分配比例** | 50% MC + 50% JBC | 按静态奖励的MC和JBC比例分配 |

## ✅ 关键点

1. **级差奖励的MC和JBC直接来源于静态奖励的MC和JBC**
   - 级差奖励的MC从静态奖励的MC中按比例分配
   - 级差奖励的JBC从静态奖励的JBC中按比例分配

2. **按比例分配**：级差奖励的MC和JBC比例与静态奖励的MC和JBC比例一致
   - 如果静态奖励是 50% MC + 50% JBC
   - 那么级差奖励也是 50% MC + 50% JBC（从静态奖励中分配）

3. **分配时机**：在赎回时，先分配静态奖励，然后从静态奖励的MC和JBC中分配级差奖励
   - 用户赎回流动性时触发
   - 先计算并分配静态奖励（50% MC + 50% JBC）
   - 然后基于静态奖励的MC和JBC计算并分配级差奖励

4. **JBC交换机制**：如果JBC余额不足，通过AMM交换MC获得JBC
   - 使用 `swapMCToJBC` 的交换逻辑
   - 扣除交换税收并销毁
   - 如果交换失败，降级为直接转账MC

5. **数据结构**：`PendingReward` 结构存储MC和JBC分别的金额
   ```solidity
   struct PendingReward {
       address upline;
       uint256 amount;      // 总额（MC等值）
       uint256 mcAmount;    // MC金额（从静态奖励MC中分配）
       uint256 jbcAmount;   // JBC金额（从静态奖励JBC中分配）
   }
   ```

## 🔍 实现细节

### 数据流

```
用户赎回流动性
    ↓
计算静态收益 (totalYield)
    ↓
分配静态奖励 (50% MC + 50% JBC)
    ├─ 50 MC → 用户
    └─ 200 JBC → 用户
    ↓
计算每个Stake的静态奖励比例
    ├─ stake1: 60 MC → stakeMC1: 30 MC, stakeJBC1: 120 JBC
    └─ stake2: 40 MC → stakeMC2: 20 MC, stakeJBC2: 80 JBC
    ↓
基于每个Stake的静态奖励计算级差奖励
    ├─ 从stakeMC1和stakeJBC1计算级差奖励
    └─ 从stakeMC2和stakeJBC2计算级差奖励
    ↓
分配级差奖励给上级
    ├─ 从静态奖励的MC中分配级差MC
    └─ 从静态奖励的JBC中分配级差JBC
```

### 重要说明

1. **级差奖励的计算基础是静态奖励的MC和JBC比例**
   - 用户已经收到了完整的静态奖励（50 MC + 200 JBC）
   - 级差奖励是从合约的MC和JBC余额中额外分配的
   - 级差奖励的MC和JBC金额是按照静态奖励的MC和JBC比例计算的
   - **关键**：级差奖励的MC和JBC比例与静态奖励的MC和JBC比例一致（都是50% MC + 50% JBC）

2. **实际分配流程**
   ```
   静态奖励总额: 100 MC
   ├─ 用户获得: 50 MC + 200 JBC (完整静态奖励)
   └─ 级差奖励计算基础: 50 MC + 200 JBC (按此比例计算级差奖励)
   
   级差奖励总额: 10 MC (10%)
   ├─ 级差MC: 5 MC (从合约余额中分配，按静态MC比例计算)
   └─ 级差JBC: 20 JBC (从合约余额中分配，按静态JBC比例计算)
   ```

3. **级差奖励的MC和JBC比例与静态奖励一致**
   - 如果静态奖励是 50% MC + 50% JBC
   - 那么级差奖励也是 50% MC + 50% JBC（按静态奖励的MC和JBC比例计算）

4. **JBC交换机制**
   - 如果合约JBC余额不足，会通过AMM交换MC获得JBC
   - 交换时会扣除税收并销毁
   - 如果交换失败，会降级为直接转账MC

---

**最后更新**: 2024年12月  
**合约版本**: JinbaoProtocolV4  
**状态**: ✅ 已实现并编译通过

