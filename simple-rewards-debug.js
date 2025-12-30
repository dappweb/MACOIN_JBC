// 简化的奖励诊断脚本
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xD437e63c2A76e0237249eC6070Bef9A2484C4302";
const RPC_URL = "https://chain.mcerscan.com/";

const ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)"
];

async function main() {
  console.log('🔍 Test分支奖励问题诊断\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  
  // 1. 基本信息
  console.log('📋 合约信息:');
  console.log('地址:', CONTRACT_ADDRESS);
  
  const secondsInUnit = await contract.SECONDS_IN_UNIT();
  console.log('时间单位:', Number(secondsInUnit), '秒');
  
  const directPercent = await contract.directRewardPercent();
  const levelPercent = await contract.levelRewardPercent();
  console.log('直推奖励:', Number(directPercent), '%');
  console.log('层级奖励:', Number(levelPercent), '%');
  
  // 2. 查询最近交易
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 50000;
  
  console.log('\n🎫 门票购买事件:');
  const ticketEvents = await contract.queryFilter(
    contract.filters.TicketPurchased(),
    fromBlock
  );
  console.log('数量:', ticketEvents.length);
  
  if (ticketEvents.length > 0) {
    const latest = ticketEvents[ticketEvents.length - 1];
    console.log('最新购买:', latest.args[0], ethers.formatEther(latest.args[1]), 'MC');
    
    // 3. 分析最新交易的事件日志
    console.log('\n🔍 分析最新门票购买交易:');
    console.log('交易哈希:', latest.transactionHash);
    
    const receipt = await provider.getTransactionReceipt(latest.transactionHash);
    console.log('事件总数:', receipt.logs.length);
    
    // 查找ReferralRewardPaid事件
    let foundReferralReward = false;
    receipt.logs.forEach((log, index) => {
      // ReferralRewardPaid事件的topic0 - 支持新的6参数格式
      const referralRewardTopic = ethers.id("ReferralRewardPaid(address,address,uint256,uint256,uint8,uint256)");
      
      if (log.topics[0] === referralRewardTopic) {
        foundReferralReward = true;
        console.log(`  找到ReferralRewardPaid事件 #${index + 1}`);
        
        try {
          const decoded = contract.interface.parseLog(log);
          console.log('    接收者:', decoded.args[0]);
          console.log('    来源:', decoded.args[1]);
          console.log('    MC金额:', ethers.formatEther(decoded.args[2]), 'MC');
          console.log('    JBC金额:', ethers.formatEther(decoded.args[3]), 'JBC');
          console.log('    类型:', Number(decoded.args[4]));
          console.log('    门票ID:', Number(decoded.args[5]));
        } catch (e) {
          console.log('    解析失败:', e.message);
        }
      }
    });
    
    if (!foundReferralReward) {
      console.log('  ❌ 未找到ReferralRewardPaid事件');
      
      // 检查用户推荐关系
      const buyer = latest.args[0];
      const userInfo = await contract.userInfo(buyer);
      const referrer = userInfo[0];
      
      console.log('\n👥 推荐关系检查:');
      console.log('购买者:', buyer);
      console.log('推荐人:', referrer === ethers.ZeroAddress ? '无' : referrer);
      
      if (referrer !== ethers.ZeroAddress) {
        const referrerInfo = await contract.userInfo(referrer);
        console.log('推荐人激活状态:', referrerInfo[5]);
        console.log('');
        console.log('🚨 问题: 有推荐关系但没有奖励事件！');
        console.log('可能原因:');
        console.log('  1. 合约buyTicket函数没有正确调用_distributeReward');
        console.log('  2. _distributeReward函数没有触发ReferralRewardPaid事件');
        console.log('  3. 合约实现版本问题');
      } else {
        console.log('');
        console.log('ℹ️ 该用户没有推荐人，所以没有奖励事件是正常的');
      }
    }
  }
  
  // 4. 查询所有ReferralRewardPaid事件
  console.log('\n💰 ReferralRewardPaid事件统计:');
  const referralEvents = await contract.queryFilter(
    contract.filters.ReferralRewardPaid(),
    fromBlock
  );
  console.log('总数:', referralEvents.length);
  
  if (referralEvents.length === 0) {
    console.log('\n🚨 关键问题: 在过去50,000个区块中没有找到任何ReferralRewardPaid事件！');
    console.log('这表明:');
    console.log('  1. 合约可能没有正确实现奖励分发逻辑');
    console.log('  2. 或者事件定义与实际触发不匹配');
    console.log('  3. 需要检查合约源码实现');
  }
}

main().catch(console.error);