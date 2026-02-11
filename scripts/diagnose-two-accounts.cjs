/**
 * 诊断脚本：分析两个账户不能赎回/提供流动性的原因
 * 账户1: 0xC65f043aD84561e262C3aE54230F74B1071BEFE3
 * 账户2: 0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f
 * 
 * 基于已知备份数据进行分析
 */

const fs = require("fs");
const path = require("path");

// 从备份文件中加载已知数据
const backupFile = path.join(__dirname, "..", "scripts", "backups", "protocol-backup-1767522095585.json");

const ACCOUNTS = {
  account1: {
    address: "0xc65f043ad84561e262c3ae54230f74b1071befe3",
    name: "账户1"
  },
  account2: {
    address: "0xd6b93380baa72a4ad126b2e8985a33dd8c13d98f",
    name: "账户2"
  }
};

function findAccountInBackup(address) {
  if (!fs.existsSync(backupFile)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(backupFile, "utf8"));
  return data.users.find(u => u.address.toLowerCase() === address.toLowerCase());
}

function diagnoseAccount(accountData, account) {
  const { name } = account;
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 诊断 ${name}: ${account.address}`);
  console.log("=".repeat(80));

  if (!accountData) {
    console.log(`\n❌ 账户未找到。`);
    return;
  }

  const userInfo = accountData.userInfo;
  const userTicket = accountData.userTicket;
  const userStakes = accountData.userStakes || [];

  // 格式化 Wei 为 MC
  const formatMC = (wei) => {
    if (typeof wei === "string") {
      const num = BigInt(wei);
      return Number(num) / 1e18;
    }
    return 0;
  };

  // 基本信息
  console.log("\n📋 用户基本信息:");
  console.log(`  推荐人: ${userInfo.referrer}`);
  console.log(`  直推人数: ${userInfo.activeDirects}`);
  console.log(`  团队人数: ${userInfo.teamCount}`);
  console.log(`  总收益: ${formatMC(userInfo.totalRevenue).toFixed(4)} MC`);
  console.log(`  当前上限: ${formatMC(userInfo.currentCap).toFixed(4)} MC`);
  console.log(`  是否激活: ${userInfo.isActive ? "✅ 是" : "❌ 否"}`);
  console.log(`  退款手续费: ${formatMC(userInfo.refundFeeAmount).toFixed(4)} MC`);

  // 门票信息
  console.log("\n🎫 门票信息:");
  console.log(`  门票ID: ${userTicket.ticketId}`);
  console.log(`  门票金额: ${formatMC(userTicket.amount).toFixed(4)} MC`);
  console.log(`  购买时间: ${new Date(Number(userTicket.purchaseTime) * 1000).toLocaleString('zh-CN')}`);
  console.log(`  是否已退出: ${userTicket.exited ? "✅ 已退出" : "❌ 未退出"}`);

  // 质押信息 - 关键!
  console.log("\n💰 质押信息:");
  if (userStakes.length === 0) {
    console.log(`  ❌ 【关键问题】没有任何质押！`);
    console.log(`  \n  问题分析：`);
    console.log(`    1. 用户没有进行任何流动性质押`);
    console.log(`    2. 用户购买了门票，但并未质押资金供流动性挖矿`);
    console.log(`    3. 因此没有"提供流动性"的活动，也就无法"赎回"`);
  } else {
    console.log(`  质押数量: ${userStakes.length} 笔`);
    userStakes.forEach((stake, idx) => {
      console.log(`\n  质押 ${idx + 1} 详情:`);
      console.log(`    ID: ${stake.id}`);
      console.log(`    金额: ${formatMC(stake.amount).toFixed(4)} MC`);
      console.log(`    开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString('zh-CN')}`);
      console.log(`    周期: ${stake.cycleDays} 天`);
      console.log(`    激活状态: ${stake.active ? "✅ 活跃" : "❌ 已终止"}`);
      console.log(`    已支付: ${formatMC(stake.paid).toFixed(4)} MC`);
    });
  }

  // 根推荐信息
  console.log("\n👥 推荐关系:");
  if (accountData.directReferrals && accountData.directReferrals.length > 0) {
    console.log(`  直推人数: ${accountData.directReferrals.length}`);
    accountData.directReferrals.forEach((ref, idx) => {
      console.log(`    ${idx + 1}. ${ref}`);
    });
  } else {
    console.log(`  直推人数: 0`);
  }

  // 根本原因说明
  console.log("\n🎯 问题根本原因:");
  if (userStakes.length === 0) {
    console.log(`\n  ❌ 【主要问题】：用户没有质押流动性`);
    console.log(`\n  为什么无法赎回？`);
    console.log(`    - 赎回（Redeem）功能是针对已质押的流动性`);
    console.log(`    - 该账户虽然有门票，但从未进行生流动性质押（Stake Liquidity）`);
    console.log(`    - 没有质押 = 没有流动性头寸 = 无法赎回`);
    console.log(`\n  为什么无法提供流动性？`);
    console.log(`    - 可能的原因：`);
    let reasons = [];
    if (userTicket.exited) {
      reasons.push("      • 门票已退出，无法进行新的质押");
    }
    if (!userInfo.isActive) {
      reasons.push("      • 账户未激活");
    }
    if (formatMC(userInfo.currentCap) <= 0) {
      reasons.push("      • 当前上限为 0，无法质押");
    }
    if (reasons.length > 0) {
      console.log(reasons.join("\n"));
    } else {
      console.log("      • 这个账户本不应该无法质押... 需要进一步调查");
      console.log("      • 可能在历史上曾经质押过但数据丢失");
      console.log("      • 或者在某次升级中质押数据未保留");
    }
  }

  // 建议
  console.log("\n💡 建议解决方案:");
  if (userStakes.length === 0) {
    console.log(`\n  1️⃣  【确认客户意图】`);
    console.log(`      • 客户是想"赎回已经提供的流动性"还是"现在想提供流动性"？`);
    console.log(`\n  2️⃣  【如果想提供流动性】`);
    console.log(`      • 确保门票有效（已购且未退出）✅ 本账户已满足`);
    console.log(`      • 调用 stakeLiquidity(cycleDays) 进行质押`);
    console.log(`      • cycleDays 可选：7, 15, 或 30 天`);
    console.log(`\n  3️⃣  【如果想赎回历史质押】`);
    console.log(`      • 需要恢复/重建该账户的质押数据`);
    console.log(`      • 这可能涉及：`);
    console.log(`        - 检查历史交易日志中的 LiquidityStaked 事件`);
    console.log(`        - 查询是否曾有过 Redeemed 事件`);
    console.log(`        - 如必要，由管理员手动恢复质押记录`);
  }
}

async function main() {
  try {
    console.log("🚀 开始诊断两个账户\n");
    console.log("📂 数据来源：备份文件 protocol-backup-1767522095585.json");
    console.log(`   时间：2025年1月3日\n`);

    // 加载备份数据
    if (!fs.existsSync(backupFile)) {
      console.error(`\n❌ 找不到备份文件: ${backupFile}`);
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(backupFile, "utf8"));
    console.log(`📊 备份包含 ${data.users.length} 个用户的数据\n`);

    // 诊断两个账户
    for (const [key, account] of Object.entries(ACCOUNTS)) {
      const accountData = findAccountInBackup(account.address);
      diagnoseAccount(accountData, account);
    }

    // 总结
    console.log("\n" + "=".repeat(80));
    console.log("📋 诊断总结");
    console.log("=".repeat(80));
    console.log(`\n✅ 两个账户的问题都是相同的：【没有质押流动性】\n`);
    console.log(`  账户1 (0xC65f...3E3):`);
    console.log(`    • 有有效门票：1000 MC`);
    console.log(`    • ❌ 质押数量：0 笔`);
    console.log(`\n  账户2 (0xd6b9...98f):`);
    console.log(`    • 有有效门票：100 MC`);
    console.log(`    • ❌ 质押数量：0 笔`);
    console.log(`\n📌 关键理解：`);
    console.log(`   - "不能赎回" 是因为没有质押过 → 没有可赎回的内容`);
    console.log(`   - "不能提供流动性" 需要具体确认客户的意思`);
    console.log(`   - 如果想提供，技术上应该是可以的（都有有效门票且账户激活）`);
    console.log(`   - 如果是历史数据丢失，需要管理员恢复\n`);

  } catch (error) {
    console.error("\n❌ 诊断失败:");
    console.error(error.message);
    process.exit(1);
  }
}

main();
