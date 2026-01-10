# 门票数据状态报告

## ⚠️ 重要发现

**门票数据在迁移过程中丢失了！**

---

## 📊 数据状态

### ✅ 备份文件中
- **用户总数**: 367 个用户
- **有门票数据的用户**: 需要统计
- **活跃门票**: 需要统计
- **门票数据已完整备份** ✅

### ❌ 新合约中
- **门票数据**: 未迁移 ❌
- **推荐关系**: 已迁移 ✅ (365/367 用户)
- **其他数据**: 未迁移（会在用户操作时自动恢复）

---

## 🔍 原因分析

### 1. 迁移脚本限制
迁移脚本 `scripts/migrate-user-data.cjs` 中：
- ✅ 只迁移了推荐人关系（`adminSetReferrer`）
- ❌ **没有迁移门票数据**（`userTicket`）
- ❌ 合约中没有 `adminSetUserTicket` 函数

### 2. 合约限制
新合约 `JinbaoProtocolNative.sol` 中：
- ✅ 有 `adminSetReferrer` 函数
- ❌ **没有 `adminSetUserTicket` 函数**
- ❌ 无法通过管理员函数直接设置门票数据

---

## 📋 备份数据详情

备份文件: `scripts/backups/protocol-backup-1767522095585.json`

每个用户的门票数据包括：
```json
{
  "userTicket": {
    "ticketId": "2",
    "amount": "200000000000000000000",  // 200 MC
    "purchaseTime": "1767248798",
    "exited": false
  }
}
```

---

## 💡 恢复方案

### 方案 A: 用户重新购买（推荐）
**优点**:
- ✅ 简单直接
- ✅ 不需要修改合约
- ✅ 用户操作即可恢复

**缺点**:
- ❌ 用户需要重新支付门票费用
- ❌ 丢失历史记录

**适用场景**: 
- 如果用户愿意重新购买
- 如果门票金额不大

---

### 方案 B: 添加管理员函数恢复门票数据
**步骤**:
1. 在合约中添加 `adminSetUserTicket` 函数
2. 升级合约（UUPS 代理）
3. 使用迁移脚本恢复门票数据

**优点**:
- ✅ 可以恢复历史门票数据
- ✅ 用户不需要重新支付

**缺点**:
- ❌ 需要升级合约（有风险）
- ❌ 需要 Gas 费用
- ❌ 需要时间部署和验证

**函数示例**:
```solidity
function adminSetUserTicket(
    address user,
    uint256 ticketId,
    uint256 amount,
    uint256 purchaseTime,
    bool exited
) external onlyOwner {
    userTicket[user] = Ticket({
        ticketId: ticketId,
        amount: amount,
        purchaseTime: purchaseTime,
        exited: exited
    });
    // 更新相关状态
    _updateActiveStatus(user);
}
```

---

### 方案 C: 补偿方案
**步骤**:
1. 统计所有丢失的门票数据
2. 根据门票金额给用户补偿
3. 用户可以重新购买门票

**优点**:
- ✅ 用户获得补偿
- ✅ 不需要修改合约

**缺点**:
- ❌ 需要额外的资金
- ❌ 需要手动处理

---

## 📊 影响评估

### 对用户的影响
1. **已购买门票的用户**:
   - ❌ 门票数据丢失
   - ❌ 需要重新购买门票
   - ✅ 推荐关系已保留

2. **已质押的用户**:
   - ❌ 质押数据可能也丢失（需要检查）
   - ❌ 需要重新质押

3. **收益数据**:
   - ❌ `totalRevenue` 丢失
   - ❌ `currentCap` 丢失
   - ⚠️ 这些会在用户操作时自动恢复

---

## 🎯 建议

### 短期方案（立即执行）
1. **通知用户**: 告知用户门票数据丢失的情况
2. **提供补偿**: 根据门票金额给用户补偿
3. **协助恢复**: 帮助用户重新购买门票

### 长期方案（可选）
1. **添加管理员函数**: 在合约中添加 `adminSetUserTicket` 函数
2. **升级合约**: 使用 UUPS 代理升级
3. **恢复数据**: 从备份文件恢复门票数据

---

## 📝 数据统计

### 需要统计的数据
- [ ] 有活跃门票的用户数量
- [ ] 门票总金额
- [ ] 平均门票金额
- [ ] 最大门票金额
- [ ] 最小门票金额

### 统计命令
```bash
# 统计有活跃门票的用户
jq '[.users[] | select(.userTicket.ticketId != "0" and .userTicket.exited == false)] | length' scripts/backups/protocol-backup-1767522095585.json

# 统计门票总金额
jq '[.users[] | select(.userTicket.ticketId != "0" and .userTicket.exited == false) | .userTicket.amount] | add | tonumber / 1e18' scripts/backups/protocol-backup-1767522095585.json
```

---

## ⚠️ 重要提醒

1. **数据丢失确认**: 门票数据确实丢失了
2. **备份完整**: 备份文件中有完整的门票数据
3. **可以恢复**: 可以通过添加管理员函数恢复
4. **需要决策**: 需要决定是否恢复门票数据

---

## 📄 相关文件

- `scripts/backups/protocol-backup-1767522095585.json` - 备份文件（包含门票数据）
- `scripts/migrate-user-data.cjs` - 迁移脚本（未迁移门票）
- `contracts/JinbaoProtocolNative.sol` - 新合约（无 adminSetUserTicket 函数）







