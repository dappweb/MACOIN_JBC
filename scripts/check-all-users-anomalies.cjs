#!/usr/bin/env node
/**
 * 全面异常检测脚本 - 检查所有用户在赎回/质押逻辑中可能存在的异常
 * 
 * 检测项目：
 * 1. 质押已到期但仍为活跃状态（应该被赎回但没有）
 * 2. 质押已终止但未支付全部应得收益
 * 3. 质押金额异常（0 或超大）
 * 4. 质押周期不合法（非 7/15/30 天）
 * 5. 收益超过3倍上限但门票未退出
 * 6. 门票已退出但仍有活跃质押
 * 7. 已支付收益超过应得收益（超额支付）
 * 8. 质押时间异常（未来时间或远古时间）
 * 9. 账户未激活但有活跃质押
 * 10. 没有推荐人但有门票/质押
 * 11. 赎回时用户可能无法支付手续费
 * 12. 收益接近上限但有活跃大额质押（可能导致损失）
 */

const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "event BoundReferrer(address indexed user, address indexed referrer)",
  "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

const SECONDS_IN_UNIT = 86400; // 天

// 异常分类
const SEVERITY = {
  CRITICAL: '🔴 严重',
  WARNING: '🟡 警告',
  INFO: '🔵 信息'
};

function formatMC(wei) {
  return ethers.formatEther(wei);
}

function formatTime(ts) {
  return new Date(Number(ts) * 1000).toLocaleString('zh-CN');
}

function getRatePerBillion(cycleDays) {
  if (cycleDays == 7) return 13333334n;
  if (cycleDays == 15) return 16666667n;
  if (cycleDays == 30) return 20000000n;
  return 0n;
}

async function getAllUsers(contract, provider) {
  console.log("📡 正在从链上获取所有用户（通过事件）...");
  const allUsers = new Set();
  
  const blockNumber = await provider.getBlockNumber();
  console.log(`  当前区块: ${blockNumber}`);
  
  // 从事件获取用户
  try {
    const boundEvents = await contract.queryFilter(contract.filters.BoundReferrer(), 0, blockNumber);
    boundEvents.forEach(e => {
      if (e.args) {
        allUsers.add(e.args.user);
        allUsers.add(e.args.referrer);
      }
    });
    console.log(`  BoundReferrer 事件找到 ${boundEvents.length} 条, 唯一用户: ${allUsers.size}`);
  } catch (err) {
    console.warn(`  ⚠️ BoundReferrer 事件查询失败: ${err.message}`);
  }

  try {
    const ticketEvents = await contract.queryFilter(contract.filters.TicketPurchased(), 0, blockNumber);
    ticketEvents.forEach(e => {
      if (e.args) allUsers.add(e.args.user);
    });
    console.log(`  TicketPurchased 事件找到 ${ticketEvents.length} 条`);
  } catch (err) {
    console.warn(`  ⚠️ TicketPurchased 事件查询失败: ${err.message}`);
  }
  
  try {
    const stakeEvents = await contract.queryFilter(contract.filters.LiquidityStaked(), 0, blockNumber);
    stakeEvents.forEach(e => {
      if (e.args) allUsers.add(e.args.user);
    });
    console.log(`  LiquidityStaked 事件找到 ${stakeEvents.length} 条`);
  } catch (err) {
    console.warn(`  ⚠️ LiquidityStaked 事件查询失败: ${err.message}`);
  }
  
  // 同时加载备份中的用户
  try {
    const fs = require('fs');
    const path = require('path');
    const backupFile = path.join(__dirname, 'backups', 'protocol-backup-1767522095585.json');
    if (fs.existsSync(backupFile)) {
      const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      backup.users.forEach(u => allUsers.add(u.address));
      console.log(`  备份文件添加 ${backup.users.length} 个地址`);
    }
  } catch (err) {}
  
  // 去除零地址
  allUsers.delete(ethers.ZeroAddress);
  
  console.log(`  ✅ 总计唯一用户: ${allUsers.size}\n`);
  return Array.from(allUsers);
}

