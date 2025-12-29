// 查询特定用户的极差奖励数据
import { ethers } from 'ethers';

// 合约地址和配置
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

// MC Chain RPC
const RPC_URL = "https://chain.mcerscan.com/";

// 目标用户地址
const TARGET_USER = "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82";

// 合约ABI
const PROTOCOL_ABI = [
  "function getUserLevel(address user) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getDirectReferrals(address user) view returns (address[])",
  "event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

async function queryUserDifferentialRewards() {
  console.log(`🔍 查询用户 ${TARGET_USER} 的极差奖励数据...\n`);
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    
    // 1. 查询用户基本信息
    console.log('📊 用户基本信息:');
    console.log('='.repeat(60));
    
    const userLevel = await contract.getUserLevel(TARGET_USER);
    const userInfo = await contract.userInfo(TARGET_USER);
    const userTicket = await contract.userTicket(TARGET_USER);
    
    console.log(`👤 用户地址: ${TARGET_USER}`);
    console.log(`🏆 V等级: V${userLevel[0]} (${userLevel[1]}% 极差收益)`);
    console.log(`👥 团队人数: ${userLevel[2].toLocaleString()}`);
    console.log(`💰 门票金额: ${ethers.formatEther(userTicket[1])} MC`);
    console.log(`📈 总收益: ${ethers.formatEther(userInfo[3])} MC`);
    console.log(`🎯 收益上限: ${ethers.formatEther(userInfo[4])} MC`);
    console.log(`✅ 激活状态: ${userInfo[5] ? '已激活' : '未激活'}`);
    console.log(`👆 推荐人: ${userInfo[0]}`);
    
    // 2. 查询直推用户
    console.log('\n👥 直推用户列表:');
    console.log('-'.repeat(40));
    
    try {
      const directReferrals = await contract.getDirectReferrals(TARGET_USER);
      console.log(`直推人数: ${directReferrals.length}`);
      
      for (let i = 0; i < Math.min(directReferrals.length, 10); i++) {
        const referralLevel = await contract.getUserLevel(directReferrals[i]);
        const referralInfo = await contract.userInfo(directReferrals[i]);
        console.log(`  ${i+1}. ${directReferrals[i]} - V${referralLevel[0]} (团队${referralLevel[2]}人) ${referralInfo[5] ? '✅' : '❌'}`);
      }
      
      if (directReferrals.length > 10) {
        console.log(`  ... 还有 ${directReferrals.length - 10} 个直推用户`);
      }
    } catch (error) {
      console.log('无法获取直推用户列表');
    }
    
    // 3. 查询用户质押记录
    console.log('\n💎 质押记录:');
    console.log('-'.repeat(40));
    
    let stakeIndex = 0;
    let hasMoreStakes = true;
    const stakes = [];
    
    while (hasMoreStakes && stakeIndex < 50) { // 限制查询数量
      try {
        const stake = await contract.userStakes(TARGET_USER, stakeIndex);
        if (stake[0] > 0) { // stakeId > 0 表示存在
          stakes.push({
            id: stake[0],
            amount: stake[1],
            startTime: stake[2],
            cycleDays: stake[3],
            active: stake[4],
            paid: stake[5],
            index: stakeIndex
          });
          stakeIndex++;
        } else {
          hasMoreStakes = false;
        }
      } catch (error) {
        hasMoreStakes = false;
      }
    }
    
    console.log(`总质押数量: ${stakes.length}`);
    
    for (const stake of stakes) {
      const startDate = new Date(Number(stake.startTime) * 1000);
      const endDate = new Date((Number(stake.startTime) + Number(stake.cycleDays) * 60) * 1000);
      const isCompleted = Date.now() > endDate.getTime();
      
      console.log(`  质押ID ${stake.id}:`);
      console.log(`    金额: ${ethers.formatEther(stake.amount)} MC`);
      console.log(`    周期: ${stake.cycleDays} 天`);
      console.log(`    开始: ${startDate.toLocaleString()}`);
      console.log(`    结束: ${endDate.toLocaleString()}`);
      console.log(`    状态: ${stake.active ? '进行中' : '已完成'} ${isCompleted ? '(周期已结束)' : '(周期进行中)'}`);
      console.log(`    已付: ${ethers.formatEther(stake.paid)} MC`);
      console.log('');
    }
    
    // 4. 查询极差奖励事件
    console.log('🎁 极差奖励事件查询:');
    console.log('-'.repeat(40));
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 200000); // 查询最近20万个区块
    
    console.log(`查询区块范围: ${fromBlock} - ${currentBlock}`);
    
    // 查询作为受益人的极差奖励记录事件
    const recordedEvents = await contract.queryFilter(
      contract.filters.DifferentialRewardRecorded(null, TARGET_USER),
      fromBlock
    );
    
    console.log(`\n📝 作为受益人的极差奖励记录: ${recordedEvents.length} 条`);
    for (const event of recordedEvents) {
      const block = await provider.getBlock(event.blockNumber);
      console.log(`  质押ID: ${event.args[0]}, 奖励: ${ethers.formatEther(event.args[2])} MC`);
      console.log(`  时间: ${new Date(block.timestamp * 1000).toLocaleString()}`);
      console.log(`  交易: ${event.transactionHash}`);
    }
    
    // 查询作为受益人的极差奖励发放事件
    const releasedEvents = await contract.queryFilter(
      contract.filters.DifferentialRewardReleased(null, TARGET_USER),
      fromBlock
    );
    
    console.log(`\n💰 作为受益人的极差奖励发放: ${releasedEvents.length} 条`);
    for (const event of releasedEvents) {
      const block = await provider.getBlock(event.blockNumber);
      console.log(`  质押ID: ${event.args[0]}, 发放: ${ethers.formatEther(event.args[2])} MC`);
      console.log(`  时间: ${new Date(block.timestamp * 1000).toLocaleString()}`);
      console.log(`  交易: ${event.transactionHash}`);
    }
    
    // 查询作为受益人的推荐奖励支付事件（类型4为极差奖励）
    const referralEvents = await contract.queryFilter(
      contract.filters.ReferralRewardPaid(TARGET_USER),
      fromBlock
    );
    
    let differentialPayments = 0;
    let totalDifferentialAmount = 0n;
    
    console.log(`\n💸 作为受益人的推荐奖励支付:`);
    for (const event of referralEvents) {
      const rewardType = Number(event.args[3]);
      const amount = event.args[2];
      
      if (rewardType === 4) { // REWARD_DIFFERENTIAL = 4
        differentialPayments++;
        totalDifferentialAmount += amount;
        
        const block = await provider.getBlock(event.blockNumber);
        console.log(`  来源: ${event.args[1]}, 金额: ${ethers.formatEther(amount)} MC`);
        console.log(`  时间: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        console.log(`  交易: ${event.transactionHash}`);
      }
    }
    
    console.log(`\n📊 极差奖励统计:`);
    console.log(`  记录事件: ${recordedEvents.length} 条`);
    console.log(`  发放事件: ${releasedEvents.length} 条`);
    console.log(`  支付事件: ${differentialPayments} 条`);
    console.log(`  总收益: ${ethers.formatEther(totalDifferentialAmount)} MC`);
    
    // 5. 查询用户质押触发的极差奖励（用户作为质押者）
    console.log('\n🚀 用户质押触发的极差奖励:');
    console.log('-'.repeat(40));
    
    let userTriggeredRewards = 0;
    for (const stake of stakes) {
      const stakeRecords = await contract.queryFilter(
        contract.filters.DifferentialRewardRecorded(stake.id),
        fromBlock
      );
      
      if (stakeRecords.length > 0) {
        console.log(`  质押ID ${stake.id} 触发了 ${stakeRecords.length} 条极差奖励:`);
        for (const record of stakeRecords) {
          console.log(`    受益人: ${record.args[1]}, 奖励: ${ethers.formatEther(record.args[2])} MC`);
        }
        userTriggeredRewards += stakeRecords.length;
      }
    }
    
    console.log(`\n总计触发极差奖励: ${userTriggeredRewards} 条`);
    
    console.log('\n✅ 极差奖励数据查询完成！');
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

// 执行查询
queryUserDifferentialRewards();