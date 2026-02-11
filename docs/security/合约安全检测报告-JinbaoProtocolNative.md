# JinbaoProtocolNative 合约安全检测报告

**合约名称**: JinbaoProtocolNative.sol  
**检测日期**: 2026-02-10  
**检测范围**: 合约逻辑、重入与溢出、权限与中心化、经济与一致性、依赖与升级

---

## 一、概述

本报告对当前生产使用的 **JinbaoProtocolNative**（原生 MC 版金宝协议）进行安全检测，涵盖重入、访问控制、整数与精度、业务逻辑一致性、中心化风险及升级安全等维度。结论按**严重 / 高 / 中 / 低 / 信息**分级。

---

## 二、检测结论汇总

| 级别     | 数量 | 说明 |
|----------|------|------|
| 严重     | 0    | 未发现可直接导致用户资金大规模损失或合约不可用的漏洞 |
| 高       | 1    | 中心化资金提取风险，依赖 Owner 行为 |
| 中       | 3    | 配置与会计一致性、极端情况下的资金/体验风险 |
| 低       | 3    | 边界与可维护性建议 |
| 信息     | 2    | 设计取舍与最佳实践建议 |

---

## 三、高等级问题

### H-1 紧急提款可提走全部合约余额（中心化风险）

**位置**: `emergencyWithdrawNative(address _to, uint256 _amount)`（约 406–412 行）

**描述**:  
仅校验 `address(this).balance >= _amount` 后即将 `_amount` 原生 MC 转给 `_to`，**不扣减任何内部会计**（如 `swapReserveMC`、用户质押本金等）。Owner 可调用 `emergencyWithdrawNative(owner, address(this).balance)` 将合约内全部 MC 提走，包括用户质押本金、待退赎回金、Swap 池等。

**影响**:  
若 Owner 私钥泄露或作恶，用户资金可被一次性抽走，属**最高等级中心化风险**。

**建议**:
- 仅在真正紧急且接受“牺牲会计一致性”时使用，并配套事后补偿或治理方案；
- 或改为：仅允许提取“超出某下限后的余额”，且与 `swapReserveMC` 等核心会计脱钩部分有明确上限与多签/时间锁。

**当前状态**: 视为**已知的 Owner 权限**，依赖项目方对 Owner 的管控与信任。

---

## 四、中等级问题

### M-1 分配比例未强制校验总和为 100%

**位置**: `setDistributionConfig`（约 303–311 行）

**描述**:  
直接写入 `directRewardPercent`、`levelRewardPercent`、`marketingPercent` 等 6 个比例，**未校验** `_direct + _level + _marketing + _buyback + _lpInjection + _treasury == 100`。若配置错误，会导致：
- 总分配不足 100%：部分购票款留在合约，与设计不符；
- 总分配超过 100%：后续转账可能余额不足或逻辑混乱。

**建议**:  
在函数内增加 `require(_direct + _level + _marketing + _buyback + _lpInjection + _treasury == 100, "SumNot100");`（或使用已有 `SumNot100` error），并在前端/脚本中同步校验。

---

### M-2 等级奖励池提取未做上限校验

**位置**: `withdrawLevelRewardPool(address _to, uint256 _amount)`（约 374–381 行）

**描述**:  
使用 `levelRewardPool -= _amount` 扣减池子。Solidity 0.8+ 会在 `_amount > levelRewardPool` 时因下溢 revert，故不会出现“池子变负”；但若 Owner 误传 `_amount > levelRewardPool`，交易会直接失败，且错误信息不直观。

**建议**:  
显式校验 `require(_amount <= levelRewardPool, "Exceeds level reward pool");`，并可选地发出事件，便于监控与排查。

---

### M-3 Swap 储备提取与会计一致性

**位置**: `withdrawSwapReserves`（约 386–402 行）

**描述**:  
`swapReserveMC -= _amountMC` 与 `swapReserveJBC -= _amountJBC` 与真实转出量一致，且先扣减再转账，逻辑正确。但合约**总余额**中除 Swap 储备外，还包含用户质押本金、待退赎回金等。若 Owner 误将 `_amountMC` 设为超过 `swapReserveMC`，会因下溢 revert，属于安全行为。  
建议在文档或注释中明确：仅应提取“属于 Swap 池”的额度，且不超过 `swapReserveMC` / `swapReserveJBC`，避免运营误用。

**建议**:  
在函数内增加 `require(_amountMC <= swapReserveMC && _amountJBC <= swapReserveJBC, "Exceeds reserves");`，并保留事件便于审计。

---

## 五、低等级问题

### L-1 receive() 使 swapReserveMC 与真实余额解耦

**位置**: `receive() external payable`（约 274–277 行）

**描述**:  
任意地址向合约转 MC 时，`swapReserveMC += msg.value`。合约实际余额还包含用户质押、待退金等，因此 `swapReserveMC` 仅为“视为 Swap 池”的记账值，与 `address(this).balance` 无强制一致。若有人误转大量 MC，会放大 Swap 池记账，影响价格与兑换逻辑。

