// 最终验证脚本 - 检查奖励显示修复
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xD437e63c2A76e0237249eC6070Bef9A2484C4302";
const RPC_URL = "https://chain.mcerscan.com/";

const ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)"
];

async function main() {
  console.log('🎯 最终验证：奖励显示修复测试\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  
  // 1. 基本信息
  console.log('📋 合约配置:');
  const secondsInUnit = await contract.SECONDS_IN_UNIT();
  const directPercent = await contract.directRewardPercent();
  const levelPercent = await contract.levelRewardPercent();
  
  console.log('时间单位:', Number(secondsInUnit), '秒');
  console.log('直推奖励:', Number(directPercent), '%');
  console.log('层级奖励:', Number(levelPercent), '%');
  
  // 2. 查询最近的奖励事件
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 20000;
  
  console.log('\n💰 奖励事件分析:');
  console.log('查询区块范围:', fromBlock, '-', currentBlock);
  
  const referralEvents = await contract.queryFilter(
    contract.filters.ReferralRewardPaid(),
    fromBlock
  );
  
  console.log('总奖励事件数:', referralEvents.length);
  
  if (referralEvents.length > 0) {
    // 按类型分组统计
    const stats = {
      direct: { count: 0, totalMC: 0, totalJBC: 0 },
      level: { count: 0, totalMC: 0, totalJBC: 0 },
      differential: { count: 0, totalMC: 0, totalJBC: 0 },
      other: { count: 0, totalMC: 0, totalJBC: 0 }
    };
    
    referralEvents.forEach(event => {
      const mcAmount = parseFloat(ethers.formatEther(event.args[2]));
      const jbcAmount = parseFloat(ethers.formatEther(event.args[3]));
      const rewardType = Number(event.args[4]);
      
      if (rewardType === 2) {
        stats.direct.count++;
        stats.direct.totalMC += mcAmount;
        stats.direct.totalJBC += jbcAmount;
      } else if (rewardType === 3) {
        stats.level.count++;
        stats.level.totalMC += mcAmount;
        stats.level.totalJBC += jbcAmount;
      } else if (rewardType === 4) {
        stats.differential.count++;
        stats.differential.totalMC += mcAmount;
        stats.differential.totalJBC += jbcAmount;
      } else {
        stats.other.count++;
        stats.other.totalMC += mcAmount;
        stats.other.totalJBC += jbcAmount;
      }
    });
    
    console.log('\n📊 奖励统计:');
    console.log('🎯 直推奖励 (类型2):');
    console.log(`   事件数: ${stats.direct.count}`);
    console.log(`   总MC: ${stats.direct.totalMC.toFixed(4)}`);
    console.log(`   总JBC: ${stats.direct.totalJBC.toFixed(4)}`);
    
    console.log('🏆 层级奖励 (类型3):');
    console.log(`   事件数: ${stats.level.count}`);
    console.log(`   总MC: ${stats.level.totalMC.toFixed(4)}`);
    console.log(`   总JBC: ${stats.level.totalJBC.toFixed(4)}`);
    
    console.log('📈 级差奖励 (类型4):');
    console.log(`   事件数: ${stats.differential.count}`);
    console.log(`   总MC: ${stats.differential.totalMC.toFixed(4)}`);
    console.log(`   总JBC: ${stats.differential.totalJBC.toFixed(4)}`);
    
    if (stats.other.count > 0) {
      console.log('❓ 其他奖励:');
      console.log(`   事件数: ${stats.other.count}`);
      console.log(`   总MC: ${stats.other.totalMC.toFixed(4)}`);
      console.log(`   总JBC: ${stats.other.totalJBC.toFixed(4)}`);
    }
    
    // 显示最新的几个事件
    console.log('\n🔍 最新奖励事件:');
    const recentEvents = referralEvents.slice(-5);
    recentEvents.forEach((event, index) => {
      const mcAmount = parseFloat(ethers.formatEther(event.args[2]));
      const jbcAmount = parseFloat(ethers.formatEther(event.args[3]));
      const rewardType = Number(event.args[4]);
      const ticketId = Number(event.args[5]);
      
      const typeNames = {
        0: '静态奖励',
        2: '直推奖励',
        3: '层级奖励', 
        4: '级差奖励'
      };
      
      console.log(`\n事件 #${index + 1}:`);
      console.log(`  类型: ${typeNames[rewardType] || '未知'} (${rewardType})`);
      console.log(`  接收者: ${event.args[0]}`);
      console.log(`  来源: ${event.args[1]}`);
      console.log(`  MC: ${mcAmount.toFixed(4)}`);
      console.log(`  JBC: ${jbcAmount.toFixed(4)}`);
      console.log(`  门票ID: ${ticketId}`);
      console.log(`  区块: ${event.blockNumber}`);
    });
    
    // 结论
    console.log('\n🎉 修复状态评估:');
    
    if (stats.direct.count > 0) {
      console.log('✅ 直推奖励: 正常工作 (' + stats.direct.count + '个事件)');
    } else {
      console.log('❌ 直推奖励: 未发现事件');
    }
    
    if (stats.level.count > 0) {
      console.log('✅ 层级奖励: 正常工作 (' + stats.level.count + '个事件)');
    } else {
      console.log('❌ 层级奖励: 未发现事件');
    }
    
    if (stats.differential.count > 0) {
      console.log('✅ 级差奖励: 正常工作 (' + stats.differential.count + '个事件)');
    } else {
      console.log('ℹ️ 级差奖励: 暂无事件 (需要质押完成后触发)');
    }
    
    console.log('\n📱 前端显示建议:');
    console.log('1. 前端ABI已更新为6参数格式');
    console.log('2. EarningsDetail.tsx应该能正确解析这些事件');
    console.log('3. 收益明细页面应该显示直推和层级奖励');
    console.log('4. 如果仍有问题，请检查前端缓存或刷新页面');
    
  } else {
    console.log('❌ 未发现任何奖励事件');
    console.log('可能原因:');
    console.log('1. 查询区块范围内没有奖励活动');
    console.log('2. 事件签名不匹配');
    console.log('3. 合约确实存在问题');
  }
}

main().catch(console.error);