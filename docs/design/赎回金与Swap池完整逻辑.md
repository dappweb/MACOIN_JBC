# 赎回金与 Swap 池完整逻辑（当前实现）

## 一、规则总览

- **赎回时**：用户 **额外支付** 门票等额的 **1%**（通过 `msg.value` 发送），**用户实收 = 本金**（全额）；该 1% 记入用户待退并 **进入 Swap 池**（`swapReserveMC`）。
- **再次提供流动性时**：先从 **Swap 池** 退待退金额到用户，再记本次质押。
- **被动退出时**：从本金中扣费记入待退并 **进入 Swap 池**，同样在再次质押时从池子退。

---

## 二、公式

| 名称 | 公式 |
|------|------|
| 基准（门票） | `feeBase` = `userInfo.maxTicketAmount`，若为 0 则 `userTicket.amount` |
| 质押本金 | `requiredAmount = baseMaxAmount × 150 / 100`（1.5 倍） |
| 赎回金（1%） | `fee = feeBase × redemptionFeePercent / 100`（当前 1%） |
| 质押时用户支付 | **仅本金**：`msg.value == requiredAmount` |

---

## 三、质押（stakeLiquidity）完整逻辑

```
1. 校验
   - liquidityEnabled、有有效门票、未退出、cycleDays ∈ {7,15,30}
   - msg.value == requiredAmount（仅本金，不包含 1%）

2. 若有待退（refundFeeAmount > 0）
   - 若 swapReserveMC < refund → revert InsufficientBalance（池子不足无法退）
   - 否则：
     - userInfo[msg.sender].refundFeeAmount = 0
     - swapReserveMC -= refund
     - _transferNativeMC(msg.sender, refund)
     - emit FeeRefunded(msg.sender, refund)

3. 创建质押
   - nextStakeId++
   - userStakes[msg.sender].push(Stake{ id, amount: requiredAmount, ... })
   - stakeOwner[nextStakeId] = msg.sender
   - _updateActiveStatus、emit LiquidityStaked、_calculateAndStoreDifferentialRewards
```

**要点**：退 1% 必须来自 Swap 池（`swapReserveMC`），池子不足则整笔交易 revert，不记质押。

---

## 四、赎回（redeem）完整逻辑

```
1. 初始化
   totalReturn = 0, totalFee = 0, totalYield = 0
   feeBase = userInfo[msg.sender].maxTicketAmount，若为 0 则 userTicket[msg.sender].amount

2. 对每一笔到期质押（endTime <= block.timestamp）
   - 计算待领收益 pending，totalYield += pending，stakes[i].paid += pending

   - 若 stakeRedemptionFeePaid[stakes[i].id] > 0（旧逻辑创建的质押）
     - totalReturn += stakes[i].amount + stakeRedemptionFeePaid[stakes[i].id]
     - 不要求额外支付 1%
   - 否则（新逻辑）
     - fee = feeBase × redemptionFeePercent / 100
     - totalFee += fee
     - totalReturn += stakes[i].amount   // 全额退本金，不扣

   - stakes[i].active = false，_releaseDifferentialRewards(stakes[i].id)

3. 若 totalReturn == 0 且 totalYield == 0 → revert NothingToRedeem

4. 若 totalFee > 0（新逻辑需用户额外支付 1%）
   - require(msg.value >= totalFee)，否则 revert InsufficientBalance
   - userInfo[msg.sender].refundFeeAmount += totalFee
   - swapReserveMC += totalFee
   - 若 msg.value > totalFee：退多余部分 _transferNativeMC(msg.sender, msg.value - totalFee)

5. 若有 totalYield：按上限与 50% MC / 50% JBC 发放收益（与赎回金无关）

6. 若 totalReturn > 0：_transferNativeMC(msg.sender, totalReturn)  // 全额本金

7. _updateActiveStatus；若达出局条件则 _handleExit(msg.sender)
```

**要点**：新逻辑下用户 **实收 = 本金**（全额），1% 由用户 **额外支付**（`msg.value`），记入待退与 Swap 池；旧 stake 仍退本金 + 原付的 1%。

---

## 五、被动退出（_handleExit）完整逻辑

```
对未到期质押做提前退出：
  fee = stake.amount × 2 × redemptionFeePercent / 300
  returnAmt = stake.amount - fee（或 0）
  totalReturn += returnAmt，totalFee += fee

若 totalReturn > 0：按合约余额转给用户（可能 RewardCapped）

若 totalFee > 0：
  - userInfo[user].refundFeeAmount += totalFee
  - swapReserveMC += totalFee
```

**要点**：被动退出扣费也进入 Swap 池，与赎回扣 1% 一致，再次质押时从池子退。

---

## 六、数据流（完整）

