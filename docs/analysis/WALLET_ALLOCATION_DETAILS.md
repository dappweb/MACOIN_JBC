# 门票购买金额分配 - 钱包详情

本文档详细说明门票购买金额中分配给营销、回购销毁、流动性注入和国库的详细信息。

## 📊 分配概览

| 分配项目 | 比例 | 金额（1000 MC 门票） | 钱包地址 | 当前余额 |
|---------|------|---------------------|---------|---------|
| **营销** | 5% | 50 MC | `0xDb817e0d21a134f649d24b91E39d42E7eeC52a65` | 3,789.99 MC |
| **回购销毁** | 5% | 50 MC | `0x979373c675c25e6cb2FD49B571dcADcB15a5a6D8` | 0.00 MC |
| **流动性注入** | 25% | 250 MC | `0x03C5d3cF3E358A00fA446e3376eaB047D1ce46F2` | 18,155.99 MC |
| **国库** | 25% | 250 MC | `0x5067D182D5f15511F0C71194a25cC67b05C20b02` | 18,382.99 MC |

## 1. 营销钱包 (5%)

### 基本信息

- **地址**: `0xDb817e0d21a134f649d24b91E39d42E7eeC52a65`
- **分配比例**: 5%
- **当前余额**: 3,789.99 MC
- **用途**: 项目营销和推广活动

### 分配机制

```solidity
// contracts/JinbaoProtocolNative.sol:555
_transferNativeMC(marketingWallet, (amount * marketingPercent) / 100);
```

### 分配来源

营销钱包会收到两部分的资金：

1. **营销分配 (5%)**: 直接从门票购买金额中分配
2. **直推奖励未分配部分**: 如果用户没有推荐人或推荐人不活跃，直推奖励（25%）也会转到营销钱包

```solidity
// contracts/JinbaoProtocolNative.sol:549-551
} else {
    _transferNativeMC(marketingWallet, (amount * directRewardPercent) / 100);
}
```

### 示例

购买 1000 MC 门票：
- 营销分配: 1000 × 5% = **50 MC** → 营销钱包
- 如果无推荐人: 1000 × 25% = **250 MC** → 营销钱包（直推奖励部分）
- **总计可能**: 50 MC 或 300 MC

### 使用建议

- 用于项目推广和营销活动
- 社区建设和用户增长
- 合作伙伴和渠道推广
- 品牌宣传和广告投放

---

## 2. 回购销毁 (5%)

### 基本信息

- **地址**: `0x979373c675c25e6cb2FD49B571dcADcB15a5a6D8`
- **分配比例**: 5%
- **当前余额**: 0.00 MC（资金立即使用）
- **用途**: 购买并销毁 JBC 代币，实现通缩

### 分配机制

```solidity
// contracts/JinbaoProtocolNative.sol:557-558
uint256 buybackAmt = (amount * buybackPercent) / 100;
_internalBuybackAndBurn(buybackAmt);
```

### 执行流程

1. **计算回购金额**: 门票金额 × 5%
2. **购买 JBC**: 使用 MC 从协议内部交换储备池购买 JBC
3. **销毁 JBC**: 立即销毁购买的 JBC 代币
4. **实现通缩**: 减少 JBC 总供应量

### 内部实现

```solidity
function _internalBuybackAndBurn(uint256 mcAmount) internal {
    if (mcAmount == 0 || swapReserveMC < MIN_LIQUIDITY || swapReserveJBC < MIN_LIQUIDITY) {
        return;
    }
    
    // 计算可购买的 JBC 数量
    uint256 numerator = mcAmount * swapReserveJBC;
    uint256 denominator = swapReserveMC + mcAmount;
    uint256 jbcToBurn = numerator / denominator;
    
    if (jbcToBurn == 0 || jbcToken.balanceOf(address(this)) < jbcToBurn) {
        return;
    }
    
    // 更新储备池
    swapReserveMC += mcAmount;
    swapReserveJBC -= jbcToBurn;
    
    // 销毁 JBC
    jbcToken.burn(jbcToBurn);
    
    emit BuybackAndBurn(mcAmount, jbcToBurn);
}
```

### 示例

购买 1000 MC 门票：
- 回购金额: 1000 × 5% = **50 MC**
- 使用 50 MC 购买 JBC（根据当前价格）
- 假设价格 1 MC = 0.5 JBC，则购买 **25 JBC**
- **立即销毁 25 JBC**，减少总供应量

### 通缩效果

- 每次门票购买都会销毁一定数量的 JBC
- 长期来看，JBC 总供应量会持续减少
- 有助于维持或提升 JBC 代币价格

### 注意事项

- ⚠️ 需要协议合约有足够的 JBC 储备
- ⚠️ 需要交换储备池有足够的流动性
- ⚠️ 如果流动性不足，回购可能无法执行

---

## 3. 流动性注入钱包 (25%)

### 基本信息

- **地址**: `0x03C5d3cF3E358A00fA446e3376eaB047D1ce46F2`
- **分配比例**: 25%
- **当前余额**: 18,155.99 MC
- **用途**: 增加交易对的流动性，稳定代币价格

### 分配机制

