import { ethers } from 'ethers';
import fs from 'fs';

// MC Chain 配置
const MC_CHAIN_CONFIG = {
  chainId: 88813,
  name: 'MC Chain',
  rpcUrl: 'https://chain.mcerscan.com/',
  explorerUrl: 'https://mcerscan.com'
};

// 合约地址 (从现有代码中获取)
const CONTRACT_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 合约 ABI (简化版，包含诊断需要的函数)
const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function userInfo(address) view returns (address referrer, bool isActive, uint256 totalRevenue, uint256 currentCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 id, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  
  // 事件
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice)",
  "event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 stakeId, uint256 cycleDays)"
];

async function diagnoseUser() {
  const userAddress = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';
  
  console.log('🔍 开始诊断用户:', userAddress);
  console.log('⏰ 诊断时间:', new Date().toISOString());
  console.log('');

  try {
    // 连接到 MC Chain
    const provider = new ethers.JsonRpcProvider(MC_CHAIN_CONFIG.rpcUrl);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const diagnostic = {
      userAddress,
      timestamp: new Date().toISOString(),
      issues: [],
      solutions: []
    };

    // 1. 检查网络连接
    console.log('📡 检查网络连接...');
    try {
      const startTime = Date.now();
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const latency = Date.now() - startTime;

      diagnostic.network = {
        chainId: Number(network.chainId),
        blockNumber,
        latency,
        isCorrectNetwork: Number(network.chainId) === MC_CHAIN_CONFIG.chainId
      };

      console.log(`✅ 网络连接成功`);
      console.log(`   - 链ID: ${diagnostic.network.chainId}`);
      console.log(`   - 区块高度: ${diagnostic.network.blockNumber}`);
      console.log(`   - 延迟: ${diagnostic.network.latency}ms`);
      
      if (!diagnostic.network.isCorrectNetwork) {
        diagnostic.issues.push({
          type: 'network',
          severity: 'critical',
          description: `网络错误：当前链ID ${diagnostic.network.chainId}，应为 ${MC_CHAIN_CONFIG.chainId}`
        });
      }
    } catch (error) {
      console.log('❌ 网络连接失败:', error.message);
      diagnostic.issues.push({
        type: 'network',
        severity: 'critical',
        description: '网络连接失败',
        error: error.message
      });
      return diagnostic;
    }

    // 2. 检查合约状态
    console.log('\n📋 检查合约状态...');
    try {
      const owner = await contract.owner();
      
      let isPaused = null;
      let isEmergencyPaused = false;
      
      try {
        isPaused = await contract.paused();
      } catch (e) {
        console.log('   ⚠️ 合约没有 paused() 函数');
      }

      try {
        isEmergencyPaused = await contract.emergencyPaused();
      } catch (e) {
        console.log('   ⚠️ 合约没有 emergencyPaused() 函数');
      }

      const balance = await provider.getBalance(CONTRACT_ADDRESS);
      
      diagnostic.contract = {
        isAccessible: true,
        owner,
        isPaused,
        isEmergencyPaused,
        balance: ethers.formatEther(balance)
      };

      console.log('✅ 合约访问成功');
      console.log(`   - 合约所有者: ${owner}`);
      console.log(`   - 合约暂停: ${isPaused}`);
      console.log(`   - 紧急暂停: ${isEmergencyPaused}`);
      console.log(`   - 合约余额: ${diagnostic.contract.balance} MC`);

      if (isPaused) {
        diagnostic.issues.push({
          type: 'contract',
          severity: 'high',
          description: '协议合约已暂停'
        });
      }

      if (isEmergencyPaused) {
        diagnostic.issues.push({
          type: 'contract',
          severity: 'critical',
          description: '协议处于紧急暂停状态'
        });
      }

    } catch (error) {
      console.log('❌ 合约访问失败:', error.message);
      diagnostic.contract = {
        isAccessible: false,
        error: error.message
      };
      diagnostic.issues.push({
        type: 'contract',
        severity: 'critical',
        description: '无法访问协议合约',
        error: error.message
      });
    }

    // 3. 检查用户基本信息
    console.log('\n👤 检查用户基本信息...');
    try {
      const userInfo = await contract.userInfo(userAddress);
      
      diagnostic.userInfo = {
        referrer: userInfo.referrer,
        hasReferrer: userInfo.referrer !== ethers.ZeroAddress,
        isActive: userInfo.isActive,
        totalRevenue: ethers.formatEther(userInfo.totalRevenue),
        currentCap: ethers.formatEther(userInfo.currentCap),
        maxTicketAmount: ethers.formatEther(userInfo.maxTicketAmount),
        maxSingleTicketAmount: ethers.formatEther(userInfo.maxSingleTicketAmount)
      };

      console.log('✅ 用户信息获取成功');
      console.log(`   - 推荐人: ${diagnostic.userInfo.referrer}`);
      console.log(`   - 已绑定推荐人: ${diagnostic.userInfo.hasReferrer}`);
      console.log(`   - 用户激活: ${diagnostic.userInfo.isActive}`);
      console.log(`   - 总收益: ${diagnostic.userInfo.totalRevenue} MC`);
      console.log(`   - 收益上限: ${diagnostic.userInfo.currentCap} MC`);

      if (!diagnostic.userInfo.hasReferrer) {
        diagnostic.issues.push({
          type: 'user_state',
          severity: 'medium',
          description: '用户没有推荐人'
        });
      }

    } catch (error) {
      console.log('❌ 用户信息获取失败:', error.message);
      diagnostic.issues.push({
        type: 'user_state',
        severity: 'high',
        description: '无法获取用户信息',
        error: error.message
      });
    }

    // 4. 检查用户门票
    console.log('\n🎫 检查用户门票...');
    try {
      const ticket = await contract.userTicket(userAddress);
      
      diagnostic.userTicket = {
        id: ticket.id.toString(),
        amount: ethers.formatEther(ticket.amount),
        purchaseTime: Number(ticket.purchaseTime),
        exited: ticket.exited,
        isActive: ticket.amount > 0 && !ticket.exited
      };

      console.log('✅ 门票信息获取成功');
      console.log(`   - 门票ID: ${diagnostic.userTicket.id}`);
      console.log(`   - 门票金额: ${diagnostic.userTicket.amount} MC`);
      console.log(`   - 购买时间: ${new Date(diagnostic.userTicket.purchaseTime * 1000).toLocaleString()}`);
      console.log(`   - 已退出: ${diagnostic.userTicket.exited}`);
      console.log(`   - 门票有效: ${diagnostic.userTicket.isActive}`);

      if (!diagnostic.userTicket.isActive) {
        diagnostic.issues.push({
          type: 'user_state',
          severity: 'high',
          description: '用户没有有效的门票',
          details: {
            amount: diagnostic.userTicket.amount,
            exited: diagnostic.userTicket.exited
          }
        });
      }

    } catch (error) {
      console.log('❌ 门票信息获取失败:', error.message);
      diagnostic.issues.push({
        type: 'user_state',
        severity: 'high',
        description: '无法获取门票信息',
        error: error.message
      });
    }

    // 5. 检查用户等级
    console.log('\n📊 检查用户等级...');
    try {
      const userLevel = await contract.getUserLevel(userAddress);
      
      diagnostic.userLevel = {
        level: Number(userLevel.level),
        percent: Number(userLevel.percent),
        teamCount: Number(userLevel.teamCount)
      };

      console.log('✅ 用户等级获取成功');
      console.log(`   - V等级: V${diagnostic.userLevel.level}`);
      console.log(`   - 级差比例: ${diagnostic.userLevel.percent}%`);
      console.log(`   - 团队人数: ${diagnostic.userLevel.teamCount}`);

    } catch (error) {
      console.log('❌ 用户等级获取失败:', error.message);
      diagnostic.issues.push({
        type: 'user_state',
        severity: 'medium',
        description: '无法获取用户等级',
        error: error.message
      });
    }

    // 6. 检查用户质押
    console.log('\n💰 检查用户质押...');
    try {
      const stakes = [];
      
      // 检查前10个质押位置
      for (let i = 0; i < 10; i++) {
        try {
          const stake = await contract.userStakes(userAddress, i);
          if (stake.amount > 0) {
            stakes.push({
              id: Number(stake.id),
              amount: ethers.formatEther(stake.amount),
              startTime: Number(stake.startTime),
              cycleDays: Number(stake.cycleDays),
              active: stake.active,
              paid: ethers.formatEther(stake.paid)
            });
          } else {
            break; // 没有更多质押了
          }
        } catch (e) {
          break; // 索引越界，结束检查
        }
      }

      diagnostic.userStakes = stakes;

      console.log(`✅ 找到 ${stakes.length} 个质押记录`);
      stakes.forEach((stake, index) => {
        console.log(`   质押 ${index + 1}:`);
        console.log(`     - ID: ${stake.id}`);
        console.log(`     - 金额: ${stake.amount} MC`);
        console.log(`     - 开始时间: ${new Date(stake.startTime * 1000).toLocaleString()}`);
        console.log(`     - 周期: ${stake.cycleDays} 天`);
        console.log(`     - 激活: ${stake.active}`);
        console.log(`     - 已支付: ${stake.paid} MC`);
      });

      if (stakes.length === 0 && diagnostic.userTicket.isActive) {
        diagnostic.issues.push({
          type: 'user_state',
          severity: 'medium',
          description: '用户有门票但没有质押记录'
        });
      }

    } catch (error) {
      console.log('❌ 质押信息获取失败:', error.message);
      diagnostic.issues.push({
        type: 'user_state',
        severity: 'medium',
        description: '无法获取质押信息',
        error: error.message
      });
    }

    // 7. 检查奖励事件
    console.log('\n🎁 检查奖励事件...');
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000); // 检查最近100000个区块
      
      console.log(`   查询区块范围: ${fromBlock} - ${currentBlock}`);

      // 查询各种奖励事件
      const [
        rewardClaimedEvents,
        rewardPaidEvents,
        referralRewardEvents,
        differentialRewardEvents,
        differentialReleasedEvents
      ] = await Promise.allSettled([
        contract.queryFilter(contract.filters.RewardClaimed(userAddress), fromBlock),
        contract.queryFilter(contract.filters.RewardPaid(userAddress), fromBlock),
        contract.queryFilter(contract.filters.ReferralRewardPaid(userAddress), fromBlock),
        contract.queryFilter(contract.filters.DifferentialRewardDistributed(userAddress), fromBlock),
        contract.queryFilter(contract.filters.DifferentialRewardReleased(null, userAddress), fromBlock)
      ]);

      diagnostic.rewardEvents = {
        rewardClaimed: rewardClaimedEvents.status === 'fulfilled' ? rewardClaimedEvents.value.length : 0,
        rewardPaid: rewardPaidEvents.status === 'fulfilled' ? rewardPaidEvents.value.length : 0,
        referralReward: referralRewardEvents.status === 'fulfilled' ? referralRewardEvents.value.length : 0,
        differentialReward: differentialRewardEvents.status === 'fulfilled' ? differentialRewardEvents.value.length : 0,
        differentialReleased: differentialReleasedEvents.status === 'fulfilled' ? differentialReleasedEvents.value.length : 0
      };

      const totalEvents = Object.values(diagnostic.rewardEvents).reduce((sum, count) => sum + count, 0);

      console.log('✅ 奖励事件查询完成');
      console.log(`   - RewardClaimed: ${diagnostic.rewardEvents.rewardClaimed} 条`);
      console.log(`   - RewardPaid: ${diagnostic.rewardEvents.rewardPaid} 条`);
      console.log(`   - ReferralReward: ${diagnostic.rewardEvents.referralReward} 条`);
      console.log(`   - DifferentialReward: ${diagnostic.rewardEvents.differentialReward} 条`);
      console.log(`   - DifferentialReleased: ${diagnostic.rewardEvents.differentialReleased} 条`);
      console.log(`   - 总计: ${totalEvents} 条`);

      if (totalEvents === 0) {
        diagnostic.issues.push({
          type: 'user_state',
          severity: 'medium',
          description: '没有找到任何奖励记录'
        });
      }

      // 检查静态奖励问题
      if (diagnostic.userTicket.isActive && diagnostic.rewardEvents.rewardClaimed === 0) {
        diagnostic.issues.push({
          type: 'user_state',
          severity: 'medium',
          description: '用户有有效门票但没有静态奖励记录'
        });
      }

    } catch (error) {
      console.log('❌ 奖励事件查询失败:', error.message);
      diagnostic.issues.push({
        type: 'component',
        severity: 'high',
        description: '奖励事件查询失败',
        error: error.message
      });
    }

    // 8. 生成诊断报告
    console.log('\n📋 生成诊断报告...');
    
    // 分析解决方案
    if (diagnostic.issues.length > 0) {
      diagnostic.issues.forEach(issue => {
        switch (issue.description) {
          case '用户没有有效的门票':
            diagnostic.solutions.push('需要购买门票才能获得奖励');
            break;
          case '用户没有推荐人':
            diagnostic.solutions.push('绑定推荐人可以获得更多奖励机会');
            break;
          case '没有找到任何奖励记录':
            diagnostic.solutions.push('用户可能还没有产生奖励，或者奖励事件查询失败');
            break;
          case '用户有有效门票但没有静态奖励记录':
            diagnostic.solutions.push('可能需要等待静态奖励产生，或检查质押状态');
            break;
          case '无法访问协议合约':
            diagnostic.solutions.push('合约可能暂时不可用，请稍后重试或联系技术支持');
            break;
          case '协议合约已暂停':
            diagnostic.solutions.push('协议暂时暂停，请等待恢复');
            break;
        }
      });
    }

    // 设置推荐行动
    const criticalIssues = diagnostic.issues.filter(i => i.severity === 'critical').length;
    const highIssues = diagnostic.issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) {
      diagnostic.recommendedAction = '存在严重问题，需要立即处理';
      diagnostic.canPurchaseTicket = false;
    } else if (highIssues > 0) {
      diagnostic.recommendedAction = '存在重要问题，建议优先解决';
      diagnostic.canPurchaseTicket = false;
    } else if (!diagnostic.userTicket?.isActive) {
      diagnostic.recommendedAction = '建议购买门票开始获得奖励';
      diagnostic.canPurchaseTicket = true;
    } else {
      diagnostic.recommendedAction = '系统运行正常，继续使用';
      diagnostic.canPurchaseTicket = true;
    }

    // 保存诊断结果
    const filename = `diagnostic-${userAddress}-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(diagnostic, null, 2));
    
    console.log(`\n💾 诊断结果已保存到: ${filename}`);

    // 输出总结
    console.log('\n📊 诊断总结:');
    console.log(`   - 发现问题: ${diagnostic.issues.length} 个`);
    console.log(`   - 严重问题: ${criticalIssues} 个`);
    console.log(`   - 重要问题: ${highIssues} 个`);
    console.log(`   - 推荐行动: ${diagnostic.recommendedAction}`);
    console.log(`   - 可购买门票: ${diagnostic.canPurchaseTicket ? '是' : '否'}`);

    if (diagnostic.issues.length > 0) {
      console.log('\n🔍 发现的问题:');
      diagnostic.issues.forEach((issue, index) => {
        const severityIcon = {
          'low': '🟡',
          'medium': '🟠', 
          'high': '🔴',
          'critical': '💀'
        }[issue.severity];
        
        console.log(`   ${index + 1}. ${severityIcon} ${issue.description}`);
      });
    }

    if (diagnostic.solutions.length > 0) {
      console.log('\n💡 建议解决方案:');
      diagnostic.solutions.forEach((solution, index) => {
        console.log(`   ${index + 1}. ${solution}`);
      });
    }

    return diagnostic;

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
    return {
      userAddress,
      timestamp: new Date().toISOString(),
      error: error.message,
      issues: [{
        type: 'system',
        severity: 'critical',
        description: '诊断系统错误',
        error: error.message
      }]
    };
  }
}

// 运行诊断
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  diagnoseUser()
    .then(() => {
      console.log('\n✅ 诊断完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 诊断失败:', error);
      process.exit(1);
    });
}

export { diagnoseUser };