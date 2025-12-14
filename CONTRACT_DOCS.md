# JinbaoProtocol 智能合约文档

**合约名称:** `JinbaoProtocol`
**版本:** `0.8.20`
**许可证:** `MIT`

## 1. 概述
`JinbaoProtocol` 是一个基于 DeFi 4.0 概念的综合性协议合约，集成了门票购买、流动性挖矿、推荐奖励机制、双代币交换（Swap）以及资产赎回功能。协议主要围绕两种代币运行：
*   **MC (Macoin)**: 基础流通代币，用于购买门票、提供流动性和作为奖励结算的主要部分。
*   **JBC (Jinbao Coin)**: 金本位代币，作为奖励结算的另一部分，并具有销毁机制。

## 2. 核心数据结构

### 2.1 用户信息 (`UserInfo`)
存储用户的基本状态和推荐关系。
*   `referrer`: 上级推荐人地址。
*   `activeDirects`: 有效直推用户数量（用于计算等级）。
*   `teamCount`: 团队总人数（演示用简化字段）。
*   `totalRevenue`: 用户累计总收益。
*   `currentCap`: 当前收益上限（通常为门票金额的 3 倍）。
*   `isActive`: 用户是否处于激活状态（已提供流动性）。

### 2.2 门票信息 (`Ticket`)
存储用户当前周期的投资详情。
*   `amount`: 门票金额 (MC)。
*   `requiredLiquidity`: 所需配资流动性金额 (MC)。
*   `purchaseTime`: 门票购买时间。
*   `liquidityProvided`: 是否已提供流动性。
*   `liquidityAmount`: 实际提供的流动性金额。
*   `startTime`: 挖矿开始时间。
*   `cycleDays`: 锁仓周期（7/15/30 天）。
*   `redeemed`: 是否已赎回。

### 2.3 推荐数据 (`ReferralData`)
用于前端展示直推列表的辅助结构。
*   `user`: 直推用户地址。
*   `ticketAmount`: 门票金额。
*   `joinTime`: 加入时间。

## 3. 主要功能模块

### 3.1 管理员功能 (Admin Functions)
仅合约拥有者 (`owner`) 可调用。
*   `setWallets`: 设置市场、国库、LP注入和回购钱包地址。
*   `setDistributionPercents`: 设置门票资金的分配比例（直推、层级、市场等，总和必须为 100%）。
*   `setSwapTaxes`: 设置 Swap 交易的买入和卖出税率。
*   `setRedemptionFee`: 设置赎回手续费率。
*   `adminSetUserStats`: **[新增]** 手动设置用户的有效直推数和团队人数（用于修正等级）。
*   `adminSetReferrer`: **[新增]** 手动修改用户的推荐绑定关系，并自动更新旧推荐人和新推荐人的直推列表。

### 3.2 推荐系统 (Referral System)
*   `bindReferrer`: 用户手动绑定上级推荐人。
    *   限制：不能绑定自己、不能重复绑定、推荐人必须有效。
*   `getDirectReferrals`: 获取用户的直推地址列表。
*   `getDirectReferralsData`: 获取用户直推的详细数据（地址、门票、时间）。

### 3.3 门票购买 (Ticket Purchase)
*   `buyTicket(uint256 amount)`: 用户购买门票。
    *   **金额限制**: 必须是 100, 300, 500, 或 1000 Ether。
    *   **资金分配**: 根据设定的比例自动分发给推荐人、市场钱包、国库等。
    *   **状态更新**: 初始化门票信息，设置 3 倍收益上限。

### 3.4 流动性挖矿 (Liquidity Mining)
*   `stakeLiquidity(uint256 cycleDays)`: 用户质押流动性并开始挖矿。
    *   **前置条件**: 已购买门票且在 72 小时内。
    *   **周期选择**: 7 天、15 天或 30 天。
    *   **激活逻辑**: 质押成功后，用户状态变为激活，上级推荐人的有效直推数 +1。

### 3.5 收益领取 (Claim Rewards)
*   `claimRewards()`: 用户领取静态收益。
    *   **收益计算**: 根据周期对应的日化收益率（2.0% - 3.0%）计算。
    *   **收益结算**: 50% 以 MC 支付，50% 以 JBC 支付（当前 JBC 价格模拟为 1:1）。
    *   **上限检查**: 总收益不能超过当前周期的 3 倍上限。

### 3.6 闪兑系统 (Swap System)
*   `swapMCToJBC(uint256 mcAmount)`: 使用 MC 购买 JBC。
    *   **机制**: 扣除买入税（默认 50%），税收部分直接销毁。
*   `swapJBCToMC(uint256 jbcAmount)`: 将 JBC 卖出换回 MC。
    *   **机制**: 扣除卖出税（默认 25%），税收部分直接销毁。

### 3.7 赎回机制 (Redemption)
*   `redeem()`: 周期结束后赎回本金。
    *   **条件**: 必须已到期。
    *   **费用**: 扣除设定的赎回手续费（默认 1%）。
    *   **结果**: 返还本金给用户，标记门票为已赎回，用户状态变为非激活。

## 4. 事件 (Events)
合约定义了关键操作的事件，便于前端索引和状态追踪：
*   `BoundReferrer`: 绑定推荐关系。
*   `TicketPurchased`: 购买门票。
*   `LiquidityStaked`: 质押流动性。
*   `RewardClaimed`: 领取收益。
*   `Redeemed`: 赎回本金。
*   `SwappedMCToJBC` / `SwappedJBCToMC`: 代币兑换。

## 5. 辅助合约 (Mock Contracts)

### MockMC
用于测试环境的模拟 MC 代币。
*   `constructor`: 部署时铸造 10亿 MC 给部署者。
*   `mint`: 允许任意铸造代币（仅限测试网）。

---
*文档生成时间: 2025-12-14*
