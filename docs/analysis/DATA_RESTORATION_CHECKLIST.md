# 数据恢复检查清单

## 📋 概述
本文档列出了协议合约中所有需要恢复的数据类型，包括推荐关系、门票数据、用户状态等。

---

## 1. 推荐关系数据 (Referrer Data)

### 1.1 用户推荐人
- **字段**: `userInfo[user].referrer`
- **类型**: `address`
- **恢复函数**: `adminSetReferrer(address user, address newReferrer)`
- **说明**: 用户的直接推荐人地址
- **重要性**: ⭐⭐⭐⭐⭐ (关键)

### 1.2 直推列表
- **字段**: `directReferrals[referrer]`
- **类型**: `address[]`
- **恢复函数**: 通过 `adminSetReferrer` 自动更新
- **说明**: 每个推荐人的直接推荐用户列表
- **重要性**: ⭐⭐⭐⭐ (重要)

### 1.3 活跃直推数
- **字段**: `userInfo[user].activeDirects`
- **类型**: `uint256`
- **恢复函数**: `adminSetActiveDirects(address user, uint256 newActiveDirects)`
- **说明**: 用户有多少个活跃的直推（有门票且未退出）
- **重要性**: ⭐⭐⭐⭐⭐ (关键，影响层级奖励)

### 1.4 团队总数
- **字段**: `userInfo[user].teamCount`
- **类型**: `uint256`
- **恢复函数**: `adminSetTeamCount(address user, uint256 newTeamCount)`
- **说明**: 用户整个推荐链的总人数（包括间接推荐）
- **重要性**: ⭐⭐⭐⭐⭐ (关键，影响用户等级)

---

## 2. 门票数据 (Ticket Data)

### 2.1 门票基本信息
- **字段**: `userTicket[user]`
- **类型**: `struct Ticket`
- **恢复函数**: `adminSetUserTicket(address user, uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)`
- **包含字段**:
  - `ticketId`: 门票ID
  - `amount`: 门票金额
  - `purchaseTime`: 购买时间
  - `exited`: 是否已退出
- **重要性**: ⭐⭐⭐⭐⭐ (关键)

### 2.2 门票拥有者映射
- **字段**: `ticketOwner[ticketId]`
- **类型**: `mapping(uint256 => address)`
- **恢复函数**: 通过 `adminSetUserTicket` 自动更新
- **说明**: 每个门票ID对应的用户地址
- **重要性**: ⭐⭐⭐⭐ (重要)

### 2.3 历史最大门票金额
- **字段**: `userInfo[user].maxTicketAmount`
- **类型**: `uint256`
- **恢复函数**: `adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount)`
- **说明**: 用户历史上购买过的最大门票总金额
- **重要性**: ⭐⭐⭐ (中等)

### 2.4 历史单张最大门票
- **字段**: `userInfo[user].maxSingleTicketAmount`
- **类型**: `uint256`
- **恢复函数**: `adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount)`
- **说明**: 用户历史上单次购买的最大门票金额（用于计算流动性要求）
- **重要性**: ⭐⭐⭐⭐ (重要，影响流动性要求)

### 2.5 下一个门票ID
- **字段**: `nextTicketId`
- **类型**: `uint256`
- **恢复函数**: 需要直接修改存储（可能需要升级合约）
- **说明**: 下一个要分配的门票ID
- **重要性**: ⭐⭐⭐ (中等)

---

## 3. 用户状态数据 (User Status Data)

### 3.1 用户活跃状态
- **字段**: `userInfo[user].isActive`
- **类型**: `bool`
- **恢复函数**: 通过 `adminSetUserTicket` 自动更新（如果有有效门票）
- **说明**: 用户是否处于活跃状态（有门票且未退出）
- **重要性**: ⭐⭐⭐⭐⭐ (关键，影响奖励分配)

### 3.2 累计收益
- **字段**: `userInfo[user].totalRevenue`
- **类型**: `uint256`
- **恢复函数**: `adminSetTotalRevenue(address user, uint256 newTotalRevenue)`
- **说明**: 用户累计获得的总收益（MC）
- **重要性**: ⭐⭐⭐⭐ (重要)

### 3.3 收益上限
- **字段**: `userInfo[user].currentCap`
- **类型**: `uint256`
- **恢复函数**: `adminSetCurrentCap(address user, uint256 newCurrentCap)`
- **说明**: 用户当前可以获得的收益上限（通常是门票金额的3倍）
- **重要性**: ⭐⭐⭐⭐⭐ (关键，影响奖励分配)

