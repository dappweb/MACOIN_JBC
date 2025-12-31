#!/usr/bin/env node

/**
 * 检查特定用户的质押记录来验证质押周期
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PROTOCOL_ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)"
];

async function checkUserStakes() {
  console.log('🔍 检查特定用户质押记录...');
  
  const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
  
  // 检查两个环境
  const environments = {
    'Test': '0xD437e63c2A76e0237249eC6070Bef9A2484C4302',
    'P-prod': '0x515871E9eADbF976b546113BbD48964383f86E61'
  };
  
  // 已知用户地址
  const users = [
    '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82',
    '0x7eFaD6Bef04631BE34De71b2Df9378C727f185b7'
  ];
  
  for (const [envName, contractAddress] of Object.entries(environments)) {
    console.log(`\n📊 ${envName} 环境 (${contractAddress}):`);
    
    const contract = new ethers.Contract(contractAddress, PROTOCOL_ABI, provider);
    
    try {
      const secondsInUnit = await contract.SECONDS_IN_UNIT();
      console.log(`  SECONDS_IN_UNIT: ${secondsInUnit} 秒`);
      
      for (const userAddress of users) {
        console.log(`\n  用户 ${userAddress.slice(0, 8)}...:`);
        
        try {
          // 检查用户信息
          const userInfo = await contract.userInfo(userAddress);
          console.log(`    推荐人: ${userInfo[0] === ethers.ZeroAddress ? '未绑定' : '已绑定'}`);
          console.log(`    活跃状态: ${userInfo[5] ? '活跃' : '非活跃'}`);
          
          // 检查质押记录 (尝试前10个ID)
          let foundStakes = 0;
          for (let i = 0; i < 10; i++) {
            try {
              const stake = await contract.userStakes(userAddress, i);
              if (stake.id > 0) {
                foundStakes++;
                const startTime = Number(stake.startTime);
                const cycleDays = Number(stake.cycleDays);
                const theoreticalDuration = cycleDays * Number(secondsInUnit);
                const now = Math.floor(Date.now() / 1000);
                const elapsed = now - startTime;
                
                console.log(`    质押 ${i}: ID=${stake.id}, 金额=${ethers.formatEther(stake.amount)} MC`);
                console.log(`      周期: ${cycleDays} 天`);
                console.log(`      开始时间: ${new Date(startTime * 1000).toLocaleString()}`);
                console.log(`      理论持续: ${theoreticalDuration} 秒 (${(theoreticalDuration/3600).toFixed(1)} 小时, ${(theoreticalDuration/86400).toFixed(2)} 天)`);
                console.log(`      实际经过: ${elapsed} 秒 (${(elapsed/3600).toFixed(1)} 小时, ${(elapsed/86400).toFixed(2)} 天)`);
                console.log(`      状态: ${stake.active ? '活跃' : '已结束'}`);
                
                // 关键判断
                if (elapsed > 86400 && stake.active && cycleDays === 7) {
                  console.log(`      🔍 关键发现: 7天质押已运行超过1天且仍活跃!`);
                }
              }
            } catch (e) {
              // 跳过无效的质押ID
            }
          }
          
          if (foundStakes === 0) {
            console.log(`    无质押记录`);
          } else {
            console.log(`    找到 ${foundStakes} 个质押记录`);
          }
          
        } catch (error) {
          console.log(`    查询失败: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`  环境查询失败: ${error.message}`);
    }
  }
  
  console.log('\n🎯 分析结论:');
  console.log('  如果P-prod环境中有7天质押记录运行超过7分钟且仍活跃，');
  console.log('  则说明实际质押周期确实是天级别，而非分钟级别。');
  console.log('  这表明可能存在合约外的时间转换机制。');
}

checkUserStakes().catch(console.error);