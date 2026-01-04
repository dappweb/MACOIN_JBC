# 链上门票购买逻辑检查报告

## 📋 检查日期
2024年（当前日期）

## 🔍 检查范围
- 合约端：`contracts/JinbaoProtocolNative.sol` 的 `buyTicket()` 函数
- 前端端：`components/BuyTicketPanel.tsx` 的购买门票逻辑

---

## ✅ 合约端逻辑检查

### 1. 推荐人检查 ✅
**位置**: `contracts/JinbaoProtocolNative.sol:502-506`

```solidity
function buyTicket() external payable nonReentrant whenNotPaused {
    // 检查是否已绑定推荐人
    if (userInfo[msg.sender].referrer == address(0)) {
        revert MustBindReferrer();
    }
    // ...
}
```

**状态**: ✅ **正确**
- 合约在购买门票前检查用户是否已绑定推荐人
- 如果未绑定推荐人，会 revert `MustBindReferrer()` 错误

### 2. 金额验证 ✅
**位置**: `contracts/JinbaoProtocolNative.sol:511-513`

```solidity
if (amount != 100 * 1e18 && amount != 300 * 1e18 && amount != 500 * 1e18 && amount != 1000 * 1e18) {
    revert InvalidAmount();
}
```

**状态**: ✅ **正确**
- 只允许购买 100/300/500/1000 MC 的门票

### 3. 门票状态更新 ✅
**位置**: `contracts/JinbaoProtocolNative.sol:515-543`

**逻辑**:
- 如果门票已退出 (`t.exited`)，创建新门票
- 如果门票金额为 0，创建新门票
- 如果已有门票，累加金额并更新 `currentCap`

**状态**: ✅ **正确**

### 4. 奖励分配逻辑 ✅
**位置**: `contracts/JinbaoProtocolNative.sol:555-578`

**分配流程**:
1. **直推奖励** (第555-565行)
   - 如果有推荐人且推荐人活跃 → 分配给推荐人
   - 否则 → 转到营销钱包

2. **层级奖励** (第567行)
   - 调用 `_distributeTicketLevelRewards()` 分配层级奖励
   - 最多15层，每层1%的门票金额

3. **营销费用** (第569行)
   - 按比例转到营销钱包

4. **回购销毁** (第571-575行)
   - 先转到回购钱包，由回购钱包执行回购

5. **流动性注入** (第577行)
   - 转到流动性注入钱包

6. **国库** (第578行)
   - 转到国库钱包

**状态**: ✅ **正确**

### 5. 团队统计更新 ✅
**位置**: `contracts/JinbaoProtocolNative.sol:580-582`

```solidity
_updateTeamStats(msg.sender, amount, false);
_updateActiveStatus(msg.sender);
```

**状态**: ✅ **正确**
- 更新团队统计（仅更新交易量，不更新人数）
- 更新用户活跃状态

---

## ❌ 前端端逻辑问题

### 问题 1: 缺少推荐人检查 ❌

**位置**: `components/BuyTicketPanel.tsx`

**问题描述**:
- 前端在购买门票前**没有检查**用户是否已绑定推荐人
- 如果用户没有推荐人，交易会在链上失败，但前端没有提前提示
- 用户体验差：用户点击购买后才知道需要推荐人

**修复方案**:
1. ✅ 从 `useWeb3()` 获取 `hasReferrer` 和 `checkReferrerStatus`
2. ✅ 在 `handleBuyTicket()` 函数开头添加推荐人检查
3. ✅ 在 UI 中显示推荐人检查提示
4. ✅ 禁用购买按钮（如果没有推荐人）

**修复代码**:
```typescript
// 1. 添加推荐人状态
const { hasReferrer, checkReferrerStatus } = useWeb3()

// 2. 检查推荐人状态
useEffect(() => {
  if (protocolContract && account) {
    checkReferrerStatus()
  }
}, [protocolContract, account, checkReferrerStatus])

// 3. 在购买前检查
const handleBuyTicket = async () => {
  // ...
  if (!hasReferrer) {
    toast.error("购买门票前必须先绑定推荐人，请先前往首页绑定推荐人")
    return
  }
  // ...
}

// 4. UI 提示和按钮禁用
{!hasReferrer && isConnected && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
    <h3>需要先绑定推荐人</h3>
    <p>根据协议规则，购买门票前必须先绑定推荐人。</p>
  </div>
)}
<button disabled={!hasReferrer || ...}>
  {!hasReferrer ? "请先绑定推荐人" : `直接购买 ${selectedTier} MC 门票`}
</button>
```