### 3.4 退款费用
- **字段**: `userInfo[user].refundFeeAmount`
- **类型**: `uint256`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 用户赎回时累积的退款费用
- **重要性**: ⭐⭐ (较低)

---

## 4. 团队统计数据 (Team Statistics)

### 4.1 团队总交易量
- **字段**: `userInfo[user].teamTotalVolume`
- **类型**: `uint256`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 用户整个团队的总交易量
- **重要性**: ⭐⭐⭐ (中等)

### 4.2 团队总收益上限
- **字段**: `userInfo[user].teamTotalCap`
- **类型**: `uint256`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 用户整个团队的总收益上限
- **重要性**: ⭐⭐⭐ (中等)

---

## 5. 质押数据 (Staking Data)

### 5.1 用户质押列表
- **字段**: `userStakes[user]`
- **类型**: `Stake[]`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **包含字段**:
  - `id`: 质押ID
  - `amount`: 质押金额
  - `startTime`: 开始时间
  - `cycleDays`: 周期天数
  - `active`: 是否活跃
  - `paid`: 已支付金额
- **重要性**: ⭐⭐⭐⭐ (重要)

### 5.2 质押拥有者映射
- **字段**: `stakeOwner[stakeId]`
- **类型**: `mapping(uint256 => address)`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 每个质押ID对应的用户地址
- **重要性**: ⭐⭐⭐ (中等)

### 5.3 下一个质押ID
- **字段**: `nextStakeId`
- **类型**: `uint256`
- **恢复函数**: 需要直接修改存储（可能需要升级合约）
- **说明**: 下一个要分配的质押ID
- **重要性**: ⭐⭐⭐ (中等)

---

## 6. 奖励数据 (Reward Data)

### 6.1 门票待分配奖励
- **字段**: `ticketPendingRewards[ticketId]`
- **类型**: `PendingReward[]`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 每个门票对应的待分配奖励列表
- **重要性**: ⭐⭐⭐ (中等)

### 6.2 质押待分配奖励
- **字段**: `stakePendingRewards[stakeId]`
- **类型**: `PendingReward[]`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 每个质押对应的待分配奖励列表
- **重要性**: ⭐⭐⭐ (中等)

### 6.3 动态奖励追踪
- **字段**: 
  - `totalDynamicEarned[user]`: 总获得动态奖励
  - `totalDynamicClaimed[user]`: 总提取动态奖励
- **类型**: `uint256`
- **恢复函数**: 暂无直接函数（可能需要升级合约添加）
- **说明**: 用于前端显示用户的动态奖励统计
- **重要性**: ⭐⭐ (较低，主要用于显示)

### 6.4 层级奖励池
- **字段**: `levelRewardPool`
- **类型**: `uint256`
- **恢复函数**: 需要直接修改存储（可能需要升级合约）
- **说明**: 未分配的层级奖励累积池
- **重要性**: ⭐⭐⭐ (中等)

---

## 7. 全局状态数据 (Global State)

### 7.1 最后燃烧时间
- **字段**: `lastBurnTime`
- **类型**: `uint256`
- **恢复函数**: 需要直接修改存储（可能需要升级合约）
- **说明**: 最后一次执行每日燃烧的时间戳
- **重要性**: ⭐⭐ (较低)

---

## 📊 数据恢复优先级

### 🔴 最高优先级（必须恢复）
1. ✅ **推荐人关系** (`userInfo[user].referrer`)
2. ✅ **活跃直推数** (`userInfo[user].activeDirects`)
3. ✅ **团队总数** (`userInfo[user].teamCount`)
4. ✅ **门票数据** (`userTicket[user]`)
5. ✅ **用户活跃状态** (`userInfo[user].isActive`)
6. ✅ **收益上限** (`userInfo[user].currentCap`)

### 🟡 高优先级（重要）
7. ✅ **直推列表** (`directReferrals[referrer]`)
8. ✅ **历史单张最大门票** (`userInfo[user].maxSingleTicketAmount`)
9. ✅ **累计收益** (`userInfo[user].totalRevenue`)
10. ⚠️ **质押数据** (`userStakes[user]`)

### 🟢 中优先级（可选）
11. ⚠️ **历史最大门票金额** (`userInfo[user].maxTicketAmount`)
12. ⚠️ **团队总交易量** (`userInfo[user].teamTotalVolume`)
13. ⚠️ **团队总收益上限** (`userInfo[user].teamTotalCap`)
14. ⚠️ **待分配奖励** (`ticketPendingRewards`, `stakePendingRewards`)

