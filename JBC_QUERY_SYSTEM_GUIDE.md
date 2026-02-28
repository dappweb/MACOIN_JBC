# JBC 综合查询系统 - 快速使用指南

## 📊 系统概述

已为你创建了一个 **JBC 综合查询主控面板**，集成了所有重要的数据导出和诊断工具，方便快速查询和分析。

## 🚀 快速开始

### 方式一：交互式菜单（推荐）
```bash
node scripts/jbc-master-query-panel.cjs
```
会显示交互菜单，你可以选择要运行的查询。

### 方式二：一键查询特定用户
```bash
# 查询地址 0xE3B5EF7F753371eDFfb91b804181b26b86397BEd 的完整信息
node scripts/jbc-master-query-panel.cjs --user 0xE3B5EF7F753371eDFfb91b804181b26b86397BEd
```

### 方式三：快速平台财务数据
```bash
node scripts/jbc-master-query-panel.cjs --platform
```
输出：
- 总用户数：671
- 已售出门票总额：331,900 MC
- 平台总累计收益：95,060.9 MC
- 平台剩余可用额度：290,139 MC
- 收票额度使用率：24.67%

### 方式四：一键运行全部查询
```bash
node scripts/jbc-master-query-panel.cjs --all
```
依次运行：
1. 平台财务数据
2. 合约状态检查
3. 团队数据验证
4. 所有用户数据导出

### 方式五：导出所有用户数据
```bash
node scripts/jbc-master-query-panel.cjs --all-users
```

## 📋 可用的查询工具

| 工具 | 命令 | 用途 | 耗时 |
|------|------|------|------|
| 平台财务 | `--platform` | 获取平台整体财务概况 | 🟢 快速 |
| 查询用户 | `--user 0x...` | 查询特定用户的完整信息 | 🟢 快速 |
| 所有用户 | `--all-users` | 导出所有用户数据（CSV） | 🟡 中等 |
| 团队验证 | `--team-count` | 验证所有用户团队数据 | 🔴 较慢 |
| 全部查询 | `--all` | 运行所有查询 | 🔴 很慢 |

## 💡 关键数据解读

### 当前平台状态 (2026-02-28)
- **总用户数**：671
- **活跃用户**：605（90.2%）
- **已售出门票总额**：331,900 MC
- **平台总收益**：95,060.9 MC（28.6% 兑现率）
- **可能盈利额**：236,839.1 MC（未来可挖掘的收益潜力）

### 出局规则说明
- **三倍出局**：购票金额 × 3 = 出局上限（currentCap）
- 示例：购 500 MC → 出局上限 1,500 MC
- 当用户 totalRevenue ≥ currentCap 时，用户出局

## 📁 输出文件位置

所有查询结果默认保存到：
```
/Users/apple/Documents/GitHub/MACOIN_JBC/output/
```

包括：
- JSON 格式数据（用于程序处理）
- CSV 格式数据（用于 Excel 分析）
- 日志文件（用于追踪执行）

## 🔍 最常用的查询场景

### 场景1：排查用户问题
```bash
node scripts/jbc-master-query-panel.cjs --user 0xE3B5EF7F753371eDFfb91b804181b26b86397BEd
```
会显示：
- ✅ 用户基本信息（推荐人、团队、级别）
- ✅ 钱包余额（MC、JBC）
- ✅ 门票信息（购票额、时间、状态）
- ✅ 质押数据（质押额、周期、收益）
- ✅ 联络历史（推荐人奖励、直推奖励等）
- ✅ 出局状态（总收益 vs 出局上限）

### 场景2：审计平台财务
```bash
node scripts/jbc-master-query-panel.cjs --platform
```
检查：
- 用户总数增长
- 门票销售额
- 平台实际收益
- 额度使用情况

### 场景3：验证数据一致性
```bash
node scripts/jbc-master-query-panel.cjs --team-count
```
验证：
- 所有用户的 teamCount 计算
- 推荐关系的完整性
- 数据一致性

## ⚙️ 环境变量配置（可选）

在 `.env` 文件中设置：
```bash
MC_RPC_URL=https://chain.mcerscan.com/
PROTOCOL_ADDRESS=0x0897Cee05E43B2eCf331cd80f881c211eb86844E
JBC_TOKEN_ADDRESS=0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D
MC_USD=0.5  # MC 转 USD 汇率
```

## 🆘 常见问题

**Q: 查询很慢，如何加速？**
A: 使用 `--platform` 快速查看平台数据，避免运行 `--all-users` 和 `--team-count`

**Q: 数据文件在哪？**
A: 所有输出文件在 `output/` 目录下，支持 JSON、CSV 两种格式

**Q: 如何导出数据用 Excel 分析？**
A: 查询后的 CSV 文件可直接在 Excel 中打开

**Q: 查询时出现错误怎么办？**
A: 检查网络连接和环保变量设置，确保 RPC 端点可用

## 📞 支持的查询脚本清单

已集成的底层脚本（超过 30+ 个）：
- `get-platform-financial-data.cjs` - 平台财务数据
- `query-all-users-data.cjs` - 所有用户数据导出
- `get-user-full-data.cjs` - 单个用户完整档案
- `get-user-reward-data.cjs` - 用户奖励历史
- `verify-all-users-team-count.cjs` - 团队数据验证
- `verify-all-reward-logic.cjs` - 奖励逻辑验证
- `verify-contract-addresses.cjs` - 合约状态检查
- 以及其他 200+ 个诊断和修复脚本...

## 🎯 建议的日常使用流程

1. **每日早会**：运行 `--platform` 查看昨日数据
2. **用户反馈处理**：运行 `--user 地址` 排查问题
3. **周期审计**：运行 `--all` 进行完整检查
4. **数据备份**：定期导出 CSV 文件存档

---

**更新时间**：2026-02-28
**支持的脚本数**：200+ 个诊断和工具脚本
**输出目录**：`/output/jbc-query-reports/`
