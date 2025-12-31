import { ethers } from 'ethers';

const RPC_URL = 'https://chain.mcerscan.com/';
const CONTRACT_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';
const USER_ADDRESS = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';

const ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function calculateStaticReward(address user, uint256 stakeIndex) view returns (uint256 mcAmount, uint256 jbcAmount)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  
  // 事件
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 stakeId, uint256 cycleDays)"
];

async function analyzeRewards() {
  console.log('🔍 分析用户奖励缺失问题');
  console.log('用户地址:', USER_ADDRESS);
  console.log('分析时间:', new Date().toISOString());
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // 1. 获取基本配置
    console.log('📋 1. 系统配置检查');
    const secondsInUnit = await contract.SECONDS_IN_UNIT();
    const currentTime = Math.floor(Date.now() / 1000);
    
    console.log('时间单位 (SECONDS_IN_UNIT):', Number(secondsInUnit), '秒');
    console.log('当前时间戳:', currentTime);
    console.log('当前时间:', new Date(currentTime * 1000).toLocaleString());
    console.log('');

    // 2. 获取用户信息
    console.log('👤 2. 用户状态检查');
    const userInfo = await contract.userInfo(USER_ADDRESS);
    const userTicket = await contract.userTicket(USER_ADDRESS);
    
    console.log('用户信息:');
    console.log('  - 推荐人:', userInfo.referrer);
    console.log('  - 激活状态:', userInfo.isActive);
    console.log('  - 总收益:', ethers.formatEther(userInfo.totalRevenue), 'MC');
    console.log('  - 收益上限:', ethers.formatEther(userInfo.currentCap), 'MC');
    console.log('');
    
    console.log('门票信息:');
    console.log('  - 门票ID:', userTicket.ticketId.toString());
    console.log('  - 门票金额:', ethers.formatEther(userTicket.amount), 'MC');
    console.log('  - 购买时间:', new Date(Number(userTicket.purchaseTime) * 1000).toLocaleString());
    console.log('  - 已退出:', userTicket.exited);
    console.log('');

    // 3. 检查质押记录
    console.log('💰 3. 质押记录分析');
    const stakes = [];
    
    for (let i = 0; i < 10; i++) {
      try {
        const stake = await contract.userStakes(USER_ADDRESS, i);
        if (stake.amount > 0) {
          stakes.push({
            index: i,
            id: Number(stake.id),
            amount: ethers.formatEther(stake.amount),
            startTime: Number(stake.startTime),
            cycleDays: Number(stake.cycleDays),
            active: stake.active,
            paid: ethers.formatEther(stake.paid)
          });
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    console.log('找到', stakes.length, '个质押记录:');
    
    for (const stake of stakes) {
      console.log('\\n质押记录', stake.index + 1, ':');
      console.log('  - ID:', stake.id);
      console.log('  - 金额:', stake.amount, 'MC');
      console.log('  - 开始时间:', new Date(stake.startTime * 1000).toLocaleString());
      console.log('  - 周期:', stake.cycleDays, '天');
      console.log('  - 激活状态:', stake.active);
      console.log('  - 已支付:', stake.paid, 'MC');
      
      // 计算应得奖励
      const elapsed = currentTime - stake.startTime;
      const unitsPassed = Math.floor(elapsed / Number(secondsInUnit));
      const maxUnits = stake.cycleDays;
      const actualUnits = Math.min(unitsPassed, maxUnits);
      
      console.log('  - 已过时间:', elapsed, '秒 ≈', Math.floor(elapsed/3600), '小时');
      console.log('  - 已过单位数:', unitsPassed);
      console.log('  - 最大单位数:', maxUnits);
      console.log('  - 有效单位数:', actualUnits);
      
      if (actualUnits > 0) {
        // 根据周期确定收益率
        let ratePerBillion = 0;
        if (stake.cycleDays === 7) ratePerBillion = 13333334;
        else if (stake.cycleDays === 15) ratePerBillion = 16666667;
        else if (stake.cycleDays === 30) ratePerBillion = 20000000;
        
        if (ratePerBillion > 0) {
          const stakeAmountWei = ethers.parseEther(stake.amount);
          const totalStaticShouldBe = (stakeAmountWei * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
          const paidWei = ethers.parseEther(stake.paid);
          const pending = totalStaticShouldBe > paidWei ? totalStaticShouldBe - paidWei : 0n;
          
          console.log('  - 收益率:', ratePerBillion / 10000000, '%/单位');
          console.log('  - 应得总奖励:', ethers.formatEther(totalStaticShouldBe), 'MC');
          console.log('  - 待领取奖励:', ethers.formatEther(pending), 'MC');
          
          if (pending > 0) {
            console.log('  ✅ 有待领取的静态奖励!');
          } else {
            console.log('  ❌ 没有待领取的静态奖励');
          }
        }
      } else {
        const nextRewardIn = Number(secondsInUnit) - (elapsed % Number(secondsInUnit));
        console.log('  ⏳ 距离首次奖励:', nextRewardIn, '秒 ≈', Math.floor(nextRewardIn/3600), '小时');
      }
    }

    // 4. 尝试调用计算函数（如果存在）
    console.log('\\n🧮 4. 奖励计算验证');
    try {
      for (let i = 0; i < stakes.length; i++) {
        try {
          const reward = await contract.calculateStaticReward(USER_ADDRESS, i);
          console.log('质押', i + 1, '计算结果:');
          console.log('  - MC奖励:', ethers.formatEther(reward.mcAmount), 'MC');
          console.log('  - JBC奖励:', ethers.formatEther(reward.jbcAmount), 'JBC');
        } catch (e) {
          console.log('质押', i + 1, '计算失败:', e.message);
        }
      }
    } catch (e) {
      console.log('❌ 合约没有 calculateStaticReward 函数');
    }

    // 5. 检查储备池
    console.log('\\n💧 5. 流动性储备检查');
    try {
      const reserveMC = await contract.swapReserveMC();
      const reserveJBC = await contract.swapReserveJBC();
      
      console.log('MC储备:', ethers.formatEther(reserveMC), 'MC');
      console.log('JBC储备:', ethers.formatEther(reserveJBC), 'JBC');
      
      if (reserveMC > 0 && reserveJBC > 0) {
        const jbcPrice = (reserveMC * 1000000000000000000n) / reserveJBC;
        console.log('JBC价格:', ethers.formatEther(jbcPrice), 'MC/JBC');
        console.log('✅ 流动性充足，可以进行奖励分配');
      } else {
        console.log('❌ 流动性不足，可能影响奖励分配');
      }
    } catch (e) {
      console.log('❌ 无法获取储备信息:', e.message);
    }

    // 6. 查询最近的质押事件
    console.log('\\n📅 6. 最近质押事件查询');
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const stakeEvents = await contract.queryFilter(
        contract.filters.LiquidityStaked(USER_ADDRESS),
        fromBlock
      );
      
      console.log('找到', stakeEvents.length, '个质押事件:');
      for (const event of stakeEvents) {
        const block = await provider.getBlock(event.blockNumber);
        console.log('  - 区块:', event.blockNumber);
        console.log('  - 时间:', new Date(block.timestamp * 1000).toLocaleString());
        console.log('  - 金额:', ethers.formatEther(event.args.amount), 'MC');
        console.log('  - 质押ID:', event.args.stakeId.toString());
        console.log('  - 周期:', event.args.cycleDays.toString(), '天');
        console.log('');
      }
    } catch (e) {
      console.log('❌ 查询质押事件失败:', e.message);
    }

    // 7. 总结分析
    console.log('\\n📊 7. 问题分析总结');
    
    const hasActiveStakes = stakes.some(s => s.active);
    const hasValidTicket = userTicket.amount > 0 && !userTicket.exited;
    const hasElapsedTime = stakes.some(s => {
      const elapsed = currentTime - s.startTime;
      return Math.floor(elapsed / Number(secondsInUnit)) > 0;
    });
    
    console.log('检查项目:');
    console.log('  ✅ 网络连接正常');
    console.log('  ✅ 合约访问正常');
    console.log('  ' + (hasValidTicket ? '✅' : '❌') + ' 有效门票:', hasValidTicket);
    console.log('  ' + (hasActiveStakes ? '✅' : '❌') + ' 激活质押:', hasActiveStakes);
    console.log('  ' + (hasElapsedTime ? '✅' : '❌') + ' 时间充足:', hasElapsedTime);
    
    console.log('\\n可能的问题原因:');
    if (!hasValidTicket) {
      console.log('  🔴 门票无效或已退出');
    }
    if (!hasActiveStakes) {
      console.log('  🔴 没有激活的质押');
    }
    if (!hasElapsedTime) {
      console.log('  🔴 质押时间不足，还未到奖励发放时间');
    }
    if (hasValidTicket && hasActiveStakes && hasElapsedTime) {
      console.log('  🟡 系统配置可能有问题，或者需要手动触发奖励计算');
      console.log('  🟡 可能需要调用 claimStaticReward 函数来领取奖励');
      console.log('  🟡 前端可能没有正确显示已有的奖励记录');
    }

  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
  }
}

analyzeRewards();