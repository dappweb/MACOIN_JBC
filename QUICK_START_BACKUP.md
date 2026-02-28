# 代码备份系统 - 快速开始指南

## 🎯 目标

从现在开始，你修改代码时可以：
- ✅ 修改前自动备份
- ✅ 出现错误时一键回滚
- ✅ 完全不用担心代码毁坏

## ⚡ 30秒快速上手

### 第一次使用

```bash
# 1. 查看帮助
node scripts/backup-manager.cjs

# 2. 创建你的第一个备份点
node scripts/backup-manager.cjs --backup "初始备份"

# ✅ 完成！现在你有了一个安全还原点
```

### 修改代码的标准流程

```bash
# 1️⃣ 修改前：创建备份
node scripts/backup-manager.cjs --backup "修改合约逻辑"

# 2️⃣ 修改代码
# （用编辑器打开文件修改）

# 3️⃣ 测试修改
npm test

# 4️⃣ 如果出现错误：一键回滚
node scripts/backup-manager.cjs --undo

# ✅ 代码已恢复到修改前！
```

### 出现突发情况怎么办？

```bash
# 1. 查看备份列表
node scripts/backup-manager.cjs --list

# 2. 找到你要回到的状态 (假如是 a1b2c3d)
# 3. 一键回滚
node scripts/backup-manager.cjs --restore a1b2c3d

# ✅ 完成！回到之前的状态
```

---

## 📚 详细使用说明

### 方法1：使用备份管理器

**适合：** 任何代码修改

```bash
# 修改前
node scripts/backup-manager.cjs --backup "本次修改的说明"

# 修改代码...

# 修改后，如果有问题
node scripts/backup-manager.cjs --undo
```

### 方法2：使用工作流脚本（推荐）

**适合：** 较大的修改或需要指导的修改

```bash
# 启动标准工作流
node scripts/code-modify-workflow.cjs --desc "修改说明"

# 这会引导你：
# 1. 创建备份
# 2. 修改代码
# 3. 检查修改
# 4. 提交修改
```

### 方法3：快速模式

**适合：** 快速小改动

```bash
# 启动快速模式（记下当前提交ID）
node scripts/code-modify-workflow.cjs --quick

# 修改代码...

# 出现问题时，复制显示的回滚命令即可
```

---

## 🎓 常用命令速查表

| 任务 | 命令 |
|------|------|
| 创建备份 | `node scripts/backup-manager.cjs --backup "说明"` |
| 查看备份列表 | `node scripts/backup-manager.cjs --list` |
| 撤销最后修改 | `node scripts/backup-manager.cjs --undo` |
| 回滚到特定备份 | `node scripts/backup-manager.cjs --restore <ID>` |
| 查看修改历史 | `node scripts/backup-manager.cjs --history` |
| 启动工作流 | `node scripts/code-modify-workflow.cjs --desc "说明"` |

---

## 💡 最佳实践

### ✅ 应该这样做：

1. **修改前创建备份**
   ```bash
   node scripts/backup-manager.cjs --backup "修改出局逻辑"
   ```

2. **写清楚备份描述**
   ```bash
   # 好的描述
   --backup "修改 JinbaoProtocol.sol 中的 calculateCap 函数"
   
   # 
差的描述
   --backup "修改"
   ```

3. **修改一个独立功能后就备份**
   ```bash
   # 修改完成后...
   node scripts/backup-manager.cjs --backup "完成奖励计算优化"
   
   # 然后再修改下一个功能
   node scripts/backup-manager.cjs --backup "修复团队数据同步"
   ```

4. **出问题了直接回滚**
   ```bash
   node scripts/backup-manager.cjs --undo
   # 不用纠结，数据都在
   ```

### ❌ 避免这样做：

1. ❌ **修改很多功能后才备份** → 会很难分离修改
2. ❌ **不写备份描述** → 以后找不到要回的状态
3. ❌ **害怕回滚** → Git 不会丢失数据
4. ❌ **依赖备份而不测试** → 还是要测试代码

---

## 🚨 遇到问题怎么办？

### 问题1：回滚后找不到最新的修改？

**不用慌！** 修改历史仍然存在。

```bash
# 查看完整历史（包括回滚的提交）
node scripts/backup-manager.cjs --history

# 重新回到最新状态
node scripts/backup-manager.cjs --restore <latest-hash>
```

### 问题2：修改了很多文件，不知道改了什么？

```bash
# 查看所有修改
git diff

# 查看修改的文件列表
git diff --name-only

# 查看修改统计
git diff --stat
```

### 问题3：不确定是否应该保留这次修改？

```bash
# 查看这次修改的具体内容
git show

# 如果不满意就回滚
node scripts/backup-manager.cjs --undo

# 满意的话继续下一步
```

---

## 📋 工作流示例

### 示例1：修改合约参数

```bash
$ node scripts/backup-manager.cjs --backup "修改 CAP_MULTIPLIER 从 3 改为 4"
✅ 备份包装完成！

# （在编辑器中修改 contracts/Tokenomics.sol）
# 把 CAP_MULTIPLIER = 3 改为 CAP_MULTIPLIER = 4

$ npm test
# 运行测试...
# ❌ 测试失败：奖励超出预期

# 出现问题了！回滚到修改前
$ node scripts/backup-manager.cjs --undo
✅ 已回滚

# 现在 CAP_MULTIPLIER 又是 3 了
# 查看备份点，再试试其他方案
```

### 示例2：修改多个相关文件

```bash
$ node scripts/code-modify-workflow.cjs --desc "重构奖励系统"
# 工作流会引导你：
# 1. 创建备份 ✓
# 2. 修改 contracts/Tokenomics.sol
# 3. 修改 components/RevenueCalculator.tsx
# 4. 修改 config/production.ts
# 5. 测试整个流程
# 6. 提交修改

$ npm test
# ✅ 所有测试通过

# 完美！这次修改已保存
# 可以继续下一个修改
```

---

## 🎯 推荐阅读

更详细的说明请查看：
- 📖 **CODE_BACKUP_GUIDE.md** - 完整的备份指南
- 📖 **JBC_QUERY_SYSTEM_GUIDE.md** - 数据查询系统指南

---

## 🆘 快速帮助

不确定某个命令的用途？

```bash
# 查看所有命令的具体帮助
node scripts/backup-manager.cjs --help
node scripts/code-modify-workflow.cjs --help

# 查看完整的 Git 历史
git log --oneline -20
```

---

## 📞 常见问题（FAQ）

**Q: 备份会占用很多空间吗？**
A: 不会。Git 只保存修改的差异，不会重复存储整个代码。

**Q: 可以回滚多次吗？**
A: 完全可以。Git 保留整个历史，你可以随意前进和后退。

**Q: 如果我回滚后又继续修改，会不会冲突？**
A: 不会。只要你不在两个分支上，Git 会自动处理。

**Q: 备份的备份是什么意思？**
A: 你的本地 Git 已经是本地备份了。远程 GitHub 上的版本是额外的云备份。

**Q: 多久应该创建一次备份？**
A: 建议每个独立功能完成后创建一次。不用太频繁，也不要堆积太多修改。

---

## ✨ 总结

从现在开始：

1. **修改代码前** → `node scripts/backup-manager.cjs --backup "说明"`
2. **修改代码** → 用编辑器修改文件
3. **出现问题** → `node scripts/backup-manager.cjs --undo` 立即恢复
4. **修改完成** → 继续下一个任务

**就这么简单！你的代码安全了！** 🛡️

---

**创建时间：2026-02-28**
**系统版本：1.0**