async function getUserData(contract, address) {
  try {
    const [userInfoData, ticket] = await Promise.all([
      contract.userInfo(address),
      contract.userTicket(address)
    ]);

    // 获取质押列表
    const stakes = [];
    let idx = 0;
    while (idx < 100) {
      try {
        const stake = await contract.userStakes(address, idx);
        if (stake.amount > 0n) {
          stakes.push({
            index: idx,
            id: Number(stake.id),
            amount: stake.amount,
            startTime: Number(stake.startTime),
            cycleDays: Number(stake.cycleDays),
            active: stake.active,
            paid: stake.paid
          });
        }
        idx++;
      } catch (e) {
        break;
      }
    }

    return {
      address,
      userInfo: {
        referrer: userInfoData.referrer,
        activeDirects: Number(userInfoData.activeDirects),
        teamCount: Number(userInfoData.teamCount),
        totalRevenue: userInfoData.totalRevenue,
        currentCap: userInfoData.currentCap,
        isActive: userInfoData.isActive,
        refundFeeAmount: userInfoData.refundFeeAmount,
        maxTicketAmount: userInfoData.maxTicketAmount
      },
      ticket: {
        ticketId: Number(ticket.ticketId),
        amount: ticket.amount,
        purchaseTime: Number(ticket.purchaseTime),
        exited: ticket.exited
      },
      stakes
    };
  } catch (err) {
    return null;
  }
}

