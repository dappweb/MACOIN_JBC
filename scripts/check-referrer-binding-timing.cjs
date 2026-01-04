const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

// 协议合约 ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function checkReferrerBindingTiming() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  const referrerAddress = "0xb6A10c3F6492e5FEfdC03909E1638FE3A8ce5C75";
  const referredAddress = "0xaA4D3862ea0A72d83D6399D6700FcA1952d8e64d";

  console.log("🔍 检查推荐关系建立时间\n");
  console.log("=" .repeat(60));
  console.log(`推荐人: ${referrerAddress}`);
  console.log(`被推荐人: ${referredAddress}`);
  console.log("=" .repeat(60) + "\n");

  try {
    // 1. 查找绑定推荐人事件
    console.log("📋 查找绑定推荐人事件...");
    const bindEvents = await protocol.queryFilter(protocol.filters.BoundReferrer(referredAddress));
    
    if (bindEvents.length === 0) {
      console.log("    ❌ 未找到绑定推荐人事件");
      console.log("    说明：被推荐人可能从未绑定推荐人，或者推荐关系是在购买时自动建立的");
    } else {
      console.log(`    ✅ 找到 ${bindEvents.length} 条绑定事件\n`);
      
      bindEvents.forEach((event, index) => {
        const referrer = event.args.referrer?.toLowerCase();
        const blockNumber = event.blockNumber;
        const txHash = event.transactionHash;
        
        console.log(`  绑定事件 ${index + 1}:`);
        console.log(`    推荐人: ${referrer}`);
        console.log(`    是否匹配: ${referrer === referrerAddress.toLowerCase() ? '✅ 是' : '❌ 否'}`);
        console.log(`    区块号: ${blockNumber}`);
        console.log(`    交易哈希: ${txHash}`);
        
        provider.getBlock(blockNumber).then(block => {
          console.log(`    时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
        });
      });
    }

    // 2. 查找购买事件
    console.log("\n📋 查找购买事件...");
    const purchaseEvents = await protocol.queryFilter(protocol.filters.TicketPurchased(referredAddress));
    
    if (purchaseEvents.length > 0) {
      const purchaseEvent = purchaseEvents[0];
      const purchaseBlock = purchaseEvent.blockNumber;
      const purchaseTx = purchaseEvent.transactionHash;
      
      console.log(`    ✅ 找到购买事件`);
      console.log(`    区块号: ${purchaseBlock}`);
      console.log(`    交易哈希: ${purchaseTx}`);
      
      provider.getBlock(purchaseBlock).then(block => {
        console.log(`    时间: ${new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN')}`);
      });
      
      // 检查购买时的推荐人
      console.log("\n  📋 检查购买时的推荐人...");
      protocol.userInfo.staticCall(referredAddress, { blockTag: purchaseBlock }).then(userInfo => {
        const referrer = userInfo.referrer?.toLowerCase();
        console.log(`    购买时的推荐人: ${referrer}`);
        console.log(`    是否为零地址: ${referrer === ethers.ZeroAddress.toLowerCase() ? '✅ 是' : '❌ 否'}`);
        
        if (referrer === ethers.ZeroAddress.toLowerCase()) {
          console.log(`    ❌ 确认：购买时推荐人为零地址！`);
          console.log(`    这就是为什么没有支付推荐奖励的原因。`);
        }
      });
    }

    // 3. 检查当前推荐人
    console.log("\n📋 检查当前推荐人...");
    const currentUserInfo = await protocol.userInfo(referredAddress);
    const currentReferrer = currentUserInfo.referrer?.toLowerCase();
    console.log(`    当前推荐人: ${currentReferrer}`);
    console.log(`    是否匹配: ${currentReferrer === referrerAddress.toLowerCase() ? '✅ 是' : '❌ 否'}`);
    
    if (currentReferrer === referrerAddress.toLowerCase()) {
      console.log(`    ✅ 当前推荐关系正确`);
      console.log(`    ⚠️  但推荐关系是在购买之后建立的，所以购买时没有推荐奖励`);
    }

    // 4. 时间线分析
    console.log("\n📋 时间线分析:");
    if (bindEvents.length > 0 && purchaseEvents.length > 0) {
      const bindEvent = bindEvents[0];
      const purchaseEvent = purchaseEvents[0];
      
      if (bindEvent.blockNumber > purchaseEvent.blockNumber) {
        console.log(`    ❌ 推荐关系在购买之后建立`);
        console.log(`    购买区块: ${purchaseEvent.blockNumber}`);
        console.log(`    绑定区块: ${bindEvent.blockNumber}`);
        console.log(`    差异: ${bindEvent.blockNumber - purchaseEvent.blockNumber} 个区块`);
        console.log(`    这就是为什么没有推荐奖励的原因！`);
      } else if (bindEvent.blockNumber < purchaseEvent.blockNumber) {
        console.log(`    ✅ 推荐关系在购买之前建立`);
        console.log(`    绑定区块: ${bindEvent.blockNumber}`);
        console.log(`    购买区块: ${purchaseEvent.blockNumber}`);
        console.log(`    差异: ${purchaseEvent.blockNumber - bindEvent.blockNumber} 个区块`);
        console.log(`    但购买时推荐人为零地址，可能是其他问题`);
      } else {
        console.log(`    ⚠️  推荐关系和购买在同一区块`);
      }
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ 检查完成");

  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    console.error(error.stack);
  }
}

// 执行检查
checkReferrerBindingTiming().catch(console.error);

