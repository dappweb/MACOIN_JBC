# 方案：赎回时付 1%（二次支付）、再次提供流动性时退

## 一、规则概述

- **赎回时**：用户赎回到期质押时，按门票等额支付 **1% 赎回金**（从本次返还的本金中扣除，即少拿 1%）；扣下的 1% 记入该用户的待退金额，**不进入协议储备**。
- **再次提供流动性时**：用户下次调用 `stakeLiquidity` 时，若其有待退金额，**先退回到该地址**（提供流动性的地址），再处理本次质押。

即：**赎回扣 1% → 记待退 → 再次质押时退 1%**。

---

## 二、合约改动要点（JinbaoProtocolNative）

### 2.1 质押（stakeLiquidity）

| 项目 | 当前实现 | 本方案 |
|------|----------|--------|
| 用户支付 | `msg.value == requiredAmount + redemptionFee`（本金 + 1%） | `msg.value == requiredAmount`（仅本金） |
| 赎回金 | 写入 `stakeRedemptionFeePaid[nextStakeId]` | 不再在质押时收取/写入 |
| 待退 | 先退 `refundFeeAmount`（被动退出产生） | **不变**：先退 `refundFeeAmount`（含上次赎回扣的 1% + 被动退出产生） |

**具体修改**：
- 删除对 `redemptionFee` 的校验与使用：`requiredAmount = (baseMaxAmount * 150) / 100`，校验 `amount == requiredAmount`。
- 删除 `stakeRedemptionFeePaid[nextStakeId] = redemptionFee`。
- 保留：先退 `userInfo[msg.sender].refundFeeAmount`，再创建 `Stake{ amount: requiredAmount }`。
- **金额不足保护**：若有待退（`refundFeeAmount > 0`）但合约余额不足以支付该退款（`address(this).balance < refund`），则 **revert InsufficientBalance**，不执行质押，避免用户质押成功却拿不到应退的 1%。

### 2.2 赎回（redeem）

| 项目 | 当前实现 | 本方案 |
|------|----------|--------|
| 本金 | `totalReturn += stake.amount` | 同左 |
| 1% 处理 | `totalReturn += stakeRedemptionFeePaid[stake.id]`（退质押时付的 1%） | **从返还中扣 1%**，扣下的金额累加到 `userInfo[msg.sender].refundFeeAmount` |
| 用户实收 | 本金 + 该笔 1% | 本金 − 1%（1% 待下次质押退） |

**公式**：
- 每笔到期质押：`feeBase = maxTicketAmount` 或 `ticket.amount`，`fee = feeBase * redemptionFeePercent / 100`。
- `returnAmt = stake.amount`，若 `returnAmt > fee` 则 `returnAmt -= fee`，`totalReturn += returnAmt`，`totalFee += fee`；否则全部当 fee 处理。
- 赎回循环结束后：`userInfo[msg.sender].refundFeeAmount += totalFee`（不写入 `swapReserveMC`）。
- 最后 `_transferNativeMC(msg.sender, totalReturn)`。

**兼容已存在的质押（旧逻辑下创建的 stake）**：
- 若 `stakeRedemptionFeePaid[stakes[i].id] > 0`，表示该笔是「质押时付过 1%」的旧逻辑，赎回时应退该 1%（即 `totalReturn += stake.amount + stakeRedemptionFeePaid[id]`），**不再从该笔扣 1%**。
- 若 `stakeRedemptionFeePaid[stakes[i].id] == 0`，表示新逻辑或历史数据，按「从本金扣 1%、记入 refundFeeAmount」处理。

### 2.3 被动退出（_handleExit）

- 保持现状：扣费累加至 `userInfo[user].refundFeeAmount`，下次 `stakeLiquidity` 时先退再质押。

### 2.4 存储与事件

- **refundFeeAmount**：继续表示「待退金额」（赎回扣的 1% + 被动退出扣费），在下次质押时退。
- **stakeRedemptionFeePaid**：保留 mapping 与存储槽，用于兼容旧 stake；新创建的 stake 不再写入（或写 0）。
- 事件：可按需增加/保留 `FeeRefunded`（再次提供流动性时退）。

---

## 三、前端改动要点

| 项目 | 当前 | 本方案 |
|------|------|--------|
| 质押所需金额 | 本金 + 1%（单独支付） | **仅本金**（1.5× 门票） |
| 质押页展示 | 「本金 1.5× + 1% 赎回金单独支付」 | 「本金 1.5×」 |
| 赎回页/说明 | 「赎回退本金 + 该笔 1%」 | 「赎回扣门票 1% 作为赎回金，再次提供流动性时退还」 |
| 文案 | notice2、liquidityExplanation、stakeAmountMismatch 等 | 改为「赎回时付 1%，再次质押时退」 |

---

## 四、数据与兼容

- **升级前已存在的质押**：赎回时若 `stakeRedemptionFeePaid[id] > 0`，仍退该笔 1%（不扣），避免旧用户损失。
- **升级后新质押**：质押只付本金；赎回时从本金扣 1% 进 `refundFeeAmount`，再次质押时退。
- **已有 refundFeeAmount 的用户**：无变化，下次质押时照常先退。

---

## 五、实现顺序建议

1. 合约：按上修改 `stakeLiquidity`（仅本金）、`redeem`（扣 1% 进 refundFeeAmount，兼容旧 stake）。
2. 编译与单元/集成测试：覆盖「质押→赎回→再次质押」及旧 stake 赎回。
3. 升级脚本：部署新实现并 `upgradeToAndCall`（代理不变）。
4. 前端：改为仅展示本金、更新赎回相关文案。

---

## 六、小结

| 环节 | 行为 |
|------|------|
| 质押 | 只付本金（1.5×），不再付 1%；若有待退先退再质押 |
| 赎回 | 从返还中扣门票 1% 记入 refundFeeAmount，用户实收本金 − 1% |
| 再次提供流动性 | 先退 refundFeeAmount 到提供流动性的地址，再处理本次质押 |

**文档版本**: v1.0  
**更新日期**: 2026-02-10