**建议**:  
若设计上不接受“任意增加池子”，可考虑仅允许通过 `addLiquidity` 或指定入口增加 `swapReserveMC`；或在文档中明确“接受捐赠/误转并纳入池子”的规则。

---

### L-2 赎回时多付的 MC 退款在 totalFee > 0 分支内

**位置**: `redeem()`（约 1678–1685 行）

**描述**:  
当 `msg.value > totalFee` 时，多余部分通过 `_transferNativeMC(msg.sender, msg.value - totalFee)` 退回。逻辑正确，且仅在 `totalFee > 0` 时执行该分支，避免误退。建议在注释或 NatSpec 中写明“多付的 value 会退回”，便于审计与前端对接。

**建议**:  
在函数注释中明确：`msg.value` 应 >= 本次赎回所需 1% 总额，多出部分会原路退回。

---

### L-3 推荐链遍历深度与 Gas

**位置**: `_hasCircularReference`（约 517–532 行）、`_updateTeamStats`、`_calculateAndStoreDifferentialRewards` 等

**描述**:  
推荐人链遍历有上限（如 50 层、20 次迭代），可防止无限循环与 DoS；但在推荐层级很深时，单次调用的 Gas 会升高，极端情况下可能接近区块 Gas 上限。

**建议**:  
在文档中说明推荐深度与 Gas 的权衡；若业务允许，可考虑将部分统计改为链下或分批更新。

---

## 六、信息项（设计取舍与最佳实践）

### I-1 重入与并发保护

**结论**:  
- 对外部资金流关键路径（如 `buyTicket`、`stakeLiquidity`、`redeem`、`claimRewards`、`swapMCToJBC`、`swapJBCToMC`）均使用 `nonReentrant`，且采用 CEI 模式（先状态变更再转账），重入风险低。  
- 使用 `call{value:}()` 进行原生 MC 转账，符合常规做法；未发现回调中再次进入同一合约的明显路径。

---

### I-2 整数与精度

**结论**:  
- Solidity 0.8+ 默认检查溢出/下溢，未发现显式 `unchecked` 在资金计算上的误用。  
- 收益与比例计算使用 `amount * rate / 1e9` 等形式，存在常规的精度截断（向下取整），在文档中已有或可补充说明即可。

---

### I-3 UUPS 升级与初始化

**结论**:  
- `_authorizeUpgrade` 仅 `onlyOwner`，升级权集中在 Owner。  
- 使用 `constructor` 中 `_disableInitializers()`，避免实现合约被直接初始化后当作逻辑合约使用，符合 OpenZeppelin 升级模式。  
- 建议：升级前在测试网完整跑通核心流程（购票、质押、赎回、兑换、奖励领取），并做存储布局兼容性检查。

---

## 七、业务逻辑一致性检查（摘要）

| 项目           | 结论 |
|----------------|------|
| 购票金额       | 仅允许 100/300/500/1000 MC，与代码一致。 |
| 质押金额       | 以 maxSingleTicketAmount 的 1.5 倍为 requiredAmount，与文档一致。 |
| 赎回 1%        | 新逻辑：用户额外支付 1%（msg.value），实收本金；旧 stake 退原 1%。逻辑与文档一致。 |
| 待退金与池子   | 先退 refundFeeAmount 再创建新质押，且要求 swapReserveMC >= refund，否则 revert，与设计一致。 |
| 被动退出       | _handleExit 中扣费进入 refundFeeAmount 与 swapReserveMC，再次质押时可退，与文档一致。 |
| 奖励发放       | 静态奖励 50% MC + 50% JBC、级差奖励 50/50、等级奖励池与未发放部分入池，逻辑清晰。 |

未发现与设计文档明显矛盾的逻辑错误。

---

## 八、依赖与外部调用

- **OpenZeppelin**: 使用 `OwnableUpgradeable`、`UUPSUpgradeable`、`ReentrancyGuardUpgradeable`、`Initializable`，版本与用法常规。  
- **IJBC**: 仅使用 `transfer`、`transferFrom`、`burn`，未发现非标准或回调类接口。  
- **RedemptionLib**: 当前主合约为原生 MC 版，赎回逻辑在合约内实现，库内 ERC20 相关逻辑未在 JinbaoProtocolNative 中直接用于资金路径，风险可控。

---

## 九、总体结论与建议

- **总体结论**: 未发现可直接导致用户资金大规模损失或合约不可用的**严重漏洞**。主要风险来自 **Owner 权限过大**（尤其是 `emergencyWithdrawNative`）和**配置/会计一致性**（分配比例总和、储备提取与池子记账）。  
- **建议优先级**:  
  1. 明确并限制 `emergencyWithdrawNative` 的使用场景与多签/治理；  
  2. 为 `setDistributionConfig` 增加总和 100% 校验；  
  3. 为 `withdrawLevelRewardPool`、`withdrawSwapReserves` 增加显式上限校验与事件；  
  4. 在文档中补充 receive、升级与推荐链 Gas 的说明。

---

**报告版本**: v1.0  
**检测依据**: JinbaoProtocolNative.sol 及 RedemptionLib.sol 当前版本（截至 2026-02-10）。
