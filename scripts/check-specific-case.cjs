const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

async function checkSpecificCase() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  const referrerAddress = "0xb6A10c3F6492e5FEfdC03909E1638FE3A8ce5C75";
  const referredAddress = "0xaA4D3862ea0A72d83D6399D6700FcA1952d8e64d";

  console.log("🔍 检查特定案例的推荐奖励\n");
  console.log("=" .repeat(60));
  console.log(`推荐人: ${referrerAddress}`);
  console.log(`被推荐人: ${referredAddress}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 查找被推荐人的购买事件
    console.log("📋 查找购买事件...");
    const purchaseEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(referredAddress));
    
    if (purchaseEvents.length === 0) {
      console.log("    ❌ 未找到购买事件");
      return;
    }
    
    console.log(`    ✅ 找到 ${purchaseEvents.length} 条购买事件\n`);
    
    for (const event of purchaseEvents) {
      const ticketId = event.args.ticketId?.toString();
      const amount = event.args.amount || 0n;
      const blockNumber = event.blockNumber;
      const txHash = event.transactionHash;
      
      console.log(`  门票ID: ${ticketId}`);
      console.log(`  金额: ${ethers.formatEther(amount)} MC`);
      console.log(`  区块号: ${blockNumber}`);
      console.log(`  交易哈希: ${txHash}`);
      
      // 2. 查找对应的推荐奖励事件
      console.log("\n  📋 查找推荐奖励事件...");
      const rewardEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(referrerAddress, referredAddress)
      );
      
      // 筛选出相同 ticketId 的奖励事件
      const matchingRewards = rewardEvents.filter(e => 
        e.args.ticketId?.toString() === ticketId
      );
      
      if (matchingRewards.length > 0) {
        console.log(`    ✅ 找到 ${matchingRewards.length} 条推荐奖励事件`);
        let totalPaid = 0n;
        matchingRewards.forEach((e, index) => {
          const paid = e.args.mcAmount || 0n;
          totalPaid += paid;
          console.log(`\n    奖励事件 ${index + 1}:`);
          console.log(`      MC 金额: ${ethers.formatEther(paid)} MC`);
          console.log(`      JBC 金额: ${ethers.formatEther(e.args.jbcAmount || 0n)} JBC`);
          console.log(`      奖励类型: ${e.args.rewardType === 0 ? '直推奖励' : '层级奖励'}`);
          console.log(`      区块号: ${e.blockNumber}`);
          console.log(`      交易哈希: ${e.transactionHash}`);
        });
        
        const expectedReward = amount * 25n / 100n;
        console.log(`\n    应支付: ${ethers.formatEther(expectedReward)} MC`);
        console.log(`    已支付: ${ethers.formatEther(totalPaid)} MC`);
        
        if (totalPaid < expectedReward) {
          const unpaid = expectedReward - totalPaid;
          console.log(`    ❌ 未支付: ${ethers.formatEther(unpaid)} MC`);
        } else {
          console.log(`    ✅ 已全额支付`);
        }
      } else {
        console.log(`    ❌ 未找到推荐奖励事件`);
        
        // 检查购买时的状态
        console.log("\n  📋 检查购买时的状态...");
        try {
          const userInfo = await protocol.userInfo.staticCall(referredAddress, {
            blockTag: blockNumber
          });
          
          const referrer = userInfo.referrer?.toLowerCase();
          console.log(`    被推荐人的推荐人: ${referrer}`);
          console.log(`    是否匹配: ${referrer === referrerAddress.toLowerCase() ? '✅ 是' : '❌ 否'}`);
          
          if (referrer === referrerAddress.toLowerCase()) {
            const referrerInfo = await protocol.userInfo.staticCall(referrerAddress, {
              blockTag: blockNumber
            });
            console.log(`    推荐人是否激活: ${referrerInfo.isActive ? '✅ 是' : '❌ 否'}`);
            
            const expectedReward = amount * 25n / 100n;
            console.log(`    应支付奖励: ${ethers.formatEther(expectedReward)} MC`);
            console.log(`    ❌ 确认：推荐奖励未支付！`);
          }
        } catch (e) {
          console.log(`    ⚠️  无法检查历史状态: ${e.message}`);
        }
      }
      
      console.log("\n" + "-".repeat(60) + "\n");
    }

    console.log("=" .repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkSpecificCase().catch(console.error);

