# 代码备份和回滚系统使用指南

## 📌 系统概述

已为你创建了一个 **自动备份和回滚系统**，基于 Git 版本控制。这样：
- ✅ 每次修改前都可以创建备份点
- ✅ 修改出错后可以一键回滚
- ✅ 完整保留所有修改历史
- ✅ 支持多次往返切换

## 🚀 快速使用流程

### 场景1：修改代码前备份

```bash
# 第一步：创建备份点（描述为什么修改）
node scripts/backup-manager.cjs --backup "修改出局规则逻辑"

# 第二步：修改代码...
# （用编辑器修改文件）

# 第三步：如果出现问题，查看备份点
node scripts/backup-manager.cjs --list

# 第四步：回滚到之前的状态
node scripts/backup-manager.cjs --restore a1b2c3d

# ✅ 代码已恢复到修改前的状态
```

### 场景2：快速撤销最后一次修改

```bash
# 直接撤销最后一次修改
node scripts/backup-manager.cjs --undo

# ✅ 回到上一次修改前的状态
```

### 场景3：查看完整修改历史

```bash
# 查看所有修改记录
node scripts/backup-manager.cjs --history
```

## 📋 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `--backup "描述"` | 创建备份点 | `node scripts/backup-manager.cjs --backup "修改合约"` |
| `--list` | 列出所有备份 | `node scripts/backup-manager.cjs --list` |
| `--restore <ID>` | 回滚到指定备份 | `node scripts/backup-manager.cjs --restore a1b2c3` |
| `--undo` | 撤销最后一次修改 | `node scripts/backup-manager.cjs --undo` |
| `--history` | 查看修改历史 | `node scripts/backup-manager.cjs --history` |
| `--help` | 显示帮助信息 | `node scripts/backup-manager.cjs --help` |

## 💡 工作流程建议

### 方式A：保守型（推荐用于重要修改）

适合修改合约、配置文件等重要代码：

```bash
# 1. 创建备份
node scripts/backup-manager.cjs --backup "修改 JinbaoProtocol 合约"

# 2. 修改代码
# ... 编辑文件 ...

# 3. 测试修改
npm test

# 4. 如果测试失败，回滚
node scripts/backup-manager.cjs --undo

# 5. 如果测试通过，继续下一个修改
# （备份点已自动保存）
```

### 方式B：灵活型（用于小改动）

适合修改配置、文档等不影响逻辑的内容：

```bash
# 1. 快速修改代码
# ... 编辑文件 ...

# 2. 如果有问题，快速回滚
node scripts/backup-manager.cjs --undo

# 3. 重新修改并继续
```

### 方式C：批量修改（用于多个相关文件）

适合一次修改多个相关的文件：

```bash
# 1. 创建备份点（说明所有要修改的内容）
node scripts/backup-manager.cjs --backup "重构奖励逻辑和前端显示"

# 2. 修改多个文件
# ... 修改 Tokenomics.sol ...
# ... 修改 StatsPanel.tsx ...
# ... 修改配置文件 ...

# 3. 测试整体功能
npm test

# 4. 如果功能正常，完成
# （所有文件修改都在一个备份点内）

# 5. 如果有问题，可以一键回滚所有文件
node scripts/backup-manager.cjs --undo
```

## 📊 常见场景应对

### 场景1：修改出现错误

```bash
# 1. 查看备份列表
node scripts/backup-manager.cjs --list

# 2. 找到你要回滚的备份点（记住提交ID）
# 例如: a1b2c3d

# 3. 执行回滚
node scripts/backup-manager.cjs --restore a1b2c3d

# ✅ 代码已恢复
```

### 场景2：忘记备份了

```bash
# 1. 直接查看修改历史
node scripts/backup-manager.cjs --history

# 2. 找到你要回到的时间点
# （即使没有明确的备份标签，也能找到）

# 3. 回滚到该时间点
node scripts/backup-manager.cjs --restore <commit-hash>
```

### 场景3：想撤销多次修改

```bash
# 方法1：直接回滚到某个备份点
node scripts/backup-manager.cjs --restore <old-commit>

# 方法2：多次执行 undo
node scripts/backup-manager.cjs --undo  # 撤销最后一次
node scripts/backup-manager.cjs --undo  # 再撤销倒数第二次
node scripts/backup-manager.cjs --undo  # 继续撤销...
```

