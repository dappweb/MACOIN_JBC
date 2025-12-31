#!/usr/bin/env node

/**
 * 检查管理员权限状态
 * 显示当前钱包和合约所有者信息
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const P_PROD_CONFIG = {
  rpcUrl: 'https://chain.mcerscan.com/',
  protocolAddress: '0x515871E9eADbF976b546113BbD48964383f86E61'
};

const ADMIN_ABI = [
  "function owner() view returns (address)"
];

async function checkAdminPermissions() {
  console.log('🔍 检查管理员权限状态...');
  console.log('=' .repeat(60));
  
  const provider = new ethers.JsonRpcProvider(P_PROD_CONFIG.rpcUrl);
  const contract = new ethers.Contract(P_PROD_CONFIG.protocolAddress, ADMIN_ABI, provider);
  
  try {
    // 获取合约所有者
    const contractOwner = await contract.owner();
    console.log(`📋 合约所有者: ${contractOwner}`);
    
    // 检查当前私钥对应的地址
    if (process.env.PRIVATE_KEY) {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      console.log(`📋 当前钱包: ${wallet.address}`);
      
      const isOwner = contractOwner.toLowerCase() === wallet.address.toLowerCase();
      console.log(`📋 权限状态: ${isOwner ? '✅ 有管理员权限' : '❌ 无管理员权限'}`);
      
      if (!isOwner) {
        console.log('\n⚠️ 权限问题解决方案:');
        console.log('1. 使用正确的管理员私钥');
        console.log(`   需要地址: ${contractOwner}`);
        console.log(`   当前地址: ${wallet.address}`);
        console.log('');
        console.log('2. 或者请求当前合约所有者执行切换');
        console.log('3. 或者通过transferOwnership转移所有权');
      } else {
        console.log('\n✅ 权限验证通过，可以执行切换操作');
      }
    } else {
      console.log('❌ 未设置PRIVATE_KEY环境变量');
    }
    
    // 检查营销钱包是否是所有者
    const marketingWallet = process.env.MARKETING_WALLET;
    if (marketingWallet) {
      console.log(`\n📋 营销钱包: ${marketingWallet}`);
      const isMarketingOwner = contractOwner.toLowerCase() === marketingWallet.toLowerCase();
      console.log(`📋 营销钱包是否为所有者: ${isMarketingOwner ? '✅ 是' : '❌ 否'}`);
      
      if (isMarketingOwner) {
        console.log('\n💡 建议: 营销钱包就是合约所有者，可以使用营销钱包的私钥');
      }
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkAdminPermissions().catch(console.error);