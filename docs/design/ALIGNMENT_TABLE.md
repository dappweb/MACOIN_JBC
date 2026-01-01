# 需求-合约-网页功能对齐对比表 (Requirement-Contract-Frontend Alignment)

| 功能模块 (Module) | 需求点 (Requirement) | 智能合约 (Contract v3.2) | 前端 (Frontend) | 状态 (Status) |
| :--- | :--- | :--- | :--- | :--- |
| **门票系统** | 4个等级 (100-1000 MC)，可累计 | `buyTicket` 支持 T1-T4 校验与金额累计 | `MiningPanel` 支持选择与购买，显示累计额度 | ✅ 对齐 |
| **激活时效** | 72小时内需质押，超时作废不退款 | `_expireTicketIfNeeded` 检查时间戳，超时重置为0 | `MiningPanel` 显示过期状态，允许购买新票覆盖 | ✅ 对齐 |
| **流动性要求** | 门票金额的 1.5 倍 | `_requiredLiquidity` = amount * 1.5 | `MiningPanel` 自动计算并填充 1.5 倍金额 | ✅ 对齐 |
| **资金分配** | 直推25%, 层级15%, 市场5%, 回购5%, LP25%, 国库25% | `buyTicket` 实时分账，支持 `setDistributionPercents` | `AdminPanel` 支持查看与配置分配比例 | ✅ 对齐 |
| **挖矿周期** | 7/15/30 天，日化 1.33%/1.67%/2.0% | `stakeLiquidity` 校验周期，`claimRewards` 按周期计算收益 | `MiningPanel` 提供 7/15/30 选项，展示日化率 | ✅ 对齐 |
| **收益结算** | 50% MC + 50% JBC | `claimRewards` 计算总额后按 50/50 分发 | `MiningPanel` 调用领取，`EarningsDetail` 展示明细 | ✅ 对齐 |
| **SWAP** | 买入滑点 50% (销毁)，卖出滑点 25% (销毁) | `swapMCToJBC` (50% tax), `swapJBCToMC` (25% tax) | `SwapPanel` 估算滑点提示，调用合约交换 | ✅ 对齐 |
| **赎回机制** | 到期赎回本金，扣除 1% 手续费 (下次质押退还) | `redeem` 扣除手续费并记录，`stakeLiquidity` 退还 | `MiningPanel` 支持赎回操作 | ✅ 对齐 |
| **每日销毁** | 每日 00:00 销毁底池 1% JBC | `dailyBurn` 函数，限制 24h 调用一次 | `AdminPanel` 新增 "Daily Burn" 手动触发按钮 | ✅ 对齐 |
| **管理员权限** | 限制提现权限，防止挪用用户资金 | `adminWithdrawMC/JBC` 限制仅能提取 Swap Reserves | `AdminPanel` 提现功能对接受限接口 | ✅ 对齐 |
| **费率硬顶** | 各类费率不超过 50% | `setSwapTaxes`, `setDistributionPercents` 等含 `<=50` 校验 | `AdminPanel` 设置界面无额外校验(依赖合约报错) | ✅ 对齐 |

## 解决方案汇总 (Solutions Summary)

1.  **门票过期逻辑**:
    *   **问题**: 前端显示过期但缺乏明确操作指引。
    *   **解决**: 更新文案提示用户"购买新票以覆盖"，合约 `buyTicket` 自动处理旧票清理。

2.  **管理员提现权限**:
    *   **问题**: 原合约缺乏提现函数，或权限过大。
    *   **解决**: 新增 `adminWithdrawMC/JBC`，并严格限制提现金额不超过 `swapReserve`，保护用户质押资金。

3.  **每日销毁触发**:
    *   **问题**: 缺乏触发入口。
    *   **解决**: 在 `AdminPanel` 新增 "Daily Burn" 按钮，方便管理员手动执行（也可后续对接 Keeper）。

4.  **合约体积优化**:
    *   **问题**: 合约体积超过 Spurious Dragon 限制 (24KB)。
    *   **解决**: 启用优化器 (runs=1)，缩短 revert 字符串，成功压缩至 24.05KB。
