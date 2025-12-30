const { ethers } = require("ethers");

// 合约地址 (p-prod 分支)
const PROTOCOL_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
const JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

// RPC URL
const RPC_URL = "https://chain.mcerscan.com/";

// 简化的 ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function getDirectReferrals(address) view returns (address[])",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function owner() view returns (address)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice)"
];

async function testPProdRewards() {
  console.log("🔍 [P-Prod Rewards Test] 开始测试 p-prod 分支的奖励分配...");
  
  try {
    // 连接到 MC Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 获取当前区块
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 当前区块: ${currentBlock}`);
    
    // 查询最近的奖励事件 (最近 10,000 个区块)
    const fromBlock = Math.max(0, currentBlock - 10000);
    console.log(`🔍 查询区块范围: ${fromBlock} - ${currentBlock}`);
    
    // 查询各种奖励事件
    console.log("\n📋 查询奖励事件...");
    
    const [rewardPaidEvents, rewardClaimedEvents, referralEvents, differentialEvents] = await Promise.allSettled([
      protocol.queryFilter(protocol.filters.RewardPaid(), fromBlock),
      protocol.queryFilter(protocol.filters.RewardClaimed(), fromBlock),
      protocol.queryFilter(protocol.filters.ReferralRewardPaid(), fromBlock),
      protocol.queryFilter(protocol.filters.DifferentialRewardDistributed(), fromBlock)
    ]);
    
    console.log("\n📊 事件统计:");
    console.log(`- RewardPaid 事件: ${rewardPaidEvents.status === 'fulfilled' ? rewardPaidEvents.value.length : '查询失败'}`);
    console.log(`- RewardClaimed 事件: ${rewardClaimedEvents.status === 'fulfilled' ? rewardClaimedEvents.value.length : '查询失败'}`);
    console.log(`- ReferralRewardPaid 事件: ${referralEvents.status === 'fulfilled' ? referralEvents.value.length : '查询失败'}`);
    console.log(`- DifferentialRewardDistributed 事件: ${differentialEvents.status === 'fulfilled' ? differentialEvents.value.length : '查询失败'}`);
    
    // 分析 ReferralRewardPaid 事件
    if (referralEvents.status === 'fulfilled' && referralEvents.value.length > 0) {
      console.log("\n🎯 分析 ReferralRewardPaid 事件:");
      
      let directRewards = 0;
      let levelRewards = 0;
      let differentialRewards = 0;
      let totalMC = 0;
      let totalJBC = 0;
      
      for (const event of referralEvents.value.slice(-10)) { // 最近 10 个事件
        const args = event.args;
        const user = args[0];
        const from = args[1];
        const mcAmount = parseFloat(ethers.formatEther(args[2]));
        const jbcAmount = parseFloat(ethers.formatEther(args[3]));
        const rewardType = Number(args[4]);
        const ticketId = args[5].toString();
        
        console.log(`  📝 事件: ${event.transactionHash.slice(0, 10)}...`);
        console.log(`     用户: ${user.slice(0, 8)}...`);
        console.log(`     来源: ${from.slice(0, 8)}...`);
        console.log(`     MC: ${mcAmount.toFixed(4)}, JBC: ${jbcAmount.toFixed(4)}`);
        console.log(`     类型: ${rewardType} (${getRewardTypeName(rewardType)})`);
        console.log(`     门票ID: ${ticketId}`);
        
        if (rewardType === 2) directRewards++;
        else if (rewardType === 3) levelRewards++;
        else if (rewardType === 4) differentialRewards++;
        
        totalMC += mcAmount;
        totalJBC += jbcAmount;
      }
      
      console.log(`\n📈 奖励类型统计 (最近10个事件):`);
      console.log(`- 直推奖励: ${directRewards} 个`);
      console.log(`- 层级奖励: ${levelRewards} 个`);
      console.log(`- 级差奖励: ${differentialRewards} 个`);
      console.log(`- 总 MC: ${totalMC.toFixed(4)}`);
      console.log(`- 总 JBC: ${totalJBC.toFixed(4)}`);
      
      // 检查是否有 JBC 奖励
      if (totalJBC === 0) {
        console.log("\n⚠️  警告: 所有 ReferralRewardPaid 事件的 JBC 金额都为 0");
        console.log("   这表明直推奖励和层级奖励可能还没有实现 50% MC + 50% JBC 分配");
      } else {
        console.log("\n✅ 发现 JBC 奖励分配，奖励机制可能已经升级");
      }
    }
    
    // 检查合约储备
    console.log("\n💰 检查合约储备:");
    try {
      const mcReserve = await protocol.swapReserveMC();
      const jbcReserve = await protocol.swapReserveJBC();
      console.log(`- MC 储备: ${ethers.formatEther(mcReserve)} MC`);
      console.log(`- JBC 储备: ${ethers.formatEther(jbcReserve)} JBC`);
      
      if (mcReserve > 0n && jbcReserve > 0n) {
        const jbcPrice = (mcReserve * 1000000000000000000n) / jbcReserve;
        console.log(`- JBC 价格: 1 JBC = ${ethers.formatEther(jbcPrice)} MC`);
      }
    } catch (err) {
      console.log("- 储备信息获取失败:", err.message);
    }
    
    console.log("\n✅ [P-Prod Rewards Test] 测试完成");
    
  } catch (error) {
    console.error("❌ [P-Prod Rewards Test] 测试失败:", error);
  }
}

function getRewardTypeName(type) {
  switch (type) {
    case 0: return "静态奖励";
    case 1: return "动态奖励";
    case 2: return "直推奖励";
    case 3: return "层级奖励";
    case 4: return "级差奖励";
    default: return "未知类型";
  }
}

// 运行测试
testPProdRewards().catch(console.error);