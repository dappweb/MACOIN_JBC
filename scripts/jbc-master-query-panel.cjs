#!/usr/bin/env node
/**
 * JBC 综合查询主控面板
 * 
 * 一键运行所有核心数据导出和诊断，便于后续查询和分析
 * 
 * 使用方法:
 *   node scripts/jbc-master-query-panel.cjs                          # 交互式菜单
 *   node scripts/jbc-master-query-panel.cjs --all                    # 运行所有查询
 *   node scripts/jbc-master-query-panel.cjs --user 0x...             # 查询特定用户
 *   node scripts/jbc-master-query-panel.cjs --platform               # 仅运行平台财务数据
 *   node scripts/jbc-master-query-panel.cjs --all-users              # 导出所有用户数据
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SCRIPTS_DIR = path.join(__dirname);
const OUTPUT_DIR = path.join(__dirname, "../output/jbc-query-reports");

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const QUERIES = {
  platform: {
    name: "📊 平台财务数据",
    desc: "获取平台财务概况、用户总数、收票总额、累计收益等",
    script: "get-platform-financial-data.cjs",
    async: false,
  },
  allUsers: {
    name: "👥 所有用户数据导出",
    desc: "导出所有用户的完整数据（包含推荐关系、质押、奖励等）",
    script: "query-all-users-data.cjs",
    async: true,
  },
  userReward: {
    name: "💰 用户奖励数据",
    desc: "查询指定用户的奖励历史和明细",
    script: "get-user-reward-data.cjs",
    async: true,
    requiresArg: "user",
  },
  userFull: {
    name: "📋 用户完整档案",
    desc: "查询指定用户的所有信息（推荐人、团队、质押、余额等）",
    script: "get-user-full-data.cjs",
    async: false,
    requiresArg: "user",
  },
  teamCount: {
    name: "🎯 用户团队数据验证",
    desc: "验证所有用户的团队人数计算是否正确",
    script: "verify-all-users-team-count.cjs",
    async: true,
  },
  rewardCheck: {
    name: "✅ 奖励逻辑验证",
    desc: "验证所有用户的奖励逻辑计算",
    script: "verify-all-reward-logic.cjs",
    async: true,
  },
  contractStatus: {
    name: "🔧 合约状态检查",
    desc: "检查新旧合约的部署状态和配置",
    script: "verify-contract-addresses.cjs",
    async: false,
  },
};

function printHeader() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                  JBC 综合查询主控面板 v1.0                      ║");
  console.log("║              一键运行所有数据导出和诊断工具                      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

function printMenu() {
  console.log("📋 可用的查询和诊断工具:\n");
  
  let i = 1;
  for (const [key, query] of Object.entries(QUERIES)) {
    console.log(`  ${i}. ${query.name}`);
    console.log(`     ${query.desc}`);
    if (query.requiresArg) {
      console.log(`     ⚠️  需要参数: ${query.requiresArg}`);
    }
    console.log("");
    i++;
  }

  console.log("  0. 🚀 运行全部查询");
  console.log("  Q. 退出");
  console.log("");
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").split("T")[0] + 
         "_" + now.getHours().toString().padStart(2, "0") +
         now.getMinutes().toString().padStart(2, "0");
}

async function runQuery(queryKey, userArg = null) {
  const query = QUERIES[queryKey];
  if (!query) {
    console.error(`❌ 未知的查询: ${queryKey}`);
    return false;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`⏳ 正在执行: ${query.name}`);
  console.log(`${"=".repeat(70)}\n`);

  const scriptPath = path.join(SCRIPTS_DIR, query.script);
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ 脚本不存在: ${scriptPath}`);
    return false;
  }

  try {
    let cmd = `node "${scriptPath}"`;
    
    // 添加用户参数
    if (query.requiresArg && userArg) {
      cmd += ` "${userArg}"`;
    } else if (query.requiresArg && !userArg) {
      const user = await promptUser(`请输入 ${query.requiresArg} 地址: `);
      if (!user) {
        console.log("⚠️  取消查询");
        return false;
      }
      cmd += ` "${user}"`;
    }

    // 对于长时间运行的查询，添加超时和错误处理
    const options = {
      stdio: "inherit",
      timeout: query.async ? 300000 : 60000, // 异步查询5分钟，同步1分钟
    };

    execSync(cmd, options);
    console.log(`\n✅ ${query.name} 完成！\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ 执行失败: ${error.message}`);
    return false;
  }
}

async function runAllQueries() {
  console.log("\n🚀 开始执行所有查询...\n");
  
  const timestamp = formatTimestamp();
  const logFile = path.join(OUTPUT_DIR, `full-report-${timestamp}.log`);
  let logContent = `JBC 全面诊断报告\n生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  const queries = [
    "platform",      // 平台财务 (快速)
    "contractStatus", // 合约状态 (快速)
    "teamCount",      // 团队数据 (中等)
    "allUsers",       // 所有用户 (长)
  ];

  let completed = 0;
  let failed = 0;

  for (const queryKey of queries) {
    const query = QUERIES[queryKey];
    try {
      console.log(`\n[${completed + failed + 1}/${queries.length}] 执行: ${query.name}`);
      await runQuery(queryKey);
      completed++;
      logContent += `✅ ${query.name}\n`;
    } catch (error) {
      failed++;
      logContent += `❌ ${query.name}: ${error.message}\n`;
    }
  }

  // 保存日志
  fs.writeFileSync(logFile, logContent);
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📋 查询完成统计`);
  console.log(`${"=".repeat(70)}`);
  console.log(`✅ 成功: ${completed}/${queries.length}`);
  if (failed > 0) {
    console.log(`❌ 失败: ${failed}/${queries.length}`);
  }
  console.log(`\n📁 日志文件: ${logFile}`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);
}

async function interactiveMode() {
  printHeader();

  while (true) {
    printMenu();
    const choice = await promptUser("请选择 (1-6, 0, Q): ");

    if (choice.toUpperCase() === "Q") {
      console.log("👋 再见！\n");
      process.exit(0);
    }

    const queryKeys = Object.keys(QUERIES);
    const index = parseInt(choice) - 1;

    if (choice === "0") {
      await runAllQueries();
    } else if (index >= 0 && index < queryKeys.length) {
      await runQuery(queryKeys[index]);
    } else {
      console.log("❌ 无效的选择\n");
    }

    console.log("\n继续? (按 Enter 继续, Q 退出)");
    const cont = await promptUser("> ");
    if (cont.toUpperCase() === "Q") {
      console.log("👋 再见！\n");
      process.exit(0);
    }
  }
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.includes("--all")) {
  runAllQueries().catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
  });
} else if (args.includes("--user")) {
  const userIndex = args.indexOf("--user");
  const userAddress = args[userIndex + 1];
  if (!userAddress) {
    console.error("❌ 需要提供用户地址");
    process.exit(1);
  }
  // 首先显示完整档案，然后显示奖励数据
  runQuery("userFull", userAddress)
    .then(() => runQuery("userReward", userAddress))
    .catch((e) => {
      console.error("❌ 错误:", e);
      process.exit(1);
    });
} else if (args.includes("--platform")) {
  runQuery("platform").catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
  });
} else if (args.includes("--all-users")) {
  runQuery("allUsers").catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
  });
} else if (args.includes("--team-count")) {
  runQuery("teamCount").catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
  });
} else if (args.includes("--help")) {
  printHeader();
  console.log("使用方法:\n");
  console.log("  交互式菜单");
  console.log("    node scripts/jbc-master-query-panel.cjs\n");
  console.log("  运行所有查询");
  console.log("    node scripts/jbc-master-query-panel.cjs --all\n");
  console.log("  查询特定用户");
  console.log("    node scripts/jbc-master-query-panel.cjs --user 0x...\n");
  console.log("  仅查询平台财务");
  console.log("    node scripts/jbc-master-query-panel.cjs --platform\n");
  console.log("  导出所有用户");
  console.log("    node scripts/jbc-master-query-panel.cjs --all-users\n");
  console.log("  验证团队数据");
  console.log("    node scripts/jbc-master-query-panel.cjs --team-count\n");
} else {
  interactiveMode().catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
  });
}
