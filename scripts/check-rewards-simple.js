#!/usr/bin/env node

/**
 * 简化的奖励状态检查工具
 * 用于快速诊断静态奖励和极差奖励的显示问题
 */

const { ethers } = require('ethers');

// 配置信息
const CONFIG = {
  // MC Chain RPC
  RPC_URL: 'https://rpc.mcchain.info',
  
  // 合约地址 - 请根据实际部署地址修改
  PROTOCOL_ADDRESS: process.env.PROTOCOL_ADDRESS || '0x...', // 请填入实际地址
  
  // 测试用户地址 - 可以通过命令行参数传入
  TEST_USER: process.argv[2] || process.env.TEST_USER || '0x...', // 请填入实际地址
};

// 简化的合约ABI
const MINIMAL_ABI = [
  'function userInfo(address) view returns (address, uint256, uint256, uint256, uint256, bool, uint256, uint256, uint256)',
  'function getUserLevel(address) view returns (uint256, uint256, uint256)',
  'function userTicket(address) view returns (uint256, uint256, uint256, bool)',
  'function userStakes(address, uint256) view returns (uint256, uint256, uint256, uint256, bool, uint256)',
  'function SECONDS_IN_UNIT() view returns (uint256)',
  'event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)',
  'event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)'
];

async function checkRewards() {
  console.log('🔍 金宝协议奖励状态检查工具');
  console.log('=' .repeat(50));

  // 验证配置
  if (CONFIG.PROTOCOL_ADDRESS === '0x...' || !CONFIG.PROTOCOL_ADDRESS) {
    console.log('❌ 错误: 请设置正确的协议合约地址');
    console.log('   方法1: 设置环境变量 PROTOCOL_ADDRESS=0x...');
    console.log('   方法2: 直接修改脚本中的 PROTOCOL_ADDRESS');
    return;
  }

  if (CONFIG.TEST_USER === '0x...' || !CONFIG.TEST_USER) {
    console.log('❌ 错误: 请设置要检查的用户地址');
    console.log('   方法1: 运行 node check-rewards-simple.js 0x用户地址');
    console.log('   方法2: 设置环境变量 TEST_USER=0x...');
    return;
  }

  try {
    // 连接到网络
    console.log(`🌐 连接到 MC Chain: ${CONFIG.RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    
    // 测试网络连接
    const network = await provider.getNetwork();
    console.log(`✅ 网络连接成功: Chain ID ${network.chainId}`);
    
    // 连接合约
    const contract = new ethers.Contract(CONFIG.PROTOCOL_ADDRESS, MINIMAL_ABI, provider);
    console.log(`📋 合约地址: ${CONFIG.PROTOCOL_ADDRESS}`);
    
    const userAddress = CONFIG.TEST_USER;
    console.log(`👤 检查用户: ${userAddress}\n`);

    // 1. 基本信息检查
    console.log('📊 1. 用户基本信息');
    console.log('-'.repeat(30));
    
    try {
      const userInfo = await contract.userInfo(userAddress);
      const [referrer, activeDirects, teamCount, totalRevenue, currentCap, isActive] = userInfo;
      
      console.log(`推荐人: ${referrer}`);
      console.log(`直推数量: ${activeDirects}`);
      console.log(`团队人数: ${teamCount}`);
      console.log(`总收益: ${ethers.formatEther(totalRevenue)} MC`);
      console.log(`收益上限: ${ethers.formatEther(currentCap)} MC`);
      console.log(`激活状态: ${isActive ? '✅ 已激活' : '❌ 未激活'}`);
      
      // 收益上限检查
      const remainingCap = currentCap - totalRevenue;
      console.log(`剩余收益额度: ${ethers.formatEther(remainingCap)} MC`);
      
      if (remainingCap <= 0n) {
        console.log('⚠️  警告: 用户已达到收益上限，无法获得更多奖励');
      }
      
    } catch (error) {
      console.log(`❌ 获取用户信息失败: ${error.message}`);
      return;
    }

    // 2. 等级信息检查
    console.log('\n🏆 2. 用户等级信息');
    console.log('-'.repeat(30));
    
    try {
      const levelInfo = await contract.getUserLevel(userAddress);
      const [level, percent, teamCount] = levelInfo;
      
      console.log(`当前等级: V${level}`);
      console.log(`极差收益比例: ${percent}%`);
      console.log(`团队地址数: ${teamCount}`);
      
      // 等级分析
      if (level === 0n) {
        console.log('💡 提示: V0等级无法获得极差奖励，需要至少10个团队地址升级到V1');
      } else {
        console.log(`✅ 当前等级可获得 ${percent}% 的极差奖励`);
      }
      
    } catch (error) {
      console.log(`❌ 获取等级信息失败: ${error.message}`);
    }

    // 3. 门票状态检查
    console.log('\n🎫 3. 门票状态检查');
    console.log('-'.repeat(30));
    
    try {
      const ticket = await contract.userTicket(userAddress);
      const [ticketId, amount, purchaseTime, exited] = ticket;
      
      if (amount === 0n) {
        console.log('❌ 用户没有门票，无法获得静态奖励');
        console.log('💡 提示: 请先购买门票（100/300/500/1000 MC）');
      } else {
        console.log(`门票ID: ${ticketId}`);
        console.log(`门票金额: ${ethers.formatEther(amount)} MC`);
        console.log(`购买时间: ${new Date(Number(purchaseTime) * 1000).toLocaleString()}`);
        console.log(`退出状态: ${exited ? '❌ 已退出' : '✅ 活跃'}`);
        
        if (exited) {
          console.log('⚠️  警告: 门票已退出，无法获得静态奖励');
        }
      }
      
    } catch (error) {
      console.log(`❌ 获取门票信息失败: ${error.message}`);
    }

    // 4. 质押状态检查
    console.log('\n💎 4. 质押状态检查');
    console.log('-'.repeat(30));
    
    try {
      const secondsInUnit = await contract.SECONDS_IN_UNIT();
      const currentTime = Math.floor(Date.now() / 1000);
      
      console.log(`时间单位: ${secondsInUnit} 秒`);
      
      let totalActiveStakes = 0;
      let totalPendingRewards = 0n;
      
      // 检查前5个质押
      for (let i = 0; i < 5; i++) {
        try {
          const stake = await contract.userStakes(userAddress, i);
          const [id, amount, startTime, cycleDays, active, paid] = stake;
          
          if (amount === 0n) break; // 没有更多质押
          
          console.log(`\n质押 #${i}:`);
          console.log(`  ID: ${id}`);
          console.log(`  金额: ${ethers.formatEther(amount)} MC`);
          console.log(`  周期: ${cycleDays} 天`);
          console.log(`  状态: ${active ? '✅ 活跃' : '❌ 非活跃'}`);
          console.log(`  已支付: ${ethers.formatEther(paid)} MC`);
          
          if (active) {
            totalActiveStakes++;
            
            // 计算待领取奖励
            const unitsPassed = Math.floor((currentTime - Number(startTime)) / Number(secondsInUnit));
            const maxUnits = Number(cycleDays);
            const actualUnits = Math.min(unitsPassed, maxUnits);
            
            console.log(`  已过时间: ${actualUnits}/${maxUnits} 单位`);
            
            if (actualUnits > 0) {
              let ratePerBillion = 0;
              if (cycleDays === 7n) ratePerBillion = 13333334;
              else if (cycleDays === 15n) ratePerBillion = 16666667;
              else if (cycleDays === 30n) ratePerBillion = 20000000;
              
              if (ratePerBillion > 0) {
                const totalStaticShouldBe = (amount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
                const pending = totalStaticShouldBe > paid ? totalStaticShouldBe - paid : 0n;
                totalPendingRewards += pending;
                
                console.log(`  待领取: ${ethers.formatEther(pending)} MC`);
              }
            }
          }
          
        } catch (error) {
          break; // 索引越界，结束循环
        }
      }
      
      console.log(`\n📊 质押汇总:`);
      console.log(`活跃质押数量: ${totalActiveStakes}`);
      console.log(`总待领取奖励: ${ethers.formatEther(totalPendingRewards)} MC`);
      
      if (totalActiveStakes === 0) {
        console.log('💡 提示: 没有活跃质押，无法获得静态奖励');
        console.log('   请前往挖矿页面进行质押（需要门票金额的150%）');
      } else if (totalPendingRewards === 0n) {
        console.log('💡 提示: 暂无待领取奖励，可能需要等待更多时间');
      } else {
        console.log('✅ 有待领取的静态奖励，请前往挖矿页面领取');
      }
      
    } catch (error) {
      console.log(`❌ 获取质押信息失败: ${error.message}`);
    }

    // 5. 最近奖励事件检查
    console.log('\n🎁 5. 最近奖励事件');
    console.log('-'.repeat(30));
    
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      
      console.log(`检查区块范围: ${fromBlock} - ${currentBlock}`);
      
      // 检查静态奖励事件
      const rewardEvents = await contract.queryFilter(
        contract.filters.RewardClaimed(userAddress),
        fromBlock
      );
      
      console.log(`\n💰 静态奖励事件: ${rewardEvents.length} 条`);
      if (rewardEvents.length > 0) {
        const recent = rewardEvents.slice(-3);
        recent.forEach((event, index) => {
          const args = event.args;
          console.log(`  ${index + 1}. MC: ${ethers.formatEther(args.mcAmount)}, JBC: ${ethers.formatEther(args.jbcAmount)}, 类型: ${args.rewardType}`);
        });
      } else {
        console.log('  暂无静态奖励记录');
      }
      
      // 检查极差奖励事件
      const differentialEvents = await contract.queryFilter(
        contract.filters.DifferentialRewardReleased(null, userAddress),
        fromBlock
      );
      
      console.log(`\n⚡ 极差奖励事件: ${differentialEvents.length} 条`);
      if (differentialEvents.length > 0) {
        const recent = differentialEvents.slice(-3);
        recent.forEach((event, index) => {
          const args = event.args;
          console.log(`  ${index + 1}. 质押ID: ${args.stakeId}, 金额: ${ethers.formatEther(args.amount)} MC`);
        });
      } else {
        console.log('  暂无极差奖励记录');
        console.log('  💡 极差奖励需要下级用户进行质押才会触发');
      }
      
    } catch (error) {
      console.log(`❌ 获取事件失败: ${error.message}`);
    }

    // 6. 总结和建议
    console.log('\n📋 6. 诊断总结');
    console.log('-'.repeat(30));
    
    console.log('✅ 诊断完成！');
    console.log('\n💡 常见问题解决方案:');
    console.log('1. 静态奖励不显示:');
    console.log('   - 确保已购买门票且未退出');
    console.log('   - 确保已进行质押且质押处于活跃状态');
    console.log('   - 等待足够时间让质押产生收益');
    console.log('   - 检查是否已达到收益上限');
    
    console.log('\n2. 极差奖励不显示:');
    console.log('   - 确保团队人数达到至少10人（V1等级）');
    console.log('   - 需要下级用户进行质押才会触发极差奖励');
    console.log('   - 极差奖励基于等级差额计算，需要等级差异');
    
    console.log('\n3. 如何获得更多奖励:');
    console.log('   - 增加质押金额和延长质押周期获得更多静态奖励');
    console.log('   - 邀请更多用户加入团队提升V等级获得更多极差奖励');
    console.log('   - 帮助团队成员进行质押触发极差奖励');

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message);
  }
}

// 显示使用说明
function showUsage() {
  console.log('使用方法:');
  console.log('  node check-rewards-simple.js [用户地址]');
  console.log('');
  console.log('环境变量:');
  console.log('  PROTOCOL_ADDRESS - 协议合约地址');
  console.log('  TEST_USER - 要检查的用户地址');
  console.log('');
  console.log('示例:');
  console.log('  node check-rewards-simple.js 0x1234567890123456789012345678901234567890');
  console.log('  PROTOCOL_ADDRESS=0xABC... TEST_USER=0x123... node check-rewards-simple.js');
}

// 主程序
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
  } else {
    checkRewards().catch(console.error);
  }
}

module.exports = { checkRewards };