#!/usr/bin/env node

/**
 * 推荐人助手脚本
 * 帮助验证推荐人地址的有效性
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const MC_CHAIN_ID = 88813;
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 协议合约ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function owner() view returns (address)"
];

class ReferrerHelper {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async validateReferrerAddress(referrerAddress) {
    console.log('🔍 验证推荐人地址有效性...');
    console.log(`🎯 推荐人地址: ${referrerAddress}`);
    console.log('=' .repeat(60));

    try {
      // 1. 检查地址格式
      if (!ethers.isAddress(referrerAddress)) {
        console.log('❌ 地址格式无效');
        return { valid: false, reason: '地址格式不正确' };
      }
      console.log('✅ 地址格式: 有效');

      // 2. 检查是否为零地址
      if (referrerAddress === ethers.ZeroAddress) {
        console.log('❌ 不能使用零地址作为推荐人');
        return { valid: false, reason: '零地址无效' };
      }
      console.log('✅ 非零地址: 通过');

      // 3. 检查推荐人是否在协议中注册
      const referrerInfo = await this.contract.userInfo(referrerAddress);
      const referrerTicket = await this.contract.userTicket(referrerAddress);
      
      const hasTicket = referrerTicket.amount > 0;
      const isActive = referrerInfo.isActive;
      
      console.log('\n📊 推荐人协议状态:');
      console.log(`  👤 是否注册: ${referrerInfo ? '是' : '否'}`);
      console.log(`  🎫 门票金额: ${ethers.formatEther(referrerTicket.amount)} MC`);
      console.log(`  ✅ 活跃状态: ${isActive ? '是' : '否'}`);
      console.log(`  💰 总收益: ${ethers.formatEther(referrerInfo.totalRevenue)} MC`);
      console.log(`  👥 直推人数: ${referrerInfo.activeDirects.toString()}`);

      // 4. 检查是否为合约拥有者
      const owner = await this.contract.owner();
      const isOwner = referrerAddress.toLowerCase() === owner.toLowerCase();
      console.log(`  👑 合约拥有者: ${isOwner ? '是' : '否'}`);

      // 5. 判断是否为有效推荐人
      const isValidReferrer = hasTicket || isOwner;
      
      if (isValidReferrer) {
        console.log('\n🎉 推荐人地址有效！');
        console.log('✅ 可以使用此地址作为推荐人');
        return { 
          valid: true, 
          isOwner,
          hasTicket,
          isActive,
          details: {
            ticketAmount: ethers.formatEther(referrerTicket.amount),
            totalRevenue: ethers.formatEther(referrerInfo.totalRevenue),
            activeDirects: referrerInfo.activeDirects.toString()
          }
        };
      } else {
        console.log('\n⚠️ 推荐人地址无效');
        console.log('❌ 此地址不能作为推荐人使用');
        console.log('💡 原因: 推荐人必须已购买门票或为合约拥有者');
        return { 
          valid: false, 
          reason: '推荐人未购买门票且非合约拥有者' 
        };
      }

    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error.message);
      return { valid: false, reason: `验证失败: ${error.message}` };
    }
  }

  async findActiveReferrers(limit = 10) {
    console.log('🔍 查找活跃推荐人...');
    console.log('⚠️ 注意: 此功能需要遍历区块链数据，可能需要较长时间');
    
    // 这里可以实现查找活跃推荐人的逻辑
    // 由于需要遍历大量数据，暂时提供示例
    console.log('💡 建议: 联系官方客服或社群获取推荐人地址');
    
    return [];
  }

  printUsageGuide() {
    console.log('📋 推荐人助手使用指南');
    console.log('=' .repeat(60));
    console.log('');
    console.log('🎯 验证推荐人地址:');
    console.log('  node scripts/referrer-helper.js validate <推荐人地址>');
    console.log('');
    console.log('🔍 查找活跃推荐人:');
    console.log('  node scripts/referrer-helper.js find');
    console.log('');
    console.log('📖 显示帮助:');
    console.log('  node scripts/referrer-helper.js help');
    console.log('');
    console.log('💡 示例:');
    console.log('  node scripts/referrer-helper.js validate 0x1234567890123456789012345678901234567890');
  }
}

// 主执行函数
async function main() {
  const helper = new ReferrerHelper();
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help') {
    helper.printUsageGuide();
    return;
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'validate':
        if (args.length < 2) {
          console.log('❌ 请提供推荐人地址');
          console.log('💡 用法: node scripts/referrer-helper.js validate <推荐人地址>');
          return;
        }
        await helper.validateReferrerAddress(args[1]);
        break;
        
      case 'find':
        await helper.findActiveReferrers();
        break;
        
      default:
        console.log(`❌ 未知命令: ${command}`);
        helper.printUsageGuide();
    }
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('referrer-helper.js')) {
  main().catch(console.error);
}

export { ReferrerHelper };