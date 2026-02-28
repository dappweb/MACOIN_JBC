#!/usr/bin/env node
/**
 * JBC 用户投入产出数据统计系统（优化版）
 * 
 * 使用并行查询和缓存优化，快速统计所有用户的投入产出数据
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
];

async function getAllUsers(protocol, provider) {
  console.log("📊 查询所有注册用户...");
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 500000);
  
  const [boundEvents, ticketEvents] = await Promise.all([
    protocol.queryFilter(protocol.filters.BoundReferrer(), fromBlock, "latest").catch(() => []),
    protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock, "latest").catch(() => []),
  ]);
  
  const users = new Set();
  boundEvents.forEach((e) => users.add(e.args.user));
  ticketEvents.forEach((e) => users.add(e.args.user));
  
  console.log(`✓ 找到 ${users.size} 个唯一用户\n`);
  return Array.from(users);
}

async function getUserSimpleROIData(protocol, userAddress) {
  try {
    const [userInfo, ticket] = await Promise.all([
      protocol.userInfo(userAddress).catch(() => null),
      protocol.userTicket(userAddress).catch(() => null),
    ]);
    
    if (!userInfo || !ticket) return null;
    
    let level = 0;
    try {
      const levelInfo = await protocol.getUserLevel(userAddress);
      level = Number(levelInfo.level);
    } catch {}
    
    // 从用户信息中推导投入产出（简化版）
    const ticketInput = BigInt(ticket.amount);
    const contractRevenue = BigInt(userInfo.totalRevenue);
    const currentCap = BigInt(userInfo.currentCap);
    
    // 简单计算：投入 = 门票额，产出 = 合约记录的总收益
    const roi = currentCap > 0n
      ? (Number(contractRevenue - ticketInput) / Number(ticketInput) * 100).toFixed(2)
      : 0;
    
    const paybackRate = ticketInput > 0n
      ? (Number(contractRevenue) / Number(ticketInput) * 100).toFixed(2)
      : 0;
    
    return {
      address: userAddress,
      level: level,
      isActive: userInfo.isActive,
      teamCount: Number(userInfo.teamCount),
      
      // 投入（简化版：只用门票）
      ticketInput: ticketInput,
      totalInput: ticketInput,
      
      // 产出（使用合约记录的总收益）
      totalOutputMC: contractRevenue,
      
      // 收益指标
      netProfit: contractRevenue - ticketInput,
      roi: roi,
      paybackRate: paybackRate,
      completionRate: currentCap > 0n
        ? (Number(contractRevenue) / Number(currentCap) * 100).toFixed(2)
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
  
  printHeader("💰 JBC 用户投入产出统计系统");
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取所有用户
    const users = await getAllUsers(protocol, provider);
    
    if (users.length === 0) {
      console.log("❌ 未找到用户\n");
      return;
    }
    
    // 使用并行查询优化性能
    console.log("💾 收集用户投入产出数据（并行查询）...\n");
    
    const batchSize = 20; // 每批20个并行查询
    const roiData = [];
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((user) => getUserSimpleROIData(protocol, user))
      );
      
      results.forEach((data) => {
        if (data) roiData.push(data);
      });
      
      const progress = Math.min(i + batchSize, users.length);
      console.log(`📋 进度: ${progress}/${users.length} (${(progress/users.length*100).toFixed(1)}%)`);
    }
    
    console.log(`\n✅ 处理完成: ${roiData.length} 个用户\n`);
    
    // 计算统计数据
    const stats = {
      totalUsers: roiData.length,
      totalInput: roiData.reduce((sum, d) => sum + d.totalInput, 0n),
      totalOutput: roiData.reduce((sum, d) => sum + d.totalOutputMC, 0n),
      totalProfit: roiData.reduce((sum, d) => sum + d.netProfit, 0n),
      
      usersWithInput: roiData.filter((d) => d.totalInput > 0n).length,
      usersWithOutput: roiData.filter((d) => d.totalOutputMC > 0n).length,
      usersWithProfit: roiData.filter((d) => d.netProfit > 0n).length,
      usersWithLoss: roiData.filter((d) => d.netProfit < 0n).length,
      
      avgROI: roiData.length > 0 
        ? (roiData.reduce((sum, d) => sum + parseFloat(d.roi), 0) / roiData.length).toFixed(2)
        : 0,
      
      avgPaybackRate: roiData.length > 0
        ? (roiData.reduce((sum, d) => sum + parseFloat(d.paybackRate), 0) / roiData.length).toFixed(2)
        : 0,
      
      maxROI: Math.max(...roiData.map((d) => parseFloat(d.roi))),
      minROI: Math.min(...roiData.map((d) => parseFloat(d.roi))),
    };
    
    stats.overallROI = stats.totalInput > 0n
      ? (Number(stats.totalProfit) / Number(stats.totalInput) * 100).toFixed(2)
      : 0;
    
    stats.overallPaybackRate = stats.totalInput > 0n
      ? (Number(stats.totalOutput) / Number(stats.totalInput) * 100).toFixed(2)
      : 0;
    
    // 按等级分类
    const byLevel = {};
    roiData.forEach((d) => {
      if (!byLevel[d.level]) {
        byLevel[d.level] = {
          count: 0,
          totalInput: 0n,
          totalOutput: 0n,
          totalProfit: 0n,
          profitable: 0,
          rois: [],
        };
      }
      byLevel[d.level].count++;
      byLevel[d.level].totalInput += d.totalInput;
      byLevel[d.level].totalOutput += d.totalOutputMC;
      byLevel[d.level].totalProfit += d.netProfit;
      if (d.netProfit > 0n) byLevel[d.level].profitable++;
      byLevel[d.level].rois.push(parseFloat(d.roi));
    });
    
    // 输出结果
    printHeader("📊 投入产出统计分析");
    
    console.log("💰 总体投入产出:");
    console.log(`  总投入: ${formatEther(stats.totalInput)} MC`);
    console.log(`  总产出: ${formatEther(stats.totalOutput)} MC`);
    console.log(`  总利润: ${formatEther(stats.totalProfit)} MC`);
    console.log(`  整体ROI: ${stats.overallROI}%`);
    console.log(`  整体回本率: ${stats.overallPaybackRate}%`);
    console.log("");
    
    console.log("👥 用户分类:");
    console.log(`  有投入用户: ${stats.usersWithInput} 人`);
    console.log(`  有产出用户: ${stats.usersWithOutput} 人`);
    console.log(`  盈利用户: ${stats.usersWithProfit} 人 (${(stats.usersWithProfit/stats.totalUsers*100).toFixed(1)}%)`);
    console.log(`  亏损用户: ${stats.usersWithLoss} 人 (${(stats.usersWithLoss/stats.totalUsers*100).toFixed(1)}%)`);
    console.log("");
    
    console.log("📈 ROI分布:");
    console.log(`  平均ROI: ${stats.avgROI}%`);
    console.log(`  最高ROI: ${stats.maxROI.toFixed(2)}%`);
    console.log(`  最低ROI: ${stats.minROI.toFixed(2)}%`);
    console.log("");
    
    console.log("📋 按等级分类:");
    Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach((level) => {
      const data = byLevel[level];
      const avgRoi = data.rois.length > 0 
        ? (data.rois.reduce((a, b) => a + b, 0) / data.rois.length).toFixed(2)
        : 0;
      const levelName = ["新手", "铜牌", "银牌", "金牌", "钻石"][level] || `L${level}`;
      console.log(`  ${levelName}: ${data.count}人, 投入${formatEther(data.totalInput)}MC, 产出${formatEther(data.totalOutput)}MC, 平均ROI${avgRoi}%, 盈利${data.profitable}人`);
    });
    console.log("");
    
    // Top 10 ROI
    const topROI = [...roiData].sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi)).slice(0, 10);
    console.log("🏆 Top 10 ROI:");
    topROI.forEach((user, idx) => {
      const num = (idx + 1).toString().padStart(2, " ");
      const roi = user.roi.toString().padStart(8, " ");
      const input = formatEther(user.totalInput).padStart(10, " ");
      const output = formatEther(user.totalOutputMC).padStart(10, " ");
      console.log(`  ${num}. ${user.address.substring(0, 10)}... ROI:${roi}% 投入:${input}MC 产出:${output}MC`);
    });
    console.log("");
    
    // 导出数据
    if (args.includes("--export")) {
      const csvPath = path.join(__dirname, `../output/roi-analysis-${new Date().toISOString().split('T')[0]}.csv`);
      const csvHeader = "地址,等级,投入(MC),产出(MC),盈亏(MC),ROI(%),回本率(%),状态\n";
      const csvData = roiData
        .map((d) => 
          `${d.address},${d.level},${formatEther(d.totalInput)},${formatEther(d.totalOutputMC)},${formatEther(d.netProfit)},${d.roi},${d.paybackRate},${d.isActive ? "活跃" : "未激活"}`
        )
        .join("\n");
      
      fs.mkdirSync(path.dirname(csvPath), { recursive: true });
      fs.writeFileSync(csvPath, csvHeader + csvData);
      console.log(`✅ CSV已导出: ${csvPath}\n`);
    }
    
    // 生成JSON报告
    const outputDir = path.join(__dirname, "../output/roi-analysis");
    fs.mkdirSync(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const reportFile = path.join(outputDir, `roi-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: stats.totalUsers,
        totalInput: formatEther(stats.totalInput),
        totalOutput: formatEther(stats.totalOutput),
        totalProfit: formatEther(stats.totalProfit),
        overallROI: stats.overallROI,
        profitRate: (stats.usersWithProfit / stats.totalUsers * 100).toFixed(2),
      },
    }, null, 2));
    
    console.log(`✅ 报告已保存: ${reportFile}\n`);
    
  } catch (error) {
    console.error("❌ 错误:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
