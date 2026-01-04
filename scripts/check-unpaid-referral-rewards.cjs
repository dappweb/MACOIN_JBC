const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getDirectReferrals(address) view returns (address[])",
  "function directRewardPercent() view returns (uint256)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

async function checkUnpaidReferralRewards() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  console.log("🔍 统计未支付的推荐奖励\n");
  console.log("=" .repeat(60));
  console.log(`协议合约地址: ${PROTOCOL_ADDRESS}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 获取所有购买门票事件
    console.log("📋 步骤 1: 获取所有购买门票事件...");
    const purchaseEvents = await protocol.queryFilter(protocol.filters.TicketPurchased());
    console.log(`    ✅ 找到 ${purchaseEvents.length} 条购买门票事件\n`);

    // 2. 获取所有推荐奖励事件
    console.log("📋 步骤 2: 获取所有推荐奖励事件...");
    const rewardEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
    console.log(`    ✅ 找到 ${rewardEvents.length} 条推荐奖励事件\n`);

    // 3. 分析每个购买事件
    console.log("📋 步骤 3: 分析每个购买事件...");
    const unpaidRewards = [];
    const paidRewards = new Map(); // ticketId -> { referrer, amount }
    
    // 建立已支付奖励的映射
    for (const event of rewardEvents) {
      const ticketId = event.args.ticketId?.toString();
      const from = event.args.from?.toLowerCase();
      const user = event.args.user?.toLowerCase();
      const amount = event.args.mcAmount || 0n;
      
      if (ticketId && from && user) {
        const key = `${ticketId}-${from}-${user}`;
        if (!paidRewards.has(key)) {
          paidRewards.set(key, { referrer: user, from: from, amount: amount, ticketId: ticketId });
        } else {
          // 累加已支付金额
          const existing = paidRewards.get(key);
          existing.amount += amount;
        }
      }
    }

    console.log(`    已建立 ${paidRewards.size} 条已支付奖励记录\n`);

    // 4. 检查每个购买事件是否有对应的推荐奖励
    console.log("📋 步骤 4: 检查未支付的推荐奖励...");
    let processedCount = 0;
    const batchSize = 50; // 每批处理50个
    
    for (let i = 0; i < purchaseEvents.length; i += batchSize) {
      const batch = purchaseEvents.slice(i, i + batchSize);
      console.log(`    处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(purchaseEvents.length / batchSize)} (${batch.length} 个事件)...`);
      
      for (const event of batch) {
        const buyer = event.args.user?.toLowerCase();
        const amount = event.args.amount || 0n;
        const ticketId = event.args.ticketId?.toString();
        const blockNumber = event.blockNumber;
        
        if (!buyer || !ticketId) continue;
        
        try {
          // 获取购买时的用户信息（使用历史查询）
          const userInfo = await protocol.userInfo.staticCall(buyer, {
            blockTag: blockNumber
          });
          
          const referrer = userInfo.referrer?.toLowerCase();
          
          if (referrer && referrer !== ethers.ZeroAddress.toLowerCase()) {
            // 检查推荐人是否激活（购买时）
            const referrerInfo = await protocol.userInfo.staticCall(referrer, {
              blockTag: blockNumber
            });
            
            if (referrerInfo.isActive) {
              // 计算应该支付的推荐奖励
              const expectedReward = amount * 25n / 100n; // 25%
              
              // 检查是否已支付
              const key = `${ticketId}-${buyer}-${referrer}`;
              const paid = paidRewards.get(key);
              
              if (!paid || paid.amount < expectedReward) {
                const unpaidAmount = paid ? (expectedReward - paid.amount) : expectedReward;
                
                unpaidRewards.push({
                  ticketId: ticketId,
                  buyer: buyer,
                  referrer: referrer,
                  ticketAmount: ethers.formatEther(amount),
                  expectedReward: ethers.formatEther(expectedReward),
                  paidReward: paid ? ethers.formatEther(paid.amount) : "0",
                  unpaidAmount: ethers.formatEther(unpaidAmount),
                  blockNumber: blockNumber,
                  transactionHash: event.transactionHash,
                  timestamp: new Date(Number((await provider.getBlock(blockNumber)).timestamp) * 1000).toLocaleString('zh-CN')
                });
              }
            }
          }
          
          processedCount++;
          if (processedCount % 100 === 0) {
            process.stdout.write(`\r    已处理: ${processedCount}/${purchaseEvents.length}`);
          }
        } catch (error) {
          console.log(`\n    ⚠️  处理事件失败 (ticketId: ${ticketId}): ${error.message}`);
        }
      }
    }
    
    console.log(`\n    ✅ 处理完成，共检查 ${processedCount} 个购买事件\n`);

    // 5. 统计结果
    console.log("📊 统计结果:");
    console.log("=" .repeat(60));
    console.log(`总购买事件数: ${purchaseEvents.length}`);
    console.log(`总推荐奖励事件数: ${rewardEvents.length}`);
    console.log(`未支付推荐奖励数: ${unpaidRewards.length}`);
    
    // 计算总未支付金额
    const totalUnpaid = unpaidRewards.reduce((sum, item) => {
      return sum + BigInt(ethers.parseEther(item.unpaidAmount));
    }, 0n);
    
    console.log(`总未支付金额: ${ethers.formatEther(totalUnpaid)} MC`);
    console.log("=" .repeat(60) + "\n");

    // 6. 显示未支付详情（前20个）
    if (unpaidRewards.length > 0) {
      console.log("📋 未支付推荐奖励详情（前20个）:");
      console.log("-".repeat(100));
      
      unpaidRewards.slice(0, 20).forEach((item, index) => {
        console.log(`\n${index + 1}. 门票ID: ${item.ticketId}`);
        console.log(`   购买人: ${item.buyer}`);
        console.log(`   推荐人: ${item.referrer}`);
        console.log(`   门票金额: ${item.ticketAmount} MC`);
        console.log(`   应支付奖励: ${item.expectedReward} MC`);
        console.log(`   已支付奖励: ${item.paidReward} MC`);
        console.log(`   未支付金额: ${item.unpaidAmount} MC`);
        console.log(`   区块号: ${item.blockNumber}`);
        console.log(`   交易哈希: ${item.transactionHash}`);
        console.log(`   时间: ${item.timestamp}`);
      });
      
      if (unpaidRewards.length > 20) {
        console.log(`\n   ... 还有 ${unpaidRewards.length - 20} 条未显示`);
      }
    } else {
      console.log("✅ 未发现未支付的推荐奖励");
    }

    // 7. 按推荐人统计
    if (unpaidRewards.length > 0) {
      console.log("\n📊 按推荐人统计未支付金额:");
      console.log("-".repeat(100));
      
      const referrerStats = new Map();
      for (const item of unpaidRewards) {
        const referrer = item.referrer;
        if (!referrerStats.has(referrer)) {
          referrerStats.set(referrer, {
            count: 0,
            totalUnpaid: 0n
          });
        }
        const stats = referrerStats.get(referrer);
        stats.count++;
        stats.totalUnpaid += BigInt(ethers.parseEther(item.unpaidAmount));
      }
      
      // 按未支付金额排序
      const sortedReferrers = Array.from(referrerStats.entries())
        .map(([referrer, stats]) => ({
          referrer,
          count: stats.count,
          totalUnpaid: ethers.formatEther(stats.totalUnpaid)
        }))
        .sort((a, b) => parseFloat(b.totalUnpaid) - parseFloat(a.totalUnpaid));
      
      console.log(`\n   共 ${sortedReferrers.length} 个推荐人受影响\n`);
      
      sortedReferrers.slice(0, 10).forEach((item, index) => {
        console.log(`${index + 1}. ${item.referrer}`);
        console.log(`   未支付次数: ${item.count}`);
        console.log(`   总未支付金额: ${item.totalUnpaid} MC`);
      });
      
      if (sortedReferrers.length > 10) {
        console.log(`\n   ... 还有 ${sortedReferrers.length - 10} 个推荐人`);
      }
    }

    // 8. 保存结果到文件
    if (unpaidRewards.length > 0) {
      const fs = require('fs');
      const outputFile = 'scripts/unpaid-referral-rewards.json';
      fs.writeFileSync(outputFile, JSON.stringify({
        summary: {
          totalPurchases: purchaseEvents.length,
          totalRewardEvents: rewardEvents.length,
          unpaidCount: unpaidRewards.length,
          totalUnpaid: ethers.formatEther(totalUnpaid)
        },
        unpaidRewards: unpaidRewards,
        referrerStats: sortedReferrers || []
      }, null, 2));
      console.log(`\n✅ 详细结果已保存到: ${outputFile}`);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    console.error(error.stack);
  }
}

// 执行检查
checkUnpaidReferralRewards().catch(console.error);

