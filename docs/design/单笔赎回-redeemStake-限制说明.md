# 单笔赎回 redeemStake 功能说明

## 需求

用户希望支持「每一单单独赎回」，即按 `stakeId` 赎回单笔质押，而非一次性赎回所有到期质押。

## 方案一实施结果（已完成）

通过**方案一：腾出字节码**，已成功实现 `redeemStake(uint256 stakeId)`：

1. **移除 RedemptionLib**：合约未使用，移除 import 与 using
2. **移除 DirectReferralData**：未使用 struct
3. **移除部分诊断 emit**：`DifferentialRewardCalculated`、`DifferentialRewardFailed`、`LiquidityProtectionTriggered`、`PartialRewardTransfer`

升级于 MC 链 区块 3208218 完成，新实现：`0x7a1Ce60f589eD0F69188Ff082eC096c3e64c68F9`。

## 使用方式

- **合约**：`redeemStake(uint256 stakeId)` payable
- **前端**：按质押 ID 发起赎回，需传 `value` = 该笔 1% 赎回费（新逻辑）

## 此前尝试（历史记录）

1. **Delegatecall 扩展**：部署独立 `RedeemStakeExtension`，主合约通过 delegatecall 调用  
   - 需严格保证存储布局一致，实现和维护成本较高

2. **架构拆分**：采用 Diamond/Facet 等拆分实现合约，腾出空间  
   - 改动较大，需系统规划

3. **裁剪其他逻辑**：移除或简化协议内其他功能以腾出字节码空间  
   - 需评估业务影响

4. **保持现状**：继续使用批量赎回 `redeem()`，在文档和前端说明限制  
   - 无技术风险，实现成本最低

## 用户侧说明建议

> 当前赎回为「一次性赎回所有到期质押」。若需更细粒度控制，可待后续合约升级后支持单笔赎回。