### 场景4：需要对比修改内容

```bash
# 查看修改历史
node scripts/backup-manager.cjs --history

# 会显示每次提交的改动，可以看到具体修改了什么
```

## ⚠️ 重要注意事项

### 1️⃣ 备份点的作用范围
- ✅ 可以回滚代码文件的修改
- ✅ 可以回滚配置文件的修改
- ✅ 可以回滚任何版本控制内的文件
- ❌ **不能**回滚数据库的修改（只有链上数据）
- ❌ **不能**回滚已部署合约的状态（链上不可逆）

### 2️⃣ 回滚是安全的吗？

**是的！** 因为：
- 所有修改都保存在 Git 历史中
- 即使回滚后，也能重新前进到最新改动
- Git 会自动检测冲突，保护你的数据

### 3️⃣ 如何恢复一个回滚后丢失的修改？

```bash
# 即使你回滚了，修改历史仍然存在
# 查看完整历史（包括回滚的提交）
git reflog

# 重新回到最新的状态
node scripts/backup-manager.cjs --restore <latest-commit>
```

### 4️⃣ 最佳实践

✅ **推荐做法**：
- 修改前总是先创建备份
- 为每个备份写上清晰的描述
- 大改动前备份，小改动后备份
- 定期提交备份（不要堆积太多修改）

❌ **避免做法**：
- 修改很多代码后才备份
- 备份描述太笼统（"修改代码"）
- 无限制地创建备份而不清理
- 依赖备份而不测试代码

## 🔗 与 Git 的关系

这个备份系统使用 Git 作为后端，所以：

```bash
# 你也可以直接使用 Git 命令
git log --oneline        # 查看历史
git show <commit>        # 查看某个提交的内容
git diff <commit1> <commit2>  # 对比两个提交

# 但建议使用备份管理器的快速命令
node scripts/backup-manager.cjs --list
node scripts/backup-manager.cjs --restore <ID>
```

## 📞 故障排除

### 问题1：Git 命令出错

```bash
# 检查 Git 是否正常工作
cd /Users/apple/Documents/GitHub/MACOIN_JBC
git status

# 如果出现问题，检查 .git 文件夹是否存在
ls -la .git
```

### 问题2：无法创建备份

```bash
# 检查是否有未提交的修改
git status

# 或者查看 backup-manager 脚本的详细错误
node scripts/backup-manager.cjs --backup "test" 2>&1
```

### 问题3：回滚后文件不对

```bash
# 查看当前状态
git status

# 检查最后修改的文件
git log -1 --stat
```

## 📝 示例操作记录

### 修改场景：优化奖励计算

```bash
# 1️⃣ 修改前备份
$ node scripts/backup-manager.cjs --backup "优化RewardLib奖励计算"
✅ 备份创建成功!
   备份标签: [BACKUP-2026-02-28_105432] 优化RewardLib奖励计算
   提交 ID: a1b2c3d4

# 2️⃣ 修改代码
# （编辑 contracts/Tokenomics.sol）
# （编辑 hooks/useRewardCalculation.ts）

# 3️⃣ 测试修改
$ npm test
# ❌ 测试失败：奖励计算有bug

# 4️⃣ 查看备份列表
$ node scripts/backup-manager.cjs --list
a1b2c3d4 [BACKUP-2026-02-28_105432] 优化RewardLib奖励计算
b2c3d4e5 [BACKUP-2026-02-28_100000] 修改流动性要求

# 5️⃣ 回滚到修改前
$ node scripts/backup-manager.cjs --restore a1b2c3d
✅ 已恢复到: [BACKUP-2026-02-28_105432] 优化RewardLib奖励计算

# 6️⃣ 重新修改（修复bug）
# （再次编辑文件）

# 7️⃣ 再次测试
$ npm test
# ✅ 测试通过

# ✓ 完成！
```

---

**记住**：这个系统的目的是让你修改代码时 **没有后顾之忧**。出现问题直接回滚，不用担心损坏代码！

**创建时间**：2026-02-28
