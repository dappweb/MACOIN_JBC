import { ethers } from "ethers";

// 合约地址和ABI
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function SECONDS_IN_UNIT() view returns (uint256)"
];

async function diagnoseUser(userAddress) {
  console.log("🔍 静态奖励诊断工具");
  console.log("=" .repeat(50));
  console.log(`用户地址: ${userAddress}`);
  console.log("");

  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    // 1. 检查门票状态
    console.log("🎫 检查门票状态");
    console.log("-".repeat(30));
    const ticket = await protocol.userTicket(userAddress);
    console.log(`门票金额: ${ethers.formatEther(ticket.amount)} MC`);
    console.log(`是否退出: ${ticket.exited}`);
    
    if (ticket.amount === 0n || ticket.exited) {
      console.log("❌ 问题发现: 用户没有有效门票");
      console.log("💡 解决方案: 需要购买门票才能获得静态奖励");
      return;
    }
    console.log("✅ 门票状态正常");
    console.log("");

    // 2. 检查收益上限
    console.log("📊 检查收益状态");
    console.log("-".repeat(30));
    const userInfo = await protocol.userInfo(userAddress);
    const totalRevenue = ethers.formatEther(userInfo.totalRevenue);
    const currentCap = ethers.formatEther(userInfo.currentCap);
    const remainingCap = userInfo.currentCap - userInfo.totalRevenue;
    
    console.log(`总收益: ${totalRevenue} MC`);
    console.log(`收益上限: ${currentCap} MC`);
    console.log(`剩余空间: ${ethers.formatEther(remainingCap)} MC`);
    
    if (remainingCap <= 0n) {
      console.log("❌ 问题发现: 用户已达到收益上限");
      console.log("💡 解决方案: 需要购买更多门票提高收益上限");
      return;
    }
    console.log("✅ 收益上限正常");
    console.log("");

    // 3. 检查质押记录
    console.log("🏦 检查质押记录");
    console.log("-".repeat(30));
    
    let hasActiveStakes = false;
    let totalPendingRewards = 0n;
    const secondsInUnit = await protocol.SECONDS_IN_UNIT();
    const currentTime = Math.floor(Date.now() / 1000);
    
    for (let i = 0; i < 5; i++) {
      try {
        const stake = await protocol.userStakes(userAddress, i);
        if (stake.amount === 0n) break;
        
        console.log(`\n质押 #${i}:`);
        console.log(`  金额: ${ethers.formatEther(stake.amount)} MC`);
        console.log(`  周期: ${stake.cycleDays} 天`);
        console.log(`  活跃: ${stake.active}`);
        
        if (stake.active) {
          hasActiveStakes = true;
          
          // 计算静态奖励
          const unitsPassed = Math.floor((currentTime - Number(stake.startTime)) / Number(secondsInUnit));
          const maxUnits = Number(stake.cycleDays);
          const actualUnits = Math.min(unitsPassed, maxUnits);
          
          let ratePerBillion = 0;
          if (Number(stake.cycleDays) === 7) ratePerBillion = 13333334;
          else if (Number(stake.cycleDays) === 15) ratePerBillion = 16666667;
          else if (Number(stake.cycleDays) === 30) ratePerBillion = 20000000;
          
          const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
          const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
          
          console.log(`  已过时间单位: ${actualUnits}/${maxUnits}`);
          console.log(`  已支付: ${ethers.formatEther(stake.paid)} MC`);
          console.log(`  待领取: ${ethers.formatEther(pending)} MC`);
          
          totalPendingRewards += pending;
        }
      } catch (error) {
        break;
      }
    }
    
    console.log(`\n📊 质押汇总:`);
    console.log(`有活跃质押: ${hasActiveStakes}`);
    console.log(`总待领取: ${ethers.formatEther(totalPendingRewards)} MC`);
    
    // 4. 给出诊断结论
    console.log("\n🎯 诊断结论");
    console.log("=".repeat(30));
    
    if (!hasActiveStakes) {
      console.log("❌ 问题: 用户没有活跃的质押记录");
      console.log("💡 解决方案: 需要进行质押才能获得静态奖励");
    } else if (totalPendingRewards === 0n) {
      console.log("⏳ 问题: 质押时间不足或已全部领取");
      console.log("💡 解决方案: 等待更多时间或检查是否已领取");
    } else {
      console.log("✅ 用户有待领取的静态奖励！");
      console.log(`💰 可领取: ${ethers.formatEther(totalPendingRewards)} MC`);
      console.log("💡 建议: 调用 claimRewards 函数领取奖励");
      console.log("📝 注意: 只有领取后才会在前端显示奖励记录");
    }
    
  } catch (error) {
    console.error("❌ 诊断失败:", error.message);
  }
}

// 使用示例
const userAddress = process.argv[2] || "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
diagnoseUser(userAddress);