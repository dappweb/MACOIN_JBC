#!/usr/bin/env node

/**
 * 检查用户推荐人绑定状态
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_USER = '0x5067d182d5f15511f0c71194a25cc67b05c20b02';
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0xD437e63c2A76e0237249eC6070Bef9A2484C4302';

const PROTOCOL_ABI = [
  "function hasReferrer(address) view returns (bool)",
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function owner() view returns (address)"
];

async function checkReferrer() {
  console.log('🔍 检查用户推荐人绑定状态...');
  console.log(`👤 用户: ${TARGET_USER}`);
  console.log('=' .repeat(60));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  try {
    // 方法1: 使用 hasReferrer 函数
    console.log('\n📋 方法1: hasReferrer 函数检查');
    try {
      const hasReferrer = await contract.hasReferrer(TARGET_USER);
      console.log(`  结果: ${hasReferrer ? '✅ 已绑定推荐人' : '❌ 未绑定推荐人'}`);
    } catch (error) {
      console.log(`  ❌ 检查失败: ${error.message}`);
    }

    // 方法2: 尝试获取用户信息
    console.log('\n📋 方法2: userInfo 函数检查');
    try {
      const userInfo = await contract.userInfo(TARGET_USER);
      const referrerAddress = userInfo.referrer;
      const hasReferrer = referrerAddress !== ethers.ZeroAddress;
      
      console.log(`  推荐人地址: ${referrerAddress}`);
      console.log(`  绑定状态: ${hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
      
      if (hasReferrer) {
        // 检查推荐人是否是合约拥有者
        const owner = await contract.owner();
        const isOwnerReferrer = referrerAddress.toLowerCase() === owner.toLowerCase();
        console.log(`  是否为合约拥有者: ${isOwnerReferrer ? '✅ 是' : '❌ 否'}`);
        
        // 检查推荐人余额
        const referrerBalance = await provider.getBalance(referrerAddress);
        console.log(`  推荐人余额: ${parseFloat(ethers.formatEther(referrerBalance))} MC`);
      }
      
    } catch (error) {
      console.log(`  ❌ 检查失败: ${error.message}`);
    }

    // 方法3: 检查合约拥有者信息
    console.log('\n📋 方法3: 合约拥有者信息');
    try {
      const owner = await contract.owner();
      console.log(`  合约拥有者: ${owner}`);
      
      const ownerBalance = await provider.getBalance(owner);
      console.log(`  拥有者余额: ${parseFloat(ethers.formatEther(ownerBalance))} MC`);
      
    } catch (error) {
      console.log(`  ❌ 检查失败: ${error.message}`);
    }

    // 建议
    console.log('\n💡 建议:');
    console.log('  1. 如果用户未绑定推荐人，需要先绑定推荐人');
    console.log('  2. 推荐绑定合约拥有者作为推荐人');
    console.log('  3. 绑定推荐人后再尝试购票');

  } catch (error) {
    console.error('❌ 检查过程失败:', error.message);
  }
}

checkReferrer().catch(console.error);