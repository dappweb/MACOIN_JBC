# 合约中「当日」与「天」的处理逻辑

## 一、时间单位

| 常量 | 值 | 含义 |
|------|-----|------|
| **SECONDS_IN_UNIT** | 86400 | 1 天 = 24×60×60 秒（生产环境按「天」计） |

合约**不区分自然日（日历）**，只按「自某时刻起经过的秒数」除以 86400 得到**整天数**。

---

## 二、质押周期与到期

- **开始时间**：`stake.startTime = block.timestamp`（质押交易所在区块时间戳）。
- **结束时间**：`endTime = startTime + cycleDays * SECONDS_IN_UNIT`（按秒精确计算）。
- **是否到期**：`block.timestamp >= endTime` 时可赎回/领取并释放极差。

例如：7 天周期 = 7 × 86400 = 604800 秒，从 `startTime` 起算满 604800 秒即到期。

---

## 三、静态收益中的「天」与「当日」

收益按「经过的整 24 小时」计，公式为：

```text
unitsPassed = (block.timestamp - stake.startTime) / SECONDS_IN_UNIT
若 unitsPassed > cycleDays 则取 unitsPassed = cycleDays
```

- **unitsPassed**：自 `startTime` 起已过去的**整天数**（整数除法，不足 1 天为 0）。
- **当日（不足 24 小时）**：若质押后未满 86400 秒，则 `unitsPassed == 0`，**不产生当日静态收益**；合约在「满 1 个 24 小时」后才开始计第 1 天收益。
- **收益计算**：  
  `totalStaticShouldBe = amount * ratePerBillion * unitsPassed / 1e9`  
  再减去已发放 `stake.paid`，得到本次待领金额。

即：**当日（首 24 小时内）合约按 0 天处理，不发静态收益；满 1 天后按 1 天计，以此类推。**

---

## 四、门票 72 小时有效期（与「当日」无关）

- **条件**：仅当 `ticket.purchaseTime >= ticketExpiryCutoffDate` 时，才启用「72 小时内未质押则过期」。
- **判断**：`block.timestamp > purchaseTime + ticketFlexibilityDuration` 则触发过期逻辑（清除门票等）。
- 这里用的是「自购买起经过的秒数」，与自然日、当日无关。

---

## 五、小结

| 场景 | 合约处理方式 |
|------|--------------|
| **1 天（时间单位）** | 固定为 86400 秒，不按自然日 |
| **当日（质押后不足 24h）** | `unitsPassed = 0`，不记静态收益 |
| **满 N 个 24h** | `unitsPassed = N`，按 N 天计静态收益 |
| **周期到期** | `block.timestamp >= startTime + cycleDays * 86400` 按秒判断 |
| **门票过期** | 按 `purchaseTime + ticketFlexibilityDuration` 与当前时间比较 |

**结论**：合约不处理「自然日/日历当日」，只按「自 startTime 或 purchaseTime 起经过的秒数」和 86400 的整倍数（整天数）处理；当日（首 24 小时内）视为 0 天，不发放静态收益。

---

**文档版本**: v1.0  
**更新日期**: 2026-02-10
