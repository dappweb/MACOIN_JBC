const { ethers } = require('ethers');

// 奖励诊断脚本
async function diagnoseRewards() {
  console.log('🔍 开始诊断奖励系统状态...\n');

  try {
    // 连接到网络
    const provider = new ethers.JsonRpcProvider('https://rpc.mcchain.info');
    
    // 合约地址（需要根据实际部署地址修改）
    const PROTOCOL_ADDRESS = '0x...'; // 请填入实际的协议合约地址
    
    // 合约ABI（简化版，包含必要的函数）
    const PROTOCOL_ABI = [
      'function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap)',
      'function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)',
      'function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)',
      'function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)',
      'function SECONDS_IN_UNIT() view returns (uint256)',
      'event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)',
      'event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)',
      'event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)',
      'event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)'
    ];

    const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 测试用户地址（请替换为实际用户地址）
    const testUsers = [
      '0x...', // 用户1
      '0x...', // 用户2
    ];

    console.log('📊 用户状态诊断');
    console.log('='.repeat(50));

    for (const userAddress of testUsers) {
      if (!userAddress || userAddress === '0x...') {
        console.log('⚠️ 请在脚本中填入实际的用户地址');
        continue;
      }

      console.log(`\n👤 用户: ${userAddress}`);
      
      try {
        // 1. 检查用户基本信息
        const userInfo = await contract.userInfo(userAddress);
        console.log('📋 基本信息:');
        console.log(`  - 推荐人: ${userInfo.referrer}`);
        console.log(`  - 直推数量: ${userInfo.activeDirects}`);
        console.log(`  - 团队人数: ${userInfo.teamCount}`);
        console.log(`  - 总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`  - 收益上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
        console.log(`  - 是否激活: ${userInfo.isActive}`);

        // 2. 检查用户等级
        const levelInfo = await contract.getUserLevel(userAddress);
        console.log('🏆 等级信息:');
        console.log(`  - 当前等级: V${levelInfo.level}`);
        console.log(`  - 极差收益比例: ${levelInfo.percent}%`);
        console.log(`  - 团队地址数: ${levelInfo.teamCount}`);

        // 3. 检查门票状态
        const ticket = await contract.userTicket(userAddress);
        console.log('🎫 门票状态:');
        console.log(`  - 门票ID: ${ticket.ticketId}`);
        console.log(`  - 门票金额: ${ethers.formatEther(ticket.amount)} MC`);
        console.log(`  - 购买时间: ${new Date(Number(ticket.purchaseTime) * 1000).toLocaleString()}`);
        console.log(`  - 是否退出: ${ticket.exited}`);

        // 4. 检查质押状态
        console.log('💎 质押状态:');
        let stakeIndex = 0;
        let totalActiveStakes = 0;
        let totalPendingRewards = 0n;

        try {
          const secondsInUnit = await contract.SECONDS_IN_UNIT();
          const currentTime = Math.floor(Date.now() / 1000);

          while (stakeIndex < 10) { // 检查前10个质押
            try {
              const stake = await contract.userStakes(userAddress, stakeIndex);
              
              if (stake.amount === 0n) break; // 没有更多质押

              console.log(`  质押 #${stakeIndex}:`);
              console.log(`    - ID: ${stake.id}`);
              console.log(`    - 金额: ${ethers.formatEther(stake.amount)} MC`);
              console.log(`    - 开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
              console.log(`    - 周期: ${stake.cycleDays} 天`);
              console.log(`    - 是否活跃: ${stake.active}`);
              console.log(`    - 已支付: ${ethers.formatEther(stake.paid)} MC`);

              if (stake.active) {
                totalActiveStakes++;
                
                // 计算待领取奖励
                const unitsPassed = Math.floor((currentTime - Number(stake.startTime)) / Number(secondsInUnit));
                const maxUnits = Number(stake.cycleDays);
                const actualUnits = Math.min(unitsPassed, maxUnits);

                let ratePerBillion = 0;
                if (stake.cycleDays === 7n) ratePerBillion = 13333334;
                else if (stake.cycleDays === 15n) ratePerBillion = 16666667;
                else if (stake.cycleDays === 30n) ratePerBillion = 20000000;

                if (actualUnits > 0 && ratePerBillion > 0) {
                  const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
                  const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
                  totalPendingRewards += pending;
                  
                  console.log(`    - 已过时间单位: ${actualUnits}/${maxUnits}`);
                  console.log(`    - 待领取奖励: ${ethers.formatEther(pending)} MC`);
                }
              }

              stakeIndex++;
            } catch (error) {
              break; // 索引越界，结束循环
            }
          }
        } catch (error) {
          console.log(`    ❌ 无法获取质押信息: ${error.message}`);
        }

        console.log(`📊 质押汇总:`);
        console.log(`  - 活跃质押数量: ${totalActiveStakes}`);
        console.log(`  - 总待领取奖励: ${ethers.formatEther(totalPendingRewards)} MC`);

      } catch (error) {
        console.log(`❌ 获取用户信息失败: ${error.message}`);
      }
    }

    // 5. 检查最近的奖励事件
    console.log('\n🎁 最近奖励事件分析');
    console.log('='.repeat(50));

    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // 检查最近10000个区块

      console.log(`📍 检查区块范围: ${fromBlock} - ${currentBlock}`);

      // 检查静态奖励事件
      const rewardEvents = await contract.queryFilter(
        contract.filters.RewardClaimed(),
        fromBlock
      );

      console.log(`\n💰 静态奖励事件 (${rewardEvents.length} 条):`);
      rewardEvents.slice(-5).forEach((event, index) => {
        const args = event.args;
        console.log(`  ${index + 1}. 用户: ${args.user.slice(0, 8)}...`);
        console.log(`     MC: ${ethers.formatEther(args.mcAmount)}`);
        console.log(`     JBC: ${ethers.formatEther(args.jbcAmount)}`);
        console.log(`     类型: ${args.rewardType} (${getRewardTypeName(args.rewardType)})`);
        console.log(`     区块: ${event.blockNumber}`);
      });

      // 检查极差奖励记录事件
      const differentialRecordEvents = await contract.queryFilter(
        contract.filters.DifferentialRewardRecorded(),
        fromBlock
      );

      console.log(`\n⚡ 极差奖励记录事件 (${differentialRecordEvents.length} 条):`);
      differentialRecordEvents.slice(-5).forEach((event, index) => {
        const args = event.args;
        console.log(`  ${index + 1}. 质押ID: ${args.stakeId}`);
        console.log(`     上级: ${args.upline.slice(0, 8)}...`);
        console.log(`     金额: ${ethers.formatEther(args.amount)} MC`);
        console.log(`     区块: ${event.blockNumber}`);
      });

      // 检查极差奖励发放事件
      const differentialReleaseEvents = await contract.queryFilter(
        contract.filters.DifferentialRewardReleased(),
        fromBlock
      );

      console.log(`\n🎯 极差奖励发放事件 (${differentialReleaseEvents.length} 条):`);
      differentialReleaseEvents.slice(-5).forEach((event, index) => {
        const args = event.args;
        console.log(`  ${index + 1}. 质押ID: ${args.stakeId}`);
        console.log(`     上级: ${args.upline.slice(0, 8)}...`);
        console.log(`     金额: ${ethers.formatEther(args.amount)} MC`);
        console.log(`     区块: ${event.blockNumber}`);
      });

      // 检查质押事件
      const stakeEvents = await contract.queryFilter(
        contract.filters.LiquidityStaked(),
        fromBlock
      );

      console.log(`\n💎 质押事件 (${stakeEvents.length} 条):`);
      stakeEvents.slice(-5).forEach((event, index) => {
        const args = event.args;
        console.log(`  ${index + 1}. 用户: ${args.user.slice(0, 8)}...`);
        console.log(`     金额: ${ethers.formatEther(args.amount)} MC`);
        console.log(`     周期: ${args.cycleDays} 天`);
        console.log(`     质押ID: ${args.stakeId}`);
        console.log(`     区块: ${event.blockNumber}`);
      });

    } catch (error) {
      console.log(`❌ 获取事件失败: ${error.message}`);
    }

    console.log('\n✅ 诊断完成！');
    console.log('\n💡 诊断结果分析:');
    console.log('1. 如果看到静态奖励事件但没有极差奖励事件，说明：');
    console.log('   - 可能还没有用户达到触发极差奖励的条件');
    console.log('   - 或者需要检查合约的极差奖励逻辑');
    console.log('2. 如果用户有质押但没有待领取奖励，说明：');
    console.log('   - 质押时间可能还不足以产生收益');
    console.log('   - 或者用户已经达到收益上限');
    console.log('3. 如果用户等级为V0，说明团队人数不足10人');

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

function getRewardTypeName(type) {
  const types = {
    0: '静态奖励',
    1: '动态奖励',
    2: '直推奖励', 
    3: '层级奖励',
    4: '极差奖励'
  };
  return types[type] || '未知类型';
}

// 运行诊断
if (require.main === module) {
  diagnoseRewards().catch(console.error);
}

module.exports = { diagnoseRewards };