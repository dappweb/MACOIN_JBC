# 抵押与赎回手续费逻辑

## 一、公式与金额

| 名称 | 公式 | 说明 |
|------|------|------|
| **基准金额** | `baseMaxAmount` | 合约内单张最大门票金额（wei）；若为 0 则用当前 `ticket.amount` |
| **质押本金** | `requiredAmount = baseMaxAmount × 150 / 100` | 即 1.5 倍门票 |
| **赎回金（1%）** | `redemptionFee = baseMaxAmount × redemptionFeePercent / 100` | 当前 `redemptionFeePercent = 1`；**单独支付**（与本金一并打款，非从本金中扣） |
| **质押时用户应付** | `requiredAmount + redemptionFee` | 即 **本金 + 1% 赎回金（1% 单独支付）**，必须 `msg.value` 严格等于此值 |

---

## 二、质押（stakeLiquidity）手续费逻辑

```
用户调用 stakeLiquidity(cycleDays)，并附带 msg.value

1. 校验
   - msg.value == requiredAmount + redemptionFee  （否则 revert InvalidAmount）
   - 有有效门票、未退出、cycleDays ∈ {7, 15, 30}

2. 若有待退（被动退出产生的）
   - 若 userInfo[msg.sender].refundFeeAmount > 0 且合约余额足够
   - 先退该金额给用户，再清零 refundFeeAmount

3. 写入本笔质押
   - nextStakeId++
   - stakeRedemptionFeePaid[nextStakeId] = redemptionFee
   - userStakes[msg.sender].push(Stake{ id, amount: requiredAmount, ... })
   - 本金 = requiredAmount（不包含 1%）；1% 仅记录在 stakeRedemptionFeePaid，赎回时退
```

**结论**：质押时**1% 单独支付**（与本金一起打款，不是从本金里扣），记入该笔 `stakeRedemptionFeePaid`，赎回该笔时原额退还。

---

## 三、赎回（redeem）手续费逻辑

```
用户调用 redeem()

对每一笔到期质押（stake.endTime <= now）：
  - totalReturn += stake.amount                    // 本金
  - totalReturn += stakeRedemptionFeePaid[stake.id]  // 该笔的 1% 赎回金
  - 将该笔标记为 inactive，并释放极差等

最后：将 totalReturn（及收益）一次性转给用户。
```

**结论**：赎回时**不扣任何手续费**，用户拿回 **本金 + 该笔 1% 赎回金**。多笔质押可分批赎回，每笔只退该笔的 1%。

---

## 四、被动退出（_handleExit）时的“手续费”

当用户收益达上限等触发被动退出时：

- 对未到期质押做**提前退出扣费**：  
  `fee = stake.amount × 2 × redemptionFeePercent / 300`（约为本金的 2/300）
- 扣下的费用累加到 `userInfo[user].refundFeeAmount`
- **不退** `stakeRedemptionFeePaid`（因被动退出时合约逻辑未按笔退 1%，而是统一记入 refundFeeAmount）
- 用户**下次调用 stakeLiquidity** 时，若 `refundFeeAmount > 0` 且合约余额足够，会**先退 refundFeeAmount** 再处理本次质押

---

## 五、数据流简图

```
质押:
  用户支付 [ 本金(1.5×) + 1% ]  ──►  本金存入 Stake.amount
                                    1% 存入 stakeRedemptionFeePaid[stakeId]

赎回（主动）:
  到期质押  ──►  totalReturn += Stake.amount + stakeRedemptionFeePaid[stakeId]
            ──►  一笔转给用户（无扣费）

被动退出:
  未到期质押提前结算  ──►  扣费  ──►  refundFeeAmount
  下次 stakeLiquidity  ──►  先退 refundFeeAmount 再质押
```

---

## 六、合约与常量位置

| 项目 | 位置 |
|------|------|
| 费率常量 | `redemptionFeePercent = 1`（JinbaoProtocolNative 初始化） |
| 质押校验与写入 | `JinbaoProtocolNative.sol`：`stakeLiquidity`（requiredAmount、redemptionFee、stakeRedemptionFeePaid） |
| 赎回退还 | `JinbaoProtocolNative.sol`：`redeem()`（totalReturn += amount + stakeRedemptionFeePaid[id]） |
| 被动退出扣费 | `JinbaoProtocolNative.sol`：`_handleExit`（fee 累加至 refundFeeAmount） |
| 前端常量 | `src/constants.ts`：`REDEMPTION_FEE_PERCENT = 1`、`LIQUIDITY_MULTIPLIER = 1.5` |

---

**文档版本**: v1.0  
**更新日期**: 2026-02-10
