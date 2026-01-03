# 推荐奖励未到账问题分析报告

## 问题账户
**地址**: `0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b`

**预期奖励**: 
- 直推奖励: 25 MC
- 见点奖励（层级奖励）: 1 MC
- **总计**: 26 MC

## 诊断结果

### 1. 账户状态检查
- ⚠️ 无法获取用户信息（可能原因：账户未在合约中注册，或合约版本不匹配）

### 2. 事件查询结果
- ✅ 查询范围: 最近 50,000 个区块
- ❌ 未找到作为受益人的推荐奖励事件
- ❌ 未找到作为来源的推荐奖励事件

### 3. 合约状态
- ✅ 合约余额: 1196.0 MC（充足）
- ⚠️ 无法获取奖励配置（合约版本可能不匹配）

## 可能的原因

### 原因 1: 收益上限已满 ⚠️
**最可能的原因**

如果账户的 `currentCap - totalRevenue <= 0`，奖励会被截断：
- 直推奖励和层级奖励都会受到收益上限限制
- 超出部分不会发放，但会触发 `RewardCapped` 事件

**检查方法**:
```solidity
userInfo = protocolContract.userInfo(account);
available = userInfo.currentCap - userInfo.totalRevenue;
if (available <= 0) {
    // 收益上限已满，无法接收奖励
}
```

### 原因 2: 推荐人不活跃 ⚠️
**直推奖励需要**:
- 推荐人存在 (`referrer != address(0)`)
- 推荐人活跃 (`isActive == true`)
- 推荐人有有效门票 (`ticket.amount > 0 && !ticket.exited`)

**层级奖励需要**:
- 推荐链上的用户都活跃
- 有足够的层级数
- 用户有足够的 `activeDirects`

### 原因 3: 奖励被截断但未记录
- 奖励计算了，但因为上限或余额问题，实际未发放
- 可能触发了 `RewardCapped` 事件，但没有 `ReferralRewardPaid` 事件

### 原因 4: 事件查询范围不够
- 如果购买门票发生在 50,000 个区块之前，需要扩大查询范围

### 原因 5: 合约版本问题
- 当前合约可能不是预期的版本
- ABI 不匹配导致无法正确查询

## 建议的检查步骤

### 步骤 1: 手动查询账户信息
使用区块链浏览器或直接调用合约：
```javascript
// 查询用户信息
const userInfo = await protocolContract.userInfo("0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b");
console.log("累计收益:", userInfo.totalRevenue);
console.log("收益上限:", userInfo.currentCap);
console.log("可用空间:", userInfo.currentCap - userInfo.totalRevenue);
```

### 步骤 2: 查询 RewardCapped 事件
检查是否有奖励被截断：
```javascript
const cappedEvents = await protocolContract.queryFilter(
  protocolContract.filters.RewardCapped("0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b"),
  fromBlock
);
```

### 步骤 3: 扩大事件查询范围
如果购买发生在更早的时间，扩大查询范围：
```javascript
const fromBlock = Math.max(0, currentBlock - 200000); // 扩大到 200,000 个区块
```

### 步骤 4: 检查推荐关系
确认推荐关系是否正确建立：
```javascript
const userInfo = await protocolContract.userInfo(account);
const referrer = userInfo.referrer;
const referrerInfo = await protocolContract.userInfo(referrer);
console.log("推荐人是否活跃:", referrerInfo.isActive);
```

## 解决方案

### 方案 1: 如果是收益上限问题
如果账户收益上限已满，需要：
1. 等待用户领取现有收益
2. 或通过管理员功能调整收益上限（如果合约支持）

### 方案 2: 如果是推荐人不活跃
需要：
1. 确保推荐人重新购买门票
2. 或重新绑定活跃的推荐人

### 方案 3: 如果是合约余额问题
需要：
1. 向合约充值足够的 MC
2. 或等待其他用户赎回，释放合约余额

### 方案 4: 如果是奖励未发放
如果是合约bug导致奖励未发放，需要：
1. 通过管理员功能手动补发奖励
2. 或升级合约修复问题

## 诊断脚本

已创建诊断脚本：`scripts/check-reward-issue.cjs`

运行方法：
```bash
npx hardhat run scripts/check-reward-issue.cjs --network mc
```

## 下一步行动

1. ✅ 确认账户是否在合约中注册
2. ✅ 检查账户的收益上限状态
3. ✅ 查询 RewardCapped 事件
4. ✅ 扩大事件查询范围
5. ✅ 检查推荐关系链
6. ✅ 确认购买门票的交易哈希和时间

## 联系信息

如果问题持续存在，请提供：
- 购买门票的交易哈希
- 购买时间
- 推荐人地址
- 预期奖励金额的详细计算

---

**报告生成时间**: 2025-01-02
**诊断脚本版本**: v1.0

