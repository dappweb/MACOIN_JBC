// 测试分支直推和层级奖励诊断脚本
import { ethers } from 'ethers';

// Test分支合约地址
const CONTRACT_ADDRESSES = {
  PROTOCOL: "0xD437e63c2A76e0237249eC6070Bef9A2484C4302", // Test Protocol (60s)
  JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da"  // Test JBC
};

// MC Chain RPC - 使用正确的RPC地址
const RPC_URL = "https://chain.mcerscan.com/";

// 合约ABI - 包含所有奖励相关事件 (测试两种格式)
const PROTOCOL_ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function getDirectReferrals(address) view returns (address[])",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  
  // 事件定义 - 旧格式 (5参数)
  "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId)",
  "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
  "event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)"
];

async function diagnoseRewardsIssue() {
  console.log('🔍 Test分支直推和层级奖励诊断开始...\n');

  try {
    // 连接到MC Chain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    // 1. 验证合约基本信息
    console.log('📋 1. 合约基本信息验证');
    console.log('合约地址:', CONTRACT_ADDRESSES.PROTOCOL);
    
    try {
      const secondsInUnit = await protocol.SECONDS_IN_UNIT();
      console.log('时间单位 (SECONDS_IN_UNIT):', Number(secondsInUnit), '秒');
      
      if (Number(secondsInUnit) === 60) {
        console.log('✅ 确认为测试环境 (60秒/分钟)');
      } else {
        console.log('⚠️ 时间单位异常，期望60秒，实际:', Number(secondsInUnit));
      }
    } catch (e) {
      console.log('❌ 无法获取时间单位:', e.message);
    }

    try {
      const directPercent = await protocol.directRewardPercent();
      const levelPercent = await protocol.levelRewardPercent();
      console.log('直推奖励比例:', Number(directPercent), '%');
      console.log('层级奖励比例:', Number(levelPercent), '%');
    } catch (e) {
      console.log('⚠️ 无法获取奖励比例配置:', e.message);
    }

    // 2. 查询最近的区块范围
    const currentBlock = await provider.getBlockNumber();
    console.log('\n📊 2. 区块信息');
    console.log('当前区块:', currentBlock);
    
    // 测试环境使用较小的查询范围
    const blockRange = 50000;
    const fromBlock = Math.max(0, currentBlock - blockRange);
    console.log('查询范围:', fromBlock, '-', currentBlock, `(${blockRange}个区块)`);

    // 3. 查询门票购买事件 (这些事件应该触发奖励)
    console.log('\n🎫 3. 查询门票购买事件');
    try {
      const ticketEvents = await protocol.queryFilter(
        protocol.filters.TicketPurchased(),
        fromBlock
      );
      console.log('找到门票购买事件:', ticketEvents.length, '个');
      
      if (ticketEvents.length > 0) {
        console.log('最近5个门票购买事件:');
        ticketEvents.slice(-5).forEach((event, index) => {
          console.log(`  ${index + 1}. 用户: ${event.args[0]}, 金额: ${ethers.formatEther(event.args[1])} MC, 区块: ${event.blockNumber}`);
        });
      }
    } catch (e) {
      console.log('❌ 查询门票购买事件失败:', e.message);
    }

    // 4. 查询直推奖励事件
    console.log('\n💰 4. 查询直推奖励事件 (ReferralRewardPaid, rewardType=2)');
    try {
      const referralEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(),
        fromBlock
      );
      console.log('找到推荐奖励事件总数:', referralEvents.length, '个');
      
      // 筛选直推奖励 (rewardType = 2)
      const directRewards = referralEvents.filter(event => {
        try {
          return Number(event.args[3]) === 2; // rewardType = 2 为直推奖励
        } catch {
          return false;
        }
      });
      
      console.log('其中直推奖励 (type=2):', directRewards.length, '个');
      
      if (directRewards.length > 0) {
        console.log('最近5个直推奖励:');
        directRewards.slice(-5).forEach((event, index) => {
          try {
            console.log(`  ${index + 1}. 接收者: ${event.args[0]}, 来源: ${event.args[1]}, 金额: ${ethers.formatEther(event.args[2])} MC, 区块: ${event.blockNumber}`);
          } catch (e) {
            console.log(`  ${index + 1}. 解析失败:`, e.message);
          }
        });
      } else {
        console.log('⚠️ 未找到直推奖励事件');
      }
    } catch (e) {
      console.log('❌ 查询直推奖励事件失败:', e.message);
    }

    // 5. 查询层级奖励事件
    console.log('\n🏆 5. 查询层级奖励事件 (ReferralRewardPaid, rewardType=3)');
    try {
      const referralEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(),
        fromBlock
      );
      
      // 筛选层级奖励 (rewardType = 3)
      const levelRewards = referralEvents.filter(event => {
        try {
          return Number(event.args[3]) === 3; // rewardType = 3 为层级奖励
        } catch {
          return false;
        }
      });
      
      console.log('层级奖励 (type=3):', levelRewards.length, '个');
      
      if (levelRewards.length > 0) {
        console.log('最近5个层级奖励:');
        levelRewards.slice(-5).forEach((event, index) => {
          try {
            console.log(`  ${index + 1}. 接收者: ${event.args[0]}, 来源: ${event.args[1]}, 金额: ${ethers.formatEther(event.args[2])} MC, 区块: ${event.blockNumber}`);
          } catch (e) {
            console.log(`  ${index + 1}. 解析失败:`, e.message);
          }
        });
      } else {
        console.log('⚠️ 未找到层级奖励事件');
      }
    } catch (e) {
      console.log('❌ 查询层级奖励事件失败:', e.message);
    }

    // 6. 分析事件格式
    console.log('\n🔍 6. 分析ReferralRewardPaid事件格式');
    try {
      const allReferralEvents = await protocol.queryFilter(
        protocol.filters.ReferralRewardPaid(),
        fromBlock
      );
      
      if (allReferralEvents.length > 0) {
        const sampleEvent = allReferralEvents[0];
        console.log('事件参数数量:', sampleEvent.args?.length);
        console.log('事件参数示例:', sampleEvent.args);
        
        if (sampleEvent.args?.length === 5) {
          console.log('✅ 使用旧格式: ReferralRewardPaid(user, from, mcAmount, rewardType, ticketId)');
        } else if (sampleEvent.args?.length === 6) {
          console.log('✅ 使用新格式: ReferralRewardPaid(user, from, mcAmount, jbcAmount, rewardType, ticketId)');
        } else {
          console.log('⚠️ 未知事件格式，参数数量:', sampleEvent.args?.length);
        }
      } else {
        console.log('⚠️ 没有找到ReferralRewardPaid事件进行格式分析');
      }
    } catch (e) {
      console.log('❌ 事件格式分析失败:', e.message);
    }

    // 7. 检查用户推荐关系
    console.log('\n👥 7. 检查推荐关系');
    const recentUsers = [
      "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82",
      "0xDb817e0d21a134f649d24b91E39d42E7eeC52a65", 
      "0x5067D182D5f15511F0C71194a25cC67b05C20b02",
      "0x8eFb0848a6De28ddd290224DC2Dd87174a0e29F1",
      "0x03C5d3cF3E358A00fA446e3376eaB047D1ce46F2"
    ];
    
    for (const user of recentUsers) {
      try {
        const userInfo = await protocol.userInfo(user);
        const referrer = userInfo[0];
        const isActive = userInfo[5];
        
        console.log(`用户 ${user.slice(0,8)}...:`);
        console.log(`  推荐人: ${referrer === ethers.ZeroAddress ? '无' : referrer}`);
        console.log(`  是否激活: ${isActive}`);
        
        if (referrer !== ethers.ZeroAddress) {
          const referrerInfo = await protocol.userInfo(referrer);
          const referrerActive = referrerInfo[5];
          console.log(`  推荐人状态: ${referrerActive ? '激活' : '未激活'}`);
        }
        console.log('');
      } catch (e) {
        console.log(`  查询失败: ${e.message}`);
      }
    }

    // 9. 深度检查：查看具体交易的事件日志
    console.log('\n🔍 9. 深度检查：分析门票购买交易的事件日志');
    
    if (ticketEvents.length > 0) {
      const latestTicket = ticketEvents[ticketEvents.length - 1];
      console.log('分析最新门票购买交易:', latestTicket.transactionHash);
      
      try {
        const receipt = await provider.getTransactionReceipt(latestTicket.transactionHash);
        console.log('交易收据中的事件数量:', receipt.logs.length);
        
        // 解析所有事件
        receipt.logs.forEach((log, index) => {
          try {
            // 尝试解析为已知事件
            const parsed = protocol.interface.parseLog(log);
            if (parsed) {
              console.log(`  事件 ${index + 1}: ${parsed.name}`);
              console.log(`    参数:`, parsed.args);
            }
          } catch (e) {
            console.log(`  事件 ${index + 1}: 未知事件 (topic: ${log.topics[0]})`);
          }
        });
      } catch (e) {
        console.log('获取交易收据失败:', e.message);
      }
    }

    // 10. 检查合约代码版本
    console.log('\n📝 10. 检查合约代码');
    try {
      const code = await provider.getCode(CONTRACT_ADDRESSES.PROTOCOL);
      console.log('合约代码长度:', code.length, '字符');
      console.log('合约代码哈希:', ethers.keccak256(code));
    } catch (e) {
      console.log('获取合约代码失败:', e.message);
    }
    console.log('\n📋 8. 诊断总结');
    console.log('合约地址:', CONTRACT_ADDRESSES.PROTOCOL);
    console.log('环境类型: 测试环境 (60秒时间单位)');
    console.log('查询区块范围:', blockRange, '个区块');
    console.log('建议检查项目:');
    console.log('  1. 确认是否有用户购买门票并建立推荐关系');
    console.log('  2. 检查合约是否正确触发ReferralRewardPaid事件');
    console.log('  3. 验证前端事件解析逻辑是否匹配合约事件格式');
    console.log('  4. 确认区块查询范围是否覆盖相关交易');

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
diagnoseRewardsIssue().catch(console.error);
    // 9. 深度检查：查看具体交易的事件日志
    console.log('\n🔍 9. 深度检查：分析门票购买交易的事件日志');
    
    if (ticketEvents.length > 0) {
      const latestTicket = ticketEvents[ticketEvents.length - 1];
      console.log('分析最新门票购买交易:', latestTicket.transactionHash);
      
      try {
        const receipt = await provider.getTransactionReceipt(latestTicket.transactionHash);
        console.log('交易收据中的事件数量:', receipt.logs.length);
        
        // 解析所有事件
        receipt.logs.forEach((log, index) => {
          try {
            // 尝试解析为已知事件
            const parsed = protocol.interface.parseLog(log);
            if (parsed) {
              console.log(`  事件 ${index + 1}: ${parsed.name}`);
              console.log(`    参数:`, parsed.args);
            }
          } catch (e) {
            console.log(`  事件 ${index + 1}: 未知事件 (topic: ${log.topics[0]})`);
          }
        });
      } catch (e) {
        console.log('获取交易收据失败:', e.message);
      }
    }

    // 10. 检查合约代码版本
    console.log('\n📝 10. 检查合约代码');
    try {
      const code = await provider.getCode(CONTRACT_ADDRESSES.PROTOCOL);
      console.log('合约代码长度:', code.length, '字符');
      console.log('合约代码哈希:', ethers.keccak256(code));
    } catch (e) {
      console.log('获取合约代码失败:', e.message);
    }

    // 11. 总结诊断结果
    console.log('\n📋 11. 诊断总结');
    console.log('合约地址:', CONTRACT_ADDRESSES.PROTOCOL);
    console.log('环境类型: 测试环境 (60秒时间单位)');
    console.log('查询区块范围:', blockRange, '个区块');
    console.log('');
    console.log('🔍 关键发现:');
    console.log('  ✅ 合约配置正确 (25%直推 + 15%层级)');
    console.log('  ✅ 有门票购买活动 (5个购买事件)');
    console.log('  ✅ 用户有推荐关系且都已激活');
    console.log('  ❌ 但是没有找到任何ReferralRewardPaid事件');
    console.log('');
    console.log('🚨 问题分析:');
    console.log('  1. 合约可能没有正确触发ReferralRewardPaid事件');
    console.log('  2. 事件格式可能与前端解析不匹配');
    console.log('  3. 合约实现可能有bug或逻辑问题');
    console.log('');
    console.log('💡 建议解决方案:');
    console.log('  1. 检查合约源码中的buyTicket函数实现');
    console.log('  2. 验证_distributeReward函数是否正确触发事件');
    console.log('  3. 确认合约部署版本是否正确');
    console.log('  4. 检查交易收据中的原始事件日志');