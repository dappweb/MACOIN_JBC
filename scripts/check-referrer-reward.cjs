const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI（简化版，只包含需要的函数）
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getDirectReferrals(address) view returns (address[])",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event RewardCapped(address indexed user, uint256 requested, uint256 paid)",
];

async function checkReferrerReward() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  const referrerAddress = "0xb6A10c3F6492e5FEfdC03909E1638FE3A8ce5C75";
  const referredAddress = "0xaA4D3862ea0A72d83D6399D6700FcA1952d8e64d";

  console.log("🔍 检查推荐关系和奖励状态\n");
  console.log("=" .repeat(60));
  console.log(`推荐人地址: ${referrerAddress}`);
  console.log(`被推荐人地址: ${referredAddress}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 检查被推荐人的信息
    console.log("📋 被推荐人信息:");
    const referredInfo = await protocol.userInfo(referredAddress);
    console.log(`  推荐人: ${referredInfo.referrer}`);
    console.log(`  是否激活: ${referredInfo.isActive}`);
    console.log(`  活跃直推数: ${referredInfo.activeDirects.toString()}`);
    console.log(`  团队人数: ${referredInfo.teamCount.toString()}`);
    console.log(`  总收益: ${ethers.formatEther(referredInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${ethers.formatEther(referredInfo.currentCap)} MC`);
    
    // 检查推荐关系是否正确
    const isCorrectReferrer = referredInfo.referrer.toLowerCase() === referrerAddress.toLowerCase();
    console.log(`  推荐关系: ${isCorrectReferrer ? "✅ 正确" : "❌ 不匹配"}`);
    console.log("");

    // 2. 检查被推荐人的门票信息
    console.log("🎫 被推荐人门票信息:");
    const referredTicket = await protocol.userTicket(referredAddress);
    console.log(`  门票ID: ${referredTicket.ticketId.toString()}`);
    console.log(`  门票金额: ${ethers.formatEther(referredTicket.amount)} MC`);
    console.log(`  购买时间: ${new Date(Number(referredTicket.purchaseTime) * 1000).toLocaleString('zh-CN')}`);
    console.log(`  是否退出: ${referredTicket.exited}`);
    console.log("");

    // 3. 检查推荐人的信息
    console.log("👤 推荐人信息:");
    const referrerInfo = await protocol.userInfo(referrerAddress);
    console.log(`  是否激活: ${referrerInfo.isActive}`);
    console.log(`  活跃直推数: ${referrerInfo.activeDirects.toString()}`);
    console.log(`  团队人数: ${referrerInfo.teamCount.toString()}`);
    console.log(`  总收益: ${ethers.formatEther(referrerInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${ethers.formatEther(referrerInfo.currentCap)} MC`);
    console.log("");

    // 4. 检查推荐人的直推列表
    console.log("📝 推荐人的直推列表:");
    const directReferrals = await protocol.getDirectReferrals(referrerAddress);
    console.log(`  直推数量: ${directReferrals.length}`);
    const isInList = directReferrals.some(addr => addr.toLowerCase() === referredAddress.toLowerCase());
    console.log(`  被推荐人是否在列表中: ${isInList ? "✅ 是" : "❌ 否"}`);
    if (directReferrals.length > 0) {
      console.log("  直推地址列表:");
      directReferrals.forEach((addr, index) => {
        const isTarget = addr.toLowerCase() === referredAddress.toLowerCase();
        console.log(`    ${index + 1}. ${addr} ${isTarget ? "← 目标地址" : ""}`);
      });
    }
    console.log("");

    // 5. 分析推荐奖励
    console.log("💰 推荐奖励分析:");
    
    if (!isCorrectReferrer) {
      console.log("  ❌ 推荐关系不匹配，无法获得推荐奖励");
      return;
    }

    if (!referrerInfo.isActive) {
      console.log("  ⚠️  推荐人未激活，无法获得推荐奖励");
    } else {
      console.log("  ✅ 推荐人已激活，可以获得推荐奖励");
    }

    if (referredTicket.amount === 0n) {
      console.log("  ⚠️  被推荐人未购买门票，推荐人无法获得奖励");
    } else {
      console.log(`  ✅ 被推荐人已购买门票: ${ethers.formatEther(referredTicket.amount)} MC`);
      
      // 计算可能的推荐奖励（假设直推奖励比例为 25%）
      const ticketAmount = referredTicket.amount;
      const estimatedDirectReward = ticketAmount * 25n / 100n;
      console.log(`  💵 预估直推奖励: ${ethers.formatEther(estimatedDirectReward)} MC (25%)`);
    }

    // 6. 检查推荐人是否在直推列表中
    if (isInList && referrerInfo.isActive && referredTicket.amount > 0n) {
      console.log("\n  ✅ 推荐人应该已经获得推荐奖励");
      console.log(`  💰 推荐人总收益: ${ethers.formatEther(referrerInfo.totalRevenue)} MC`);
    } else {
      console.log("\n  ⚠️  推荐人可能尚未获得推荐奖励，原因：");
      if (!isInList) console.log("     - 被推荐人不在推荐人的直推列表中");
      if (!referrerInfo.isActive) console.log("     - 推荐人未激活");
      if (referredTicket.amount === 0n) console.log("     - 被推荐人未购买门票");
    }

    // 7. 检查事件日志
    console.log("📜 检查推荐奖励事件日志:");
    try {
      // 查询所有推荐奖励事件（不限制地址）
      const allReferralEvents = await protocol.queryFilter(protocol.filters.ReferralRewardPaid());
      
      // 筛选出相关的奖励事件
      const relevantEvents = allReferralEvents.filter(event => {
        const eventReferrer = event.args.user?.toLowerCase();
        const eventFrom = event.args.from?.toLowerCase();
        return (eventReferrer === referrerAddress.toLowerCase() && 
                eventFrom === referredAddress.toLowerCase());
      });
      
      if (relevantEvents.length > 0) {
        console.log(`  ✅ 找到 ${relevantEvents.length} 条推荐奖励事件`);
        relevantEvents.forEach((event, index) => {
          console.log(`\n  事件 ${index + 1}:`);
          console.log(`    区块号: ${event.blockNumber}`);
          console.log(`    交易哈希: ${event.transactionHash}`);
          console.log(`    MC 金额: ${ethers.formatEther(event.args.mcAmount || 0n)} MC`);
          console.log(`    JBC 金额: ${ethers.formatEther(event.args.jbcAmount || 0n)} JBC`);
          console.log(`    奖励类型: ${event.args.rewardType === 0 ? '直推奖励' : '层级奖励'}`);
          console.log(`    门票ID: ${event.args.ticketId?.toString() || 'N/A'}`);
        });
      } else {
        console.log("  ⚠️  未找到推荐奖励事件");
        console.log("  可能原因：");
        console.log("    1. 奖励支付时合约余额不足");
        console.log("    2. 推荐人在购买时未激活");
        console.log("    3. 奖励被收益上限限制为 0");
        console.log("    4. 推荐奖励支付失败（技术问题）");
        
        // 检查购买门票时的事件
        console.log("\n  检查购买门票事件:");
        try {
          const ticketPurchaseEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(referredAddress));
          if (ticketPurchaseEvents.length > 0) {
            const purchaseEvent = ticketPurchaseEvents[0];
            console.log(`    找到购买门票事件:`);
            console.log(`    区块号: ${purchaseEvent.blockNumber}`);
            console.log(`    交易哈希: ${purchaseEvent.transactionHash}`);
            console.log(`    门票金额: ${ethers.formatEther(purchaseEvent.args.amount || 0n)} MC`);
            console.log(`    门票ID: ${purchaseEvent.args.ticketId?.toString() || 'N/A'}`);
            
            // 检查该区块时推荐人的状态
            console.log("\n    检查购买时的推荐人状态:");
            const blockNumber = purchaseEvent.blockNumber;
            const block = await provider.getBlock(blockNumber);
            console.log(`    购买时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
          }
        } catch (purchaseError) {
          console.log("    无法查询购买事件:", purchaseError.message);
        }
      }
    } catch (eventError) {
      console.log("  ⚠️  无法查询事件日志:", eventError.message);
    }

    // 8. 检查推荐人的收益上限
    console.log("\n📊 收益上限分析:");
    const availableCap = referrerInfo.currentCap - referrerInfo.totalRevenue;
    console.log(`  当前上限: ${ethers.formatEther(referrerInfo.currentCap)} MC`);
    console.log(`  已用收益: ${ethers.formatEther(referrerInfo.totalRevenue)} MC`);
    console.log(`  可用额度: ${ethers.formatEther(availableCap)} MC`);
    
    const estimatedReward = referredTicket.amount * 25n / 100n;
    if (availableCap < estimatedReward) {
      console.log(`  ⚠️  可用额度 (${ethers.formatEther(availableCap)} MC) 小于预估奖励 (${ethers.formatEther(estimatedReward)} MC)`);
      console.log(`  实际可支付奖励: ${ethers.formatEther(availableCap)} MC`);
    } else {
      console.log(`  ✅ 可用额度足够支付预估奖励`);
    }

    // 9. 检查购买时的历史状态
    console.log("\n🔍 检查购买时的历史状态:");
    try {
      const purchaseBlockNumber = 2110803; // 从购买事件中获取
      console.log(`  购买区块号: ${purchaseBlockNumber}`);
      
      // 获取购买时的区块信息
      const purchaseBlock = await provider.getBlock(purchaseBlockNumber);
      console.log(`  区块时间: ${new Date(Number(purchaseBlock.timestamp) * 1000).toLocaleString('zh-CN')}`);
      
      // 在购买区块时查询推荐人状态（使用历史调用）
      console.log("\n  查询购买时推荐人的状态:");
      try {
        // 使用 callStatic 在历史区块查询
        const historicalReferrerInfo = await protocol.userInfo.staticCall(referrerAddress, {
          blockTag: purchaseBlockNumber
        });
        console.log(`    是否激活: ${historicalReferrerInfo.isActive}`);
        console.log(`    总收益: ${ethers.formatEther(historicalReferrerInfo.totalRevenue)} MC`);
        console.log(`    当前上限: ${ethers.formatEther(historicalReferrerInfo.currentCap)} MC`);
        
        // 检查推荐人是否有门票
        const historicalReferrerTicket = await protocol.userTicket.staticCall(referrerAddress, {
          blockTag: purchaseBlockNumber
        });
        console.log(`    门票金额: ${ethers.formatEther(historicalReferrerTicket.amount)} MC`);
        console.log(`    门票是否退出: ${historicalReferrerTicket.exited}`);
        
        if (!historicalReferrerInfo.isActive || historicalReferrerTicket.amount === 0n || historicalReferrerTicket.exited) {
          console.log("\n    ❌ 问题确认：购买时推荐人未激活！");
          console.log("    这就是为什么没有支付推荐奖励的原因。");
        } else {
          console.log("\n    ✅ 购买时推荐人已激活");
          console.log("    需要进一步检查其他原因。");
        }
      } catch (historicalError) {
        console.log("    ⚠️  无法查询历史状态:", historicalError.message);
        console.log("    可能 RPC 节点不支持历史查询");
      }
      
      // 检查购买时合约的余额
      console.log("\n  查询购买时合约的余额:");
      try {
        const historicalBalance = await provider.getBalance(PROTOCOL_ADDRESS, purchaseBlockNumber);
        console.log(`    合约 MC 余额: ${ethers.formatEther(historicalBalance)} MC`);
        
        const estimatedReward = referredTicket.amount * 25n / 100n;
        if (historicalBalance < estimatedReward) {
          console.log(`    ❌ 合约余额不足！需要 ${ethers.formatEther(estimatedReward)} MC，但只有 ${ethers.formatEther(historicalBalance)} MC`);
        } else {
          console.log(`    ✅ 合约余额充足（需要 ${ethers.formatEther(estimatedReward)} MC）`);
        }
      } catch (balanceError) {
        console.log("    ⚠️  无法查询历史余额:", balanceError.message);
      }
      
      // 检查购买交易的详细信息
      console.log("\n  检查购买交易的详细信息:");
      try {
        const purchaseTxHash = "0xcad5a22e818a02162b8c3f0edfa72cb8bab90fa662d1cb08f98545b6bef57b2b";
        const tx = await provider.getTransactionReceipt(purchaseTxHash);
        console.log(`    交易状态: ${tx.status === 1 ? '成功' : '失败'}`);
        console.log(`    Gas 使用: ${tx.gasUsed.toString()}`);
        console.log(`    事件数量: ${tx.logs.length}`);
        
        // 解析所有事件
        const protocolInterface = new ethers.Interface(PROTOCOL_ABI);
        let foundEvents = 0;
        const allEvents = [];
        
        for (const log of tx.logs) {
          try {
            // 检查是否是协议合约的事件
            if (log.address.toLowerCase() === PROTOCOL_ADDRESS.toLowerCase()) {
              const parsed = protocolInterface.parseLog(log);
              if (parsed) {
                foundEvents++;
                allEvents.push(parsed);
                console.log(`\n    📋 事件 ${foundEvents}: ${parsed.name}`);
                
                if (parsed.name === 'ReferralRewardPaid') {
                  console.log(`       ✅ 推荐奖励已支付！`);
                  console.log(`       MC 金额: ${ethers.formatEther(parsed.args.mcAmount || 0n)} MC`);
                  console.log(`       JBC 金额: ${ethers.formatEther(parsed.args.jbcAmount || 0n)} JBC`);
                  console.log(`       奖励类型: ${parsed.args.rewardType === 0 ? '直推奖励' : '层级奖励'}`);
                  console.log(`       接收人: ${parsed.args.user}`);
                  console.log(`       来源: ${parsed.args.from}`);
                } else if (parsed.name === 'TicketPurchased') {
                  console.log(`       用户: ${parsed.args.user}`);
                  console.log(`       金额: ${ethers.formatEther(parsed.args.amount || 0n)} MC`);
                  console.log(`       门票ID: ${parsed.args.ticketId?.toString() || 'N/A'}`);
                } else if (parsed.name === 'RewardCapped') {
                  console.log(`       ⚠️  奖励被上限限制！`);
                  console.log(`       请求金额: ${ethers.formatEther(parsed.args.requested || 0n)} MC`);
                  console.log(`       实际支付: ${ethers.formatEther(parsed.args.paid || 0n)} MC`);
                  console.log(`       用户: ${parsed.args.user}`);
                } else if (parsed.name === 'RewardPaid') {
                  console.log(`       用户: ${parsed.args.user}`);
                  console.log(`       金额: ${ethers.formatEther(parsed.args.amount || 0n)} MC`);
                  console.log(`       奖励类型: ${parsed.args.rewardType}`);
                } else {
                  // 显示其他事件的基本信息
                  console.log(`       参数: ${JSON.stringify(parsed.args, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                }
              }
            }
          } catch (e) {
            // 忽略无法解析的事件（可能是其他合约的事件）
          }
        }
        
        if (foundEvents === 0) {
          console.log("    ⚠️  未找到协议相关事件");
        } else {
          // 检查是否有推荐奖励事件
          const hasReferralReward = allEvents.some(e => e.name === 'ReferralRewardPaid');
          if (!hasReferralReward) {
            console.log("\n    ❌ 确认：购买交易中未找到推荐奖励事件！");
            console.log("    这说明推荐奖励确实没有支付。");
            
            // 检查是否有 RewardCapped 事件
            const hasRewardCapped = allEvents.some(e => e.name === 'RewardCapped');
            if (hasRewardCapped) {
              console.log("    ⚠️  但找到了 RewardCapped 事件，说明奖励被上限限制了。");
            } else {
              console.log("    ⚠️  也没有找到 RewardCapped 事件。");
              console.log("    可能原因：");
              console.log("      1. 推荐奖励分发逻辑未执行（代码问题）");
              console.log("      2. 推荐人状态检查失败（虽然查询显示已激活）");
              console.log("      3. 合约余额检查失败（虽然查询显示充足）");
            }
          }
        }
      } catch (txError) {
        console.log("    ⚠️  无法查询交易详情:", txError.message);
        console.log(txError.stack);
      }
      
    } catch (historyError) {
      console.log("  ⚠️  无法检查历史状态:", historyError.message);
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
checkReferrerReward().catch(console.error);

