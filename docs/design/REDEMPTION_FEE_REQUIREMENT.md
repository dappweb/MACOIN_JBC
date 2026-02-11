# 赎回金（1%）需求逻辑

## 一、需求概述

- **赎回金**：用户**质押流动性时**按门票金额**单独支付**的 **1%** 费用（与本金一并打款，非从本金中扣）。
- **原则**：该 1% 为**暂扣**，在用户**赎回该笔质押**时**按笔退还**；多笔质押可分批赎回，每笔只退该笔的 1%。

---

## 二、当前逻辑（完整流程）

### 1. 质押时（`stakeLiquidity`）

| 项目 | 说明 |
|------|------|
| **触发** | 用户调用 `stakeLiquidity()` 提供流动性 |
| **支付** | `msg.value == requiredAmount + redemptionFee`，其中 `redemptionFee = baseMaxAmount * 1%`（门票金额的 1%） |
| **处理** | 本金 `requiredAmount` 进入质押；1% 记入该笔质押的 **待退金额** `stakeRedemptionFeePaid[stakeId]` |
| **效果** | 用户多付 1% 作为「赎回金」，赎回该笔时退还 |

### 2. 赎回时（`redeem`）

| 项目 | 说明 |
|------|------|
| **触发** | 用户调用 `redeem()` 赎回到期质押 |
| **退还** | 对本次赎回的**每一笔**质押：`totalReturn += stake.amount + stakeRedemptionFeePaid[stake.id]` |
| **效果** | 本金全额 + 该笔质押时支付的 1% 一并退还；多笔质押可分批赎回，每笔只退该笔的 1% |

### 3. 被动退出（`_handleExit`）

| 项目 | 说明 |
|------|------|
| **触发** | 收益达上限等导致被动退出 |
| **处理** | 扣费记入 `userInfo[user].refundFeeAmount`，在用户**下次质押**时先退还再处理本次质押 |

---

## 三、逻辑小结（一句话）

- **质押时**：单独支付 1%（门票的 1%），记入 `stakeRedemptionFeePaid[stakeId]`。
- **赎回时**：按笔退还，`totalReturn += 本金 + stakeRedemptionFeePaid[该笔 id]`；多笔可分批赎回，每笔只退该笔的 1%。

---

## 四、与被动退出的关系

| 场景 | 1% 处理 |
|------|---------|
| **主动赎回** `redeem()` | 不扣款；退还该笔的 `stakeRedemptionFeePaid[stakeId]` |
| **被动退出** `_handleExit()` | 扣费 → 记入 `refundFeeAmount` → 下次 **重质押时**先退再质押 |

---

## 五、合约实现要点（JinbaoProtocolV4）

1. **`stakeLiquidity()`**  
   - 要求 `msg.value == requiredAmount + redemptionFee`（1% 门票）。  
   - 先退 `userInfo[msg.sender].refundFeeAmount`（若有，来自被动退出）。  
   - `stakeRedemptionFeePaid[nextStakeId] = redemptionFee`；本金只存 `requiredAmount`。

2. **`redeem()`**  
   - 对每笔到期质押：`totalReturn += stakes[i].amount + stakeRedemptionFeePaid[stakes[i].id]`；不再使用整户 `refundFeeAmount` 一次性退。

3. **`refundFeeAmount`**  
   - 仅用于被动退出（`_handleExit`）扣费的待退，在下次 `stakeLiquidity` 时先退再质押。

---

**文档版本**: v2.0（质押扣 1% → 赎回按笔退 1%）  
**更新日期**: 2026-02-10
