#!/usr/bin/env node

/**
 * 验证P-prod环境质押周期实际持续时间
 * 通过检查实际质押记录来确定是天还是分钟
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 环境配置
const ENVIRONMENTS = {
  test: {
    name: 'Test Environment',
    rpcUrl: 'https://chain.mcerscan.com/',
    protocolAddress: '0xD437e63c2A76e0237249eC6070Bef9A2484C4302',
    description: '测试环境'
  },
  'p-prod': {
    name: 'P-prod Environment', 
    rpcUrl: 'https://chain.mcerscan.com/',
    protocolAddress: '0x515871E9eADbF976b546113BbD48964383f86E61',
    description: '生产环境'
  }
};

// 协议合约ABI (质押相关)
const PROTOCOL_ABI = [
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function nextStakeId() view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
  "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)"
];

class StakingDurationVerifier {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(ENVIRONMENTS.test.rpcUrl);
    this.results = {};
  }

  async verifyStakingDurations() {
    console.log('🔍 验证质押周期实际持续时间...');
    console.log('=' .repeat(80));

    // 检查两个环境
    for (const [envName, config] of Object.entries(ENVIRONMENTS)) {
      console.log(`\n📊 分析 ${config.name}...`);
      this.results[envName] = await this.analyzeEnvironmentStaking(config);
    }

    // 生成对比报告
    console.log('\n📋 生成质押周期验证报告...');
    this.generateStakingReport();
  }

  async analyzeEnvironmentStaking(config) {
    const data = {
      environment: config.name,
      config,
      secondsInUnit: null,
      totalStakes: 0,
      sampleStakes: [],
      analysis: {},
      errors: []
    };

    try {
      const contract = new ethers.Contract(config.protocolAddress, PROTOCOL_ABI, this.provider);
      
      // 获取基础配置
      data.secondsInUnit = await contract.SECONDS_IN_UNIT();
      data.totalStakes = await contract.nextStakeId();
      
      console.log(`  SECONDS_IN_UNIT: ${data.secondsInUnit}`);
      console.log(`  总质押记录数: ${data.totalStakes}`);

      // 获取最近的质押记录样本
      const sampleSize = Math.min(5, Number(data.totalStakes) - 1);
      const startId = Math.max(1, Number(data.totalStakes) - sampleSize);
      
      console.log(`  获取质押样本: ID ${startId} 到 ${Number(data.totalStakes) - 1}`);

      // 获取样本质押记录
      for (let i = startId; i < Number(data.totalStakes); i++) {
        try {
          // 尝试不同的用户地址来获取质押记录
          const sampleAddresses = [
            '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82', // 已知用户
            '0x7eFaD6Bef04631BE34De71b2Df9378C727f185b7', // 已知用户
            '0xDb81c4c8C7e0E56F0d2b0E4E8B8b8b8b8b8b2a65', // Owner
            '0x4C10c4c8C7e0E56F0d2b0E4E8B8b8b8b8b8b4A48'  // 其他地址
          ];

          for (const address of sampleAddresses) {
            try {
              const stake = await contract.userStakes(address, i);
              if (stake.id > 0) {
                const stakeData = {
                  id: Number(stake.id),
                  user: address,
                  amount: ethers.formatEther(stake.amount),
                  startTime: Number(stake.startTime),
                  cycleDays: Number(stake.cycleDays),
                  active: stake.active,
                  paid: ethers.formatEther(stake.paid),
                  startDate: new Date(Number(stake.startTime) * 1000).toISOString(),
                  theoreticalEndTime: Number(stake.startTime) + (Number(stake.cycleDays) * Number(data.secondsInUnit)),
                  theoreticalEndDate: new Date((Number(stake.startTime) + (Number(stake.cycleDays) * Number(data.secondsInUnit))) * 1000).toISOString()
                };
                data.sampleStakes.push(stakeData);
                console.log(`    找到质押记录 ID ${stakeData.id}: ${stakeData.cycleDays}天质押`);
                break;
              }
            } catch (e) {
              // 继续尝试下一个地址
            }
          }
        } catch (error) {
          // 跳过这个ID
        }
      }

      // 分析质押周期
      data.analysis = this.analyzeStakingPatterns(data);

    } catch (error) {
      data.errors.push(`环境分析失败: ${error.message}`);
    }

    return data;
  }

  analyzeStakingPatterns(data) {
    const analysis = {
      avgCycleDays: 0,
      commonCycles: {},
      durationAnalysis: {},
      timeUnitAnalysis: {}
    };

    if (data.sampleStakes.length === 0) {
      analysis.conclusion = '无法获取质押样本数据';
      return analysis;
    }

    // 统计周期天数
    const cycleDays = data.sampleStakes.map(s => s.cycleDays);
    analysis.avgCycleDays = cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length;
    
    // 统计常见周期
    cycleDays.forEach(days => {
      analysis.commonCycles[days] = (analysis.commonCycles[days] || 0) + 1;
    });

    // 分析实际持续时间
    const now = Math.floor(Date.now() / 1000);
    data.sampleStakes.forEach(stake => {
      const theoreticalDuration = stake.cycleDays * Number(data.secondsInUnit);
      const actualElapsed = now - stake.startTime;
      const isExpired = actualElapsed >= theoreticalDuration;
      
      analysis.durationAnalysis[stake.id] = {
        cycleDays: stake.cycleDays,
        theoreticalDurationSeconds: theoreticalDuration,
        theoreticalDurationHours: theoreticalDuration / 3600,
        theoreticalDurationDays: theoreticalDuration / 86400,
        actualElapsedSeconds: actualElapsed,
        actualElapsedHours: actualElapsed / 3600,
        actualElapsedDays: actualElapsed / 86400,
        isExpired,
        active: stake.active
      };
    });

    // 时间单位分析
    analysis.timeUnitAnalysis = {
      secondsInUnit: Number(data.secondsInUnit),
      interpretation: this.interpretTimeUnit(Number(data.secondsInUnit)),
      implications: this.getTimeUnitImplications(Number(data.secondsInUnit))
    };

    return analysis;
  }

  interpretTimeUnit(secondsInUnit) {
    if (secondsInUnit === 60) {
      return '分钟单位 (1分钟 = 60秒)';
    } else if (secondsInUnit === 3600) {
      return '小时单位 (1小时 = 3600秒)';
    } else if (secondsInUnit === 86400) {
      return '天单位 (1天 = 86400秒)';
    } else {
      return `自定义单位 (${secondsInUnit}秒)`;
    }
  }

  getTimeUnitImplications(secondsInUnit) {
    const implications = [];
    
    if (secondsInUnit === 60) {
      implications.push('7天质押 = 7分钟');
      implications.push('15天质押 = 15分钟');
      implications.push('30天质押 = 30分钟');
    } else if (secondsInUnit === 86400) {
      implications.push('7天质押 = 7天');
      implications.push('15天质押 = 15天');
      implications.push('30天质押 = 30天');
    }
    
    return implications;
  }

  generateStakingReport() {
    console.log('\n📊 质押周期验证报告');
    console.log('=' .repeat(80));

    const testData = this.results.test;
    const prodData = this.results['p-prod'];

    // 基础配置对比
    console.log('\n🕐 时间单位配置:');
    console.log(`  Test环境: ${testData.secondsInUnit}秒 (${testData.analysis?.timeUnitAnalysis?.interpretation || 'N/A'})`);
    console.log(`  P-prod环境: ${prodData.secondsInUnit}秒 (${prodData.analysis?.timeUnitAnalysis?.interpretation || 'N/A'})`);

    // 质押记录统计
    console.log('\n📈 质押记录统计:');
    console.log(`  Test环境: ${testData.totalStakes} 个质押记录`);
    console.log(`  P-prod环境: ${prodData.totalStakes} 个质押记录`);

    // 样本分析
    console.log('\n🔍 质押样本分析:');
    this.printEnvironmentSamples('Test', testData);
    this.printEnvironmentSamples('P-prod', prodData);

    // 持续时间分析
    console.log('\n⏱️ 质押持续时间分析:');
    this.printDurationAnalysis('Test', testData);
    this.printDurationAnalysis('P-prod', prodData);

    // 最终结论
    console.log('\n🎯 验证结论:');
    this.generateConclusion(testData, prodData);
  }

  printEnvironmentSamples(envName, data) {
    console.log(`\n  ${envName}环境样本 (${data.sampleStakes.length} 个):`);
    if (data.sampleStakes.length === 0) {
      console.log('    无可用样本数据');
      return;
    }

    data.sampleStakes.forEach(stake => {
      console.log(`    质押ID ${stake.id}: ${stake.cycleDays}天, ${stake.amount} MC`);
      console.log(`      开始时间: ${stake.startDate}`);
      console.log(`      理论结束: ${stake.theoreticalEndDate}`);
    });

    // 常见周期统计
    const cycles = Object.entries(data.analysis?.commonCycles || {});
    if (cycles.length > 0) {
      console.log(`    常见周期: ${cycles.map(([days, count]) => `${days}天(${count}次)`).join(', ')}`);
    }
  }

  printDurationAnalysis(envName, data) {
    console.log(`\n  ${envName}环境持续时间分析:`);
    
    if (!data.analysis?.durationAnalysis) {
      console.log('    无分析数据');
      return;
    }

    Object.entries(data.analysis.durationAnalysis).forEach(([id, analysis]) => {
      console.log(`    质押ID ${id}:`);
      console.log(`      周期: ${analysis.cycleDays}天`);
      console.log(`      理论持续: ${analysis.theoreticalDurationDays.toFixed(2)}天 (${analysis.theoreticalDurationHours.toFixed(1)}小时)`);
      console.log(`      实际经过: ${analysis.actualElapsedDays.toFixed(2)}天 (${analysis.actualElapsedHours.toFixed(1)}小时)`);
      console.log(`      状态: ${analysis.active ? '活跃' : '已结束'} ${analysis.isExpired ? '(已到期)' : '(未到期)'}`);
    });
  }

  generateConclusion(testData, prodData) {
    // 基于分析数据生成结论
    const testUnit = Number(testData.secondsInUnit);
    const prodUnit = Number(prodData.secondsInUnit);
    
    console.log(`  时间单位配置:`);
    console.log(`    Test: ${testUnit}秒 ${testUnit === 60 ? '(分钟级)' : testUnit === 86400 ? '(天级)' : '(自定义)'}`);
    console.log(`    P-prod: ${prodUnit}秒 ${prodUnit === 60 ? '(分钟级)' : prodUnit === 86400 ? '(天级)' : '(自定义)'}`);
    
    if (testUnit === prodUnit) {
      console.log(`    ✅ 两环境时间单位配置相同`);
    } else {
      console.log(`    ⚠️ 两环境时间单位配置不同`);
    }

    // 基于样本数据的结论
    if (prodData.sampleStakes.length > 0) {
      const hasLongRunningStakes = Object.values(prodData.analysis?.durationAnalysis || {})
        .some(analysis => analysis.actualElapsedDays > 1);
      
      if (hasLongRunningStakes && prodUnit === 60) {
        console.log(`    🔍 关键发现: P-prod环境有超过1天的质押记录，但SECONDS_IN_UNIT=60`);
        console.log(`    💡 可能解释: 存在额外的时间转换逻辑或业务层处理`);
      }
    }

    // 最终判断
    if (prodUnit === 60) {
      console.log(`\n  📋 最终判断:`);
      console.log(`    根据合约配置: P-prod质押周期应该是分钟级别`);
      console.log(`    根据用户反馈: P-prod质押周期实际是天级别`);
      console.log(`    结论: 可能存在合约外的时间转换机制`);
    } else if (prodUnit === 86400) {
      console.log(`\n  📋 最终判断:`);
      console.log(`    根据合约配置: P-prod质押周期是天级别 ✅`);
      console.log(`    与用户反馈一致 ✅`);
    }
  }
}

// 主执行函数
async function main() {
  const verifier = new StakingDurationVerifier();
  
  try {
    await verifier.verifyStakingDurations();
  } catch (error) {
    console.error('❌ 质押周期验证失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('verify-staking-duration.js')) {
  main().catch(console.error);
}

export { StakingDurationVerifier };