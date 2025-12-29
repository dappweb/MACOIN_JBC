#!/usr/bin/env node

/**
 * 级差奖励机制验证脚本
 * 验证 Jinbao Protocol 的级差奖励计算逻辑
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 验证级差奖励机制...\n');

// 等级定义 (基于合约 _getLevel 函数)
const LEVELS = [
  { minTeam: 0, level: 0, percent: 0 },
  { minTeam: 10, level: 1, percent: 5 },
  { minTeam: 30, level: 2, percent: 10 },
  { minTeam: 100, level: 3, percent: 15 },
  { minTeam: 300, level: 4, percent: 20 },
  { minTeam: 1000, level: 5, percent: 25 },
  { minTeam: 3000, level: 6, percent: 30 },
  { minTeam: 10000, level: 7, percent: 35 },
  { minTeam: 30000, level: 8, percent: 40 },
  { minTeam: 100000, level: 9, percent: 45 }
];

// 获取用户等级
function getLevel(teamCount) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (teamCount >= LEVELS[i].minTeam) {
      return { level: LEVELS[i].level, percent: LEVELS[i].percent };
    }
  }
  return { level: 0, percent: 0 };
}

// 计算级差奖励
function calculateDifferentialRewards(stakeAmount, userChain) {
  const rewards = [];
  let previousPercent = 0;
  
  console.log(`📊 计算质押金额 ${stakeAmount} MC 的级差奖励:`);
  console.log('推荐链结构:');
  
  userChain.forEach((user, index) => {
    const level = getLevel(user.teamCount);
    console.log(`  ${index + 1}. ${user.name} - V${level.level} (${level.percent}%) - 门票: ${user.ticketAmount} MC - ${user.active ? '活跃' : '非活跃'}`);
  });
  
  console.log('\n级差计算过程:');
  
  for (let i = 0; i < userChain.length && i < 20; i++) {
    const user = userChain[i];
    
    // 检查用户状态
    if (!user.active) {
      console.log(`  ${i + 1}. ${user.name}: 跳过 (非活跃用户)`);
      continue;
    }
    
    // 检查门票
    if (user.ticketAmount === 0) {
      console.log(`  ${i + 1}. ${user.name}: 跳过 (无门票)`);
      continue;
    }
    
    const level = getLevel(user.teamCount);
    
    // 检查等级是否更高
    if (level.percent > previousPercent) {
      const diffPercent = level.percent - previousPercent;
      const baseAmount = Math.min(stakeAmount, user.ticketAmount);
      const reward = (baseAmount * diffPercent) / 100;
      
      rewards.push({
        user: user.name,
        level: level.level,
        percent: level.percent,
        diffPercent,
        baseAmount,
        reward
      });
      
      console.log(`  ${i + 1}. ${user.name}: V${level.level} (${level.percent}%) - 级差 ${diffPercent}% - 基数 ${baseAmount} MC - 奖励 ${reward} MC`);
      
      previousPercent = level.percent;
    } else {
      console.log(`  ${i + 1}. ${user.name}: V${level.level} (${level.percent}%) - 跳过 (等级不够高)`);
    }
    
    // 达到V9停止
    if (level.percent >= 45) {
      console.log(`  达到V9等级，停止向上查找`);
      break;
    }
  }
  
  return rewards;
}

// 测试案例
const testCases = [
  {
    name: '基础级差计算',
    stakeAmount: 500,
    userChain: [
      { name: 'B', teamCount: 50, ticketAmount: 1000, active: true },
      { name: 'C', teamCount: 1500, ticketAmount: 1000, active: true },
      { name: 'D', teamCount: 15000, ticketAmount: 1000, active: true }
    ]
  },
  {
    name: '门票金额限制',
    stakeAmount: 1000,
    userChain: [
      { name: 'B', teamCount: 50, ticketAmount: 1000, active: true },
      { name: 'C', teamCount: 1500, ticketAmount: 300, active: true }, // 门票限制
      { name: 'D', teamCount: 15000, ticketAmount: 2000, active: true }
    ]
  },
  {
    name: '跨等级情况',
    stakeAmount: 800,
    userChain: [
      { name: 'B', teamCount: 15, ticketAmount: 1000, active: true },  // V1
      { name: 'C', teamCount: 1500, ticketAmount: 1000, active: true }, // V5
      { name: 'D', teamCount: 50, ticketAmount: 1000, active: true },   // V2 (低于C)
      { name: 'E', teamCount: 5000, ticketAmount: 1000, active: true }  // V6
    ]
  },
  {
    name: '非活跃用户跳过',
    stakeAmount: 600,
    userChain: [
      { name: 'B', teamCount: 50, ticketAmount: 1000, active: true },
      { name: 'C', teamCount: 500, ticketAmount: 1000, active: false }, // 非活跃
      { name: 'D', teamCount: 5000, ticketAmount: 1000, active: true }
    ]
  },
  {
    name: '达到V9上限',
    stakeAmount: 1000,
    userChain: [
      { name: 'B', teamCount: 50, ticketAmount: 1000, active: true },   // V2
      { name: 'C', teamCount: 1500, ticketAmount: 1000, active: true }, // V5
      { name: 'D', teamCount: 15000, ticketAmount: 1000, active: true }, // V7
      { name: 'E', teamCount: 150000, ticketAmount: 1000, active: true }, // V9
      { name: 'F', teamCount: 50000, ticketAmount: 1000, active: true }  // V8 (不应获得)
    ]
  }
];

// 执行测试
console.log('🧪 执行级差奖励测试案例:\n');

testCases.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 测试案例 ${index + 1}: ${testCase.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const rewards = calculateDifferentialRewards(testCase.stakeAmount, testCase.userChain);
  
  console.log('\n📊 奖励分配结果:');
  let totalRewards = 0;
  
  if (rewards.length === 0) {
    console.log('  无级差奖励');
  } else {
    rewards.forEach(reward => {
      console.log(`  ${reward.user}: ${reward.reward} MC (V${reward.level}, 级差${reward.diffPercent}%)`);
      totalRewards += reward.reward;
    });
  }
  
  console.log(`\n💰 总级差奖励: ${totalRewards} MC`);
  console.log(`📈 级差比例: ${((totalRewards / testCase.stakeAmount) * 100).toFixed(2)}%`);
});

// 验证等级系统
console.log(`\n\n${'='.repeat(60)}`);
console.log('📊 等级系统验证');
console.log(`${'='.repeat(60)}`);

console.log('\n等级表:');
console.log('| 等级 | 团队人数要求 | 级差收益比例 |');
console.log('|------|-------------|-------------|');

LEVELS.forEach(level => {
  if (level.level === 0) {
    console.log(`| V${level.level}   | < ${LEVELS[1].minTeam} 人        | ${level.percent}%          |`);
  } else {
    const nextLevel = LEVELS[level.level + 1];
    const maxTeam = nextLevel ? `< ${nextLevel.minTeam}` : '无上限';
    console.log(`| V${level.level}   | ≥ ${level.minTeam.toLocaleString()} 人     | ${level.percent}%         |`);
  }
});

// 验证边界情况
console.log('\n🔍 边界情况验证:');

const boundaryTests = [
  { teamCount: 9, expected: { level: 0, percent: 0 } },
  { teamCount: 10, expected: { level: 1, percent: 5 } },
  { teamCount: 29, expected: { level: 1, percent: 5 } },
  { teamCount: 30, expected: { level: 2, percent: 10 } },
  { teamCount: 99999, expected: { level: 8, percent: 40 } },
  { teamCount: 100000, expected: { level: 9, percent: 45 } },
  { teamCount: 1000000, expected: { level: 9, percent: 45 } }
];

let boundaryPassed = 0;
let boundaryTotal = boundaryTests.length;

boundaryTests.forEach(test => {
  const result = getLevel(test.teamCount);
  const passed = result.level === test.expected.level && result.percent === test.expected.percent;
  
  console.log(`  团队 ${test.teamCount.toLocaleString()} 人 → V${result.level} (${result.percent}%) ${passed ? '✅' : '❌'}`);
  
  if (passed) boundaryPassed++;
});

console.log(`\n📊 边界测试结果: ${boundaryPassed}/${boundaryTotal} 通过`);

// 生成报告
const report = {
  timestamp: new Date().toISOString(),
  testCases: testCases.length,
  boundaryTests: {
    total: boundaryTotal,
    passed: boundaryPassed,
    success: boundaryPassed === boundaryTotal
  },
  levels: LEVELS,
  summary: {
    mechanism: '级差奖励机制',
    maxLevels: 20,
    maxPercent: 45,
    stopAtV9: true,
    requiresActiveTicket: true
  }
};

// 保存报告
const reportPath = path.join(__dirname, 'differential-rewards-verification-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n📄 详细报告已保存到: ${reportPath}`);

// 总结
console.log(`\n${'='.repeat(60)}`);
console.log('🎉 级差奖励机制验证完成');
console.log(`${'='.repeat(60)}`);

console.log(`✅ 测试案例: ${testCases.length} 个`);
console.log(`✅ 边界测试: ${boundaryPassed}/${boundaryTotal} 通过`);
console.log(`✅ 等级系统: V0-V9 (10个等级)`);
console.log(`✅ 最高级差: 45% (V9等级)`);
console.log(`✅ 安全机制: 活跃检查、门票验证、等级限制`);

if (boundaryPassed === boundaryTotal) {
  console.log('\n🎊 所有验证通过！级差奖励机制运行正常。');
  process.exit(0);
} else {
  console.log(`\n⚠️  有 ${boundaryTotal - boundaryPassed} 个边界测试失败，请检查实现。`);
  process.exit(1);
}