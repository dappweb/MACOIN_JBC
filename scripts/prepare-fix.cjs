/**
 * 修复前准备脚本
 * 检查修复环境和数据状态
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 修复前环境检查...\n");

// 1. 检查PRIVATE_KEY
console.log("1️⃣ 检查PRIVATE_KEY环境变量...");
if (process.env.PRIVATE_KEY) {
    console.log("   ✅ PRIVATE_KEY已设置");
} else {
    console.log("   ❌ PRIVATE_KEY未设置");
    console.log("   📝 请设置: export PRIVATE_KEY=your_private_key");
}

// 2. 检查RPC_URL
console.log("\n2️⃣ 检查RPC_URL环境变量...");
const rpcUrl = process.env.RPC_URL || "https://chain.mcerscan.com/";
console.log(`   RPC URL: ${rpcUrl}`);

// 3. 检查数据文件
console.log("\n3️⃣ 检查数据文件...");
const reportFile = path.join(__dirname, '../output/data-consistency-report.json');
if (fs.existsSync(reportFile)) {
    console.log("   ✅ 数据一致性报告存在");
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    const logicIssues = report.details.filter(d => d.type === 'logic_error');
    console.log(`   📊 发现 ${logicIssues.length} 个逻辑错误需要修复`);
    
    if (logicIssues.length > 0) {
        console.log("\n   需要修复的用户:");
        logicIssues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue.user}`);
            console.log(`      问题: ${issue.message}`);
            console.log(`      直推: ${issue.activeDirects}, 团队: ${issue.teamCount}`);
        });
    }
} else {
    console.log("   ❌ 数据一致性报告不存在");
    console.log("   📝 请先运行: node scripts/check-data-consistency.cjs");
}

// 4. 检查备份文件
console.log("\n4️⃣ 检查备份文件...");
const backupDir = path.join(__dirname, '../output');
const backups = fs.readdirSync(backupDir).filter(f => f.includes('backup'));
if (backups.length > 0) {
    console.log(`   ✅ 找到 ${backups.length} 个备份文件`);
    backups.slice(-3).forEach(backup => {
        console.log(`      - ${backup}`);
    });
} else {
    console.log("   ⚠️  没有找到备份文件");
    console.log("   📝 建议先备份数据");
}

// 5. 总结
console.log("\n" + "=".repeat(80));
console.log("📋 修复准备状态");
console.log("=".repeat(80));

const ready = process.env.PRIVATE_KEY && fs.existsSync(reportFile);

if (ready) {
    console.log("✅ 环境准备就绪，可以开始修复");
    console.log("\n执行修复命令:");
    console.log("   node scripts/fix-team-count-simple.cjs");
} else {
    console.log("⚠️  环境未完全准备就绪");
    if (!process.env.PRIVATE_KEY) {
        console.log("   ❌ 需要设置 PRIVATE_KEY");
    }
    if (!fs.existsSync(reportFile)) {
        console.log("   ❌ 需要运行数据一致性检查");
    }
}

console.log("");
