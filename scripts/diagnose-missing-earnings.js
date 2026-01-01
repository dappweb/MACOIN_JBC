/**
 * 诊断脚本：检查链上已结算但前端未显示的收益
 * 
 * 使用方法：
 * node scripts/diagnose-missing-earnings.js <userAddress> [rpcUrl] [contractAddress]
 */

const { ethers } = require("hardhat");

// 合约ABI（只包含需要的事件）
const CONTRACT_ABI = [
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp)",
  "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event RewardCapped(address indexed user, uint256 amount, uint256 cappedAmount)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
];

async function diagnoseMissingEarnings(userAddress, rpcUrl, contractAddress) {
  console.log("🔍 开始诊断收益显示问题...\n");
  console.log(`用户地址: ${userAddress}`);
  console.log(`合约地址: ${contractAddress}`);
  console.log(`RPC URL: ${rpcUrl}\n`);

  // 连接provider
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

  // 获取当前区块
  const currentBlock = await provider.getBlockNumber();
  console.log(`当前区块: ${currentBlock}`);

  // 获取时间单位以确定查询范围
  let secondsInUnit = 60;
  try {
    secondsInUnit = Number(await contract.SECONDS_IN_UNIT());
    console.log(`时间单位: ${secondsInUnit} 秒`);
  } catch (e) {
    console.warn("⚠️  无法获取时间单位，使用默认值 60 秒");
  }

  // 根据时间单位确定查询范围
  let blockRange = 100000;
  if (secondsInUnit === 60) {
    blockRange = 50000;
    console.log("检测到测试环境，使用 50K 区块范围");
  } else if (secondsInUnit === 86400) {
    blockRange = 200000;
    console.log("检测到生产环境，使用 200K 区块范围");
  }
  
  const fromBlock = Math.max(0, currentBlock - blockRange);
  console.log(`查询范围: 区块 ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)\n`);

  // 查询所有相关事件
  console.log("📊 查询链上事件...\n");

  const [
    rewardPaidEvents,
    rewardClaimedEvents,
    referralEvents,
    differentialDistributedEvents,
    differentialRecordedEvents,
    differentialReleasedEvents,
    rewardCappedEvents
  ] = await Promise.allSettled([
    contract.queryFilter(contract.filters.RewardPaid(userAddress), fromBlock),
    contract.queryFilter(contract.filters.RewardClaimed(userAddress), fromBlock),
    contract.queryFilter(contract.filters.ReferralRewardPaid(userAddress), fromBlock),
    contract.queryFilter(contract.filters.DifferentialRewardDistributed(userAddress), fromBlock),
    contract.queryFilter(contract.filters.DifferentialRewardRecorded(), fromBlock), // 注意：这个事件没有user索引
    contract.queryFilter(contract.filters.DifferentialRewardReleased(), fromBlock), // 注意：这个事件没有user索引
    contract.queryFilter(contract.filters.RewardCapped(userAddress), fromBlock),
  ]);

  // 处理结果
  const events = {
    rewardPaid: rewardPaidEvents.status === 'fulfilled' ? rewardPaidEvents.value : [],
    rewardClaimed: rewardClaimedEvents.status === 'fulfilled' ? rewardClaimedEvents.value : [],
    referral: referralEvents.status === 'fulfilled' ? referralEvents.value : [],
    differentialDistributed: differentialDistributedEvents.status === 'fulfilled' ? differentialDistributedEvents.value : [],
    differentialRecorded: differentialRecordedEvents.status === 'fulfilled' ? differentialRecordedEvents.value : [],
    differentialReleased: differentialReleasedEvents.status === 'fulfilled' ? differentialReleasedEvents.value : [],
    rewardCapped: rewardCappedEvents.status === 'fulfilled' ? rewardCappedEvents.value : [],
  };

  // 统计信息
  console.log("📈 事件统计:");
  console.log(`  ✅ RewardPaid: ${events.rewardPaid.length} 条`);
  console.log(`  ✅ RewardClaimed: ${events.rewardClaimed.length} 条`);
  console.log(`  ✅ ReferralRewardPaid: ${events.referral.length} 条`);
  console.log(`  ✅ DifferentialRewardDistributed: ${events.differentialDistributed.length} 条`);
  console.log(`  ⚠️  DifferentialRewardRecorded: ${events.differentialRecorded.length} 条 (前端未查询)`);
  console.log(`  ⚠️  DifferentialRewardReleased: ${events.differentialReleased.length} 条 (前端未查询)`);
  console.log(`  ⚠️  RewardCapped: ${events.rewardCapped.length} 条 (前端未查询)\n`);

  // 分析 RewardPaid 事件（按类型分组）
  const rewardPaidByType = {
    0: [], // 静态收益
    1: [], // 动态收益
    2: [], // 直推收益
    3: [], // 层级收益
    4: [], // 级差收益
  };

  for (const event of events.rewardPaid) {
    const rewardType = Number(event.args[2]);
    if (rewardType in rewardPaidByType) {
      rewardPaidByType[rewardType].push(event);
    }
  }

  console.log("📊 RewardPaid 事件按类型分组:");
  console.log(`  静态收益 (0): ${rewardPaidByType[0].length} 条`);
  console.log(`  动态收益 (1): ${rewardPaidByType[1].length} 条`);
  console.log(`  直推收益 (2): ${rewardPaidByType[2].length} 条`);
  console.log(`  层级收益 (3): ${rewardPaidByType[3].length} 条`);
  console.log(`  级差收益 (4): ${rewardPaidByType[4].length} 条\n`);

  // 检查是否有 RewardCapped 事件（可能表示收益被限制）
  if (events.rewardCapped.length > 0) {
    console.log("⚠️  发现 RewardCapped 事件（收益被限制）:");
    for (const event of events.rewardCapped) {
      const amount = ethers.formatEther(event.args[1]);
      const cappedAmount = ethers.formatEther(event.args[2]);
      console.log(`  区块 ${event.blockNumber}: 原始金额 ${amount} MC, 限制后 ${cappedAmount} MC`);
    }
    console.log();
  }

  // 检查 DifferentialRewardRecorded 和 Released 事件
  // 这些事件可能记录了级差奖励但还未分发
  if (events.differentialRecorded.length > 0 || events.differentialReleased.length > 0) {
    console.log("⚠️  发现级差奖励中间状态事件:");
    console.log(`  DifferentialRewardRecorded: ${events.differentialRecorded.length} 条`);
    console.log(`  DifferentialRewardReleased: ${events.differentialReleased.length} 条`);
    
    // 检查是否有记录但未分发的情况
    const recordedStakeIds = new Set(events.differentialRecorded.map(e => Number(e.args[0])));
    const releasedStakeIds = new Set(events.differentialReleased.map(e => Number(e.args[0])));
    const distributedStakeIds = new Set(); // DifferentialRewardDistributed 没有 stakeId，无法直接对比
    
    const pendingStakeIds = [...recordedStakeIds].filter(id => !releasedStakeIds.has(id));
    if (pendingStakeIds.length > 0) {
      console.log(`  ⚠️  发现 ${pendingStakeIds.length} 个已记录但未释放的级差奖励:`);
      for (const stakeId of pendingStakeIds.slice(0, 10)) { // 只显示前10个
        console.log(`    Stake ID: ${stakeId}`);
      }
    }
    console.log();
  }

  // 对比 RewardPaid 和 RewardClaimed
  console.log("🔍 对比 RewardPaid 和 RewardClaimed 事件:");
  const rewardPaidMap = new Map();
  for (const event of events.rewardPaid) {
    const key = `${event.blockNumber}-${event.transactionHash}`;
    rewardPaidMap.set(key, event);
  }

  const rewardClaimedMap = new Map();
  for (const event of events.rewardClaimed) {
    const key = `${event.blockNumber}-${event.transactionHash}`;
    rewardClaimedMap.set(key, event);
  }

  // 找出只有 RewardPaid 但没有 RewardClaimed 的情况
  const missingClaimed = [];
  for (const [key, paidEvent] of rewardPaidMap) {
    if (!rewardClaimedMap.has(key)) {
      missingClaimed.push(paidEvent);
    }
  }

  if (missingClaimed.length > 0) {
    console.log(`  ⚠️  发现 ${missingClaimed.length} 个 RewardPaid 事件没有对应的 RewardClaimed 事件:`);
    for (const event of missingClaimed.slice(0, 10)) {
      const amount = ethers.formatEther(event.args[1]);
      const rewardType = Number(event.args[2]);
      console.log(`    区块 ${event.blockNumber}, 交易 ${event.transactionHash.slice(0, 10)}...`);
      console.log(`      类型: ${rewardType}, 金额: ${amount} MC`);
    }
    console.log();
  } else {
    console.log("  ✅ 所有 RewardPaid 事件都有对应的 RewardClaimed 事件\n");
  }

  // 计算总收益
  let totalMC = 0;
  let totalJBC = 0;

  for (const event of events.rewardClaimed) {
    totalMC += parseFloat(ethers.formatEther(event.args[1]));
    totalJBC += parseFloat(ethers.formatEther(event.args[2]));
  }

  for (const event of events.referral) {
    totalMC += parseFloat(ethers.formatEther(event.args[2]));
    totalJBC += parseFloat(ethers.formatEther(event.args[3]));
  }

  for (const event of events.differentialDistributed) {
    totalMC += parseFloat(ethers.formatEther(event.args[1]));
    totalJBC += parseFloat(ethers.formatEther(event.args[2]));
  }

  console.log("💰 总收益统计:");
  console.log(`  MC: ${totalMC.toFixed(4)}`);
  console.log(`  JBC: ${totalJBC.toFixed(4)}\n`);

  // 建议
  console.log("💡 建议:");
  if (events.differentialRecorded.length > 0 || events.differentialReleased.length > 0) {
    console.log("  1. 考虑查询 DifferentialRewardRecorded 和 DifferentialRewardReleased 事件");
    console.log("     （这些是级差奖励的中间状态，可能对调试有用）");
  }
  if (events.rewardCapped.length > 0) {
    console.log("  2. 考虑显示 RewardCapped 事件，告知用户收益被限制");
  }
  if (missingClaimed.length > 0) {
    console.log("  3. 检查为什么某些 RewardPaid 事件没有对应的 RewardClaimed 事件");
  }
  if (currentBlock - fromBlock < blockRange) {
    console.log(`  4. 当前查询范围可能不够，建议增加区块范围`);
  }

  console.log("\n✅ 诊断完成");
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error("❌ 使用方法: node scripts/diagnose-missing-earnings.js <userAddress> [rpcUrl] [contractAddress]");
    process.exit(1);
  }

  const userAddress = args[0];
  const rpcUrl = args[1] || process.env.RPC_URL || "https://rpc.mcchain.io";
  const contractAddress = args[2] || process.env.PROTOCOL_CONTRACT_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61";

  try {
    await diagnoseMissingEarnings(userAddress, rpcUrl, contractAddress);
  } catch (error) {
    console.error("❌ 诊断失败:", error);
    process.exit(1);
  }
}

main();

