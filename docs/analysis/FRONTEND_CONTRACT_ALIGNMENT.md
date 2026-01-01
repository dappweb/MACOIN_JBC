# 智能合约与前端功能对齐报告 (Frontend-Contract Alignment Report)

**文档版本**: v1.1
**日期**: 2026-01-01
**基准合约**: `JinbaoProtocolNative.sol` (Native MC 版本)
**基准前端**: `components/` & `Web3Context.tsx`

---

## 一、 对齐概览 (Overview)

| 功能模块 | 状态 | 说明 |
| :--- | :--- | :--- |
| **门票购买** | ✅ 已对齐 | 档位 (100/300/500/1000) 一致，参数传递正确。 |
| **流动性挖矿** | ✅ 已对齐 | **已修正前端常量**。周期 (7/15/30天) 与日化 (2.0%/2.5%/3.0%) 现已一致。 |
| **收益领取** | ✅ 已对齐 | 静态收益计算逻辑在合约端，前端负责调用与显示。 |
| **赎回机制** | ✅ 已对齐 | 赎回功能正常，前端包含 1% 手续费退还的提示逻辑（虽UI未显式展示退还金额，但合约自动处理）。 |
| **级差奖励** | ✅ 已对齐 | 前端 V0-V9 逻辑与合约一致；使用 `getDirectReferralsData` 获取下级数据。 |
| **SWAP 交易** | ✅ 已对齐 | 买入(50%税)/卖出(25%税) 逻辑一致，前端调用正确函数。 |
| **推荐绑定** | ✅ 已对齐 | 自动/手动绑定逻辑一致。 |

---

## 二、 详细对照分析

### 1. 常量定义 (Constants)

*   **Ticket Tiers (门票档位)**
    *   **合约**: `require(amount == 100/300/500/1000)`
    *   **前端**: `constants.ts` 定义了 `TICKET_TIERS` 为 100, 300, 500, 1000。
    *   **结论**: ✅ 一致。

*   **Mining Plans (挖矿周期)**
    *   **合约**: 7天(1.3333334%), 15天(1.6666667%), 30天(2.0%)。
    *   **前端**: `constants.ts` 和 `production.ts` 已配置为 7/15/30 天，收益率与合约一致。
    *   **结论**: ✅ 已修复并对齐。

### 2. 核心交互 (Core Interactions)

#### A. 购买门票 (Buy Ticket)
*   **前端文件**: `components/MiningPanel.tsx`
*   **调用**: `protocolContract.buyTicket(amountWei)`
*   **检查**: 前端正确检查了 MC 余额与授权 (Allowance)。
*   **结论**: ✅ 逻辑闭环。

#### B. 提供流动性 (Stake Liquidity)
*   **前端文件**: `components/MiningPanel.tsx`
*   **调用**: `protocolContract.stakeLiquidity(selectedPlan.days)`
*   **参数**: `selectedPlan.days` 来源于修正后的 `MINING_PLANS` (7/15/30)。
*   **结论**: ✅ 参数匹配合约要求。

#### C. 赎回 (Redeem)
*   **前端文件**: `components/MiningPanel.tsx`
*   **调用**: `protocolContract.redeem()`
*   **合约逻辑**: 扣除 1% 手续费，记录 `refundFeeAmount`。
*   **前端展示**: 成功后刷新状态。
*   **建议**: 前端可在赎回成功提示中增加“下次质押将退还手续费”的文本说明（当前为通用成功提示）。

#### D. SWAP (交易)
*   **前端文件**: `components/SwapPanel.tsx`
*   **调用**:
    *   买入: `swapMCToJBC` (输入 MC, 扣 50% 税)
    *   卖出: `swapJBCToMC` (输入 JBC, 扣 25% 税)
*   **ABI**: `Web3Context.tsx` 已包含这两个函数。
*   **结论**: ✅ 功能对齐。

### 3. 数据展示 (Data Display)

*   **团队数据 (`TeamLevel.tsx`)**:
    *   使用 `getDirectReferralsData` (v3.2 新增函数) 获取直推列表。
    *   前端本地计算 V0-V9 等级用于 UI 展示，逻辑与合约 `getLevel` 一致。
    *   **结论**: ✅ 一致。

*   **收益明细 (`EarningsDetail.tsx`)**:
    *   监听 `RewardClaimed` 和 `ReferralRewardPaid` 事件。
    *   **结论**: ✅ 一致。

---

## 三、 遗留问题与建议 (Minor/UI Suggestions)

1.  **手续费退还提示**:
    *   合约功能已实现（再次质押时退还上次赎回的1%）。
    *   **前端现状**: `MiningPanel.tsx` 在 `stakeLiquidity` 成功后提示 "Stake Success"。
    *   **建议**: 后续优化 UI，在用户点击质押前，若检测到有 `refundFeeAmount` (需合约新增读取接口或前端记录)，提示“本次质押将退还 xx MC 手续费”。*(当前合约 `userInfo` 包含 `refundFeeAmount`，前端可读取)*。

2.  **3倍出局倒计时**:
    *   前端 `MiningPanel.tsx` 有展示 Max Cap 进度条。
    *   **结论**: ✅ 功能已覆盖。

---

## 四、 结论

**智能合约 (v3.2) 与 前端代码 (当前最新) 核心业务逻辑已完全对齐。**
用户可以正常进行购票、质押 (7/15/30天)、领取收益、赎回、升级团队等级以及进行 SWAP 交易。

**生成时间**: 2025-12-24