### ⚪ 低优先级（次要）
15. ⚠️ **退款费用** (`userInfo[user].refundFeeAmount`)
16. ⚠️ **动态奖励追踪** (`totalDynamicEarned`, `totalDynamicClaimed`)
17. ⚠️ **全局ID计数器** (`nextTicketId`, `nextStakeId`)
18. ⚠️ **层级奖励池** (`levelRewardPool`)

---

## 🛠️ 可用的恢复函数

### 已实现的函数 ✅
1. `adminSetReferrer(address user, address newReferrer)` - 设置推荐人
2. `adminSetActiveDirects(address user, uint256 newActiveDirects)` - 设置活跃直推数
3. `adminSetTeamCount(address user, uint256 newTeamCount)` - 设置团队总数
4. `adminSetUserTicket(address user, uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)` - 设置门票数据
5. `adminSetTotalRevenue(address user, uint256 newTotalRevenue)` - 设置累计收益
6. `adminSetCurrentCap(address user, uint256 newCurrentCap)` - 设置收益上限
7. `adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount)` - 设置最大门票金额

### 需要添加的函数 ⚠️
1. `adminSetUserStakes(address user, Stake[] memory stakes)` - 设置质押数据
2. `adminSetTeamTotalVolume(address user, uint256 newVolume)` - 设置团队总交易量
3. `adminSetTeamTotalCap(address user, uint256 newCap)` - 设置团队总收益上限
4. `adminSetRefundFeeAmount(address user, uint256 newAmount)` - 设置退款费用
5. `adminSetDynamicRewards(address user, uint256 earned, uint256 claimed)` - 设置动态奖励
6. `adminSetNextTicketId(uint256 newId)` - 设置下一个门票ID
7. `adminSetNextStakeId(uint256 newId)` - 设置下一个质押ID
8. `adminSetLevelRewardPool(uint256 newPool)` - 设置层级奖励池

---

## 📝 数据恢复流程建议

### 步骤 1: 恢复推荐关系
1. 使用 `adminSetReferrer` 恢复所有用户的推荐人
2. 验证 `directReferrals` 映射是否正确更新

### 步骤 2: 恢复门票数据
1. 使用 `adminSetUserTicket` 恢复所有用户的门票信息
2. 验证 `ticketOwner` 映射是否正确
3. 使用 `adminSetMaxTicketAmounts` 恢复历史最大门票金额

### 步骤 3: 恢复用户状态
1. 使用 `adminSetTotalRevenue` 恢复累计收益
2. 使用 `adminSetCurrentCap` 恢复收益上限
3. 验证 `isActive` 状态是否正确（通过门票数据自动更新）

### 步骤 4: 恢复团队统计
1. 使用 `adminSetActiveDirects` 恢复活跃直推数
2. 使用 `adminSetTeamCount` 恢复团队总数
3. 验证团队统计数据的一致性

### 步骤 5: 恢复质押数据（如果需要）
1. 添加 `adminSetUserStakes` 函数
2. 恢复所有用户的质押记录
3. 验证 `stakeOwner` 映射是否正确

### 步骤 6: 验证和测试
1. 验证所有数据的一致性
2. 测试奖励分配功能
3. 测试推荐关系查询
4. 测试门票和质押功能

---

## ⚠️ 注意事项

1. **数据一致性**: 恢复数据时要注意保持数据的一致性，例如：
   - `activeDirects` 应该等于 `directReferrals` 中活跃用户的数量
   - `teamCount` 应该等于整个推荐链的总人数
   - `currentCap` 应该等于门票金额的3倍（如果有门票）

2. **推荐关系循环**: 使用 `adminSetReferrer` 时，合约会自动检查循环引用，但恢复时仍要注意避免创建循环。

3. **事件触发**: 恢复数据时，相关的事件（如 `ReferrerChanged`, `TeamCountUpdated`）会被触发，前端需要监听这些事件。

4. **批量操作**: 对于大量用户的数据恢复，建议编写脚本批量调用恢复函数。

5. **备份**: 在恢复数据之前，建议先备份当前合约状态，以防需要回滚。

---

## 🔗 相关文件

- `contracts/JinbaoProtocolNative.sol` - 主合约文件
- `contracts/AdminLib.sol` - 管理员功能库
- `components/AdminPanel.tsx` - 管理面板前端
- `components/AdminUserManager.tsx` - 用户管理组件

---

## 📅 最后更新

文档创建日期: 2024年
最后更新日期: 2024年







