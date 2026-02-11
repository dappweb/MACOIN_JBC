#!/usr/bin/env node
/**
 * 用户问题诊断脚本
 * 用于排查无法赎回或无法提供流动性的问题
 * 
 * 使用方法:
 *   node scripts/diagnose-user-issue.cjs <用户地址>
 * 
 * 示例:
 *   node scripts/diagnose-user-issue.cjs 0x1234567890abcdef...
 */

const { ethers } = require('ethers');
require('dotenv').config();

// 配置
const RPC_URL = process.env.RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

// 合约 ABI（精简版）
const PROTOCOL_ABI = [
  // 读函数
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 amount, uint256 purchaseTime, bool exited, uint256 ticketId, uint256[] stakeIds)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function stakeOwner(uint256) view returns (address)",
  "function stakeRedemptionFeePaid(uint256) view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function redemptionFeePercent() view returns (uint256)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function ticketExpiryCutoffDate() view returns (uint256)",
  "function lastStakeDeadlineBase(address) view returns (uint256)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function directReferrals(address) view returns (address[])",
  
  // 事件
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

// 72小时有效期生效日期
const TICKET_EXPIRY_CUTOFF_DATE = 1770595200; // 2026-02-09 00:00:00 UTC

async function diagnoseUser(userAddress) {
  console.log(`\n🔍 诊断用户: ${userAddress}\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  
  const now = Math.floor(Date.now() / 1000);
  let issues = [];
  let warnings = [];
  
  try {
    // 1. 检查合约状态
    console.log("📋 检查合约状态...");
    const [paused, liquidityEnabled, redeemEnabled] = await Promise.all([
      contract.emergencyPaused(),
      contract.liquidityEnabled(),
      contract.redeemEnabled()
    ]);
    
    if (paused) {
      issues.push("❌ 合约已紧急暂停，所有操作不可用");
    } else {
      console.log("  ✅ 合约未暂停");
    }
    
    if (!liquidityEnabled) {
      issues.push("❌ 质押功能已禁用");
    } else {
      console.log("  ✅ 质押功能已启用");
    }
    
    if (!redeemEnabled) {
      issues.push("❌ 赎回功能已禁用");
    } else {
      console.log("  ✅ 赎回功能已启用");
    }
    
    // 2. 检查用户信息
    console.log("\n📋 检查用户信息...");
    const userInfo = await contract.userInfo(userAddress);
    console.log(`  推荐人: ${userInfo.referrer === '0x0000000000000000000000000000000000000000' ? '未绑定' : userInfo.referrer}`);
    console.log(`  是否激活: ${userInfo.isActive}`);
    console.log(`  累计收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    console.log(`  最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
    
    if (userInfo.referrer === '0x0000000000000000000000000000000000000000') {
      issues.push("❌ 用户未绑定推荐人，无法购买门票");
    }
    
    // 3. 检查门票状态
    console.log("\n📋 检查门票状态...");
    const ticket = await contract.userTicket(userAddress);
    const hasTicket = ticket.amount > 0n && !ticket.exited;
    
    if (ticket.amount > 0n) {
      console.log(`  门票金额: ${ethers.formatEther(ticket.amount)} MC`);
      console.log(`  购买时间: ${new Date(Number(ticket.purchaseTime) * 1000).toLocaleString()}`);
      console.log(`  是否退出: ${ticket.exited}`);
      console.log(`  门票ID: ${ticket.ticketId}`);
      
      if (ticket.exited) {
        issues.push("❌ 门票已退出（达到3倍收益上限）");
      } else {
        // 检查72小时过期
        if (Number(ticket.purchaseTime) >= TICKET_EXPIRY_CUTOFF_DATE) {
          const lastStakeDeadlineBase = await contract.lastStakeDeadlineBase(userAddress);
          const deadlineBase = lastStakeDeadlineBase > 0n ? Number(lastStakeDeadlineBase) : Number(ticket.purchaseTime);
          const ticketFlexibilityDuration = Number(await contract.ticketFlexibilityDuration());
          const deadline = deadlineBase + ticketFlexibilityDuration;
          
          console.log(`  过期截止时间: ${new Date(deadline * 1000).toLocaleString()}`);
          
          if (now > deadline) {
            issues.push("❌ 门票已过期（72小时未质押）");
          } else {
            const remaining = deadline - now;
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            warnings.push(`⚠️ 门票将在 ${hours}小时${minutes}分钟后过期`);
          }
        } else {
          console.log("  该门票不受72小时规则限制（2026年2月9日前购买）");
        }
      }
    } else {
      issues.push("❌ 用户没有有效门票");
    }
    
    // 4. 检查质押列表
    console.log("\n📋 检查质押列表...");
    const secondsInUnit = Number(await contract.SECONDS_IN_UNIT());
    const stakes = [];
    let index = 0;
    
    while (index < 50) {
      try {
        const stake = await contract.userStakes(userAddress, index);
        if (stake.active) {
          stakes.push(stake);
        }
        index++;
      } catch (e) {
        break;
      }
    }
    
    console.log(`  活跃质押数量: ${stakes.length}`);
    
    if (stakes.length > 0) {
      let maturedCount = 0;
      
      for (const stake of stakes) {
        const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * secondsInUnit);
        const isMatured = now >= endTime;
        
        console.log(`\n  质押 #${stake.id}:`);
        console.log(`    金额: ${ethers.formatEther(stake.amount)} MC`);
        console.log(`    周期: ${stake.cycleDays} 天`);
        console.log(`    开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
        console.log(`    结束时间: ${new Date(endTime * 1000).toLocaleString()}`);
        console.log(`    状态: ${isMatured ? '✅ 可赎回' : '⏳ 挖矿中'}`);
        
        if (isMatured) {
          maturedCount++;
          // 检查手续费
          const feePaid = await contract.stakeRedemptionFeePaid(stake.id);
          if (feePaid > 0n) {
            console.log(`    手续费状态: 旧逻辑（已预付 ${ethers.formatEther(feePaid)} MC）`);
          } else {
            console.log(`    手续费状态: 新逻辑（赎回时需付费）`);
          }
        }
      }
      
      if (maturedCount === 0 && stakes.length > 0) {
        warnings.push("⚠️ 有质押在挖矿中，但尚未到期");
      } else if (maturedCount > 0) {
        console.log(`\n  共有 ${maturedCount} 笔质押可赎回`);
      }
    } else if (hasTicket) {
      console.log("  用户有门票但未质押");
    }
    
    // 5. 检查池子余额
    console.log("\n📋 检查协议池子...");
    const [poolMC, poolJBC] = await Promise.all([
      contract.swapReserveMC(),
      contract.swapReserveJBC()
    ]);
    
    console.log(`  MC 储备: ${ethers.formatEther(poolMC)} MC`);
    console.log(`  JBC 储备: ${ethers.formatEther(poolJBC)} JBC`);
    
    if (poolMC < ethers.parseEther("1000")) {
      warnings.push("⚠️ 协议MC储备较低，可能影响赎回");
    }
    
    // 6. 检查待退金
    if (hasTicket) {
      const refund = userInfo.refundFeeAmount;
      if (refund > 0n) {
        console.log(`\n  待退金: ${ethers.formatEther(refund)} MC`);
        if (poolMC < refund) {
          issues.push("❌ 协议池子不足以退还待退金，无法提供流动性");
        }
      }
    }
    
    // 7. 检查用户余额
    console.log("\n📋 检查用户余额...");
    const balance = await provider.getBalance(userAddress);
    console.log(`  MC 余额: ${ethers.formatEther(balance)} MC`);
    
    if (balance < ethers.parseEther("0.1")) {
      issues.push("❌ 用户MC余额极低，可能不足以支付Gas费");
    }
    
    // 8. 检查是否达到收益上限
    if (userInfo.currentCap > 0n) {
      const progress = (userInfo.totalRevenue * 100n) / userInfo.currentCap;
      console.log(`\n  收益进度: ${progress}%`);
      if (progress >= 100n) {
        issues.push("❌ 已达到3倍收益上限，需要重新购买门票");
      } else if (progress >= 90n) {
        warnings.push(`⚠️ 收益进度已达 ${progress}%，即将达到上限`);
      }
    }
    
  } catch (error) {
    console.error("诊断过程中出错:", error);
  }
  
  // 输出结果
  console.log("\n" + "=".repeat(60));
  console.log("📊 诊断结果汇总");
  console.log("=".repeat(60));
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log("\n✅ 未发现明显问题，用户应该可以正常操作");
  } else {
    if (issues.length > 0) {
      console.log("\n🔴 阻止操作的问题:");
      issues.forEach(issue => console.log(`  ${issue}`));
    }
    
    if (warnings.length > 0) {
      console.log("\n🟡 警告/注意事项:");
      warnings.forEach(warning => console.log(`  ${warning}`));
    }
  }
  
  // 提供建议
  console.log("\n💡 建议操作:");
  if (issues.some(i => i.includes("未绑定推荐人"))) {
    console.log("  1. 先绑定推荐人");
  }
  if (issues.some(i => i.includes("没有有效门票")) || issues.some(i => i.includes("门票已过期"))) {
    console.log("  2. 购买新门票");
  }
  if (issues.some(i => i.includes("池子不足以退还待退金"))) {
    console.log("  3. 等待协议池子补充或联系管理员");
  }
  if (issues.some(i => i.includes("已达到3倍收益上限"))) {
    console.log("  4. 重新购买门票以继续参与");
  }
  if (issues.length === 0) {
    console.log("  - 如果仍无法操作，请检查浏览器控制台错误信息");
    console.log("  - 尝试刷新页面或重新连接钱包");
    console.log("  - 联系技术支持并提供具体错误截图");
  }
  
  console.log("\n");
}

// 主函数
async function main() {
  const userAddress = process.argv[2];
  
  if (!userAddress) {
    console.log("\n❌ 请提供用户地址");
    console.log("用法: node scripts/diagnose-user-issue.cjs <用户地址>\n");
    process.exit(1);
  }
  
  if (!ethers.isAddress(userAddress)) {
    console.log("\n❌ 无效的用户地址格式\n");
    process.exit(1);
  }
  
  await diagnoseUser(userAddress);
}

main().catch(console.error);