---

## 📊 购买门票完整流程

### 前端流程
1. ✅ 用户选择门票金额（100/300/500/1000 MC）
2. ✅ 检查钱包连接状态
3. ✅ **检查推荐人状态**（新增）
4. ✅ 检查 MC 余额
5. ✅ 检查 Gas 费用
6. ✅ 调用合约 `buyTicket()` 函数

### 合约流程
1. ✅ 检查推荐人（`MustBindReferrer` 如果未绑定）
2. ✅ 检查金额（必须是 100/300/500/1000 MC）
3. ✅ 处理门票过期（`_expireTicketIfNeeded`）
4. ✅ 更新门票状态
5. ✅ 分配直推奖励
6. ✅ 分配层级奖励
7. ✅ 分配营销/回购/流动性/国库资金
8. ✅ 更新团队统计
9. ✅ 更新用户活跃状态
10. ✅ 触发 `TicketPurchased` 事件

---

## 🎯 奖励分配详情

### 直推奖励
- **比例**: `directRewardPercent`（从配置读取）
- **条件**: 推荐人存在且活跃
- **分配**: 
  - ✅ 有推荐人 → 分配给推荐人（通过 `_distributeReward`）
  - ❌ 无推荐人 → 转到营销钱包（但合约要求必须有推荐人，所以不会执行此分支）

### 层级奖励
- **比例**: `levelRewardPercent`（从配置读取）
- **层级**: 最多15层
- **每层奖励**: 门票金额的 1%
- **条件**: 推荐人必须活跃，且根据活跃直推数决定层级数
- **未分配部分**: 转入 `levelRewardPool`

### 其他分配
- **营销**: `marketingPercent` → 营销钱包
- **回购**: `buybackPercent` → 回购钱包（由回购钱包执行回购）
- **流动性**: `lpInjectionPercent` → 流动性注入钱包
- **国库**: `treasuryPercent` → 国库钱包

---

## ✅ 修复总结

### 已修复的问题
1. ✅ **前端推荐人检查**: 添加了推荐人状态检查和 UI 提示
2. ✅ **用户体验改进**: 在购买前提示用户需要绑定推荐人
3. ✅ **按钮状态**: 未绑定推荐人时禁用购买按钮

### 合约端状态
- ✅ 所有逻辑正确，无需修改

---

## 📝 建议

### 1. 前端优化建议
- ✅ 已实现：在购买页面显示推荐人状态
- 💡 建议：在首页也显示推荐人绑定状态，方便用户了解

### 2. 错误处理建议
- ✅ 已实现：购买前检查推荐人
- 💡 建议：如果链上交易失败并返回 `MustBindReferrer` 错误，显示更友好的错误提示

### 3. 测试建议
- ✅ 测试场景1：有推荐人的用户购买门票 → 应该成功
- ✅ 测试场景2：无推荐人的用户购买门票 → 应该在前端被阻止
- ✅ 测试场景3：推荐人不活跃的用户购买门票 → 直推奖励应转到营销钱包

---

## 🔗 相关文件

- `contracts/JinbaoProtocolNative.sol` - 合约实现
- `components/BuyTicketPanel.tsx` - 前端购买门票组件
- `src/Web3Context.tsx` - Web3 上下文（包含推荐人状态）
- `docs/analysis/TICKET_PURCHASE_REFERRER_REQUIREMENT.md` - 推荐人要求文档

---

## ✅ 检查结论

**合约端**: ✅ 逻辑正确，推荐人检查、金额验证、奖励分配都正确实现

**前端端**: ✅ **已修复**，添加了推荐人检查，提升了用户体验

**整体状态**: ✅ **通过检查**，购买门票逻辑完整且正确

