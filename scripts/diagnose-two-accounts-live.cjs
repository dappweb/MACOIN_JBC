#!/usr/bin/env node
/**
 * 实时诊断两个账户的链上状态
 * 账户1: 0xC65f043aD84561e262C3aE54230F74B1071BEFE3
 * 账户2: 0xd6b93380bAa72a4Ad126b2e8985A33Dd8C13D98f
 */

const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

// 正确的 ABI 定义
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function directReferrals(address) view returns (address[])",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)"
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

async function diagnoseAccount(contract, account) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 诊断 ${account.name}: ${account.address}`);
  console.log("=".repeat(80));

  try {
    // 1. 检查用户基本信息
    console.log("\n📋 用户基本信息:");
    const userInfo = await contract.userInfo(account.address);
    console.log(`  推荐人: ${userInfo.referrer}`);
    console.log(`  直推人数: ${userInfo.activeDirects}`);
    console.log(`  团队人数: ${userInfo.teamCount}`);
    console.log(`  总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`  当前上限: ${ethers.formatEther(userInfo.currentCap)} MC`);
    console.log(`  账户激活: ${userInfo.isActive ? "✅ 是" : "❌ 否"}`);
    console.log(`  最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);

    // 2. 检查门票状态
    console.log("\n🎫 门票信息:");
    const ticket = await contract.userTicket(account.address);
    console.log(`  门票ID: ${ticket.ticketId}`);
    console.log(`  门票金额: ${ethers.formatEther(ticket.amount)} MC`);
    if (ticket.amount > 0n) {
      console.log(`  购买时间: ${new Date(Number(ticket.purchaseTime) * 1000).toLocaleString('zh-CN')}`);
      console.log(`  是否已退出: ${ticket.exited ? "✅ 已退出" : "❌ 未退出"}`);
    } else {
      console.log(`  ❌ 没有门票`);
    }

    // 3. 检查质押列表
    console.log("\n💰 质押信息:");
    const stakes = [];
    let index = 0;
    
    // 尝试获取最多50笔质押
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
        // 没有更多质押了
        break;
      }
    }

    if (stakes.length === 0) {
      console.log(`  ❌ 【关键发现】没有任何质押记录！`);
      console.log(`\n  📊 分析:`);
      console.log(`    1. 用户购买了门票但从未进行流动性质押`);
      console.log(`    2. 没有质押意味着没有流动性头寸`);
      console.log(`    3. 因此无法进行赎回操作`);
    } else {
      console.log(`  质押数量: ${stakes.length} 笔\n`);
      stakes.forEach((stake) => {
        console.log(`  质押 #${stake.index}:`);
        console.log(`    ID: ${stake.id}`);
        console.log(`    金额: ${ethers.formatEther(stake.amount)} MC`);
        console.log(`    开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString('zh-CN')}`);
        console.log(`    周期: ${stake.cycleDays} 天`);
        console.log(`    状态: ${stake.active ? "✅ 活跃" : "❌ 已终止"}`);
        console.log(`    已支付: ${ethers.formatEther(stake.paid)} MC`);
        console.log(``);
      });
    }

    // 4. 检查直推列表
    console.log("\n👥 推荐关系:");
    try {
      const referrals = await contract.directReferrals(account.address);
      console.log(`  直推人数: ${referrals.length}`);
      if (referrals.length > 0 && referrals.length <= 10) {
        referrals.forEach((ref, idx) => {
          console.log(`    ${idx + 1}. ${ref}`);
        });
      } else if (referrals.length > 10) {
        console.log(`    (太多，不显示详情)`);
      }
    } catch (e) {
      console.log(`  无法获取直推列表: ${e.message}`);
    }

    // 5. 结论
    console.log("\n💡 诊断结论:");
    if (stakes.length === 0) {
      console.log(`  ❌ 不能赎回: 因为从未进行过质押 (预期行为)`);
      console.log(`  ${ticket.amount > 0n && !ticket.exited ? "✅" : "❓"} 提供流动性: 技术上${ticket.amount > 0n && !ticket.exited ? "应该可以" : "需要先购买门票"}`);
    } else {
      const activeStakes = stakes.filter(s => s.active);
      console.log(`  ✅ 可以赎回: 有 ${activeStakes.length} 笔活跃质押`);
      console.log(`  ✅ 可以提供流动性: 有门票且账户激活`);
    }

  } catch (error) {
    console.log(`\n❌ 诊断过程出错: ${error.message}`);
    console.log(error);
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 两个账户实时诊断 - 链上数据");
  console.log("=".repeat(80));
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`📝 合约: ${PROTOCOL_ADDRESS}`);
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

  // 检查合约状态
  console.log("\n📋 检查合约全局状态...");
  try {
    const [paused, liquidityEnabled, redeemEnabled, secondsInUnit] = await Promise.all([
      contract.emergencyPaused(),
      contract.liquidityEnabled(),
      contract.redeemEnabled(),
      contract.SECONDS_IN_UNIT()
    ]);

    console.log(`  合约暂停: ${paused ? "❌ 是" : "✅ 否"}`);
    console.log(`  质押功能: ${liquidityEnabled ? "✅ 启用" : "❌ 禁用"}`);
    console.log(`  赎回功能: ${redeemEnabled ? "✅ 启用" : "❌ 禁用"}`);
    console.log(`  单位秒数: ${secondsInUnit} 秒 (${Number(secondsInUnit) / 86400} 天)`);

    // 检查流动性池
    try {
      const [reserveMC, reserveJBC] = await Promise.all([
        contract.swapReserveMC(),
        contract.swapReserveJBC()
      ]);
      console.log(`  MC 储备: ${ethers.formatEther(reserveMC)} MC`);
      console.log(`  JBC 储备: ${ethers.formatEther(reserveJBC)} JBC`);
    } catch (e) {
      console.log(`  流动性池: 无法获取`);
    }

  } catch (error) {
    console.log(`  ❌ 无法获取合约状态: ${error.message}`);
  }

  // 诊断两个账户
  for (const account of ACCOUNTS) {
    await diagnoseAccount(contract, account);
  }

  // 总结
  console.log("\n" + "=".repeat(80));
  console.log("📊 诊断完成");
  console.log("=".repeat(80));
  console.log("\n💡 后续建议:");
  console.log("  1. 如果用户想提供流动性但无法操作，检查:");
  console.log("     - 浏览器控制台是否有错误信息");
  console.log("     - 钱包是否有足够的 MC/JBC 代币");
  console.log("     - 是否已经授权合约使用代币");
  console.log("  2. 如果用户曾经质押过但数据丢失，需要:");
  console.log("     - 在区块链浏览器查询 LiquidityStaked 事件");
  console.log("     - 联系管理员恢复数据");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
