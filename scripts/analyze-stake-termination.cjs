#!/usr/bin/env node
/**
 * 质押终止原因分析
 * 分析为什么账户1和账户2的质押被终止
 */

const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)"
];

const ACCOUNTS = [
  {
    address: "0xC65f043aD84561e262C3aE54230F74B1071BEFE3",
    name: "账户1"
  },
  {
    address: "0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f",
    name: "账户2"
  }
];

async function analyzeStakeTermination(contract, account) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 分析 ${account.name}: ${account.address}`);
  console.log("=".repeat(80));

  // 获取用户信息
  const userInfo = await contract.userInfo(account.address);
  const ticket = await contract.userTicket(account.address);

  console.log(`\n📊 基本数据:`);
  console.log(`  总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
  console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
  console.log(`  收益率: ${(Number(ethers.formatEther(userInfo.totalRevenue)) / Number(ethers.formatEther(userInfo.currentCap)) * 100).toFixed(2)}%`);
  console.log(`  门票金额: ${ethers.formatEther(ticket.amount)} MC`);
  console.log(`  门票已退出: ${ticket.exited}`);

  // 获取质押信息
  const stakes = [];
  let index = 0;
  
  while (index < 50) {
    try {
      const stake = await contract.userStakes(account.address, index);
      if (stake.amount > 0n) {
        stakes.push({
          index,
          id: stake.id,
          amount: stake.amount,
          startTime: stake.startTime,
          cycleDays: stake.cycleDays,
          active: stake.active,
          paid: stake.paid
        });
      }
      index++;
    } catch (e) {
      break;
    }
  }

  console.log(`\n💰 质押分析:`);
  stakes.forEach((stake) => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(stake.startTime) + Number(stake.cycleDays) * 86400;
    const isMatured = now >= endTime;
    
    console.log(`\n  质押 #${stake.index} (ID: ${stake.id}):`);
    console.log(`    金额: ${ethers.formatEther(stake.amount)} MC`);
    console.log(`    开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString('zh-CN')}`);
    console.log(`    周期: ${stake.cycleDays} 天`);
    console.log(`    到期时间: ${new Date(endTime * 1000).toLocaleString('zh-CN')}`);
    console.log(`    是否到期: ${isMatured ? "✅ 是" : "❌ 否"}`);
    console.log(`    状态: ${stake.active ? "✅ 活跃" : "❌ 已终止"}`);
    console.log(`    已支付: ${ethers.formatEther(stake.paid)} MC`);

    // 分析终止原因
    if (!stake.active) {
      console.log(`\n    🔍 终止原因分析:`);
      
      // 原因1：已经赎回
      if (isMatured) {
        console.log(`      ✅ 质押已到期`);
        if (Number(ethers.formatEther(stake.paid)) > 0) {
          console.log(`      ✅ 已支付了 ${ethers.formatEther(stake.paid)} MC`);
        }
        console.log(`      💡 可能原因: 用户已经赎回质押`);
      }
      
      // 原因2：达到3倍上限导致门票退出
      if (ticket.exited) {
        console.log(`      ⚠️ 门票已退出（达到3倍收益上限）`);
        console.log(`      💡 可能原因: 达到收益上限，系统自动终止所有质押`);
      }
      
      // 原因3：收益接近上限
      const revenueRatio = Number(ethers.formatEther(userInfo.totalRevenue)) / Number(ethers.formatEther(userInfo.currentCap));
      if (revenueRatio >= 0.99) {
        console.log(`      ⚠️ 总收益已达当前上限的 ${(revenueRatio * 100).toFixed(2)}%`);
        console.log(`      💡 可能原因: 接近或达到3倍上限`);
      }
      
      // 原因4：自动赎回
      if (isMatured && !ticket.exited && revenueRatio < 0.99) {
        console.log(`      ✅ 质押已自然到期`);
        console.log(`      ✅ 门票未退出`);
        console.log(`      ✅ 未达收益上限`);
        console.log(`      💡 最可能原因: 用户或系统已执行赎回操作`);
      }
    }
  });

  // 操作能力评估
  console.log(`\n🔧 当前操作能力:`);
  
  const hasActiveStakes = stakes.some(s => s.active);
  const canStakeMore = !ticket.exited && ticket.amount > 0n;
  
  console.log(`  提供新流动性: ${canStakeMore ? "✅ 可以" : "❌ 不可以"}`);
  if (!canStakeMore) {
    if (ticket.exited) {
      console.log(`    原因: 门票已退出（达到3倍收益上限）`);
      console.log(`    解决方案: 需要购买新门票才能继续质押`);
    } else if (ticket.amount === 0n) {
      console.log(`    原因: 没有门票`);
      console.log(`    解决方案: 需要先购买门票`);
    }
  }
  
  console.log(`  赎回质押: ${hasActiveStakes ? "⏳ 等待到期" : "❌ 没有活跃质押"}`);
  if (!hasActiveStakes && stakes.length > 0) {
    console.log(`    说明: 曾经有质押，但现在都已终止`);
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 质押终止原因深度分析");
  console.log("=".repeat(80));
  console.log(`⏰ 分析时间: ${new Date().toLocaleString('zh-CN')}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  for (const account of ACCOUNTS) {
    await analyzeStakeTermination(contract, account);
  }

  // 总结
  console.log(`\n${"=".repeat(80)}`);
  console.log("📋 总结");
  console.log("=".repeat(80));
  console.log(`
🔍 核心发现:

1. **账户1**: 
   - 有1笔已终止的质押（1500 MC，已支付900 MC）
   - 质押已到期（2026年2月10日）
   - 门票未退出，理论上可以继续质押
   - 很可能已经赎回了这笔质押

2. **账户2**: 
   - 有1笔已终止的质押（150 MC，已支付90 MC）
   - 有1笔活跃的质押（150 MC，今天刚质押的）
   - 门票未退出，可以继续质押
   - 第一笔质押很可能已经赎回

💡 用户反馈"无法赎回或提供流动性"的可能原因:

A. **无法赎回**:
   - 账户1: 没有活跃质押可赎回（已经赎回过了）
   - 账户2: 有活跃质押但还未到期（还需30天）

B. **无法提供流动性**:
   可能的问题:
   1. ❌ 钱包没有足够的 MC/JBC 代币余额
   2. ❌ 没有授权合约使用代币
   3. ❌ 浏览器/前端错误
   4. ❌ Gas 费不足
   5. ❌ 网络连接问题

📝 建议操作:

1. 确认用户钱包中的 MC 和 JBC 代币余额
2. 确认是否已授权合约使用代币
3. 检查浏览器控制台的错误信息
4. 如果想继续质押，需要:
   - 准备 MC + JBC 代币（1:1比例）
   - 授权合约使用代币
   - 通过前端进行质押操作
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
