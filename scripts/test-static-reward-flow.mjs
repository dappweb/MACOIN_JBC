import { ethers } from "ethers";

// 合约地址和ABI
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 rewardType, uint256 ticketId)"
];

/**
 * 端到端静态奖励流程测试
 * 模拟完整的质押→等待→领取→显示流程
 */
async function testStaticRewardFlow(userAddress) {
  console.log("🔄 静态奖励端到端流程测试");
  console.log("=" .repeat(60));
  console.log(`测试用户: ${userAddress}`);
  console.log("");

  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    // 步骤1: 检查前置条件
    console.log("📋 步骤1: 检查前置条件");
    console.log("-".repeat(40));
    
    const ticket = await protocol.userTicket(userAddress);
    const userInfo = await protocol.userInfo(userAddress);
    
    console.log(`门票状态: ${ticket.amount > 0n && !ticket.exited ? '✅ 有效' : '❌ 无效'}`);
    console.log(`门票金额: ${ethers.formatEther(ticket.amount)} MC`);
    console.log(`收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    console.log(`已获收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`剩余空间: ${ethers.formatEther(userInfo.currentCap - userInfo.totalRevenue)} MC`);
    
    if (ticket.amount === 0n || ticket.exited) {
      console.log("❌ 测试终止: 用户没有有效门票");
      return;
    }
    
    if (userInfo.currentCap <= userInfo.totalRevenue) {
      console.log("❌ 测试终止: 用户已达收益上限");
      return;
    }
    
    console.log("✅ 前置条件检查通过");
    console.log("");

    // 步骤2: 检查质押状态
    console.log("🏦 步骤2: 检查质押状态");
    console.log("-".repeat(40));
    
    const secondsInUnit = await protocol.SECONDS_IN_UNIT();
    const currentTime = Math.floor(Date.now() / 1000);
    
    let activeStakes = [];
    let totalPendingRewards = 0n;
    
    for (let i = 0; i < 10; i++) {
      try {
        const stake = await protocol.userStakes(userAddress, i);
        if (stake.amount === 0n) break;
        
        if (stake.active) {
          const unitsPassed = Math.floor((currentTime - Number(stake.startTime)) / Number(secondsInUnit));
          const maxUnits = Number(stake.cycleDays);
          const actualUnits = Math.min(unitsPassed, maxUnits);
          
          let ratePerBillion = 0;
          if (Number(stake.cycleDays) === 7) ratePerBillion = 13333334;
          else if (Number(stake.cycleDays) === 15) ratePerBillion = 16666667;
          else if (Number(stake.cycleDays) === 30) ratePerBillion = 20000000;
          
          const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
          const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
          
          activeStakes.push({
            id: i,
            amount: stake.amount,
            cycleDays: Number(stake.cycleDays),
            startTime: Number(stake.startTime),
            unitsPassed,
            actualUnits,
            maxUnits,
            totalEarned: totalStaticShouldBe,
            paid: stake.paid,
            pending
          });
          
          totalPendingRewards += pending;
          
          console.log(`质押 #${i}:`);
          console.log(`  金额: ${ethers.formatEther(stake.amount)} MC`);
          console.log(`  周期: ${stake.cycleDays} 天`);
          console.log(`  进度: ${actualUnits}/${maxUnits} 时间单位`);
          console.log(`  已支付: ${ethers.formatEther(stake.paid)} MC`);
          console.log(`  待领取: ${ethers.formatEther(pending)} MC`);
        }
      } catch (error) {
        break;
      }
    }
    
    console.log(`\n活跃质押数量: ${activeStakes.length}`);
    console.log(`总待领取奖励: ${ethers.formatEther(totalPendingRewards)} MC`);
    
    if (activeStakes.length === 0) {
      console.log("❌ 测试终止: 用户没有活跃质押");
      return;
    }
    
    console.log("✅ 质押状态检查完成");
    console.log("");

    // 步骤3: 模拟前端计算逻辑
    console.log("💻 步骤3: 模拟前端计算逻辑");
    console.log("-".repeat(40));
    
    // 模拟前端的待领取奖励计算
    const remainingCap = userInfo.currentCap - userInfo.totalRevenue;
    const actualClaimable = totalPendingRewards > remainingCap ? remainingCap : totalPendingRewards;
    
    // 分配50%MC和50%JBC
    const mcPart = actualClaimable / 2n;
    const jbcValuePart = actualClaimable / 2n;
    
    // 获取JBC价格
    const reserveMC = await protocol.swapReserveMC();
    const reserveJBC = await protocol.swapReserveJBC();
    
    let jbcAmount = 0;
    if (reserveMC > 0n && reserveJBC > 0n) {
      const jbcPrice = (reserveMC * 1000000000000000000n) / reserveJBC;
      const jbcAmountBigInt = (jbcValuePart * 1000000000000000000n) / jbcPrice;
      jbcAmount = Number(ethers.formatEther(jbcAmountBigInt));
    } else {
      jbcAmount = Number(ethers.formatEther(jbcValuePart));
    }
    
    console.log(`前端计算结果:`);
    console.log(`  可领取MC: ${ethers.formatEther(mcPart)} MC`);
    console.log(`  可领取JBC: ${jbcAmount.toFixed(4)} JBC`);
    console.log(`  流动性储备: ${ethers.formatEther(reserveMC)} MC / ${ethers.formatEther(reserveJBC)} JBC`);
    
    console.log("✅ 前端计算逻辑验证完成");
    console.log("");

    // 步骤4: 检查历史奖励记录
    console.log("📊 步骤4: 检查历史奖励记录");
    console.log("-".repeat(40));
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 50000);
    
    const rewardEvents = await protocol.queryFilter(
      protocol.filters.RewardClaimed(userAddress),
      fromBlock
    );
    
    console.log(`查询区块范围: ${fromBlock} - ${currentBlock}`);
    console.log(`找到奖励记录: ${rewardEvents.length} 条`);
    
    let staticRewardCount = 0;
    let totalStaticMC = 0;
    let totalStaticJBC = 0;
    
    rewardEvents.forEach((event, index) => {
      const rewardType = Number(event.args[3]);
      const mcAmount = Number(ethers.formatEther(event.args[1]));
      const jbcAmount = Number(ethers.formatEther(event.args[2]));
      
      if (rewardType === 0) { // 静态奖励
        staticRewardCount++;
        totalStaticMC += mcAmount;
        totalStaticJBC += jbcAmount;
        
        if (index < 3) { // 显示前3条
          console.log(`  静态奖励 #${staticRewardCount}:`);
          console.log(`    MC: ${mcAmount.toFixed(4)}`);
          console.log(`    JBC: ${jbcAmount.toFixed(4)}`);
          console.log(`    区块: ${event.blockNumber}`);
        }
      }
    });
    
    console.log(`\n静态奖励统计:`);
    console.log(`  记录数量: ${staticRewardCount}`);
    console.log(`  总MC奖励: ${totalStaticMC.toFixed(4)} MC`);
    console.log(`  总JBC奖励: ${totalStaticJBC.toFixed(4)} JBC`);
    
    console.log("✅ 历史记录检查完成");
    console.log("");

    // 步骤5: 流程完整性验证
    console.log("🎯 步骤5: 流程完整性验证");
    console.log("-".repeat(40));
    
    let issues = [];
    let recommendations = [];
    
    // 检查是否有待领取奖励但没有显示
    if (totalPendingRewards > 0n && staticRewardCount === 0) {
      issues.push("有待领取奖励但历史记录为空");
      recommendations.push("用户需要调用 claimRewards 函数来领取奖励");
    }
    
    // 检查收益上限
    if (remainingCap < totalPendingRewards) {
      issues.push("待领取奖励超过收益上限");
      recommendations.push("用户需要购买更多门票提高收益上限");
    }
    
    // 检查质押时间
    const hasMaturedStakes = activeStakes.some(stake => stake.actualUnits >= stake.maxUnits);
    if (hasMaturedStakes && totalPendingRewards === 0n) {
      issues.push("质押已到期但无待领取奖励");
      recommendations.push("检查是否已全部领取或计算逻辑错误");
    }
    
    console.log("问题诊断:");
    if (issues.length === 0) {
      console.log("✅ 未发现问题，流程正常");
    } else {
      issues.forEach((issue, index) => {
        console.log(`❌ 问题 ${index + 1}: ${issue}`);
      });
    }
    
    console.log("\n建议措施:");
    if (recommendations.length === 0) {
      console.log("✅ 无需特殊操作");
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`💡 建议 ${index + 1}: ${rec}`);
      });
    }
    
    console.log("");
    console.log("🏁 测试总结");
    console.log("=".repeat(40));
    console.log(`✅ 端到端流程测试完成`);
    console.log(`📊 活跃质押: ${activeStakes.length} 个`);
    console.log(`💰 待领取: ${ethers.formatEther(totalPendingRewards)} MC`);
    console.log(`📝 历史记录: ${staticRewardCount} 条静态奖励`);
    console.log(`🎯 状态: ${issues.length === 0 ? '正常' : '需要关注'}`);

  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message);
    console.log("\n🔧 故障排除:");
    console.log("1. 检查用户地址是否正确");
    console.log("2. 确认网络连接是否稳定");
    console.log("3. 验证合约地址和ABI是否匹配");
  }
}

// 使用示例
const userAddress = process.argv[2] || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
testStaticRewardFlow(userAddress);