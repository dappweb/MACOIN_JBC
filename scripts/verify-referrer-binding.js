#!/usr/bin/env node

/**
 * 推荐人绑定验证脚本
 * 验证用户是否成功绑定推荐人
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const TARGET_USER = '0x7eFaD6Bef04631BE34De71b2Df9378C727f185b7';
const MC_CHAIN_ID = 88813;
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 协议合约ABI (简化版)
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function hasReferrer(address) view returns (bool)"
];

class ReferrerBindingVerifier {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async verifyBinding() {
    console.log('🔍 验证推荐人绑定状态...');
    console.log(`👤 用户地址: ${TARGET_USER}`);
    console.log('=' .repeat(60));

    try {
      // 检查网络连接
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== MC_CHAIN_ID) {
        console.log(`❌ 网络错误: 当前Chain ID ${Number(network.chainId)}, 应为 ${MC_CHAIN_ID}`);
        return false;
      }
      console.log(`✅ 网络连接: MC Chain (${MC_CHAIN_ID})`);

      // 获取用户信息
      const userInfo = await this.contract.userInfo(TARGET_USER);
      const hasReferrer = await this.contract.hasReferrer(TARGET_USER);

      // 分析推荐人状态
      const referrerAddress = userInfo.referrer;
      const isZeroAddress = referrerAddress === ethers.ZeroAddress;
      const isValidReferrer = !isZeroAddress && hasReferrer;

      console.log('\n📊 推荐人绑定状态:');
      console.log(`  🔗 推荐人地址: ${referrerAddress}`);
      console.log(`  ✅ 是否绑定: ${isValidReferrer ? '是' : '否'}`);
      console.log(`  🎫 可购票状态: ${isValidReferrer ? '✅ 可以购票' : '❌ 无法购票'}`);

      if (isValidReferrer) {
        console.log('\n🎉 恭喜！推荐人绑定成功！');
        console.log('✅ 您现在可以正常购买门票了');
        console.log('💡 建议: 前往官网尝试购买门票');
        return true;
      } else {
        console.log('\n⚠️ 推荐人尚未绑定');
        console.log('❌ 您仍然无法购买门票');
        console.log('💡 建议: 请按照指导完成推荐人绑定');
        return false;
      }

    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error.message);
      return false;
    }
  }

  async waitForBinding(maxWaitMinutes = 10) {
    console.log(`\n⏳ 等待推荐人绑定完成 (最多等待 ${maxWaitMinutes} 分钟)...`);
    
    const maxAttempts = maxWaitMinutes * 2; // 每30秒检查一次
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`\n🔄 第 ${attempts} 次检查...`);
      
      const isBinding = await this.verifyBinding();
      if (isBinding) {
        console.log('\n🎊 推荐人绑定成功！用户现在可以购票了！');
        return true;
      }

      if (attempts < maxAttempts) {
        console.log(`⏱️ 30秒后重新检查... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒
      }
    }

    console.log('\n⏰ 等待超时，推荐人仍未绑定');
    console.log('💡 建议: 请检查绑定操作是否正确完成');
    return false;
  }
}

// 主执行函数
async function main() {
  const verifier = new ReferrerBindingVerifier();
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  const shouldWait = args.includes('--wait') || args.includes('-w');
  
  try {
    if (shouldWait) {
      await verifier.waitForBinding();
    } else {
      await verifier.verifyBinding();
    }
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('verify-referrer-binding.js')) {
  main().catch(console.error);
}

export { ReferrerBindingVerifier };