```
赎回（新逻辑）额外支付 1%：
  用户发送 msg.value >= totalFee（1% 合计），实收全额本金
    → userInfo[user].refundFeeAmount += totalFee
    → swapReserveMC += totalFee

被动退出扣费：
  未到期本金扣费（从本金扣）
    → userInfo[user].refundFeeAmount += totalFee
    → swapReserveMC += totalFee

再次提供流动性：
  若 refundFeeAmount > 0：
    若 swapReserveMC >= refund：
      swapReserveMC -= refund
      转 refund 给用户，refundFeeAmount = 0
    否则 revert InsufficientBalance
  然后：用 msg.value（仅本金）创建新质押
```

---

## 七、合约变量与位置（JinbaoProtocolNative.sol）

| 变量/逻辑 | 含义 |
|-----------|------|
| `refundFeeAmount` | 用户待退金额（赎回扣 1% + 被动退出扣费） |
| `swapReserveMC` | Swap 池 MC 余额；收 1% 时增加，退 1% 时减少 |
| `stakeRedemptionFeePaid[stakeId]` | 仅用于兼容：旧逻辑下质押时付的 1%，赎回时退还该笔 |
| `redemptionFeePercent` | 1% |
| 质押 | 第 627–676 行附近 |
| 赎回 | 第 1620–1711 行附近 |
| 被动退出 | 第 1034–1090 行附近 |

---

## 八、前端与用户侧

- **质押**：仅展示并校验 **本金（1.5× 门票）**，不包含 1%。
- **赎回**：用户 **实收 = 本金**（全额）；需 **额外支付** 门票等额 1% 的 MC（由前端调用 `getRedeemPreview` 取 `totalFee` 作为 `value`）；文案为「赎回时额外支付 1%，再次提供流动性时退」。
- **管理**：Swap 池子管理中的 MC 余额 = `swapReserveMC`，内含待退 1% 的储备；池子不足时再次质押会 revert。

---

## 九、举例说明（新业务逻辑：赎回额外支付 1%，用户实收 = 本金）

### 例 1：赎回时额外支付 1% → 用户实收全额本金 → 再次质押退 1%

- 用户门票 **1000 MC**，质押本金 **1500 MC**（1.5×），周期到期后赎回。
- **赎回时**：
  - 需额外支付 1% = 1000 × 1% = **10 MC**（按门票等额，非按本金）。
  - 用户调用 `redeem({ value: 10 MC })`，合约要求 `msg.value >= 10`。
  - 合约：`refundFeeAmount += 10`，`swapReserveMC += 10`（10 MC 进入 Swap 池）；**用户实收本金 1500 MC**（全额）。
  - 用户净支出：多付 10 MC；净收到：1500 MC 本金 + 收益（若有）。即 **实收 = 本金**，1% 为额外支付。
- **再次提供流动性时**：
  - 用户发起质押，`msg.value = 1500 MC`（仅本金）。
  - 合约发现 `refundFeeAmount = 10`，先退：`swapReserveMC -= 10`，转 **10 MC** 给用户，`refundFeeAmount = 0`。
  - 再用本次 1500 MC 创建新质押。
  - 用户净效果：先收到 10 MC 退金，再付 1500 MC 质押，相当于上次赎回时多付的 1% 在再次参与时退回。

### 例 2：多笔到期质押一次赎回，需额外支付多笔 1% 合计

- 用户有两笔到期质押：门票均为 **500 MC**，本金各 750 MC；feeBase = 500，每笔 1% = **5 MC**。
- 用户一次调用 `redeem`：`totalFee = 5 + 5 = 10 MC`，`totalReturn = 750 + 750 = 1500 MC`。
  - 用户需发送 `msg.value >= 10 MC`，实收 **1500 MC** 本金。
  - 合约：`refundFeeAmount += 10`，`swapReserveMC += 10`。
- 前端通过 `getRedeemPreview(account)` 得到 `totalFee = 10`，展示「需额外支付 10 MC」，并传 `redeem({ value: 10 })`。

### 例 3：池子不足时无法质押

- 用户有待退 **10 MC**，当前 `swapReserveMC = 8 MC`。
- 用户调用 `stakeLiquidity` 并付 1500 MC。
- 合约执行到「先退待退」：`refund = 10`，`swapReserveMC (8) < refund (10)` → **revert InsufficientBalance**，整笔交易回滚，不创建质押、也不扣用户 1500 MC。
- 需等 Swap 池中 MC 增加（例如更多用户赎回时额外支付 1% 进入池子）后，再次发起质押才能先退 10 MC 再记质押。

### 例 4：赎回时余额不足 1% 会失败

- 用户门票 1000 MC，到期应额外支付 **10 MC**，但钱包只有 5 MC。
  - 前端 `getRedeemPreview` 得到 `totalFee = 10`，校验 `mcBalance < 10` 后提示「赎回需额外支付 1% MC，当前余额不足」。
  - 若用户仍发起交易且 `msg.value < 10`，合约 `require(msg.value >= totalFee)` 会 **revert InsufficientBalance**。

---

**文档版本**: v1.0  
**更新日期**: 2026-02-10
