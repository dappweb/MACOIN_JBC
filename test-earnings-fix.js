// 测试收益明细修复
import { ethers } from 'ethers';

// 合约地址和配置
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

// MC Chain RPC
const RPC_URL = "https://chain.mcerscan.com/";

// 简化的合约ABI，包含所有收益相关事件
const PROTOCOL_ABI = [
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)"
];

async function testEarningsFix() {
  console.log('🔧 测试收益明细修复...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocolContract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    
    const userAddress = "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82";
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000); // 查询最近10万个区块
    
    console.log(`📊 查询区块范围: ${fromBlock} - ${currentBlock}`);
    console.log(`👤 用户地址: ${userAddress}\n`);
    
    // 测试三种事件查询
    console.log('🔍 查询 RewardPaid 事件...');
    const rewardPaidEvents = await protocolContract.queryFilter(
      protocolContract.filters.RewardPaid(userAddress),
      fromBlock
    );
    console.log(`✅ 找到 ${rewardPaidEvents.length} 条 RewardPaid 事件`);
    
    console.log('🔍 查询 RewardClaimed 事件...');
    const rewardClaimedEvents = await protocolContract.queryFilter(
      protocolContract.filters.RewardClaimed(userAddress),
      fromBlock
    );
    console.log(`✅ 找到 ${rewardClaimedEvents.length} 条 RewardClaimed 事件`);
    
    console.log('🔍 查询 ReferralRewardPaid 事件...');
    const referralRewardEvents = await protocolContract.queryFilter(
      protocolContract.filters.ReferralRewardPaid(userAddress),
      fromBlock
    );
    console.log(`✅ 找到 ${referralRewardEvents.length} 条 ReferralRewardPaid 事件\n`);
    
    // 统计收益类型
    const rewardTypeStats = {};
    const rewardTypes = {
      0: "静态收益",
      2: "直推奖励", 
      3: "层级奖励",
      4: "极差奖励"
    };
    
    // 统计 RewardPaid 事件
    for (const event of rewardPaidEvents) {
      const rewardType = Number(event.args[2]);
      const amount = ethers.formatEther(event.args[1]);
      
      if (!rewardTypeStats[rewardType]) {
        rewardTypeStats[rewardType] = { count: 0, total: 0 };
      }
      rewardTypeStats[rewardType].count++;
      rewardTypeStats[rewardType].total += parseFloat(amount);
    }
    
    console.log('📊 RewardPaid 事件统计:');
    for (const [type, stats] of Object.entries(rewardTypeStats)) {
      const typeName = rewardTypes[type] || `未知类型(${type})`;
      console.log(`  ${typeName}: ${stats.count} 次, 总计 ${stats.total.toFixed(4)} MC`);
    }
    
    console.log('\n✅ 测试完成！');
    console.log('💡 修复说明:');
    console.log('  - 前端现在会查询 RewardPaid 事件，包含静态收益');
    console.log('  - RewardClaimed 事件显示实际转账的MC和JBC数量');
    console.log('  - ReferralRewardPaid 事件显示推荐奖励');
    console.log('  - 所有事件类型都会在收益明细中正确显示');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 执行测试
testEarningsFix();