function checkUserAnomalies(userData, now, redemptionFeePercent) {
  const anomalies = [];
  const { address, userInfo, ticket, stakes } = userData;
  
  // ===== 检测1: 质押已到期但仍为活跃 =====
  for (const stake of stakes) {
    if (stake.active) {
      const endTime = stake.startTime + stake.cycleDays * SECONDS_IN_UNIT;
      if (now >= endTime) {
        const overdueDays = Math.floor((now - endTime) / SECONDS_IN_UNIT);
        anomalies.push({
          severity: overdueDays > 7 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
          type: 'EXPIRED_BUT_ACTIVE',
          message: `质押 #${stake.id} 已到期 ${overdueDays} 天但仍为活跃状态（金额: ${formatMC(stake.amount)} MC, 周期: ${stake.cycleDays}天, 到期: ${formatTime(endTime)}）`,
          stakeId: stake.id,
          overdueDays
        });
      }
    }
  }

  // ===== 检测2: 质押已终止但未支付全部应得收益 =====
  for (const stake of stakes) {
    if (!stake.active && stake.amount > 0n) {
      const rate = getRatePerBillion(BigInt(stake.cycleDays));
      const expectedTotal = (stake.amount * rate * BigInt(stake.cycleDays)) / 1000000000n;
      
      if (stake.paid < expectedTotal) {
        const unpaid = expectedTotal - stake.paid;
        const unpaidPercent = Number(unpaid * 10000n / expectedTotal) / 100;
        
        // 只有差额超过总收益5%才算异常（有些可能是达到上限被截断）
        if (unpaidPercent > 5) {
          anomalies.push({
            severity: unpaidPercent > 50 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
            type: 'UNDERPAID_TERMINATED',
            message: `质押 #${stake.id} 已终止，但只支付了 ${formatMC(stake.paid)}/${formatMC(expectedTotal)} MC（欠付 ${unpaidPercent.toFixed(1)}%, 缺少 ${formatMC(unpaid)} MC, 金额: ${formatMC(stake.amount)} MC, 周期: ${stake.cycleDays}天）`,
            stakeId: stake.id,
            unpaidPercent
          });
        }
      }
    }
  }

  // ===== 检测3: 质押金额异常 =====
  for (const stake of stakes) {
    if (stake.amount === 0n) {
      anomalies.push({
        severity: SEVERITY.WARNING,
        type: 'ZERO_AMOUNT_STAKE',
        message: `质押 #${stake.id} 金额为 0`,
        stakeId: stake.id
      });
    }
    // 超大质押（> 100万 MC）
    if (stake.amount > ethers.parseEther('1000000')) {
      anomalies.push({
        severity: SEVERITY.WARNING,
        type: 'HUGE_AMOUNT_STAKE',
        message: `质押 #${stake.id} 金额异常大: ${formatMC(stake.amount)} MC`,
        stakeId: stake.id
      });
    }
  }

  // ===== 检测4: 质押周期不合法 =====
  for (const stake of stakes) {
    if (![7, 15, 30].includes(stake.cycleDays)) {
      anomalies.push({
        severity: SEVERITY.CRITICAL,
        type: 'INVALID_CYCLE',
        message: `质押 #${stake.id} 周期不合法: ${stake.cycleDays} 天（应为7/15/30）`,
        stakeId: stake.id
      });
    }
  }

  // ===== 检测5: 收益超过3倍上限但门票未退出 =====
  if (userInfo.currentCap > 0n && userInfo.totalRevenue >= userInfo.currentCap && !ticket.exited) {
    anomalies.push({
      severity: SEVERITY.CRITICAL,
      type: 'CAP_REACHED_NOT_EXITED',
      message: `收益 ${formatMC(userInfo.totalRevenue)} MC 已达上限 ${formatMC(userInfo.currentCap)} MC，但门票未退出`,
    });
  }

  // ===== 检测6: 门票已退出但仍有活跃质押 =====
  if (ticket.exited) {
    const activeStakes = stakes.filter(s => s.active);
    if (activeStakes.length > 0) {
      anomalies.push({
        severity: SEVERITY.CRITICAL,
        type: 'EXITED_WITH_ACTIVE_STAKES',
        message: `门票已退出但仍有 ${activeStakes.length} 笔活跃质押（ID: ${activeStakes.map(s => s.id).join(', ')}）`,
      });
    }
  }

  // ===== 检测7: 已支付收益超过应得收益（超额支付） =====
  for (const stake of stakes) {
    const rate = getRatePerBillion(BigInt(stake.cycleDays));
    if (rate > 0n) {
      const maxTotal = (stake.amount * rate * BigInt(stake.cycleDays)) / 1000000000n;
      if (stake.paid > maxTotal) {
        const overpaid = stake.paid - maxTotal;
        anomalies.push({
          severity: SEVERITY.CRITICAL,
          type: 'OVERPAID',
          message: `质押 #${stake.id} 超额支付！已付 ${formatMC(stake.paid)} MC，应得 ${formatMC(maxTotal)} MC，多付 ${formatMC(overpaid)} MC`,
          stakeId: stake.id
        });
      }
    }
  }

  // ===== 检测8: 质押时间异常 =====
  for (const stake of stakes) {
    // 未来时间
    if (stake.startTime > now + 3600) {
      anomalies.push({
        severity: SEVERITY.CRITICAL,
        type: 'FUTURE_START_TIME',
        message: `质押 #${stake.id} 开始时间为未来: ${formatTime(stake.startTime)}`,
        stakeId: stake.id
      });
    }
    // 太古老（2024年前）
    if (stake.startTime > 0 && stake.startTime < 1704067200) { // 2024-01-01
      anomalies.push({
        severity: SEVERITY.WARNING,
        type: 'ANCIENT_START_TIME',
        message: `质押 #${stake.id} 开始时间异常早: ${formatTime(stake.startTime)}`,
        stakeId: stake.id
      });
    }
  }

  // ===== 检测9: 账户未激活但有活跃质押 =====
  if (!userInfo.isActive) {
    const activeStakes = stakes.filter(s => s.active);
    if (activeStakes.length > 0) {
      anomalies.push({
        severity: SEVERITY.WARNING,
        type: 'INACTIVE_WITH_STAKES',
        message: `账户未激活但有 ${activeStakes.length} 笔活跃质押`,
      });
    }
  }

  // ===== 检测10: 没有推荐人但有门票/质押 =====
  if (userInfo.referrer === ethers.ZeroAddress) {
    if (ticket.amount > 0n) {
      anomalies.push({
        severity: SEVERITY.WARNING,
        type: 'NO_REFERRER_WITH_TICKET',
        message: `没有推荐人但有门票（${formatMC(ticket.amount)} MC）`,
      });
    }
  }

  // ===== 检测11: 赎回时需要手续费但用户可能无法支付 =====
  for (const stake of stakes) {
    if (stake.active) {
      const endTime = stake.startTime + stake.cycleDays * SECONDS_IN_UNIT;
      if (now >= endTime) {
        // 质押已到期，计算赎回手续费
        const feeBase = userInfo.maxTicketAmount > 0n ? userInfo.maxTicketAmount : ticket.amount;
        const fee = (feeBase * BigInt(redemptionFeePercent)) / 100n;
        if (fee > 0n) {
          anomalies.push({
            severity: SEVERITY.INFO,
            type: 'REDEMPTION_FEE_NEEDED',
            message: `质押 #${stake.id} 已到期可赎回，赎回手续费约 ${formatMC(fee)} MC（基数: ${formatMC(feeBase)} MC, 费率: ${redemptionFeePercent}%）`,
            stakeId: stake.id
          });
        }
      }
    }
  }

  // ===== 检测12: 收益接近上限但有活跃大额质押 =====
  if (userInfo.currentCap > 0n && !ticket.exited) {
    const remaining = userInfo.currentCap - userInfo.totalRevenue;
    const activeStakes = stakes.filter(s => s.active);
    
    for (const stake of activeStakes) {
      const rate = getRatePerBillion(BigInt(stake.cycleDays));
      const expectedTotal = (stake.amount * rate * BigInt(stake.cycleDays)) / 1000000000n;
      
      if (expectedTotal > remaining && remaining > 0n) {
        const lossPercent = Number((expectedTotal - remaining) * 10000n / expectedTotal) / 100;
        anomalies.push({
          severity: lossPercent > 50 ? SEVERITY.WARNING : SEVERITY.INFO,
          type: 'CAP_WILL_TRUNCATE',
          message: `质押 #${stake.id} 预期收益 ${formatMC(expectedTotal)} MC 将被上限截断，剩余额度仅 ${formatMC(remaining)} MC（损失 ${lossPercent.toFixed(1)}%）`,
          stakeId: stake.id
        });
      }
    }
  }

  // ===== 检测13: 总收益 + 所有活跃质押预期收益 > 上限 =====
  if (userInfo.currentCap > 0n && !ticket.exited) {
    const activeStakes = stakes.filter(s => s.active);
    let totalExpectedEarnings = userInfo.totalRevenue;
    
    for (const stake of activeStakes) {
      const rate = getRatePerBillion(BigInt(stake.cycleDays));
      const expectedTotal = (stake.amount * rate * BigInt(stake.cycleDays)) / 1000000000n;
      const remaining = expectedTotal > stake.paid ? expectedTotal - stake.paid : 0n;
      totalExpectedEarnings += remaining;
    }
    
    if (totalExpectedEarnings > userInfo.currentCap) {
      anomalies.push({
        severity: SEVERITY.INFO,
        type: 'WILL_HIT_CAP',
        message: `预计总收益 ${formatMC(totalExpectedEarnings)} MC 将超过上限 ${formatMC(userInfo.currentCap)} MC`,
      });
    }
  }

  return anomalies;
}

