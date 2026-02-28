#!/usr/bin/env node
/**
 * JBC 用户投入产出数据统计系统
 * 
 * 统计所有用户的投入和产出数据，包括：
 * - 用户投入（门票、质押等）
 * - 用户产出（各类奖励）
 * - 投入产出比（ROI）
 * - 用户盈利能力分析
 * - 等级和投入产出的关系分析
 * 
 * 使用方法:
 *   node scripts/user-roi-analysis.cjs              # 完整分析
 *   node scripts/user-roi-analysis.cjs --export     # 导出数据
 *   node scripts/user-roi-analysis.cjs --summary    # 简明汇总
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
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
}

async function getUserROIData(protocol, provider, userAddress) {
  try {
    const userInfo = await protocol.userInfo(userAddress);
    const ticket = await protocol.userTicket(userAddress);
    
    let level = 0;
    try {
      const levelInfo = await protocol.getUserLevel(userAddress);
      level = Number(levelInfo.level);
    } catch {}
    
    // 获取该用户的所有事件数据
    const [stakingEvents, claimEvents, referralEvents, rewardPaidEvents] = await Promise.all([
      protocol.queryFilter(protocol.filters.LiquidityStaked(userAddress), 0, "latest").catch(() => []),
      protocol.queryFilter(protocol.filters.RewardClaimed(userAddress), 0, "latest").catch(() => []),
      protocol.queryFilter(protocol.filters.ReferralRewardPaid(userAddress), 0, "latest").catch(() => []),
      protocol.queryFilter(protocol.filters.RewardPaid(userAddress), 0, "latest").catch(() => []),
    ]);
    
    // 计算投入
    const ticketInvestment = BigInt(ticket.amount); // 门票投入
    
    let totalStakingAmount = 0n;
    stakingEvents.forEach((e) => {
      totalStakingAmount += BigInt(e.args.amount);
    });
    
    const totalInput = ticketInvestment + totalStakingAmount;
    
    // 计算产出
    let claimMC = 0n;
    let claimJBC = 0n;
    claimEvents.forEach((e) => {
      claimMC += BigInt(e.args.mcAmount);
      claimJBC += BigInt(e.args.jbcAmount);
    });
    
    let referralMC = 0n;
    let referralJBC = 0n;
    referralEvents.forEach((e) => {
      referralMC += BigInt(e.args.mcAmount);
      referralJBC += BigInt(e.args.jbcAmount);
    });
    
    let directRewardMC = 0n;
    rewardPaidEvents.forEach((e) => {
      directRewardMC += BigInt(e.args.amount);
    });
    
    const totalOutputMC = claimMC + referralMC + directRewardMC;
    
    // 计算净收益（只计算MC，因为JBC需要价格转换）
    const netProfit = totalOutputMC - totalInput;
    
    // 计算ROI
    const roi = totalInput > 0n 
      ? (Number(netProfit) / Number(totalInput) * 100).toFixed(2)
      : 0;
    
    // 计算产出回本率
    const paybackRate = totalInput > 0n
      ? (Number(totalOutputMC) / Number(totalInput) * 100).toFixed(2)
      : 0;
    
    return {
      address: userAddress,
      level: level,
      isActive: userInfo.isActive,
      teamCount: Number(userInfo.teamCount),
      
      // 投入数据
      ticketInput: ticketInvestment,
      stakingInput: totalStakingAmount,
      totalInput: totalInput,
      
      // 产出数据
      claimMC: claimMC,
      claimJBC: claimJBC,
      referralMC: referralMC,
      referralJBC: referralJBC,
      directRewardMC: directRewardMC,
      totalOutputMC: totalOutputMC,
      totalOutputJBC: claimJBC + referralJBC,
      
      // 收益数据
      contractRevenue: BigInt(userInfo.totalRevenue),
      completionRate: Number(userInfo.currentCap) > 0 
        ? (Number(userInfo.totalRevenue) / Number(userInfo.currentCap) * 100).toFixed(2)
        : 0,
      
      // 效率指标
      netProfit: netProfit,
      roi: roi,
      paybackRate: paybackRate,
      
      // 事件统计
      stakingCount: stakingEvents.length,
      claimCount: claimEvents.length,
      referralCount: referralEvents.length,
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
  
  printHeader("💰 JBC 用户投入产出ROI分析系统");
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取所有用户
    const users = await getAllUsers(protocol, provider);
    
    if (users.length === 0) {
      console.log("❌ 未找到用户\n");
      return;
    }
    
    // 收集ROI数据
    console.log("💾 收集用户投入产出数据...\n");
    
    let processedCount = 0;
    const roiData = [];
    
    for (const user of users) {
      const data = await getUserROIData(protocol, provider, user);
      if (data) {
        roiData.push(data);
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`📋 进度: ${processedCount}/${users.length} (${(processedCount/users.length*100).toFixed(1)}%)`);
      }
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
    
    // 按等级分类分析
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
    printHeader("📊 投入产出ROI分析汇总");
    
    console.log("💰 总体投入产出统计:");
    console.log(`  总投入: ${formatEther(stats.totalInput)} MC`);
    console.log(`  总产出: ${formatEther(stats.totalOutput)} MC`);
    console.log(`  总利润: ${formatEther(stats.totalProfit)} MC`);
    console.log(`  整体ROI: ${stats.overallROI}%`);
    console.log(`  整体回本率: ${stats.overallPaybackRate}%`);
    console.log("");
    
    console.log("👥 用户分类统计:");
    console.log(`  有投入用户: ${stats.usersWithInput} 人`);
    console.log(`  有产出用户: ${stats.usersWithOutput} 人`);
    console.log(`  盈利用户: ${stats.usersWithProfit} 人 (${(stats.usersWithProfit/stats.totalUsers*100).toFixed(1)}%)`);
    console.log(`  亏损用户: ${stats.usersWithLoss} 人 (${(stats.usersWithLoss/stats.totalUsers*100).toFixed(1)}%)`);
    console.log("");
    
    console.log("📈 ROI分布:");
    console.log(`  平均ROI: ${stats.avgROI}%`);
    console.log(`  最高ROI: ${stats.maxROI.toFixed(2)}%`);
    console.log(`  最低ROI: ${stats.minROI.toFixed(2)}%`);
    console.log(`  平均回本率: ${stats.avgPaybackRate}%`);
    console.log("");
    
    // 按等级分析
    console.log("📋 按等级分类的投入产出分析:");
    Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach((level) => {
      const data = byLevel[level];
      const avgRoi = data.rois.length > 0 
        ? (data.rois.reduce((a, b) => a + b, 0) / data.rois.length).toFixed(2)
        : 0;
      const avgPayback = data.totalInput > 0n
        ? (Number(data.totalOutput) / Number(data.totalInput) * 100).toFixed(2)
        : 0;
      const levelName = ["新手", "铜牌", "银牌", "金牌", "钻石"][level] || `等级${level}`;
      
      console.log(`  ${levelName}(L${level}): ${data.count}人`);
      console.log(`    投入: ${formatEther(data.totalInput)}MC, 产出: ${formatEther(data.totalOutput)}MC`);
      console.log(`    平均ROI: ${avgRoi}%, 盈利用户: ${data.profitable}/${data.count} (${(data.profitable/data.count*100).toFixed(1)}%)`);
    });
    console.log("");
    
    // Top 10 ROI用户
    const topROI = [...roiData].sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi)).slice(0, 10);
    
    console.log("🏆 Top 10 ROI用户:");
    topROI.forEach((user, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2, " ")}. ${user.address.substring(0, 10)}... ROI: ${user.roi.padStart(8, " ")}%, 投入: ${formatEther(user.totalInput).padStart(10, " ")}MC`);
    });
    console.log("");
    
    // Top 10 产出用户
    const topOutput = [...roiData].sort((a, b) => Number(b.totalOutputMC - a.totalOutputMC)).slice(0, 10);
    
    console.log("🎁 Top 10 产出用户:");
    topOutput.forEach((user, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2, " ")}. ${user.address.substring(0, 10)}... 产出: ${formatEther(user.totalOutputMC).padStart(10, " ")}MC, 投入: ${formatEther(user.totalInput).padStart(10, " ")}MC`);
    });
    console.log("");
    
    // 导出CSV
    if (args.includes("--export")) {
      const csvPath = path.join(__dirname, `../output/user-roi-statistics-${new Date().toISOString().split('T')[0]}.csv`);
      const csvHeader = "地址,等级,投入(MC),产出(MC),利润(MC),ROI(%),回本率(%),投入类型(票/质),产出来源(直推/推荐)\n";
      const csvData = roiData
        .map((d) => 
          `${d.address},${d.level},${formatEther(d.totalInput)},${formatEther(d.totalOutputMC)},${formatEther(d.netProfit)},${d.roi},${d.paybackRate},票${formatEther(d.ticketInput)}/质${formatEther(d.stakingInput)},直${formatEther(d.directRewardMC)}/推${formatEther(d.referralMC)}`
        )
        .join("\n");
      
      fs.mkdirSync(path.dirname(csvPath), { recursive: true });
      fs.writeFileSync(csvPath, csvHeader + csvData);
      console.log(`✅ CSV 已导出: ${csvPath}\n`);
    }
    
    // 生成JSON报告
    const outputDir = path.join(__dirname, "../output/roi-analysis");
    fs.mkdirSync(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + 
                     "_" + new Date().getHours().toString().padStart(2, "0") +
                     new Date().getMinutes().toString().padStart(2, "0");
    
    const reportFile = path.join(outputDir, `roi-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: stats.totalUsers,
        totalInput: formatEther(stats.totalInput),
        totalOutput: formatEther(stats.totalOutput),
        totalProfit: formatEther(stats.totalProfit),
        overallROI: stats.overallROI,
        overallPaybackRate: stats.overallPaybackRate,
        usersWithProfit: stats.usersWithProfit,
        profitRate: ((stats.usersWithProfit / stats.totalUsers) * 100).toFixed(2),
        avgROI: stats.avgROI,
        maxROI: stats.maxROI.toFixed(2),
        minROI: stats.minROI.toFixed(2),
      },
      byLevel: Object.keys(byLevel).reduce((obj, level) => {
        const data = byLevel[level];
        const avgRoi = data.rois.length > 0 
          ? (data.rois.reduce((a, b) => a + b, 0) / data.rois.length).toFixed(2)
          : 0;
        obj[`level${level}`] = {
          count: data.count,
          totalInput: formatEther(data.totalInput),
          totalOutput: formatEther(data.totalOutput),
          averageROI: avgRoi,
          profitableCount: data.profitable,
        };
        return obj;
      }, {}),
      topUsers: topROI.map((u) => ({
        address: u.address,
        level: u.level,
        input: formatEther(u.totalInput),
        output: formatEther(u.totalOutputMC),
        roi: u.roi,
      })),
    }, null, 2));
    
    console.log(`✅ 报告已保存: ${reportFile}\n`);
    
  } catch (error) {
    console.error("❌ 分析出错:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
