#!/usr/bin/env node
/**
 * JBC 平台用户收益统计系统
 * 
 * 统计所有用户的收益综合数据，包括：
 * - 用户总收益统计
 * - 按等级分类的收益
 * - 按状态分类的收益
 * - 收益分布和排名
 * - 预期可收益分析
 * 
 * 使用方法:
 *   node scripts/user-revenue-statistics.cjs              # 完整统计
 *   node scripts/user-revenue-statistics.cjs --simple     # 简明统计
 *   node scripts/user-revenue-statistics.cjs --export     # 导出CSV
 *   node scripts/user-revenue-statistics.cjs --top 10     # 显示Top 10用户
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function getAllUsers(protocol, provider) {
  try {
    console.log("📊 查询所有注册用户...");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    
    const boundEvents = await protocol.queryFilter(
      protocol.filters.BoundReferrer(),
      fromBlock,
      "latest"
    );
    
    const ticketEvents = await protocol.queryFilter(
      protocol.filters.TicketPurchased(),
      fromBlock,
      "latest"
    );
    
    const users = new Set();
    boundEvents.forEach((e) => users.add(e.args.user));
    ticketEvents.forEach((e) => users.add(e.args.user));
    
    console.log(`✓ 找到 ${users.size} 个唯一用户\n`);
    return Array.from(users);
  } catch (error) {
    console.error("❌ 查询用户失败:", error.message);
    return [];
  }
}

async function getUserRevenueData(protocol, userAddress) {
  try {
    const userInfo = await protocol.userInfo(userAddress);
    const ticket = await protocol.userTicket(userAddress);
    
    let level = 0;
    try {
      const levelInfo = await protocol.getUserLevel(userAddress);
      level = Number(levelInfo.level);
    } catch {
      // 级别查询失败，默认为0
    }
    
    return {
      address: userAddress,
      totalRevenue: BigInt(userInfo.totalRevenue),
      currentCap: BigInt(userInfo.currentCap),
      isActive: userInfo.isActive,
      teamCount: Number(userInfo.teamCount),
      ticketAmount: BigInt(ticket.amount),
      level: level,
      remainingCap: BigInt(userInfo.currentCap) - BigInt(userInfo.totalRevenue),
      completionPercent: Number(userInfo.currentCap) > 0 
        ? (Number(userInfo.totalRevenue) / Number(userInfo.currentCap) * 100).toFixed(2)
        : 0,
    };
  } catch (error) {
    return null;
  }
}

function formatEther(value) {
  if (typeof value === "bigint") {
    return parseFloat(ethers.formatEther(value)).toFixed(2);
  }
  return parseFloat(ethers.formatEther(BigInt(value))).toFixed(2);
}

function printHeader(title) {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log(`║  ${title.padEnd(62)}║`);
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\n");
}

async function main() {
  const args = process.argv.slice(2);
  
  printHeader("📊 JBC 平台用户收益统计系统");
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取所有用户
    const users = await getAllUsers(protocol, provider);
    
    if (users.length === 0) {
      console.log("❌ 未找到用户\n");
      return;
    }
    
    // 收集所有用户的收益数据
    console.log("💾 收集所有用户的收益数据...\n");
    
    let processedCount = 0;
    const revenueData = [];
    
    for (const user of users) {
      const data = await getUserRevenueData(protocol, user);
      if (data) {
        revenueData.push(data);
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`📋 进度: ${processedCount}/${users.length} (${(processedCount/users.length*100).toFixed(1)}%)`);
      }
    }
    
    console.log(`\n✅ 处理完成: ${revenueData.length} 个用户\n`);
    
    // 计算统计数据
    const stats = {
      totalUsers: revenueData.length,
      activeUsers: revenueData.filter((d) => d.isActive).length,
      inactiveUsers: revenueData.filter((d) => !d.isActive).length,
      
      totalRevenue: revenueData.reduce((sum, d) => sum + d.totalRevenue, 0n),
      totalCap: revenueData.reduce((sum, d) => sum + d.currentCap, 0n),
      totalRemaining: revenueData.reduce((sum, d) => sum + d.remainingCap, 0n),
      
      maxRevenue: revenueData.reduce((max, d) => d.totalRevenue > max ? d.totalRevenue : max, 0n),
      minRevenue: revenueData.filter((d) => d.totalRevenue > 0n).length > 0
        ? revenueData.filter((d) => d.totalRevenue > 0n).reduce((min, d) => d.totalRevenue < min ? d.totalRevenue : min, revenueData[0].totalRevenue)
        : 0n,
      
      usersWithRevenue: revenueData.filter((d) => d.totalRevenue > 0n).length,
      usersExited: revenueData.filter((d) => d.totalRevenue >= d.currentCap && d.currentCap > 0n).length,
      usersPartialRevenue: revenueData.filter((d) => d.totalRevenue > 0n && d.totalRevenue < d.currentCap).length,
      usersNoRevenue: revenueData.filter((d) => d.totalRevenue === 0n).length,
    };
    
    stats.averageRevenue = stats.totalUsers > 0 ? stats.totalRevenue / BigInt(stats.totalUsers) : 0n;
    stats.completionRate = stats.totalCap > 0n 
      ? (Number(stats.totalRevenue) / Number(stats.totalCap) * 100).toFixed(2)
      : 0;
    
    // 按等级分类
    const byLevel = {};
    revenueData.forEach((d) => {
      if (!byLevel[d.level]) {
        byLevel[d.level] = {
          count: 0,
          totalRevenue: 0n,
          totalCap: 0n,
          activeCount: 0,
        };
      }
      byLevel[d.level].count++;
      byLevel[d.level].totalRevenue += d.totalRevenue;
      byLevel[d.level].totalCap += d.currentCap;
      if (d.isActive) byLevel[d.level].activeCount++;
    });
    
    // 按状态分类
    const activeRevenue = revenueData.filter((d) => d.isActive).reduce((sum, d) => sum + d.totalRevenue, 0n);
    const inactiveRevenue = revenueData.filter((d) => !d.isActive).reduce((sum, d) => sum + d.totalRevenue, 0n);
    
    // 输出结果
    printHeader("📊 收益统计汇总");
    
    console.log("👥 用户统计:");
    console.log(`  总用户数: ${stats.totalUsers}`);
    console.log(`  活跃用户: ${stats.activeUsers} (${(stats.activeUsers/stats.totalUsers*100).toFixed(1)}%)`);
    console.log(`  非活跃用户: ${stats.inactiveUsers} (${(stats.inactiveUsers/stats.totalUsers*100).toFixed(1)}%)`);
    console.log("");
    
    console.log("💰 收益总额统计:");
    console.log(`  平台总收益: ${formatEther(stats.totalRevenue)} MC`);
    console.log(`  平台总额度: ${formatEther(stats.totalCap)} MC`);
    console.log(`  平台剩余: ${formatEther(stats.totalRemaining)} MC`);
    console.log(`  完成度: ${stats.completionRate}%`);
    console.log("");
    
    console.log("📈 收益分布:");
    console.log(`  最高收益: ${formatEther(stats.maxRevenue)} MC`);
    console.log(`  最低收益: ${formatEther(stats.minRevenue)} MC`);
    console.log(`  平均收益: ${formatEther(stats.averageRevenue)} MC`);
    console.log("");
    
    console.log("📊 用户收益分类:");
    console.log(`  已出局用户: ${stats.usersExited} (收益 >= 额度上限)`);
    console.log(`  已有收益用户: ${stats.usersWithRevenue} (收益 > 0)`);
    console.log(`    - 部分收益: ${stats.usersPartialRevenue}`);
    console.log(`    - 已出局: ${stats.usersExited}`);
    console.log(`  无收益用户: ${stats.usersNoRevenue}`);
    console.log("");
    
    console.log("👥 按状态分类的收益:");
    console.log(`  活跃用户总收益: ${formatEther(activeRevenue)} MC`);
    console.log(`  非活跃用户总收益: ${formatEther(inactiveRevenue)} MC`);
    console.log("");
    
    console.log("📋 按等级分类的收益:");
    Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach((level) => {
      const data = byLevel[level];
      const levelName = ["新手", "铜牌", "银牌", "金牌", "钻石"][level] || `等级${level}`;
      console.log(`  ${levelName}(L${level}): ${data.count}人, 收益${formatEther(data.totalRevenue)}MC (活跃${data.activeCount}人)`);
    });
    console.log("");
    
    // Top 10 用户
    const topUsers = [...revenueData].sort((a, b) => 
      Number(b.totalRevenue - a.totalRevenue)
    ).slice(0, 10);
    
    console.log("🏆 Top 10 收益用户:");
    topUsers.forEach((user, idx) => {
      const status = user.isActive ? "✓活跃" : "✗未激活";
      console.log(`  ${(idx + 1).toString().padStart(2, " ")}. ${user.address.substring(0, 10)}... ${formatEther(user.totalRevenue).padStart(10, " ")}MC [${status}]`);
    });
    console.log("");
    
    // 导出 CSV
    if (args.includes("--export")) {
      const csvPath = path.join(__dirname, `../output/user-revenue-statistics-${new Date().toISOString().split('T')[0]}.csv`);
      const csvHeader = "地址,总收益(MC),额度上限(MC),剩余额度(MC),完成度(%),状态,等级,团队人数\n";
      const csvData = revenueData
        .map((d) => 
          `${d.address},${formatEther(d.totalRevenue)},${formatEther(d.currentCap)},${formatEther(d.remainingCap)},${d.completionPercent},${d.isActive ? "活跃" : "未激活"},${d.level},${d.teamCount}`
        )
        .join("\n");
      
      fs.mkdirSync(path.dirname(csvPath), { recursive: true });
      fs.writeFileSync(csvPath, csvHeader + csvData);
      console.log(`✅ CSV 已导出: ${csvPath}\n`);
    }
    
    // 生成 JSON 输出目录
    const outputDir = path.join(__dirname, "../output/revenue-statistics");
    fs.mkdirSync(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + 
                     "_" + new Date().getHours().toString().padStart(2, "0") +
                     new Date().getMinutes().toString().padStart(2, "0");
    
    const reportFile = path.join(outputDir, `revenue-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        inactiveUsers: stats.inactiveUsers,
        totalRevenue: formatEther(stats.totalRevenue),
        totalCap: formatEther(stats.totalCap),
        totalRemaining: formatEther(stats.totalRemaining),
        completionRate: stats.completionRate,
        averageRevenue: formatEther(stats.averageRevenue),
        usersWithRevenue: stats.usersWithRevenue,
        usersExited: stats.usersExited,
        usersNoRevenue: stats.usersNoRevenue,
      },
      byLevel: Object.keys(byLevel).reduce((obj, level) => {
        const data = byLevel[level];
        obj[`level${level}`] = {
          count: data.count,
          totalRevenue: formatEther(data.totalRevenue),
          activeCount: data.activeCount,
        };
        return obj;
      }, {}),
      topUsers: topUsers.map((u) => ({
        address: u.address,
        revenue: formatEther(u.totalRevenue),
        status: u.isActive ? "active" : "inactive",
        level: u.level,
      })),
    }, null, 2));
    
    console.log(`✅ 报告已保存: ${reportFile}\n`);
    
  } catch (error) {
    console.error("❌ 统计出错:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
