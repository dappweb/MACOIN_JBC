// 查询指定用户的所有收益数据
import { ethers } from 'ethers';

// 合约地址和配置
const CONTRACT_ADDRESSES = {
  MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
  JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
  PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
};

// MC Chain RPC
const RPC_URL = "https://chain.mcerscan.com/";

// 合约ABI（简化版）
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)"
];

const MC_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

// 收益类型映射
const REWARD_TYPES = {
  0: "静态收益 (Static Reward)",
  1: "动态收益 (Dynamic Reward)", 
  2: "直推奖励 (Direct Reward)",
  3: "层级奖励 (Level Reward)",
  4: "极差奖励 (Differential Reward)"
};

// 收益率配置
const getRatePerBillion = (cycleDays) => {
  if (cycleDays === 7) return 13333334;
  if (cycleDays === 15) return 16666667;
  if (cycleDays === 30) return 20000000;
  return 0;
};

async function queryUserEarnings(userAddress) {
  console.log(`\n🔍 查询用户收益数据: ${userAddress}`);
  console.log('='.repeat(80));

  try {
    // 连接到MC Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocolContract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    const mcContract = new ethers.Contract(CONTRACT_ADDRESSES.MC_TOKEN, MC_ABI, provider);
    const jbcContract = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, MC_ABI, provider);

    // 获取当前区块和时间
    const currentBlock = await provider.getBlockNumber();
    const currentTime = Math.floor(Date.now() / 1000);
    console.log(`📊 当前区块: ${currentBlock}, 当前时间: ${new Date().toLocaleString()}\n`);

    // 1. 获取用户基本信息
    console.log('👤 用户基本信息:');
    console.log('-'.repeat(40));
    
    const userInfo = await protocolContract.userInfo(userAddress);
    const userTicket = await protocolContract.userTicket(userAddress);
    const mcBalance = await mcContract.balanceOf(userAddress);
    const jbcBalance = await jbcContract.balanceOf(userAddress);

    console.log(`推荐人: ${userInfo[0]}`);
    console.log(`有效直推: ${userInfo[1]}`);
    console.log(`团队人数: ${userInfo[2]}`);
    console.log(`累计收益: ${ethers.formatEther(userInfo[3])} MC`);
    console.log(`收益上限: ${ethers.formatEther(userInfo[4])} MC`);
    console.log(`激活状态: ${userInfo[5] ? '✅ 已激活' : '❌ 未激活'}`);
    console.log(`退费金额: ${ethers.formatEther(userInfo[6])} MC`);
    console.log(`团队总业绩: ${ethers.formatEther(userInfo[7])} MC`);
    console.log(`团队总额度: ${ethers.formatEther(userInfo[8])} MC`);
    console.log(`最高门票: ${ethers.formatEther(userInfo[9])} MC`);
    console.log(`最高单票: ${ethers.formatEther(userInfo[10])} MC`);
    console.log(`MC 余额: ${ethers.formatEther(mcBalance)} MC`);
    console.log(`JBC 余额: ${ethers.formatEther(jbcBalance)} JBC`);

    // 2. 获取门票信息
    console.log('\n🎫 门票信息:');
    console.log('-'.repeat(40));
    
    if (userTicket[1] > 0n) {
      console.log(`门票ID: ${userTicket[0]}`);
      console.log(`门票金额: ${ethers.formatEther(userTicket[1])} MC`);
      console.log(`购买时间: ${new Date(Number(userTicket[2]) * 1000).toLocaleString()}`);
      console.log(`出局状态: ${userTicket[3] ? '❌ 已出局' : '✅ 活跃中'}`);
    } else {
      console.log('❌ 无门票记录');
    }

    // 3. 获取质押信息和静态收益
    console.log('\n⛏️ 质押挖矿信息:');
    console.log('-'.repeat(40));

    const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
    const reserves = {
      mc: await protocolContract.swapReserveMC(),
      jbc: await protocolContract.swapReserveJBC()
    };

    let totalStaked = 0n;
    let totalPendingStatic = 0n;
    let activeStakes = 0;

    for (let i = 0; i < 20; i++) {
      try {
        const stake = await protocolContract.userStakes(userAddress, i);
        if (stake[1] === 0n) break; // 没有更多质押

        const stakeAmount = stake[1];
        const startTime = Number(stake[2]);
        const cycleDays = Number(stake[3]);
        const active = stake[4];
        const paid = stake[5];

        totalStaked += stakeAmount;

        console.log(`\n质押 #${i + 1}:`);
        console.log(`  金额: ${ethers.formatEther(stakeAmount)} MC`);
        console.log(`  周期: ${cycleDays} 天`);
        console.log(`  开始时间: ${new Date(startTime * 1000).toLocaleString()}`);
        console.log(`  状态: ${active ? '🟢 活跃' : '🔴 已结束'}`);
        console.log(`  已支付: ${ethers.formatEther(paid)} MC`);

        if (active) {
          activeStakes++;
          
          // 计算静态收益
          const ratePerBillion = getRatePerBillion(cycleDays);
          const unitsPassed = Math.min(
            cycleDays,
            Math.floor((currentTime - startTime) / Number(secondsInUnit))
          );
          
          if (unitsPassed > 0) {
            const totalStaticShouldBe = (stakeAmount * BigInt(ratePerBillion) * BigInt(unitsPassed)) / 1000000000n;
            const pending = totalStaticShouldBe > paid ? totalStaticShouldBe - paid : 0n;
            totalPendingStatic += pending;

            console.log(`  已过单位: ${unitsPassed}/${cycleDays}`);
            console.log(`  收益率: ${ratePerBillion / 10000000}% 每日`);
            console.log(`  应得总收益: ${ethers.formatEther(totalStaticShouldBe)} MC`);
            console.log(`  待领取: ${ethers.formatEther(pending)} MC`);
            
            // 计算MC/JBC分配
            const mcPart = pending / 2n;
            const jbcValuePart = pending - mcPart;
            let jbcAmount = 0n;
            
            if (reserves.mc > 0n && reserves.jbc > 0n) {
              jbcAmount = (jbcValuePart * reserves.jbc) / reserves.mc;
            } else {
              jbcAmount = jbcValuePart;
            }
            
            console.log(`  待领取MC: ${ethers.formatEther(mcPart)} MC`);
            console.log(`  待领取JBC: ${ethers.formatEther(jbcAmount)} JBC`);
          }
        }
      } catch (error) {
        break; // 没有更多质押
      }
    }

    console.log(`\n📊 质押汇总:`);
    console.log(`总质押金额: ${ethers.formatEther(totalStaked)} MC`);
    console.log(`活跃质押数: ${activeStakes}`);
    console.log(`待领取静态收益: ${ethers.formatEther(totalPendingStatic)} MC`);

    // 4. 查询历史收益记录
    console.log('\n📈 历史收益记录:');
    console.log('-'.repeat(40));

    const fromBlock = Math.max(0, currentBlock - 500000); // 查询最近50万个区块
    
    try {
      // 查询RewardPaid事件（包含静态收益）
      const rewardPaidEvents = await protocolContract.queryFilter(
        protocolContract.filters.RewardPaid(userAddress),
        fromBlock
      );

      // 查询RewardClaimed事件
      const rewardClaimedEvents = await protocolContract.queryFilter(
        protocolContract.filters.RewardClaimed(userAddress),
        fromBlock
      );

      // 查询ReferralRewardPaid事件
      const referralRewardEvents = await protocolContract.queryFilter(
        protocolContract.filters.ReferralRewardPaid(userAddress),
        fromBlock
      );

      const allEvents = [...rewardPaidEvents, ...rewardClaimedEvents, ...referralRewardEvents];
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber); // 按区块号降序排列

      if (allEvents.length === 0) {
        console.log('❌ 暂无历史收益记录');
      } else {
        console.log(`📊 找到 ${allEvents.length} 条收益记录:\n`);

        let totalHistoricalMC = 0;
        let totalHistoricalJBC = 0;
        const rewardTypeStats = {};

        for (const event of allEvents.slice(0, 30)) { // 显示最近30条
          const block = await provider.getBlock(event.blockNumber);
          const timestamp = block ? block.timestamp : 0;
          
          if (event.fragment.name === 'RewardPaid') {
            const amount = ethers.formatEther(event.args[1]);
            const rewardType = Number(event.args[2]);

            totalHistoricalMC += parseFloat(amount);
            rewardTypeStats[rewardType] = (rewardTypeStats[rewardType] || 0) + parseFloat(amount);

            console.log(`💎 ${REWARD_TYPES[rewardType] || `未知类型(${rewardType})`} (RewardPaid)`);
            console.log(`   总金额: ${amount} MC`);
            console.log(`   时间: ${new Date(timestamp * 1000).toLocaleString()}`);
            console.log(`   区块: ${event.blockNumber}`);
            console.log(`   交易: ${event.transactionHash}\n`);
            
          } else if (event.fragment.name === 'RewardClaimed') {
            const mcAmount = ethers.formatEther(event.args[1]);
            const jbcAmount = ethers.formatEther(event.args[2]);
            const rewardType = Number(event.args[3]);
            const ticketId = event.args[4].toString();

            totalHistoricalMC += parseFloat(mcAmount);
            totalHistoricalJBC += parseFloat(jbcAmount);
            rewardTypeStats[rewardType] = (rewardTypeStats[rewardType] || 0) + parseFloat(mcAmount);

            console.log(`🎁 ${REWARD_TYPES[rewardType] || `未知类型(${rewardType})`} (RewardClaimed)`);
            console.log(`   MC: ${mcAmount}, JBC: ${jbcAmount}`);
            console.log(`   票据ID: ${ticketId}`);
            console.log(`   时间: ${new Date(timestamp * 1000).toLocaleString()}`);
            console.log(`   区块: ${event.blockNumber}`);
            console.log(`   交易: ${event.transactionHash}\n`);
            
          } else if (event.fragment.name === 'ReferralRewardPaid') {
            const mcAmount = ethers.formatEther(event.args[2]);
            const rewardType = Number(event.args[3]);
            const ticketId = event.args[4].toString();
            const from = event.args[1];

            totalHistoricalMC += parseFloat(mcAmount);
            rewardTypeStats[rewardType] = (rewardTypeStats[rewardType] || 0) + parseFloat(mcAmount);

            console.log(`💰 ${REWARD_TYPES[rewardType] || `未知类型(${rewardType})`} (推荐奖励)`);
            console.log(`   MC: ${mcAmount}`);
            console.log(`   来源: ${from}`);
            console.log(`   票据ID: ${ticketId}`);
            console.log(`   时间: ${new Date(timestamp * 1000).toLocaleString()}`);
            console.log(`   区块: ${event.blockNumber}`);
            console.log(`   交易: ${event.transactionHash}\n`);
          }
        }

        // 5. 收益统计汇总
        console.log('\n📊 收益统计汇总:');
        console.log('-'.repeat(40));
        console.log(`历史总收益 MC: ${totalHistoricalMC.toFixed(4)} MC`);
        console.log(`历史总收益 JBC: ${totalHistoricalJBC.toFixed(4)} JBC`);
        console.log(`待领取静态收益: ${ethers.formatEther(totalPendingStatic)} MC`);
        
        console.log('\n按收益类型统计:');
        for (const [type, amount] of Object.entries(rewardTypeStats)) {
          console.log(`  ${REWARD_TYPES[type]}: ${amount.toFixed(4)} MC`);
        }

        // 6. 收益能力分析
        console.log('\n🎯 收益能力分析:');
        console.log('-'.repeat(40));
        
        const remainingCap = userInfo[4] - userInfo[3]; // currentCap - totalRevenue
        console.log(`剩余收益空间: ${ethers.formatEther(remainingCap)} MC`);
        
        if (totalPendingStatic > 0n) {
          const actualClaimable = totalPendingStatic > remainingCap ? remainingCap : totalPendingStatic;
          console.log(`实际可领取: ${ethers.formatEther(actualClaimable)} MC`);
          
          if (totalPendingStatic > remainingCap) {
            console.log(`⚠️  收益受限: 待领取收益超过剩余额度`);
          }
        }

        if (userInfo[5] && !userTicket[3]) { // 激活且未出局
          console.log(`✅ 账户状态良好，可正常获得收益`);
        } else if (userTicket[3]) {
          console.log(`❌ 账户已出局，无法获得新收益`);
        } else {
          console.log(`⚠️  账户未激活，需要购买门票并质押`);
        }
      }

    } catch (error) {
      console.error('查询历史记录失败:', error.message);
    }

  } catch (error) {
    console.error('查询失败:', error);
  }
}

// 执行查询
const userAddress = "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82";
queryUserEarnings(userAddress);