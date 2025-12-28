import { ethers } from "ethers";

// 合约地址和完整ABI
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function claimRewards() external",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function owner() view returns (address)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed source, uint256 mcAmount, uint256 rewardType, uint256 ticketId)"
];

async function verifyContractCompatibility() {
  console.log("🔍 合约兼容性验证工具");
  console.log("=" .repeat(60));
  console.log(`合约地址: ${CONTRACT_ADDRESSES.PROTOCOL}`);
  console.log("");

  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mchains.io");
    const protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    // 1. 验证合约基本信息
    console.log("📋 验证合约基本信息");
    console.log("-".repeat(40));
    
    try {
      const owner = await protocol.owner();
      console.log(`✅ 合约所有者: ${owner}`);
    } catch (error) {
      console.log(`❌ 无法获取合约所有者: ${error.message}`);
    }

    try {
      const secondsInUnit = await protocol.SECONDS_IN_UNIT();
      console.log(`✅ 时间单位: ${secondsInUnit} 秒`);
    } catch (error) {
      console.log(`❌ 无法获取时间单位: ${error.message}`);
    }

    try {
      const reserveMC = await protocol.swapReserveMC();
      const reserveJBC = await protocol.swapReserveJBC();
      console.log(`✅ MC储备: ${ethers.formatEther(reserveMC)} MC`);
      console.log(`✅ JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
    } catch (error) {
      console.log(`❌ 无法获取流动性储备: ${error.message}`);
    }

    console.log("");

    // 2. 验证事件签名
    console.log("📡 验证事件签名");
    console.log("-".repeat(40));
    
    try {
      const rewardClaimedTopic = protocol.interface.getEvent("RewardClaimed").topicHash;
      console.log(`✅ RewardClaimed 事件签名: ${rewardClaimedTopic}`);
    } catch (error) {
      console.log(`❌ RewardClaimed 事件签名错误: ${error.message}`);
    }

    try {
      const referralRewardTopic = protocol.interface.getEvent("ReferralRewardPaid").topicHash;
      console.log(`✅ ReferralRewardPaid 事件签名: ${referralRewardTopic}`);
    } catch (error) {
      console.log(`❌ ReferralRewardPaid 事件签名错误: ${error.message}`);
    }

    console.log("");

    // 3. 测试函数调用
    console.log("🔧 测试函数调用");
    console.log("-".repeat(40));
    
    const testAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
    
    try {
      const userInfo = await protocol.userInfo(testAddress);
      console.log(`✅ userInfo 调用成功`);
      console.log(`   总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
      console.log(`   收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    } catch (error) {
      console.log(`❌ userInfo 调用失败: ${error.message}`);
    }

    try {
      const ticket = await protocol.userTicket(testAddress);
      console.log(`✅ userTicket 调用成功`);
      console.log(`   门票金额: ${ethers.formatEther(ticket.amount)} MC`);
      console.log(`   是否退出: ${ticket.exited}`);
    } catch (error) {
      console.log(`❌ userTicket 调用失败: ${error.message}`);
    }

    try {
      const stake = await protocol.userStakes(testAddress, 0);
      console.log(`✅ userStakes 调用成功`);
      console.log(`   质押金额: ${ethers.formatEther(stake.amount)} MC`);
      console.log(`   是否活跃: ${stake.active}`);
    } catch (error) {
      console.log(`❌ userStakes 调用失败: ${error.message}`);
    }

    console.log("");

    // 4. 测试事件查询
    console.log("📊 测试事件查询");
    console.log("-".repeat(40));
    
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      console.log(`当前区块: ${currentBlock}`);
      console.log(`查询范围: ${fromBlock} - ${currentBlock}`);
      
      const rewardEvents = await protocol.queryFilter(
        protocol.filters.RewardClaimed(),
        fromBlock
      );
      console.log(`✅ 找到 ${rewardEvents.length} 个 RewardClaimed 事件`);
      
      const referralEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(),
        fromBlock
      );
      console.log(`✅ 找到 ${referralEvents.length} 个 ReferralRewardPaid 事件`);
      
      // 显示最近的几个事件
      if (rewardEvents.length > 0) {
        console.log("\n最近的奖励事件:");
        rewardEvents.slice(-3).forEach((event, index) => {
          console.log(`  事件 ${index + 1}:`);
          console.log(`    用户: ${event.args[0]}`);
          console.log(`    MC金额: ${ethers.formatEther(event.args[1])}`);
          console.log(`    JBC金额: ${ethers.formatEther(event.args[2])}`);
          console.log(`    奖励类型: ${event.args[3]}`);
          console.log(`    区块: ${event.blockNumber}`);
        });
      }
      
    } catch (error) {
      console.log(`❌ 事件查询失败: ${error.message}`);
    }

    console.log("");

    // 5. 网络连接测试
    console.log("🌐 网络连接测试");
    console.log("-".repeat(40));
    
    try {
      const network = await provider.getNetwork();
      console.log(`✅ 网络连接正常`);
      console.log(`   链ID: ${network.chainId}`);
      console.log(`   网络名称: ${network.name}`);
    } catch (error) {
      console.log(`❌ 网络连接失败: ${error.message}`);
    }

    try {
      const gasPrice = await provider.getFeeData();
      console.log(`✅ Gas价格获取成功: ${ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei")} Gwei`);
    } catch (error) {
      console.log(`❌ Gas价格获取失败: ${error.message}`);
    }

    console.log("");
    console.log("🎯 验证总结");
    console.log("=".repeat(40));
    console.log("✅ 合约兼容性验证完成");
    console.log("💡 如果所有测试都通过，说明合约集成正常");
    console.log("💡 如果有失败项，请检查对应的合约地址、ABI或网络配置");

  } catch (error) {
    console.error("❌ 验证过程中发生错误:", error.message);
    console.log("\n🔧 故障排除建议:");
    console.log("1. 检查网络连接是否正常");
    console.log("2. 确认合约地址是否正确");
    console.log("3. 验证RPC端点是否可用");
    console.log("4. 检查ABI定义是否完整");
  }
}

// 运行验证
verifyContractCompatibility();