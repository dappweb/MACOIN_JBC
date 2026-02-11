# 方案：1% 赎回金直接纳入 Swap 池子管理

## 一、目标

- 赎回时扣下的 **1% 赎回金** 直接进入 **Swap 池**（`swapReserveMC`），与池子统一管理。
- 再次提供流动性时，从 **Swap 池** 中支付待退金额（先退 1% 再记质押）。
- 便于运营：池子余额即包含「待退 1%」的储备，管理员在 Swap 池子管理界面即可看到整体流动性。

---

## 二、当前 vs 本方案

| 环节 | 当前实现 | 本方案 |
|------|----------|--------|
| 赎回扣 1% | 记入 `refundFeeAmount`，不写入 `swapReserveMC` | 记入 `refundFeeAmount`，**同时** `swapReserveMC += totalFee` |
| 合约余额 | 扣下的 MC 留在合约，未归入池子 | 扣下的 MC 进入池子，池子统一持有 |
| 再次质押退 1% | 从 `address(this).balance` 退，可选扣减 `swapReserveMC` | **必须**从 `swapReserveMC` 扣减：`swapReserveMC -= refund`，退给用户 |
| 金额不足 | 合约余额不足时 revert | **池子余额不足**（`swapReserveMC < refund`）时 revert，保证退金来自池子 |

---

## 三、合约改动要点

### 3.1 赎回（redeem）

在 `if (totalFee > 0)` 分支内：

- 保留：`userInfo[msg.sender].refundFeeAmount += totalFee`（用户待退金额不变）。
- **新增**：`swapReserveMC += totalFee`（将本次扣下的 1% 直接计入 Swap 池）。

### 3.2 再次质押（stakeLiquidity）退 1%

- 退金必须来自池子：仅当 `swapReserveMC >= refund` 时执行退款。
- 执行：`swapReserveMC -= refund`，再 `_transferNativeMC(msg.sender, refund)`，并清零 `refundFeeAmount`。
- 若 `refund > 0` 且 `swapReserveMC < refund`，则 **revert**（或沿用现有 `InsufficientBalance`），避免“池子外”支付退金、与池子管理不一致。

### 3.3 被动退出（_handleExit）

- 被动退出扣费同样进入池子：`userInfo[user].refundFeeAmount += totalFee` 时，**同时** `swapReserveMC += totalFee`，便于所有「待退」均由池子统一支撑。

### 3.4 一致性

- 赎回扣 1% → 进 `swapReserveMC`，池子增加；
- 被动退出扣费 → 进 `swapReserveMC`，池子增加；
- 再次质押退 1% → 从 `swapReserveMC` 出，池子减少；
- 所有待退金额均在 **Swap 池子** 内收支，便于在「Swap 池子管理」中统一查看与规划流动性。

---

## 四、管理侧（Swap 池子管理）

- **展示**：池子 MC 余额 = `swapReserveMC`，其中包含「待退给用户的 1%」储备。
- **风险**：若待退总额（各用户 `refundFeeAmount` 之和）接近或超过 `swapReserveMC`，后续用户可能无法完成「再次质押」（会因池子不足而 revert）；运营可通过增加 MC 流动性或控制赎回节奏，保证 `swapReserveMC` 充足。
- **可选**：在管理后台展示「待退总额」或「池子 MC 余额与待退总额」，便于监控。

---

## 五、小结

| 项目 | 说明 |
|------|------|
| 赎回时 | 1% 进入 `swapReserveMC`，并记入用户 `refundFeeAmount` |
| 再次质押时 | 从 `swapReserveMC` 退 1% 给用户，池子扣减 |
| 管理 | 1% 直接在 Swap 池子管理内，池子余额即包含赎回金储备 |

---

**文档版本**: v1.0  
**更新日期**: 2026-02-10
