# 除 Owner 外的提币与资金流出路径

**合约**: JinbaoProtocolNative  
**说明**: 除 Owner 外，还有哪些角色/调用路径能让 MC 或 JBC 从合约转出。

---

## 一、谁能让资金流出合约？

### 1. 普通用户（msg.sender = 任意地址）

| 函数 | 转出资产 | 转给谁 | 条件/说明 |
|------|----------|--------|-----------|
| **stakeLiquidity** | 原生 MC | msg.sender | 仅当该用户有待退金（refundFeeAmount > 0）且池子足够时，先退待退金再记质押 |
| **claimRewards** | 原生 MC + JBC | msg.sender | 领取静态奖励：50% MC + 50% JBC 价值，需有未领取收益且未出局 |
| **redeem** | 原生 MC + JBC | msg.sender | 到期赎回：本金（全额）+ 收益（若有）；多付的 1% 会退回 msg.sender |
| **swapMCToJBC** | JBC | msg.sender | 用户先转 MC 进合约，按 AMM 得到 JBC（扣税后） |
| **swapJBCToMC** | 原生 MC | msg.sender | 用户先 transferFrom JBC 进合约，按 AMM 得到 MC（扣税后） |

以上均为**业务设计内的流出**：金额由合约逻辑和用户输入决定，不依赖管理员。

---

### 2. 协议固定地址（由用户行为间接触发）

用户调用 **buyTicket** 时，合约会把购票款按比例转给以下地址（不是“提币权限”，而是固定分配）：

| 接收方 | 比例（默认） | 说明 |
|--------|--------------|------|
| marketingWallet | directRewardPercent（25%）+ marketingPercent（5%） | 直推奖励（若推荐人未激活则进营销）+ 营销 |
| buybackWallet | buybackPercent（5%） | 回购金，用于后续回购销毁 |
| lpInjectionWallet | lpInjectionPercent（25%） | 流动性注入 |
| treasuryWallet | treasuryPercent（25%） | 国库 |

这些地址由 Owner 通过 `setWallets` 设置，**不能自己主动从合约提币**，只能通过用户购票被动接收。

---

### 3. 推荐人/上级（由用户行为间接触发）

以下流程中，合约会向**推荐链上的上级**转 MC 或 JBC，而不是任意地址：

| 触发场景 | 函数/逻辑 | 转给谁 | 说明 |
|----------|-----------|--------|------|
| 用户购票 | _distributeTicketLevelRewards → _distributeReward | 上级（最多 15 层） | 等级奖励，MC |
| 用户购票 | _distributeReward（直推） | 直推推荐人 | 直推奖励，MC |
| 用户质押到期/赎回 | _releaseDifferentialRewards → _distributeReward | 上级（极差） | 极差奖励，50% MC + 50% JBC |
| 用户达 cap 被动退出 | _handleExit → _releaseDifferentialRewards | 上级 | 同上 |

金额由合约公式和用户数据（门票、质押额、层级等）决定，**只有“在推荐链上且满足条件”的地址能收到**，不能任意指定。

---

### 4. 仅 buybackWallet 可调用的逻辑（不是提 MC 出去）

| 函数 | 说明 |
|------|------|
| **executeBuybackAndBurn** | 仅 `msg.sender == buybackWallet` 可调用。回购钱包**向合约转 MC**（msg.value），合约用这些 MC 按 AMM 换 JBC 并 **burn**。没有“从合约提 MC 到 buybackWallet”的路径。 |

因此，**buybackWallet 没有从合约提 MC 的权限**，只能触发“把已转入的 MC 换成 JBC 并销毁”。

---

### 5. 任何人可触发、但不向地址转出资产

| 函数 | 说明 |
|------|------|
| **dailyBurn** | 任何人可调用；合约燃烧 Swap 池中 1% 的 JBC，不向任何地址转 MC 或 JBC。 |
| **receive()** | 任何人向合约转 MC，只会增加 `swapReserveMC`，不会导致转出。 |

---

## 二、总结：除 Owner 外的“提币可能性”

- **能主动从合约“提币”的只有两类**：  
  1. **Owner**：通过 `withdrawLevelRewardPool`、`withdrawSwapReserves`、`emergencyWithdrawNative`、`rescueTokens` 等（见安全报告）。  
  2. **普通用户**：仅限**自己**通过 `stakeLiquidity`（退待退金）、`claimRewards`、`redeem`、`swapJBCToMC` 获得 MC；通过 `claimRewards`、`redeem`、`swapMCToJBC` 获得 JBC。金额由合约规则和自身持仓决定。

- **协议钱包**（marketing、treasury、lpInjection、buyback）：只能**被动接收**购票分配，不能主动调用提币函数。

- **推荐人/上级**：只能**被动接收**奖励（等级、直推、极差），不能主动从合约提款。

- **buybackWallet**：只能触发回购销毁逻辑，不能从合约提 MC。

因此，**除 Owner 外，没有其他角色拥有“任意提币”或“提走他人资金”的权限**；其他所有流出都是规则内的用户收益、兑换或协议分配。
