const { ethers } = require("hardhat");

// 问题账户地址
const PROBLEM_ACCOUNT = "0x40Ee97d7B8D424489938BFa0a523ae39B59d7f5b";

async function main() {
  console.log("🔍 检查账户推荐奖励问题...\n");
  console.log("问题账户:", PROBLEM_ACCOUNT);
  
  const [deployer] = await ethers.getSigners();
  console.log("检查账户:", deployer.address);
  
  // 获取合约地址（从环境变量或配置文件）
  const proxyAddress = process.env.PROXY_ADDRESS || "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  console.log("合约地址:", proxyAddress);
  
  // 尝试不同的合约版本
  let protocolContract;
  const contractNames = ["JinbaoProtocolV2", "JinbaoProtocolV2Simple", "JinbaoProtocol", "JinbaoProtocolNative", "JinbaoProtocolV4"];
  
  for (const name of contractNames) {
    try {
      protocolContract = await ethers.getContractAt(name, proxyAddress);
      // 测试是否能调用基本函数
      await protocolContract.userInfo(PROBLEM_ACCOUNT);
      console.log(`✅ 使用合约版本: ${name}`);
      break;
    } catch (e) {
      // 继续尝试下一个
    }
  }
  
  if (!protocolContract) {
    console.log("❌ 无法连接到合约，尝试使用通用ABI...");
    // 使用最小ABI
    const minimalABI = [
      "function userInfo(address) view returns (address,uint256,uint256,uint256,uint256,bool)",
      "function userTicket(address) view returns (uint256,uint256,uint256,bool)",
      "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)"
    ];
    protocolContract = new ethers.Contract(proxyAddress, minimalABI, deployer);
  }
  
  const provider = ethers.provider;
  
  console.log("\n📋 检查账户状态...");
  
  // 1. 检查用户基本信息
  try {
    const userInfo = await protocolContract.userInfo(PROBLEM_ACCOUNT);
    console.log("\n✅ 用户信息:");
    console.log("  - 推荐人:", userInfo[0]);
    console.log("  - 活跃直推数:", userInfo[1].toString());
    console.log("  - 团队总数:", userInfo[2].toString());
    console.log("  - 累计收益:", ethers.formatEther(userInfo[3]), "MC");
    console.log("  - 收益上限:", ethers.formatEther(userInfo[4]), "MC");
    console.log("  - 是否活跃:", userInfo[5]);
    
    // 检查门票信息
    const ticket = await protocolContract.userTicket(PROBLEM_ACCOUNT);
    console.log("\n✅ 门票信息:");
    console.log("  - 门票ID:", ticket[0].toString());
    console.log("  - 门票金额:", ethers.formatEther(ticket[1]), "MC");
    console.log("  - 购买时间:", new Date(Number(ticket[2]) * 1000).toLocaleString());
    console.log("  - 是否退出:", ticket[3]);
    
    // 计算可用收益空间
    const totalRevenue = userInfo[3];
    const currentCap = userInfo[4];
    const available = currentCap - totalRevenue;
    console.log("\n💰 收益空间:");
    console.log("  - 累计收益:", ethers.formatEther(totalRevenue), "MC");
    console.log("  - 收益上限:", ethers.formatEther(currentCap), "MC");
    console.log("  - 可用空间:", ethers.formatEther(available), "MC");
    
    if (available <= 0n) {
      console.log("\n⚠️  警告: 收益上限已满，无法接收更多奖励！");
    }
    
    // 检查推荐人状态
    const referrer = userInfo[0];
    if (referrer && referrer !== ethers.ZeroAddress) {
      console.log("\n✅ 推荐人信息:");
      const referrerInfo = await protocolContract.userInfo(referrer);
      const referrerTicket = await protocolContract.userTicket(referrer);
      console.log("  - 推荐人地址:", referrer);
      console.log("  - 推荐人是否活跃:", referrerInfo[5]);
      console.log("  - 推荐人门票金额:", ethers.formatEther(referrerTicket[1]), "MC");
      console.log("  - 推荐人门票是否退出:", referrerTicket[3]);
      
      if (!referrerInfo[5] || referrerTicket[3] || referrerTicket[1] === 0n) {
        console.log("\n⚠️  警告: 推荐人不活跃，无法接收直推奖励！");
      }
    } else {
      console.log("\n⚠️  警告: 账户没有推荐人！");
    }
    
  } catch (error) {
    console.error("❌ 获取用户信息失败:", error.message);
  }
  
  // 2. 查询最近的推荐奖励事件
  console.log("\n📊 查询最近的推荐奖励事件...");
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 50000); // 最近50000个区块
    
    // 使用事件签名查询
    const referralRewardPaidTopic = ethers.id("ReferralRewardPaid(address,address,uint256,uint256,uint8,uint256)");
    const problemAccountTopic = ethers.zeroPadValue(PROBLEM_ACCOUNT, 32);
    
    // 查询作为受益人的事件（第一个参数是受益人）
    const referralEventsFilter = {
      address: proxyAddress,
      topics: [referralRewardPaidTopic, problemAccountTopic]
    };
    
    const referralEvents = await provider.getLogs({
      ...referralEventsFilter,
      fromBlock,
      toBlock: currentBlock
    });
    
    console.log(`\n✅ 找到 ${referralEvents.length} 个推荐奖励事件（作为受益人）:`);
    
    // 解析事件
    const iface = new ethers.Interface([
      "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)"
    ]);
    
    for (let i = 0; i < Math.min(referralEvents.length, 10); i++) {
      const log = referralEvents[i];
      const parsed = iface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);
      
      console.log(`\n  事件 #${i + 1}:`);
      console.log("    - 交易哈希:", log.transactionHash);
      console.log("    - 区块号:", log.blockNumber);
      console.log("    - 时间:", new Date(block.timestamp * 1000).toLocaleString());
      console.log("    - 受益人:", parsed.args[0]);
      console.log("    - 来源用户:", parsed.args[1]);
      console.log("    - MC金额:", ethers.formatEther(parsed.args[2] || 0), "MC");
      console.log("    - JBC金额:", ethers.formatEther(parsed.args[3] || 0), "JBC");
      console.log("    - 奖励类型:", parsed.args[4]?.toString() || "N/A");
      console.log("    - 票据ID:", parsed.args[5]?.toString() || "N/A");
    }
    
    // 查询作为来源的事件（第二个参数是来源）
    const sourceAccountTopic = ethers.zeroPadValue(PROBLEM_ACCOUNT, 32);
    const sourceEventsFilter = {
      address: proxyAddress,
      topics: [referralRewardPaidTopic, null, sourceAccountTopic]
    };
    
    const sourceEvents = await provider.getLogs({
      ...sourceEventsFilter,
      fromBlock,
      toBlock: currentBlock
    });
    
    console.log(`\n✅ 找到 ${sourceEvents.length} 个推荐奖励事件（作为来源）:`);
    for (let i = 0; i < Math.min(sourceEvents.length, 10); i++) {
      const log = sourceEvents[i];
      const parsed = iface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);
      
      console.log(`\n  事件 #${i + 1}:`);
      console.log("    - 交易哈希:", log.transactionHash);
      console.log("    - 区块号:", log.blockNumber);
      console.log("    - 时间:", new Date(block.timestamp * 1000).toLocaleString());
      console.log("    - 受益人:", parsed.args[0]);
      console.log("    - 来源用户:", parsed.args[1]);
      console.log("    - MC金额:", ethers.formatEther(parsed.args[2] || 0), "MC");
      console.log("    - JBC金额:", ethers.formatEther(parsed.args[3] || 0), "JBC");
      console.log("    - 奖励类型:", parsed.args[4]?.toString() || "N/A");
    }
    
  } catch (error) {
    console.error("❌ 查询事件失败:", error.message);
  }
  
  // 3. 检查合约余额
  console.log("\n💰 检查合约余额...");
  try {
    const balance = await provider.getBalance(proxyAddress);
    console.log("  - 合约MC余额:", ethers.formatEther(balance), "MC");
    
    if (balance === 0n) {
      console.log("\n⚠️  警告: 合约余额为0，可能无法支付奖励！");
    }
  } catch (error) {
    console.error("❌ 检查余额失败:", error.message);
  }
  
  // 4. 检查奖励上限配置
  console.log("\n⚙️  检查奖励配置...");
  try {
    const directPercent = await protocolContract.directRewardPercent();
    const levelPercent = await protocolContract.levelRewardPercent();
    console.log("  - 直推奖励比例:", directPercent.toString(), "%");
    console.log("  - 层级奖励比例:", levelPercent.toString(), "%");
  } catch (error) {
    console.log("  ⚠️  无法获取奖励配置:", error.message);
  }
  
  console.log("\n✅ 检查完成！");
  console.log("\n💡 可能的问题原因:");
  console.log("  1. 收益上限已满（currentCap - totalRevenue <= 0）");
  console.log("  2. 推荐人不活跃（没有有效门票）");
  console.log("  3. 合约余额不足");
  console.log("  4. 奖励被上限截断（RewardCapped事件）");
  console.log("  5. 事件查询范围不够（需要查询更早的区块）");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