async function main() {
  console.log("=".repeat(80));
  console.log("🔬 全面异常检测 - 赎回/质押逻辑异常扫描");
  console.log("=".repeat(80));
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`📝 合约: ${PROTOCOL_ADDRESS}`);
  console.log(`📡 RPC: ${RPC_URL}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  const now = Math.floor(Date.now() / 1000);

  // 获取合约参数
  let redemptionFeePercent = 1;
  try {
    const feePercent = await contract.redemptionFeePercent();
    redemptionFeePercent = Number(feePercent);
    console.log(`💰 赎回手续费: ${redemptionFeePercent}%`);
  } catch (e) {
    console.warn("⚠️ 无法获取赎回手续费，使用默认1%");
  }

  // 获取所有用户
  const allAddresses = await getAllUsers(contract, provider);

  // 统计
  const stats = {
    totalUsers: allAddresses.length,
    usersChecked: 0,
    usersWithStakes: 0,
    totalStakes: 0,
    activeStakes: 0,
    terminatedStakes: 0,
    totalAnomalies: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    anomalyByType: {},
    anomalousUsers: []
  };

  const allAnomalies = [];

  // 逐用户检查
  console.log(`\n🔍 开始逐用户检查（共 ${allAddresses.length} 个用户）...\n`);
  
  let progress = 0;
  const batchSize = 5;
  
  for (let i = 0; i < allAddresses.length; i += batchSize) {
    const batch = allAddresses.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(addr => getUserData(contract, addr)));
    
    for (const userData of results) {
      if (!userData) continue;
      stats.usersChecked++;
      
      if (userData.stakes.length > 0) {
        stats.usersWithStakes++;
        stats.totalStakes += userData.stakes.length;
        stats.activeStakes += userData.stakes.filter(s => s.active).length;
        stats.terminatedStakes += userData.stakes.filter(s => !s.active).length;
      }
      
      const anomalies = checkUserAnomalies(userData, now, redemptionFeePercent);
      
      if (anomalies.length > 0) {
        stats.totalAnomalies += anomalies.length;
        stats.anomalousUsers.push({
          address: userData.address,
          anomalyCount: anomalies.length,
          anomalies
        });
        
        for (const a of anomalies) {
          if (a.severity === SEVERITY.CRITICAL) stats.criticalCount++;
          else if (a.severity === SEVERITY.WARNING) stats.warningCount++;
          else stats.infoCount++;
          
          stats.anomalyByType[a.type] = (stats.anomalyByType[a.type] || 0) + 1;
          allAnomalies.push({ ...a, address: userData.address });
        }
      }
    }
    
    progress = Math.min(i + batchSize, allAddresses.length);
    if (progress % 50 === 0 || progress === allAddresses.length) {
      process.stdout.write(`  进度: ${progress}/${allAddresses.length} (${(progress / allAddresses.length * 100).toFixed(0)}%), 异常: ${stats.totalAnomalies}\r`);
    }
  }
  
  console.log("\n");

  // ===== 输出结果 =====
  console.log("=".repeat(80));
  console.log("📊 检测统计");
  console.log("=".repeat(80));
  console.log(`  检查用户数: ${stats.usersChecked}`);
  console.log(`  有质押用户: ${stats.usersWithStakes}`);
  console.log(`  总质押数: ${stats.totalStakes}`);
  console.log(`  活跃质押: ${stats.activeStakes}`);
  console.log(`  已终止质押: ${stats.terminatedStakes}`);
  console.log(`  ──────────────────`);
  console.log(`  发现异常: ${stats.totalAnomalies}`);
  console.log(`    🔴 严重: ${stats.criticalCount}`);
  console.log(`    🟡 警告: ${stats.warningCount}`);
  console.log(`    🔵 信息: ${stats.infoCount}`);
  console.log(`  有异常的用户: ${stats.anomalousUsers.length}`);

  // 异常类型统计
  console.log("\n" + "=".repeat(80));
  console.log("📋 异常类型分布");
  console.log("=".repeat(80));
  
  const typeDescriptions = {
    EXPIRED_BUT_ACTIVE: '质押已到期但仍活跃',
    UNDERPAID_TERMINATED: '质押已终止但欠付收益',
    ZERO_AMOUNT_STAKE: '质押金额为0',
    HUGE_AMOUNT_STAKE: '质押金额异常大',
    INVALID_CYCLE: '质押周期不合法',
    CAP_REACHED_NOT_EXITED: '达到上限但未退出',
    EXITED_WITH_ACTIVE_STAKES: '已退出但有活跃质押',
    OVERPAID: '超额支付收益',
    FUTURE_START_TIME: '质押开始时间在未来',
    ANCIENT_START_TIME: '质押开始时间异常早',
    INACTIVE_WITH_STAKES: '未激活但有活跃质押',
    NO_REFERRER_WITH_TICKET: '无推荐人但有门票',
    REDEMPTION_FEE_NEEDED: '到期需要交手续费',
    CAP_WILL_TRUNCATE: '收益将被上限截断',
    WILL_HIT_CAP: '预计将达到上限'
  };

  const sortedTypes = Object.entries(stats.anomalyByType).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    console.log(`  ${typeDescriptions[type] || type}: ${count}`);
  }

  // 详细异常列表 - 按严重程度排序
  console.log("\n" + "=".repeat(80));
  console.log("🔴 严重异常详情");
  console.log("=".repeat(80));
  
  const criticals = allAnomalies.filter(a => a.severity === SEVERITY.CRITICAL);
  if (criticals.length === 0) {
    console.log("  ✅ 没有发现严重异常！");
  } else {
    criticals.forEach((a, idx) => {
      console.log(`\n  ${idx + 1}. [${a.type}]`);
      console.log(`     用户: ${a.address}`);
      console.log(`     ${a.message}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("🟡 警告详情");
  console.log("=".repeat(80));
  
  const warnings = allAnomalies.filter(a => a.severity === SEVERITY.WARNING);
  if (warnings.length === 0) {
    console.log("  ✅ 没有发现警告！");
  } else {
    warnings.forEach((a, idx) => {
      console.log(`\n  ${idx + 1}. [${a.type}]`);
      console.log(`     用户: ${a.address}`);
      console.log(`     ${a.message}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("🔵 信息提示（前30条）");
  console.log("=".repeat(80));
  
  const infos = allAnomalies.filter(a => a.severity === SEVERITY.INFO);
  if (infos.length === 0) {
    console.log("  ✅ 没有信息提示");
  } else {
    infos.slice(0, 30).forEach((a, idx) => {
      console.log(`\n  ${idx + 1}. [${a.type}]`);
      console.log(`     用户: ${a.address}`);
      console.log(`     ${a.message}`);
    });
    if (infos.length > 30) {
      console.log(`\n  ... 还有 ${infos.length - 30} 条信息提示`);
    }
  }

  // 按用户汇总
  console.log("\n" + "=".repeat(80));
  console.log("👥 异常用户汇总（按异常数排序，前20名）");
  console.log("=".repeat(80));
  
  stats.anomalousUsers
    .sort((a, b) => b.anomalyCount - a.anomalyCount)
    .slice(0, 20)
    .forEach((user, idx) => {
      const critCount = user.anomalies.filter(a => a.severity === SEVERITY.CRITICAL).length;
      const warnCount = user.anomalies.filter(a => a.severity === SEVERITY.WARNING).length;
      const infoCount = user.anomalies.filter(a => a.severity === SEVERITY.INFO).length;
      console.log(`  ${idx + 1}. ${user.address}`);
      console.log(`     异常总数: ${user.anomalyCount} (🔴${critCount} 🟡${warnCount} 🔵${infoCount})`);
      console.log(`     类型: ${user.anomalies.map(a => a.type).join(', ')}`);
    });

  // 保存结果到文件
  const outputFile = `output/anomaly-report-${Date.now()}.json`;
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(path.dirname(path.join(process.cwd(), outputFile)), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), outputFile),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stats,
      anomalies: allAnomalies,
      anomalousUsers: stats.anomalousUsers
    }, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)
  );
  console.log(`\n📁 详细报告已保存: ${outputFile}`);

  // 最终总结
  console.log("\n" + "=".repeat(80));
  console.log("🎯 最终总结");
  console.log("=".repeat(80));
  
  if (stats.criticalCount > 0) {
    console.log(`\n  ⚠️ 发现 ${stats.criticalCount} 个严重异常，需要立即处理！`);
  } else {
    console.log(`\n  ✅ 没有发现严重异常`);
  }
  
  if (stats.warningCount > 0) {
    console.log(`  ⚠️ 发现 ${stats.warningCount} 个警告，建议检查`);
  }

  console.log(`  ℹ️ 发现 ${stats.infoCount} 个信息提示`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });
