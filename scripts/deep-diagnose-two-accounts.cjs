#!/usr/bin/env node
/**
 * 深度诊断脚本 - 检查代币余额、授权状态和操作限制
 * 账户1: 0xC65f043aD84561e262C3aE54230F74B1071BEFE3
 * 账户2: 0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f
 */

const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

// 完整的 ABI 定义
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function mcToken() view returns (address)",
  "function jbcToken() view returns (address)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function ticketExpiryCutoffDate() view returns (uint256)",
  "function lastStakeDeadlineBase(address) view returns (uint256)",
  "function calculateStakeRewards(address) view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
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

const TICKET_EXPIRY_CUTOFF_DATE = 1770595200; // 2026-02-09 00:00:00 UTC

function formatTime(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleString('zh-CN');
}

function formatMC(wei) {
  return ethers.formatEther(wei);
}

async function checkTokenBalanceAndAllowance(tokenContract, userAddress, spenderAddress, tokenName) {
  try {
    const [balance, allowance, symbol] = await Promise.all([
      tokenContract.balanceOf(userAddress),
      tokenContract.allowance(userAddress, spenderAddress),
      tokenContract.symbol()
    ]);

    console.log(`\n  ${tokenName} (${symbol}):`);
    console.log(`    余额: ${formatMC(balance)}`);
    console.log(`    授权额度: ${formatMC(allowance)}`);
    
    if (balance === 0n) {
      console.log(`    ⚠️ 余额为0 - 无法进行质押操作`);
    } else if (allowance === 0n) {
      console.log(`    ❌ 未授权 - 需要先授权才能质押`);
    } else if (allowance < balance) {
      console.log(`    ⚠️ 授权不足 - 建议增加授权额度`);
    } else {
      console.log(`    ✅ 授权充足`);
    }

    return { balance, allowance, symbol };
  } catch (error) {
    console.log(`    ❌ 无法获取代币信息: ${error.message}`);
    return null;
  }
}

async function diagnoseAccountDeep(provider, contract, account) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 深度诊断 ${account.name}: ${account.address}`);
  console.log("=".repeat(80));

  try {
    const now = Math.floor(Date.now() / 1000);

    // 1. 基本信息
    console.log("\n📋 Step 1: 用户基本信息");
    const userInfo = await contract.userInfo(account.address);
    console.log(`  推荐人: ${userInfo.referrer}`);
    console.log(`  账户激活: ${userInfo.isActive ? "✅ 是" : "❌ 否"}`);
    console.log(`  总收益: ${formatMC(userInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${formatMC(userInfo.currentCap)} MC`);
    console.log(`  收益/上限比: ${(Number(formatMC(userInfo.totalRevenue)) / Number(formatMC(userInfo.currentCap)) * 100).toFixed(2)}%`);

    // 2. 门票状态
    console.log("\n🎫 Step 2: 门票状态检查");
    const ticket = await contract.userTicket(account.address);
    console.log(`  门票金额: ${formatMC(ticket.amount)} MC`);
    console.log(`  购买时间: ${formatTime(ticket.purchaseTime)}`);
    console.log(`  是否已退出: ${ticket.exited ? "✅ 是" : "❌ 否"}`);

    // 检查72小时规则
    if (ticket.amount > 0n && !ticket.exited) {
      const purchaseTime = Number(ticket.purchaseTime);
      if (purchaseTime >= TICKET_EXPIRY_CUTOFF_DATE) {
        const lastStakeDeadlineBase = await contract.lastStakeDeadlineBase(account.address);
        const deadlineBase = lastStakeDeadlineBase > 0n ? Number(lastStakeDeadlineBase) : purchaseTime;
        const ticketFlexibilityDuration = Number(await contract.ticketFlexibilityDuration());
        const deadline = deadlineBase + ticketFlexibilityDuration;

        console.log(`\n  ⏰ 72小时规则检查:`);
        console.log(`    基准时间: ${formatTime(deadlineBase)}`);
        console.log(`    过期时间: ${formatTime(deadline)}`);
        console.log(`    当前时间: ${formatTime(now)}`);

        if (now > deadline) {
          console.log(`    ❌ 门票已过期 - 无法新增质押`);
        } else {
          const remaining = deadline - now;
          const hours = Math.floor(remaining / 3600);
          const minutes = Math.floor((remaining % 3600) / 60);
          console.log(`    ✅ 门票有效，剩余 ${hours}小时${minutes}分钟`);
        }
      } else {
        console.log(`  ℹ️ 该门票不受72小时限制（2026年2月9日前购买）`);
      }
    }

    // 3. 质押状态
    console.log("\n💰 Step 3: 质押状态详情");
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

    if (stakes.length === 0) {
      console.log(`  ❌ 没有任何质押记录`);
    } else {
      console.log(`  质押总数: ${stakes.length} 笔`);
      const activeStakes = stakes.filter(s => s.active);
      const inactiveStakes = stakes.filter(s => !s.active);
      console.log(`  活跃质押: ${activeStakes.length} 笔`);
      console.log(`  已终止: ${inactiveStakes.length} 笔`);

      stakes.forEach((stake) => {
        const endTime = Number(stake.startTime) + Number(stake.cycleDays) * 86400;
        const isMatured = now >= endTime;
        const daysRemaining = Math.ceil((endTime - now) / 86400);

        console.log(`\n  质押 #${stake.index} (ID: ${stake.id}):`);
        console.log(`    金额: ${formatMC(stake.amount)} MC`);
        console.log(`    开始: ${formatTime(stake.startTime)}`);
        console.log(`    周期: ${stake.cycleDays} 天`);
        console.log(`    到期: ${formatTime(endTime)}`);
        console.log(`    状态: ${stake.active ? "✅ 活跃" : "❌ 已终止"}`);
        console.log(`    已支付: ${formatMC(stake.paid)} MC`);
        
        if (stake.active) {
          if (isMatured) {
            console.log(`    🎉 已到期 - 可以赎回`);
          } else {
            console.log(`    ⏳ 还需 ${daysRemaining} 天到期`);
          }
        } else {
          console.log(`    ⚠️ 质押已终止 - 可能原因:`);
          console.log(`       - 已经赎回`);
          console.log(`       - 达到3倍收益上限`);
          console.log(`       - 管理员操作`);
        }
      });
    }

    // 4. 代币余额和授权
    console.log("\n💳 Step 4: 代币余额和授权检查");
    const mcTokenAddress = await contract.mcToken();
    const jbcTokenAddress = await contract.jbcToken();
    
    console.log(`  MC Token: ${mcTokenAddress}`);
    console.log(`  JBC Token: ${jbcTokenAddress}`);

    const mcToken = new ethers.Contract(mcTokenAddress, ERC20_ABI, provider);
    const jbcToken = new ethers.Contract(jbcTokenAddress, ERC20_ABI, provider);

    const mcInfo = await checkTokenBalanceAndAllowance(mcToken, account.address, PROTOCOL_ADDRESS, "MC Token");
    const jbcInfo = await checkTokenBalanceAndAllowance(jbcToken, account.address, PROTOCOL_ADDRESS, "JBC Token");

    // 5. 可领取奖励
    console.log("\n🎁 Step 5: 可领取奖励");
    try {
      const pendingRewards = await contract.calculateStakeRewards(account.address);
      console.log(`  待领取收益: ${formatMC(pendingRewards)} MC`);
      if (pendingRewards > 0n) {
        console.log(`  ✅ 有待领取奖励`);
      }
    } catch (error) {
      console.log(`  无法获取待领取奖励: ${error.message}`);
    }

    // 6. 操作能力总结
    console.log("\n🔧 Step 6: 操作能力评估");
    
    const canStake = ticket.amount > 0n 
      && !ticket.exited 
      && userInfo.isActive
      && mcInfo && mcInfo.balance > 0n
      && jbcInfo && jbcInfo.balance > 0n;

    const canRedeem = stakes.some(s => s.active);

    console.log(`\n  ✨ 提供流动性（质押）:`);
    if (!ticket.amount || ticket.exited) {
      console.log(`    ❌ 不可用 - 没有有效门票`);
    } else if (!userInfo.isActive) {
      console.log(`    ❌ 不可用 - 账户未激活`);
    } else if (!mcInfo || mcInfo.balance === 0n) {
      console.log(`    ❌ 不可用 - MC 余额为0`);
    } else if (!jbcInfo || jbcInfo.balance === 0n) {
      console.log(`    ❌ 不可用 - JBC 余额为0`);
    } else if (!mcInfo.allowance || mcInfo.allowance === 0n) {
      console.log(`    ⚠️ 受限 - 需要先授权 MC 代币`);
    } else if (!jbcInfo.allowance || jbcInfo.allowance === 0n) {
      console.log(`    ⚠️ 受限 - 需要先授权 JBC 代币`);
    } else {
      console.log(`    ✅ 可用 - 所有条件满足`);
    }

    console.log(`\n  💎 赎回质押:`);
    if (!canRedeem) {
      console.log(`    ❌ 不可用 - 没有活跃的质押`);
    } else {
      const activeStakes = stakes.filter(s => s.active);
      const maturedStakes = activeStakes.filter(s => {
        const endTime = Number(s.startTime) + Number(s.cycleDays) * 86400;
        return now >= endTime;
      });
      
      if (maturedStakes.length > 0) {
        console.log(`    ✅ 可用 - 有 ${maturedStakes.length} 笔已到期可赎回`);
      } else {
        console.log(`    ⏳ 待到期 - 有 ${activeStakes.length} 笔活跃质押但未到期`);
      }
    }

    // 7. 问题诊断
    console.log("\n🩺 Step 7: 问题诊断");
    const issues = [];
    const warnings = [];

    if (ticket.amount === 0n || ticket.exited) {
      issues.push("没有有效门票");
    }

    if (!mcInfo || mcInfo.balance === 0n) {
      issues.push("MC 余额为0");
    }

    if (!jbcInfo || jbcInfo.balance === 0n) {
      issues.push("JBC 余额为0");
    }

    if (mcInfo && mcInfo.balance > 0n && mcInfo.allowance === 0n) {
      warnings.push("MC 代币未授权");
    }

    if (jbcInfo && jbcInfo.balance > 0n && jbcInfo.allowance === 0n) {
      warnings.push("JBC 代币未授权");
    }

    if (Number(formatMC(userInfo.totalRevenue)) >= Number(formatMC(userInfo.currentCap)) * 0.99) {
      warnings.push("接近3倍收益上限");
    }

    if (issues.length > 0) {
      console.log(`\n  ❌ 发现 ${issues.length} 个阻塞性问题:`);
      issues.forEach((issue, idx) => {
        console.log(`    ${idx + 1}. ${issue}`);
      });
    } else {
      console.log(`\n  ✅ 未发现阻塞性问题`);
    }

    if (warnings.length > 0) {
      console.log(`\n  ⚠️ 发现 ${warnings.length} 个警告:`);
      warnings.forEach((warning, idx) => {
        console.log(`    ${idx + 1}. ${warning}`);
      });
    }

  } catch (error) {
    console.log(`\n❌ 诊断过程出错: ${error.message}`);
    console.error(error);
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 深度诊断 - 代币、授权和操作限制分析");
  console.log("=".repeat(80));
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`📝 合约: ${PROTOCOL_ADDRESS}`);
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  // 检查合约状态
  console.log("\n" + "=".repeat(80));
  console.log("📋 合约全局状态");
  console.log("=".repeat(80));
  
  try {
    const [paused, liquidityEnabled, redeemEnabled] = await Promise.all([
      contract.emergencyPaused(),
      contract.liquidityEnabled(),
      contract.redeemEnabled()
    ]);

    console.log(`  合约暂停: ${paused ? "❌ 是" : "✅ 否"}`);
    console.log(`  质押功能: ${liquidityEnabled ? "✅ 启用" : "❌ 禁用"}`);
    console.log(`  赎回功能: ${redeemEnabled ? "✅ 启用" : "❌ 禁用"}`);

    if (paused) {
      console.log(`\n  ⚠️ 警告: 合约已暂停，所有用户操作不可用！`);
    }
    if (!liquidityEnabled) {
      console.log(`\n  ⚠️ 警告: 质押功能已禁用，用户无法提供流动性！`);
    }
    if (!redeemEnabled) {
      console.log(`\n  ⚠️ 警告: 赎回功能已禁用，用户无法赎回质押！`);
    }

  } catch (error) {
    console.log(`  ❌ 无法获取合约状态: ${error.message}`);
  }

  // 诊断两个账户
  for (const account of ACCOUNTS) {
    await diagnoseAccountDeep(provider, contract, account);
  }

  // 最终总结
  console.log("\n" + "=".repeat(80));
  console.log("📊 诊断总结");
  console.log("=".repeat(80));
  console.log("\n💡 如果用户报告无法操作，请:");
  console.log("  1. 确认用户的 MC 和 JBC 代币余额是否充足");
  console.log("  2. 确认用户是否已授权合约使用代币");
  console.log("  3. 检查浏览器控制台的错误信息");
  console.log("  4. 确认钱包是否有足够的 Gas 费");
  console.log("  5. 尝试刷新页面或重新连接钱包");
  console.log("\n💻 如需授权代币，请执行:");
  console.log("  MC Token.approve(protocolAddress, amount)");
  console.log("  JBC Token.approve(protocolAddress, amount)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
