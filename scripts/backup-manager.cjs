#!/usr/bin/env node
/**
 * JBC 代码备份和回滚系统
 * 
 * 在每次代码修改前自动备份当前状态到 Git
 * 如果修改出现错误，可快速回滚到修改前的状态
 * 
 * 使用方法:
 *   node scripts/backup-manager.cjs --backup "修改说明"    # 创建备份点
 *   node scripts/backup-manager.cjs --list                # 列出所有备份点
 *   node scripts/backup-manager.cjs --restore <commit>    # 回滚到指定备份
 *   node scripts/backup-manager.cjs --undo                # 撤销最后一次修改
 *   node scripts/backup-manager.cjs --history             # 查看修改历史
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_PATH = path.join(__dirname, "..");

function runGitCommand(cmd) {
  try {
    return execSync(`cd "${REPO_PATH}" && ${cmd}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`Git 命令失败: ${error.message}`);
  }
}

function printHeader() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              JBC 代码备份和回滚系统 v1.0                        ║");
  console.log("║            自动备份所有代码修改，支持一键回滚                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

function createBackup(message) {
  console.log("📦 正在创建备份点...\n");
  
  try {
    // 获取当前分支
    const currentBranch = runGitCommand("git rev-parse --abbrev-ref HEAD").trim();
    console.log(`📍 当前分支: ${currentBranch}`);
    
    // 检查是否有未提交的修改
    const status = runGitCommand("git status --porcelain");
    if (status) {
      console.log("\n📝 检测到以下修改:");
      console.log(status);
    } else {
      console.log("\n✓ 没有未提交的修改");
      return;
    }
    
    // 添加所有修改
    runGitCommand("git add .");
    console.log("✓ 已添加所有修改");
    
    // 使用自定义标签标记备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + 
                     "_" + new Date().getHours().toString().padStart(2, "0") +
                     new Date().getMinutes().toString().padStart(2, "0") +
                     new Date().getSeconds().toString().padStart(2, "0");
    
    const backupMessage = `[BACKUP-${timestamp}] ${message || "自动备份"}`;
    
    // 提交
    runGitCommand(`git commit -m "${backupMessage}"`);
    
    // 获取 commit hash
    const commitHash = runGitCommand("git rev-parse HEAD").trim().substring(0, 8);
    
    console.log("\n✅ 备份创建成功!");
    console.log(`   备份标签: ${backupMessage}`);
    console.log(`   提交 ID: ${commitHash}`);
    console.log(`   如需回滚，使用命令:`);
    console.log(`   node scripts/backup-manager.cjs --restore ${commitHash}`);
    
  } catch (error) {
    console.error("\n❌ 创建备份失败:");
    console.error(error.message);
    process.exit(1);
  }
}

function listBackups() {
  console.log("📋 备份点列表:\n");
  
  try {
    // 列出所有包含 BACKUP 标签的提交
    const logs = runGitCommand(
      'git log --oneline --decorate --all | grep -E "BACKUP|代码修改" | head -20'
    );
    
    if (!logs) {
      console.log("⚠️  没有找到备份点\n");
      return;
    }
    
    console.log(logs);
    console.log("");
  } catch (error) {
    console.error("❌ 列出备份失败:", error.message);
  }
}

function restoreBackup(commitHash) {
  console.log(`\n⚠️  即将回滚到备份点: ${commitHash}\n`);
  
  try {
    // 检查是否有未提交的修改
    const status = runGitCommand("git status --porcelain");
    if (status) {
      console.log("⚠️  检测到未提交的修改:");
      console.log(status);
      console.log("\n❌ 请先提交或放弃这些修改\n");
      process.exit(1);
    }
    
    // 获取备份点的完整信息
    let fullHash;
    try {
      fullHash = runGitCommand(`git rev-parse ${commitHash}`).trim();
    } catch {
      console.log(`❌ 找不到备份点: ${commitHash}`);
      process.exit(1);
    }
    
    const commitMessage = runGitCommand(`git log -1 --pretty=%B ${fullHash}`).trim();
    const commitDate = runGitCommand(`git log -1 --pretty=%ci ${fullHash}`).trim();
    
    console.log("备份点信息:");
    console.log(`  提交: ${fullHash}`);
    console.log(`  时间: ${commitDate}`);
    console.log(`  说明: ${commitMessage}`);
    console.log("");
    
    // 确认回滚
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question("确认回滚? (yes/no): ", (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== "yes") {
        console.log("\n❌ 已取消回滚\n");
        return;
      }
      
      try {
        // 创建一个新的提交来记录回滚操作
        runGitCommand(`git reset --hard ${fullHash}`);
        
        console.log("\n✅ 回滚成功!");
        console.log(`   已恢复到: ${commitMessage}`);
        console.log(`   提交时间: ${commitDate}\n`);
        
      } catch (error) {
        console.error("\n❌ 回滚失败:", error.message);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error("❌ 回滚失败:", error.message);
    process.exit(1);
  }
}

function undoLastChange() {
  console.log("\n⚠️  即将撤销最后一次修改\n");
  
  try {
    // 获取最后修改的信息
    const lastCommit = runGitCommand("git log -1 --pretty=%H").trim();
    const lastMessage = runGitCommand("git log -1 --pretty=%B").trim();
    const lastDate = runGitCommand("git log -1 --pretty=%ci").trim();
    
    console.log("最后一次修改:");
    console.log(`  提交: ${lastCommit.substring(0, 8)}`);
    console.log(`  时间: ${lastDate}`);
    console.log(`  说明: ${lastMessage}`);
    console.log("");
    
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question("确认撤销? (yes/no): ", (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== "yes") {
        console.log("\n❌ 已取消撤销\n");
        return;
      }
      
      try {
        runGitCommand("git reset --hard HEAD~1");
        console.log("\n✅ 已撤销最后一次修改\n");
      } catch (error) {
        console.error("\n❌ 撤销失败:", error.message);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error("❌ 操作失败:", error.message);
    process.exit(1);
  }
}

function showHistory() {
  console.log("\n📜 修改历史:\n");
  
  try {
    const history = runGitCommand("git log --oneline --graph --decorate -20");
    console.log(history);
  } catch (error) {
    console.error("❌ 显示历史失败:", error.message);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.includes("--help")) {
  printHeader();
  console.log("📖 使用方法:\n");
  console.log("1. 创建备份（修改前）:");
  console.log("   node scripts/backup-manager.cjs --backup \"修改说明\"\n");
  console.log("2. 列出所有备份点:");
  console.log("   node scripts/backup-manager.cjs --list\n");
  console.log("3. 回滚到指定备份:");
  console.log("   node scripts/backup-manager.cjs --restore <commit-hash>\n");
  console.log("4. 撤销最后一次修改:");
  console.log("   node scripts/backup-manager.cjs --undo\n");
  console.log("5. 查看修改历史:");
  console.log("   node scripts/backup-manager.cjs --history\n");
  console.log("📌 示例:\n");
  console.log("   # 修改前创建备份");
  console.log("   node scripts/backup-manager.cjs --backup \"修改 contract 逻辑\"\n");
  console.log("   # 修改出现问题，查看备份列表");
  console.log("   node scripts/backup-manager.cjs --list\n");
  console.log("   # 回滚到某个备份点");
  console.log("   node scripts/backup-manager.cjs --restore a1b2c3d4\n");
} else if (args.includes("--backup")) {
  const msg = args[args.indexOf("--backup") + 1] || "自动备份";
  createBackup(msg);
} else if (args.includes("--list")) {
  listBackups();
} else if (args.includes("--restore")) {
  const hash = args[args.indexOf("--restore") + 1];
  if (!hash) {
    console.error("❌ 错误: 请提供提交 ID");
    console.error("使用: node scripts/backup-manager.cjs --restore <commit-hash>");
    process.exit(1);
  }
  restoreBackup(hash);
} else if (args.includes("--undo")) {
  undoLastChange();
} else if (args.includes("--history")) {
  showHistory();
} else {
  printHeader();
  console.log("⚡ 快速开始:\n");
  console.log("1️⃣  修改代码前，先创建备份:");
  console.log("   node scripts/backup-manager.cjs --backup \"修改描述\"\n");
  console.log("2️⃣  修改代码...\n");
  console.log("3️⃣  如果出现错误，查看备份列表:");
  console.log("   node scripts/backup-manager.cjs --list\n");
  console.log("4️⃣  回滚到之前的状态:");
  console.log("   node scripts/backup-manager.cjs --restore <ID>\n");
  console.log("💡 更多帮助: node scripts/backup-manager.cjs --help\n");
}
