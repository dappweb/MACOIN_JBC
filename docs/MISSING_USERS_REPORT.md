# 未迁移用户报告

## 📅 检查时间
2026-01-05

## 📊 检查结果总结

### 旧合约统计
- **总用户数**: 377
- **BoundReferrer 事件**: 376
- **TicketPurchased 事件**: 384
- **LiquidityStaked 事件**: 48

### 新合约统计
- **已迁移用户数**: 367
- **未迁移用户数**: 10

---

## ⚠️ 未迁移用户列表

### 1. 有推荐人但未迁移的用户 (9个)

这些用户是在备份时间（2026-01-04 10:19:10 UTC）之后在旧合约中绑定推荐人的新用户：

1. **0x30a1d966e4c30fc07a972a8d0261925fea0d6f07**
   - 推荐人: `0xb3fcde0cb5e17e97ec8e23e27e5d6ce809ac57a6`
   - 绑定时间: 2026-01-04 10:28:32 UTC (区块 2119884)

2. **0x1e33131ebf57e8d65f221280ba0fe5cf9e1f30fe**
   - 推荐人: `0x30a1d966e4c30fc07a972a8d0261925fea0d6f07`
   - 绑定时间: 2026-01-04 10:30:53 UTC (区块 2119931)

3. **0x637f879a4625f067824f95d7d5a5b4e771b771af**
   - 推荐人: `0x30a1d966e4c30fc07a972a8d0261925fea0d6f07`
   - 绑定时间: 2026-01-04 10:33:50 UTC (区块 2119990)

4. **0x7f26fdb3ddeb8c3868da3d52af0300ffd97f6987**
   - 推荐人: `0x30a1d966e4c30fc07a972a8d0261925fea0d6f07`
   - 绑定时间: 2026-01-04 10:35:17 UTC (区块 2120019)

5. **0x1095ac56d0e2b579ed8935e610a94b9c5249f525**
   - 推荐人: `0x7f26fdb3ddeb8c3868da3d52af0300ffd97f6987`
   - 绑定时间: 2026-01-04 10:38:47 UTC (区块 2120089)

6. **0x71877cba63c96f8ad3be3495b9d597f317c09e2f**
   - 推荐人: `0x7f26fdb3ddeb8c3868da3d52af0300ffd97f6987`
   - 绑定时间: 2026-01-04 10:40:26 UTC (区块 2120122)

7. **0xd789977de408e7325a757b31e49cf4c6e3add3e8**
   - 推荐人: `0x7f26fdb3ddeb8c3868da3d52af0300ffd97f6987`
   - 绑定时间: 2026-01-04 10:46:53 UTC (区块 2120251)

8. **0x1d02cc58dcc1b24b071d17e354033925fa0540c9**
   - 推荐人: `0xd2b0c11ddc14355bf4564b32cc8ffdfb64121f74`
   - 绑定时间: 2026-01-04 11:01:59 UTC (区块 2120553)

9. **0xc7c9693f26b10b5b93ccac2469eb3ae7b4638dac**
   - 推荐人: `0x1d02cc58dcc1b24b071d17e354033925fa0540c9`
   - 绑定时间: 2026-01-04 11:06:26 UTC (区块 2120642)

### 2. 有门票但无推荐人且未迁移的用户 (1个)

1. **0x0ea4a4b654cd77e9ea5b088633e6d5d5b4bbb720**
   - 门票ID: 1767210059
   - 门票金额: 100 MC
   - 状态: 有门票但没有推荐人，新合约中完全没有数据

---

## 📋 推荐人不匹配的用户 (1个)

1. **0x4c10831cbcf9884ba72051b5287b6c87e4f74a48** (Owner/部署者)
   - 旧合约推荐人: `0x2d68a5850a4805c6fe6648e5870b68456e2a7c82`
   - 新合约推荐人: `0x3e436e9ef8a44cb65b00fcefe4ac1952384ed21e`
   - 说明: 该用户在新合约中重新绑定了推荐人

---

## 🔧 迁移方案

### 需要迁移的数据

1. **推荐关系** (9个用户)
   - 使用 `adminSetReferrer` 函数迁移推荐关系

2. **门票数据** (1个用户)
   - 用户: `0x0ea4a4b654cd77e9ea5b088633e6d5d5b4bbb720`
   - 需要从旧合约查询门票数据，然后使用 `adminSetUserTicket` 迁移
   - 注意: 该用户没有推荐人，可能需要先设置推荐人（如果旧合约中有）

### 迁移步骤

1. **迁移推荐关系** (9个用户)
   ```javascript
   // 使用 adminSetReferrer 函数
   await protocol.adminSetReferrer(userAddress, referrerAddress);
   ```

2. **迁移门票数据** (1个用户)
   ```javascript
   // 从旧合约查询门票数据
   const ticket = await oldProtocol.userTicket(userAddress);
   // 使用 adminSetUserTicket 迁移
   await protocol.adminSetUserTicket(
     userAddress,
     ticket.ticketId,
     ticket.amount,
     ticket.purchaseTime,
     ticket.exited
   );
   ```

---

## 📄 相关文件

- `scripts/backups/all-old-contract-users-check-*.json` - 完整用户检查结果
- `scripts/backups/users-without-referrer-check-*.json` - 无推荐人用户检查结果
- `scripts/backups/post-backup-users-check-*.json` - 备份后新用户检查结果

---

## ✅ 建议

1. **立即迁移这10个用户的数据**
2. **优先迁移推荐关系**，确保推荐链完整
3. **迁移门票数据**，确保用户权益不丢失
4. **验证迁移结果**，确保所有数据正确迁移

---

**最后更新**: 2026-01-05


