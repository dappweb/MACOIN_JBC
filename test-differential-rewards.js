// 测试极差奖励激活
import { ethers } from 'ethers';

// 合约地址和配置
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

// MC Chain RPC
const RPC_URL = "https://chain.mcerscan.com/";

// 合约ABI，包含极差奖励相关事件
const PROTOCOL_ABI = [
  "function getUserLevel(address user) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function calculateLevel(uint256 teamCount) view returns (uint256 level, uint256 percent)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

async function testDifferentialRewards() {
  console.log('🔧 测试极差奖励激活状态...\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocolContract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    
    const testUsers = [
      "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82", // 测试用户1
      "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5", // 测试用户2
      "0x8eFb0848a6De28ddd290224DC2Dd87174a0e29F1"  // 测试用户3
    ];
    
    console.log('📊 用户V等级信息:');
    console.log('='.repeat(80));
    
    for (const userAddress of testUsers) {
      try {
        const userLevel = await protocolContract.getUserLevel(userAddress);
        const userInfo = await protocolContract.userInfo(userAddress);
        
        console.log(`👤 用户: ${userAddress}`);
        console.log(`   V等级: V${userLevel[0]} (${userLevel[1]}% 极差收益)`);
        console.log(`   团队人数: ${userLevel[2]}`);
        console.log(`   激活状态: ${userInfo[5] ? '✅ 已激活' : '❌ 未激活'}`);
        console.log(`   推荐人: ${userInfo[0]}`);
        console.log('');
      } catch (error) {
        console.log(`❌ 查询用户 ${userAddress} 失败:`, error.message);
      }
    }
    
    // 测试等级计算函数
    console.log('🧮 V等级计算测试:');
    console.log('-'.repeat(40));
    
    const testCounts = [0, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
    
    for (const count of testCounts) {
      const level = await protocolContract.calculateLevel(count);
      console.log(`团队${count.toLocaleString()}人 → V${level[0]} (${level[1]}% 极差收益)`);
    }
    
    // 查询最近的极差奖励事件
    console.log('\n🔍 查询极差奖励事件:');
    console.log('-'.repeat(40));
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000); // 查询最近10万个区块
    
    console.log(`查询区块范围: ${fromBlock} - ${currentBlock}`);
    
    // 查询DifferentialRewardRecorded事件
    const recordedEvents = await protocolContract.queryFilter(
      protocolContract.filters.DifferentialRewardRecorded(),
      fromBlock
    );
    
    console.log(`✅ 找到 ${recordedEvents.length} 条极差奖励记录事件`);
    
    // 查询DifferentialRewardReleased事件
    const releasedEvents = await protocolContract.queryFilter(
      protocolContract.filters.DifferentialRewardReleased(),
      fromBlock
    );
    
    console.log(`✅ 找到 ${releasedEvents.length} 条极差奖励发放事件`);
    
    // 查询ReferralRewardPaid事件（类型4为极差奖励）
    const referralEvents = await protocolContract.queryFilter(
      protocolContract.filters.ReferralRewardPaid(),
      fromBlock
    );
    
    let differentialCount = 0;
    for (const event of referralEvents) {
      if (Number(event.args[3]) === 4) { // REWARD_DIFFERENTIAL = 4
        differentialCount++;
      }
    }
    
    console.log(`✅ 找到 ${differentialCount} 条极差奖励支付事件`);
    
    // 显示最近的极差奖励记录
    if (recordedEvents.length > 0) {
      console.log('\n📋 最近的极差奖励记录:');
      for (const event of recordedEvents.slice(-5)) { // 显示最近5条
        const block = await provider.getBlock(event.blockNumber);
        console.log(`  质押ID: ${event.args[0]}, 上级: ${event.args[1]}, 奖励: ${ethers.formatEther(event.args[2])} MC`);
        console.log(`  时间: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        console.log(`  交易: ${event.transactionHash}`);
        console.log('');
      }
    }
    
    console.log('✅ 极差奖励测试完成！');
    console.log('\n💡 激活状态总结:');
    console.log(`  - 极差奖励记录事件: ${recordedEvents.length > 0 ? '✅ 已激活' : '❌ 未激活'}`);
    console.log(`  - 极差奖励发放事件: ${releasedEvents.length > 0 ? '✅ 已激活' : '❌ 未激活'}`);
    console.log(`  - 极差奖励支付事件: ${differentialCount > 0 ? '✅ 已激活' : '❌ 未激活'}`);
    
    if (recordedEvents.length === 0 && releasedEvents.length === 0 && differentialCount === 0) {
      console.log('\n⚠️  注意: 未发现极差奖励事件，可能原因:');
      console.log('  1. 合约修改尚未部署');
      console.log('  2. 还没有用户触发极差奖励条件');
      console.log('  3. 查询的区块范围内没有相关交易');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 执行测试
testDifferentialRewards();