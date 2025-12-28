const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 诊断赎回错误...");
  console.log("=".repeat(60));

  // 新部署的合约地址
  const PROTOCOL_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";

  const PROTOCOL_ABI = [
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function redeemEnabled() view returns (bool)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)"
  ];

  try {
    const [deployer] = await ethers.getSigners();
    const testUser = deployer.address; // 使用部署者地址作为测试用户
    
    console.log(`📋 测试用户: ${testUser}`);
    console.log(`📋 合约地址: ${PROTOCOL_ADDRESS}`);
    console.log("");

    // 连接合约
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 1. 检查赎回功能是否启用
    console.log("1️⃣ 检查赎回功能状态:");
    console.log("-".repeat(40));
    const redeemEnabled = await protocol.redeemEnabled();
    console.log(`赎回功能启用: ${redeemEnabled ? '✅ 是' : '❌ 否'}`);
    
    if (!redeemEnabled) {
      console.log("❌ 赎回功能被禁用，这是错误的主要原因！");
      return;
    }
    console.log("");

    // 2. 检查用户质押记录
    console.log("2️⃣ 检查用户质押记录:");
    console.log("-".repeat(40));
    
    let hasStakes = false;
    let hasExpiredStakes = false;
    const currentTime = Math.floor(Date.now() / 1000);
    const SECONDS_IN_UNIT = await protocol.SECONDS_IN_UNIT();
    
    console.log(`当前时间戳: ${currentTime}`);
    console.log(`时间单位: ${SECONDS_IN_UNIT.toString()} 秒`);
    console.log("");

    // 检查前10个质押位置
    for (let i = 0; i < 10; i++) {
      try {
        const stake = await protocol.userStakes(testUser, i);
        
        if (stake.amount > 0) {
          hasStakes = true;
          const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(SECONDS_IN_UNIT));
          const isExpired = currentTime >= endTime;
          const isActive = stake.active;
          
          if (isExpired && isActive) {
            hasExpiredStakes = true;
          }
          
          console.log(`质押 ${i}:`);
          console.log(`  - ID: ${stake.id.toString()}`);
          console.log(`  - 金额: ${ethers.formatEther(stake.amount)} MC`);
          console.log(`  - 开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
          console.log(`  - 周期: ${stake.cycleDays.toString()} 个时间单位`);
          console.log(`  - 结束时间: ${new Date(endTime * 1000).toLocaleString()}`);
          console.log(`  - 是否活跃: ${isActive ? '是' : '否'}`);
          console.log(`  - 是否到期: ${isExpired ? '✅ 是' : '❌ 否'}`);
          console.log(`  - 已支付: ${ethers.formatEther(stake.paid)} MC`);
          console.log("");
        }
      } catch (error) {
        // 没有更多质押记录
        break;
      }
    }

    if (!hasStakes) {
      console.log("❌ 用户没有任何质押记录！");
      console.log("原因: 这是全新部署的合约，所有历史数据已清空");
      console.log("解决方案: 用户需要重新购买门票并质押流动性");
      return;
    }

    if (!hasExpiredStakes) {
      console.log("❌ 用户没有到期的质押记录！");
      console.log("原因: 所有质押都还未到期，无法赎回");
      console.log("解决方案: 等待质押到期后再尝试赎回");
      return;
    }

    // 3. 检查用户基本信息
    console.log("3️⃣ 检查用户基本信息:");
    console.log("-".repeat(40));
    const userInfo = await protocol.userInfo(testUser);
    console.log(`推荐人: ${userInfo.referrer}`);
    console.log(`是否活跃: ${userInfo.isActive ? '是' : '否'}`);
    console.log(`最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
    console.log("");

    console.log("✅ 诊断完成！");
    console.log("如果以上检查都通过，但仍然出错，可能是:");
    console.log("- Gas费不足");
    console.log("- 网络连接问题");
    console.log("- 前端ABI与合约不匹配");

  } catch (error) {
    console.error("❌ 诊断失败:", error);
  }
}

main().catch(console.error);