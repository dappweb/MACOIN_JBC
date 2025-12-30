// 测试升级后的合约功能
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xD437e63c2A76e0237249eC6070Bef9A2484C4302"; // 升级后应该是同一个地址
const RPC_URL = "https://chain.mcerscan.com/";

const ABI = [
  "function getVersion() view returns (string)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardDistributionDebug(address indexed user, uint256 amount, uint8 rewardType, bool success, string reason)"
];

async function main() {
  console.log('🧪 测试升级后的合约功能\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  
  try {
    // 1. 检查版本
    console.log('📦 检查合约版本:');
    try {
      const version = await contract.getVersion();
      console.log('✅ 合约版本:', version);
      
      if (version === "2.0.0") {
        console.log('🎉 升级成功! 当前运行V2版本');
      } else {
        console.log('⚠️ 版本不匹配，可能升级未完成');
      }
    } catch (e) {
      console.log('❌ 无法获取版本信息，可能仍是旧版本:', e.message);
    }
    
    // 2. 基本配置检查
    console.log('\n⚙️ 合约配置:');
    const secondsInUnit = await contract.SECONDS_IN_UNIT();
    const directPercent = await contract.directRewardPercent();
    const levelPercent = await contract.levelRewardPercent();
    
    console.log('时间单位:', Number(secondsInUnit), '秒');
    console.log('直推奖励:', Number(directPercent), '%');
    console.log('层级奖励:', Number(levelPercent), '%');
    
    // 3. 查询最近的交易事件
    console.log('\n🔍 查询最近的奖励事件:');
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // 查询最近10K区块
    
    // 查询ReferralRewardPaid事件
    const referralEvents = await contract.queryFilter(
      contract.filters.ReferralRewardPaid(),
      fromBlock
    );
    
    console.log('ReferralRewardPaid事件数量:', referralEvents.length);
    
    if (referralEvents.length > 0) {
      console.log('✅ 发现奖励事件，升级可能已生效');
      
      // 显示最新的几个事件
      const recentEvents = referralEvents.slice(-3);
      recentEvents.forEach((event, index) => {
        console.log(`\n事件 #${index + 1}:`);
        console.log('  接收者:', event.args[0]);
        console.log('  来源:', event.args[1]);
        console.log('  MC金额:', ethers.formatEther(event.args[2]));
        
        // 检查是否是新格式(6参数)
        if (event.args.length >= 6) {
          console.log('  JBC金额:', ethers.formatEther(event.args[3]));
          console.log('  奖励类型:', Number(event.args[4]));
          console.log('  门票ID:', Number(event.args[5]));
          console.log('  ✅ 使用新的6参数格式');
        } else {
          console.log('  奖励类型:', Number(event.args[3]));
          console.log('  门票ID:', Number(event.args[4]));
          console.log('  ⚠️ 使用旧的5参数格式');
        }
        
        console.log('  区块:', event.blockNumber);
      });
    } else {
      console.log('⚠️ 未发现奖励事件');
    }
    
    // 4. 查询调试事件(仅V2版本有)
    try {
      console.log('\n🐛 查询调试事件:');
      const debugEvents = await contract.queryFilter(
        contract.filters.RewardDistributionDebug(),
        fromBlock
      );
      
      console.log('调试事件数量:', debugEvents.length);
      
      if (debugEvents.length > 0) {
        console.log('✅ 发现调试事件，确认是V2版本');
        
        // 显示最新的调试事件
        const recentDebug = debugEvents.slice(-5);
        recentDebug.forEach((event, index) => {
          console.log(`\n调试事件 #${index + 1}:`);
          console.log('  用户:', event.args[0]);
          console.log('  金额:', ethers.formatEther(event.args[1]));
          console.log('  类型:', Number(event.args[2]));
          console.log('  成功:', event.args[3]);
          console.log('  原因:', event.args[4]);
        });
      }
    } catch (e) {
      console.log('❌ 无法查询调试事件，可能仍是旧版本');
    }
    
    // 5. 测试建议
    console.log('\n📋 测试建议:');
    console.log('1. 让一个有推荐人的用户购买门票');
    console.log('2. 检查是否触发ReferralRewardPaid事件');
    console.log('3. 在前端收益明细页面查看是否显示直推和层级奖励');
    console.log('4. 监控RewardDistributionDebug事件了解分发状态');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

main().catch(console.error);