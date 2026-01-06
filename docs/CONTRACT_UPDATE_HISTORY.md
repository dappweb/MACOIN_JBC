# 合约更新历史和部署时间

## 📋 当前协议合约信息

- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **网络**: MC Chain (Chain ID: 88813)
- **合约类型**: UUPS Upgradeable Proxy
- **Owner**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

---

## 📅 合约更新历史

### 1. 初始部署 (2026-01-04 18:34:26 UTC+8)

**时间**: 2026-01-04 10:34:26 UTC (18:34:26 UTC+8)  
**文件**: `deployments/new-protocol-deployment-1767522867325.json`

**部署信息**:
- **实现地址**: `0x34c929bF6961818f3e20252C87B14A89f6A4F091`
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`
- **新 Owner**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**部署原因**: 
- 重新部署协议合约以恢复 Owner 权限
- 从旧合约备份数据并迁移到新合约

**配置参数**:
- `directRewardPercent`: 25%
- `levelRewardPercent`: 15%
- `marketingPercent`: 5%
- `buybackPercent`: 5%
- `lpInjectionPercent`: 25%
- `treasuryPercent`: 25%
- `redemptionFeePercent`: 1%
- `swapBuyTax`: 50
- `swapSellTax`: 25
- `jbcToken`: `0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D`

---

### 2. 第一次升级 - 添加门票恢复功能 (2026-01-04 23:24:06 UTC+8)

**时间**: 2026-01-04 15:24:06 UTC (23:24:06 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767540247137.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0x34c929bF6961818f3e20252C87B14A89f6A4F091`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminSetUserTicket` - 管理员设置用户门票数据（用于数据迁移）

**升级原因**: 恢复用户门票数据

---

### 3. 第二次升级 - 添加用户状态恢复功能 (2026-01-04 23:48:33 UTC+8)

**时间**: 2026-01-04 15:48:33 UTC (23:48:33 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767541713522.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0xABD9D515F18A33D2e392951404e096C0F326Ce76`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminSetActiveDirects` - 管理员设置用户活跃直推数量
- `adminSetTeamCount` - 管理员设置用户团队数量
- `adminSetTotalRevenue` - 管理员设置用户总收益
- `adminSetCurrentCap` - 管理员设置用户收益上限
- `adminSetMaxTicketAmounts` - 管理员设置用户最大门票金额

**升级原因**: 恢复用户状态数据

---

### 4. 第三次升级 - 添加质押数据恢复功能 (2026-01-05 00:11:14 UTC+8)

**时间**: 2026-01-04 16:11:14 UTC (00:11:14 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767543074884.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0x0a0A83D19A96a4256AffeB9D6987659e78bDe432`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminAddUserStake` - 管理员添加用户质押数据

**升级原因**: 恢复用户质押数据

---

### 5. 第四次升级 - 添加团队数据恢复功能 (2026-01-05 00:27:00 UTC+8)

**时间**: 2026-01-04 16:27:00 UTC (00:27:00 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767544020704.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0xFced050b69C42FD706C059593E853871a6FE6590`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminSetTeamTotalVolume` - 管理员设置团队总交易量
- `adminSetTeamTotalCap` - 管理员设置团队总上限
- `adminAddDirectReferral` - 管理员添加直推用户

**升级原因**: 恢复团队数据

---

### 6. 第五次升级 - 添加奖励数据恢复功能 (2026-01-05 01:00:59 UTC+8)

**时间**: 2026-01-04 17:00:59 UTC (01:00:59 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767546059288.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0x8095E0BEFA1b791B578c3bFa66AA176089D482d5`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminSetLevelRewardPool` - 管理员设置等级奖励池
- `adminAddStakePendingReward` - 管理员添加质押极差奖励
- `adminAddTicketPendingReward` - 管理员添加门票等级奖励

**升级原因**: 恢复奖励数据

---

### 7. 第六次升级 - 添加系统状态恢复功能 (2026-01-05 01:08:23 UTC+8)

**时间**: 2026-01-04 17:08:23 UTC (01:08:23 UTC+8)  
**文件**: `deployments/upgrade-ticket-restore-1767546503608.json`

**升级信息**:
- **代理地址**: `0x0897Cee05E43B2eCf331cd80f881c211eb86844E`
- **实现地址**: `0x7D233d2732b325e9EC47C9c8c31E074b426B53A4`
- **部署者**: `0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`

**新增功能**:
- `adminSetSwapReserves` - 管理员设置交换储备
- `adminSetNextTicketId` - 管理员设置下一个门票 ID
- `adminSetNextStakeId` - 管理员设置下一个质押 ID
- `adminSetLastBurnTime` - 管理员设置最后燃烧时间
- `adminSetRefundFeeAmount` - 管理员设置用户退款手续费

**升级原因**: 恢复系统状态和交换储备数据

---

## 📊 升级统计

### 升级次数
- **总升级次数**: 6 次
- **初始部署**: 1 次
- **总计操作**: 7 次

### 新增管理员函数
1. `adminSetUserTicket` - 设置用户门票数据
2. `adminSetActiveDirects` - 设置活跃直推数
3. `adminSetTeamCount` - 设置团队数量
4. `adminSetTotalRevenue` - 设置总收益
5. `adminSetCurrentCap` - 设置收益上限
6. `adminSetMaxTicketAmounts` - 设置最大门票金额
7. `adminAddUserStake` - 添加用户质押数据
8. `adminSetTeamTotalVolume` - 设置团队总交易量
9. `adminSetTeamTotalCap` - 设置团队总上限
10. `adminAddDirectReferral` - 添加直推用户
11. `adminSetLevelRewardPool` - 设置等级奖励池
12. `adminAddStakePendingReward` - 添加质押极差奖励
13. `adminAddTicketPendingReward` - 添加门票等级奖励
14. `adminSetSwapReserves` - 设置交换储备
15. `adminSetNextTicketId` - 设置下一个门票 ID
16. `adminSetNextStakeId` - 设置下一个质押 ID
17. `adminSetLastBurnTime` - 设置最后燃烧时间
18. `adminSetRefundFeeAmount` - 设置用户退款手续费

---

## 🔗 相关链接

### 区块浏览器
- **代理地址**: [0x0897Cee05E43B2eCf331cd80f881c211eb86844E](https://mc.mcerscan.com/address/0x0897Cee05E43B2eCf331cd80f881c211eb86844E)
- **最新实现地址**: [0x7D233d2732b325e9EC47C9c8c31E074b426B53A4](https://mc.mcerscan.com/address/0x7D233d2732b325e9EC47C9c8c31E074b426B53A4)

### 部署记录文件
- `deployments/new-protocol-deployment-1767522867325.json` - 初始部署
- `deployments/upgrade-ticket-restore-1767540247137.json` - 第一次升级
- `deployments/upgrade-ticket-restore-1767541713522.json` - 第二次升级
- `deployments/upgrade-ticket-restore-1767543074884.json` - 第三次升级
- `deployments/upgrade-ticket-restore-1767544020704.json` - 第四次升级
- `deployments/upgrade-ticket-restore-1767546059288.json` - 第五次升级
- `deployments/upgrade-ticket-restore-1767546503608.json` - 第六次升级

---

## 📝 备注

1. **所有升级均为数据恢复相关**: 所有升级都是为了恢复从旧合约迁移的数据
2. **代理地址保持不变**: 所有升级都使用相同的代理地址，确保用户交互地址不变
3. **升级模式**: 使用 UUPS (Universal Upgradeable Proxy Standard) 升级模式
4. **Owner 权限**: 所有升级操作均由 Owner (`0x4C10831CBcF9884ba72051b5287b6c87E4F74A48`) 执行

---

## ✅ 当前状态

- **合约状态**: ✅ 正常运行
- **数据恢复**: ✅ 已完成
- **功能完整性**: ✅ 所有功能正常
- **升级完成**: ✅ 所有数据恢复功能已添加

---

**最后更新**: 2026-01-05 01:08:23 UTC+8