```solidity
// contracts/JinbaoProtocolNative.sol:560
_transferNativeMC(lpInjectionWallet, (amount * lpInjectionPercent) / 100);
```

### 分配示例

购买 1000 MC 门票：
- 流动性注入: 1000 × 25% = **250 MC** → 流动性钱包

### 使用建议

- 定期添加到 MC/JBC 交易对
- 增加流动性深度，减少价格波动
- 提高交易体验和价格稳定性
- 可以通过 `addLiquidity()` 函数添加到协议

### 添加流动性

流动性钱包的资金可以通过以下方式添加到协议：

```solidity
function addLiquidity(uint256 jbcAmount) external payable {
    // 需要同时提供 MC (msg.value) 和 JBC
    // 添加到内部交换储备池
}
```

### 当前状态

- 钱包余额充足（18,155.99 MC）
- 可以用于增加流动性
- 建议定期添加到交易对

---

## 4. 国库钱包 (25%)

### 基本信息

- **地址**: `0x5067D182D5f15511F0C71194a25cC67b05C20b02`
- **分配比例**: 25%
- **当前余额**: 18,382.99 MC
- **用途**: 项目运营、开发、储备等

### 分配机制

```solidity
// contracts/JinbaoProtocolNative.sol:561
_transferNativeMC(treasuryWallet, (amount * treasuryPercent) / 100);
```

### 分配示例

购买 1000 MC 门票：
- 国库: 1000 × 25% = **250 MC** → 国库钱包

### 使用建议

- 项目开发和维护
- 团队运营费用
- 紧急储备资金
- 未来发展规划
- 审计和安全
- 法律合规

### 当前状态

- 钱包余额充足（18,382.99 MC）
- 是最大的分配项目（25%）
- 用于长期项目发展

---

## 📈 完整分配示例

### 购买 1000 MC 门票的完整分配

```
门票金额: 1000 MC
    ↓
┌─────────────────────────────────────┐
│  直推奖励 (25%) = 250 MC            │
│  ├─ 有推荐人 → 给推荐人            │
│  └─ 无推荐人 → 营销钱包            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  层级奖励 (15%) = 150 MC            │
│  └─ 向上分配最多15层                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  营销 (5%) = 50 MC                  │
│  └─ 0xDb817e0d21a134f649d24b91...  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  回购销毁 (5%) = 50 MC              │
│  └─ 购买并销毁 JBC                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  流动性注入 (25%) = 250 MC           │
│  └─ 0x03C5d3cF3E358A00fA446e3376... │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  国库 (25%) = 250 MC                 │
│  └─ 0x5067D182D5f15511F0C71194a2... │
└─────────────────────────────────────┘
```

## 🔍 钱包地址验证

### 合约中的钱包地址

可以通过以下函数查询合约中配置的钱包地址：

```solidity
// 查询钱包地址
marketingWallet()    // 返回: 0xDb817e0d21a134f649d24b91E39d42E7eeC52a65
treasuryWallet()     // 返回: 0x5067D182D5f15511F0C71194a25cC67b05C20b02
lpInjectionWallet()  // 返回: 0x03C5d3cF3E358A00fA446e3376eaB047D1ce46F2
buybackWallet()      // 返回: 0x979373c675c25e6cb2FD49B571dcADcB15a5a6D8
```

### 修改钱包地址（仅所有者）

```solidity
function setWallets(
    address _marketing,
    address _treasury,
    address _lpInjection,
    address _buyback
) external onlyOwner
```

## 📊 当前状态总结

| 钱包 | 余额 | 状态 | 备注 |
|------|------|------|------|
| 营销钱包 | 3,789.99 MC | ✅ 正常 | 余额充足 |
| 回购钱包 | 0.00 MC | ✅ 正常 | 资金立即使用，余额为0是正常的 |
| 流动性钱包 | 18,155.99 MC | ✅ 正常 | 余额充足，可用于增加流动性 |
| 国库钱包 | 18,382.99 MC | ✅ 正常 | 余额充足，最大的分配项目 |

## ⚠️ 注意事项

### 1. 回购销毁钱包

- 余额为 0 是正常的，因为资金会立即用于购买和销毁 JBC
- 需要确保协议合约有足够的 JBC 储备
- 需要确保交换储备池有足够的流动性

### 2. 钱包地址安全

- 所有钱包地址应该由多签钱包管理
- 定期检查钱包余额和交易记录
- 确保钱包私钥安全存储

### 3. 资金使用透明度

- 建议定期公布资金使用情况
- 建立资金使用审批机制
- 保持社区透明度

## 🔧 检查脚本

使用以下脚本检查钱包状态：

```bash
node scripts/check-wallet-balances.cjs
```

脚本功能：
- ✅ 查询合约中配置的钱包地址
- ✅ 查询各钱包的当前余额
- ✅ 显示分配比例
- ✅ 计算示例分配

## 📝 相关文档

- [门票购买金额分配机制](./TICKET_PURCHASE_ALLOCATION.md)
- [JBC 生成机制分析](./JBC_GENERATION_ANALYSIS.md)
- [前端合约参考](../contracts/FRONTEND_CONTRACT_REFERENCE.md)







