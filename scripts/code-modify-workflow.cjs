#!/usr/bin/env node
/**
 * 代码修改工作流工具
 * 
 * 一键启动代码修改流程：
 * 1. 自动创建备份点
 * 2. 打开编辑器
 * 3. 修改完成后，自动提交和检查
 * 
 * 使用方法:
 *   node scripts/code-modify-workflow.cjs --desc "修改说明"
 *   node scripts/code-modify-workflow.cjs --quick          # 快速流程
 *   node scripts/code-modify-workflow.cjs --test           # 修改后自动测试
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const REPO_PATH = path.join(__dirname, "..");

function runCommand(cmd, options = {}) {
  try {
    return execSync(`cd "${REPO_PATH}" && ${cmd}`, {
      encoding: "utf-8",
      stdio: options.stdio || ["pipe", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error;
    }
    return error.stdout || "";
  }
}

function printHeader(title) {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log(`║  ${title.padEnd(62)}║`);
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function standardWorkflow(description) {
  printHeader("📝 代码修改工作流 - 标准模式");
  
  console.log("✓ 工作流步骤:");
  console.log("  1️⃣  创建备份点");
  console.log("  2️⃣  列出待修改的文件");
  console.log("  3️⃣  打开编辑器（可选）");
  console.log("  4️⃣  修改代码");
  console.log("  5️⃣  提交修改");
  console.log("  6️⃣  生成修改报告");
  console.log("\n");
  
  try {
    // 第一步：创建备份点
    console.log("📦 步骤1: 创建备份点\n");
    
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0] + "_" + 
      new Date().getHours().toString().padStart(2, "0") +
      new Date().getMinutes().toString().padStart(2, "0");
    
    const backupMsg = `[WORKFLOW-${timestamp}] ${description || "代码修改"}`;
    
    // 检查是否有未提交的修改
    const status = runCommand("git status --porcelain", { throwOnError: false });
    if (status) {
      console.log("⚠️  检测到以下未提交的修改:");
      console.log(status);
      
      const shouldCommit = await askQuestion("\n是否提交这些修改? (yes/no): ");
      if (shouldCommit.toLowerCase() === "yes") {
        runCommand("git add .");
        runCommand(`git commit -m "未提交的修改: ${description}"`);
        console.log("✅ 已提交之前的修改\n");
      }
    }
    
    // 创建工作流备份点
    runCommand("git add . 2>/dev/null || true");
    const result = runCommand(
      `git commit -m "${backupMsg}" 2>&1 || true`,
      { throwOnError: false }
    );
    
    if (result.includes("nothing to commit")) {
      console.log("✓ 当前无修改，跳过备份");
    } else {
      const commitHash = runCommand("git rev-parse HEAD").trim().substring(0, 8);
      console.log(`✅ 备份点已创建: ${commitHash}`);
      console.log(`   说明: ${description || "代码修改"}`);
    }
    console.log("");
    
    // 第二步：显示可修改的文件
    console.log("📋 步骤2: 可修改的文件类型\n");
    console.log("  • 合约文件: contracts/*.sol");
    console.log("  • 前端组件: components/*.tsx");
    console.log("  • Hooks: hooks/*.ts");
    console.log("  • 类库: utils/*.ts");
    console.log("  • 配置文件: config/*.ts");
    console.log("  • 脚本文件: scripts/*.cjs\n");
    
    // 第三步：提示用户开始修改
    console.log("✏️  步骤3: 开始修改代码\n");
    console.log("打开你的编辑器，修改相关文件:");
    console.log("  • VS Code: code .");
    console.log("  • 其他编辑器: 手动打开文件\n");
    
    await askQuestion("修改完成后按 Enter 继续...");
    console.log("");
    
    // 第四步：检查修改
    console.log("🔍 步骤4: 检查修改内容\n");
    const changes = runCommand("git diff --stat", { throwOnError: false });
    
    if (!changes || changes.includes("0 files changed")) {
      console.log("⚠️  没有检测到修改\n");
      const confirm = await askQuestion("继续? (yes/no): ");
      if (confirm.toLowerCase() !== "yes") {
        console.log("❌ 已取消\n");
        return;
      }
    } else {
      console.log(changes);
    }
    console.log("");
    
    // 第五步：提交修改
    console.log("💾 步骤5: 提交修改\n");
    
    const details = await askQuestion("请输入修改内容详细说明: ");
    
    if (details) {
      runCommand("git add .", { stdio: "inherit" });
      runCommand(`git commit -m "修改: ${details}" -m "工作流时间: $(date)"`, {
        stdio: "inherit",
      });
      console.log("\n✅ 修改已保存\n");
    } else {
      console.log("⚠️  已跳过提交\n");
    }
    
    // 第六步：生成修改报告
    printHeader("📊 修改工作流完成");
    
    const lastCommit = runCommand("git log -1 --pretty=%H").trim();
    const lastMsg = runCommand("git log -1 --pretty=%B").trim();
    const lastDate = runCommand("git log -1 --pretty=%ci").trim();
    
    console.log("✅ 修改成功!");
    console.log("\n修改信息:");
    console.log(`  提交ID: ${lastCommit.substring(0, 8)}`);
    console.log(`  说明: ${lastMsg}`);
    console.log(`  时间: ${lastDate}`);
    
    console.log("\n💡 后续操作:");
    console.log("  • 测试代码: npm test");
    console.log("  • 查看修改: git show");
    console.log("  • 回滚修改: node scripts/backup-manager.cjs --undo");
    console.log("  • 部署代码: npm run deploy\n");
    
  } catch (error) {
    console.error("\n❌ 工作流出错:", error.message);
    console.error("\n💡 快速恢复步骤:");
    console.error("  1. 保存你的修改");
    console.error("  2. 运行: node scripts/backup-manager.cjs --undo");
    console.error("  3. 重试修改\n");
  }
}

async function quickWorkflow(description) {
  printHeader("⚡ 代码修改工作流 - 快速模式");
  
  console.log("⚡ 快速流程（跳过备份和提交）:\n");
  
  try {
    const commitHash = runCommand("git rev-parse HEAD").trim().substring(0, 8);
    console.log(`✓ 当前状态已记录: ${commitHash}`);
    
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    
    console.log(`\n💡 记住这个ID，修改出错时可以用来回滚:`);
    console.log(`   node scripts/backup-manager.cjs --restore ${commitHash}`);
    
    console.log(`\n📝 现在可以安心修改代码了！`);
    console.log(`   修改完成后，如果出现错误:`);
    console.log(`   • 运行上面的回滚命令恢复代码`);
    console.log(`\n按 Enter 启动编辑器...`);
    
    await askQuestion("");
    
    // 尝试打开 VS Code
    try {
      execSync("code .", { cwd: REPO_PATH, stdio: "inherit" });
    } catch {
      console.log("✓ 请在编辑器中修改文件");
    }
    
    await askQuestion("修改完成后按 Enter...");
    
    const changes = runCommand("git diff --stat", { throwOnError: false });
    if (changes && !changes.includes("0 files changed")) {
      console.log("\n✅ 检测到修改:");
      console.log(changes);
    } else {
      console.log("\n✓ 无新修改");
    }
    
  } catch (error) {
    console.error("❌ 出错:", error.message);
  }
}

// 主程序
const args = process.argv.slice(2);

if (args.includes("--help")) {
  printHeader("📖 代码修改工作流帮助");
  
  console.log("用法:\n");
  console.log("1. 标准工作流（推荐）:");
  console.log("   node scripts/code-modify-workflow.cjs --desc \"修改说明\"\n");
  
  console.log("2. 快速工作流:");
  console.log("   node scripts/code-modify-workflow.cjs --quick\n");
  
  console.log("3. 显示帮助:");
  console.log("   node scripts/code-modify-workflow.cjs --help\n");
  
  console.log("示例:\n");
  console.log("   node scripts/code-modify-workflow.cjs --desc \"优化奖励计算逻辑\"\n");
  
} else if (args.includes("--quick")) {
  quickWorkflow("快速修改").catch(console.error);
  
} else {
  const descIndex = args.indexOf("--desc");
  const description = descIndex >= 0 ? args[descIndex + 1] : "代码修改";
  
  standardWorkflow(description).catch(console.error);
}
