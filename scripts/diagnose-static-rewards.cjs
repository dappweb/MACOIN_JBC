const { ethers } = require("ethers");

// 合约地址和ABI
const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
  JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)"
];

async function diagnoseStaticRewards(userAddress) {
  console.log("🔍 静态奖励诊断工具");
  console.log("=" .repeat(50));
  console.log(`📍 用户地址: ${userAddress}`);
  console.log(`📍 合约地址: ${CONTRACT_ADDRESSES.PROTOCOL}`);
  console.log("");

  try {
    // 连接到MC链测试网
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io", {
      name: "MC Chain",
      chainId: 88813
    });
    const protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    // 1. 检查合约基本信息
    console.log("📋 合约基本信息");
    console.log("-".repeat(30));
    
    const secondsInUnit = await protocol.SECONDS_IN_UNIT();
    console.log(`⏰ SECONDS_IN_UNIT: ${secondsInUnit} (${Number(secondsInUnit) / 3600} 小时)`);
    
    const reserveMC = await protocol.swapReserveMC();
    const reserveJBC = await protocol.swapReserveJBC();
    console.log(`💰 MC储备: ${ethers.formatEther(reserveMC)} MC`);
    console.log(`💰 JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
    console.log("");

    // 2. 检查用户基本信息
    console.log("👤 用户基本信息");
    console.log("-".repeat(30));
    
    const userInfo = await protocol.userInfo(userAddress);
    console.log(`📊 总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`🎯 收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    console.log(`✅ 是否活跃: ${userInfo.isActive}`);
    
    const remainingCap = userInfo.currentCap - userInfo.totalRevenue;
    console.log(`📈 剩余收益空间: ${ethers.formatEther(remainingCap)} MC`);
    
    if (remainingCap <= 0n) {
      console.log("⚠️  警告: 用户已达到收益上限，无法获得更多奖励！");
    }
    console.log("");

    // 3. 检查门票状态
    console.log("🎫 门票状态");
    console.log("-".repeat(30));
    
    const ticket = await protocol.userTicket(userAddress);
    console.log(`🆔 门票ID: ${ticket.ticketId}`);
    console.log(`💵 门票金额: ${ethers.formatEther(ticket.amount)} MC`);
    console.log(`📅 购买时间: ${new Date(Number(ticket.purchaseTime) * 1000).toLocaleString()}`);
    console.log(`🚪 是否退出: ${ticket.exited}`);
    
    if (ticket.amount === 0n || ticket.exited) {
      console.log("❌ 错误: 用户没有有效门票，无法领取静态奖励！");
      console.log("💡 解决方案: 用户需要购买门票才能领取奖励");
      return;
    }
    console.log("");

    // 4. 检查质押记录
    console.log("🏦 质押记录分析");
    console.log("-".repeat(30));
    
    let totalActiveStakes = 0;
    let totalPendingRewards = 0n;
    let hasActiveStakes = false;
    
    for (let i = 0; i < 10; i++) { // 检查前10个质押记录
      try {
        const stake = await protocol.userStakes(userAddress, i);
        
        if (stake.amount === 0n) break; // 没有更多质押记录
        
        totalActiveStakes++;
        console.log(`\n📦 质押 #${i}:`);
        console.log(`  💰 金额: ${ethers.formatEther(stake.amount)} MC`);
        console.log(`  📅 开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
        console.log(`  ⏳ 周期: ${stake.cycleDays} 天`);
        console.log(`  ✅ 活跃状态: ${stake.active}`);
        console.log(`  💸 已支付: ${ethers.formatEther(stake.paid)} MC`);
        
        if (stake.active) {
          hasActiveStakes = true;
          
          // 计算静态奖励
          const currentTime = Math.floor(Date.now() / 1000);
          const unitsPassed = Math.floor((currentTime - Number(stake.startTime)) / Number(secondsInUnit));
          const maxUnits = Number(stake.cycleDays);
          const actualUnits = Math.min(unitsPassed, maxUnits);
          
          console.log(`  ⏰ 已过时间单位: ${actualUnits}/${maxUnits}`);
          
          // 根据周期确定收益率
          let ratePerBillion = 0;
          if (Number(stake.cycleDays) === 7) ratePerBillion = 13333334;
          else if (Number(stake.cycleDays) === 15) ratePerBillion = 16666667;
          else if (Number(stake.cycleDays) === 30) ratePerBillion = 20000000;
          
          console.log(`  📊 收益率: ${ratePerBillion / 10000000}% 每时间单位`);
          
          if (actualUnits > 0) {
            const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
            const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
            
            console.log(`  🎯 应得总奖励: ${ethers.formatEther(totalStaticShouldBe)} MC`);
            console.log(`  💰 待领取奖励: ${ethers.formatEther(pending)} MC`);
            
            totalPendingRewards += pending;
            
            if (pending > 0n) {
              console.log(`  ✅ 有待领取的静态奖励！`);
            } else {
              console.log(`  ⏳ 暂无待领取奖励（可能需要等待更多时间）`);
            }
          } else {
            console.log(`  ⏳ 质押时间不足一个时间单位`);
          }
          
          // 计算剩余时间
          const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(secondsInUnit));
          const remainingTime = endTime - currentTime;
          if (remainingTime > 0) {
            const days = Math.floor(remainingTime / 86400);
            const hours = Math.floor((remainingTime % 86400) / 3600);
            console.log(`  ⏰ 剩余时间: ${days}天 ${hours}小时`);
          } else {
            console.log(`  ✅ 质押周期已完成，可以赎回`);
          }
        } else {
          console.log(`  ❌ 质押已结束或被赎回`);
        }
        
      } catch (error) {
        if (i === 0) {
          console.log("❌ 用户没有质押记录");
        }
        break;
      }
    }
    
    console.log(`\n📊 质押汇总:`);
    console.log(`  📦 总质押数量: ${totalActiveStakes}`);
    console.log(`  ✅ 有活跃质押: ${hasActiveStakes}`);
    console.log(`  💰 总待领取奖励: ${ethers.formatEther(totalPendingRewards)} MC`);
    
    // 5. 诊断结论
    console.log("\n🎯 诊断结论");
    console.log("=".repeat(30));
    
    if (!hasActiveStakes) {
      console.log("❌ 问题: 用户没有活跃的质押记录");
      console.log("💡 解决方案: 用户需要先进行质押才能获得静态奖励");
    } else if (totalPendingRewards === 0n) {
      console.log("⏳ 问题: 用户有质押但暂无待领取奖励");
      console.log("💡 可能原因: 质押时间不足或已全部领取");
      console.log("💡 解决方案: 等待更多时间或检查是否已领取");
    } else if (remainingCap <= 0n) {
      console.log("⚠️  问题: 用户已达到收益上限");
      console.log("💡 解决方案: 用户需要购买更多门票来提高收益上限");
    } else {
      console.log("✅ 用户有待领取的静态奖励！");
      console.log(`💰 可领取金额: ${ethers.formatEther(totalPendingRewards)} MC`);
      console.log("💡 建议: 用户可以调用 claimRewards 函数领取奖励");
      
      // 检查收益上限约束
      const actualClaimable = totalPendingRewards > remainingCap ? remainingCap : totalPendingRewards;
      if (actualClaimable < totalPendingRewards) {
        console.log(`⚠️  注意: 受收益上限约束，实际可领取 ${ethers.formatEther(actualClaimable)} MC`);
      }
    }
    
  } catch (error) {
    console.error("❌ 诊断过程中发生错误:", error.message);
    console.error("🔧 请检查网络连接和合约地址是否正确");
  }
}

// 主函数
async function main() {
  const userAddress = process.argv[2];
  
  if (!userAddress) {
    console.log("使用方法: node scripts/diagnose-static-rewards.cjs <用户地址>");
    console.log("示例: node scripts/diagnose-static-rewards.cjs 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48");
    return;
  }
  
  if (!ethers.isAddress(userAddress)) {
    console.log("❌ 错误: 无效的以太坊地址");
    return;
  }
  
  await diagnoseStaticRewards(userAddress);
}

main().catch(console.error);