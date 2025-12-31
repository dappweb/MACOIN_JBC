#!/usr/bin/env node

/**
 * Test vs P-prod 合约属性对比脚本
 * 对比测试环境和生产环境的合约配置差异
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
    jbcAddress: '0x1Bf9ACe2485BC3391150762a109886d0B85f40Da',
    expectedSecondsInUnit: 60, // 测试环境使用分钟
    description: '测试环境 (分钟单位)'
  },
  'p-prod': {
    name: 'P-prod Environment',
    rpcUrl: 'https://chain.mcerscan.com/',
    protocolAddress: '0x515871E9eADbF976b546113BbD48964383f86E61',
    jbcAddress: '0xA743cB357a9f59D349efB7985072779a094658dD',
    expectedSecondsInUnit: 86400, // 生产环境使用天数
    description: '生产环境 (天数单位)'
  }
};

// 完整的协议合约ABI
const PROTOCOL_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function directRewardPercent() view returns (uint256)",
  "function levelRewardPercent() view returns (uint256)",
  "function marketingPercent() view returns (uint256)",
  "function buybackPercent() view returns (uint256)",
  "function lpInjectionPercent() view returns (uint256)",
  "function treasuryPercent() view returns (uint256)",
  "function redemptionFeePercent() view returns (uint256)",
  "function swapBuyTax() view returns (uint256)",
  "function swapSellTax() view returns (uint256)",
  "function ticketFlexibilityDuration() view returns (uint256)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)",
  "function nextTicketId() view returns (uint256)",
  "function nextStakeId() view returns (uint256)",
  "function swapReserveMC() view returns (uint256)",
  "function swapReserveJBC() view returns (uint256)",
  "function levelRewardPool() view returns (uint256)",
  "function marketingWallet() view returns (address)",
  "function treasuryWallet() view returns (address)",
  "function lpInjectionWallet() view returns (address)",
  "function buybackWallet() view returns (address)",
  "function jbcToken() view returns (address)"
];

// JBC代币ABI
const JBC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)"
];

class ContractEnvironmentComparator {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(ENVIRONMENTS.test.rpcUrl);
    this.results = {};
  }

  async compareEnvironments() {
    console.log('🔍 开始对比 Test vs P-prod 环境合约属性...');
    console.log('=' .repeat(80));

    // 收集两个环境的数据
    for (const [envName, config] of Object.entries(ENVIRONMENTS)) {
      console.log(`\n📊 收集 ${config.name} 数据...`);
      this.results[envName] = await this.collectEnvironmentData(config);
    }

    // 生成对比报告
    console.log('\n📋 生成对比报告...');
    this.generateComparisonReport();
  }

  async collectEnvironmentData(config) {
    const data = {
      environment: config.name,
      config,
      protocol: {},
      jbc: {},
      errors: []
    };

    try {
      // 创建合约实例
      const protocolContract = new ethers.Contract(config.protocolAddress, PROTOCOL_ABI, this.provider);
      const jbcContract = new ethers.Contract(config.jbcAddress, JBC_ABI, this.provider);

      // 收集协议合约数据
      data.protocol = await this.collectProtocolData(protocolContract, config);
      
      // 收集JBC代币数据
      data.jbc = await this.collectJBCData(jbcContract);

      // 验证环境配置
      data.validation = this.validateEnvironmentConfig(data, config);

    } catch (error) {
      data.errors.push(`环境数据收集失败: ${error.message}`);
    }

    return data;
  }

  async collectProtocolData(contract, config) {
    const data = {};
    
    // 基础配置
    const basicFields = [
      'owner', 'paused', 'emergencyPaused', 'SECONDS_IN_UNIT',
      'liquidityEnabled', 'redeemEnabled'
    ];

    // 百分比配置
    const percentFields = [
      'directRewardPercent', 'levelRewardPercent', 'marketingPercent',
      'buybackPercent', 'lpInjectionPercent', 'treasuryPercent',
      'redemptionFeePercent', 'swapBuyTax', 'swapSellTax'
    ];

    // 数值配置
    const numericFields = [
      'ticketFlexibilityDuration', 'nextTicketId', 'nextStakeId',
      'swapReserveMC', 'swapReserveJBC', 'levelRewardPool'
    ];

    // 地址配置
    const addressFields = [
      'marketingWallet', 'treasuryWallet', 'lpInjectionWallet',
      'buybackWallet', 'jbcToken'
    ];

    // 收集所有字段
    const allFields = [...basicFields, ...percentFields, ...numericFields, ...addressFields];

    for (const field of allFields) {
      try {
        const value = await contract[field]();
        
        if (percentFields.includes(field) || numericFields.includes(field)) {
          data[field] = {
            raw: value.toString(),
            formatted: this.formatValue(field, value)
          };
        } else {
          data[field] = value;
        }
      } catch (error) {
        data[field] = { error: error.message };
      }
    }

    return data;
  }

  async collectJBCData(contract) {
    const data = {};
    const fields = ['name', 'symbol', 'decimals', 'totalSupply', 'owner'];

    for (const field of fields) {
      try {
        const value = await contract[field]();
        if (field === 'totalSupply') {
          data[field] = {
            raw: value.toString(),
            formatted: ethers.formatEther(value) + ' JBC'
          };
        } else {
          data[field] = value;
        }
      } catch (error) {
        data[field] = { error: error.message };
      }
    }

    return data;
  }

  validateEnvironmentConfig(data, config) {
    const validation = {
      isValid: true,
      issues: [],
      warnings: []
    };

    // 验证SECONDS_IN_UNIT
    if (data.protocol.SECONDS_IN_UNIT) {
      const actualValue = Number(data.protocol.SECONDS_IN_UNIT);
      if (actualValue !== config.expectedSecondsInUnit) {
        validation.issues.push({
          field: 'SECONDS_IN_UNIT',
          expected: config.expectedSecondsInUnit,
          actual: actualValue,
          description: `时间单位不匹配，期望 ${config.expectedSecondsInUnit}，实际 ${actualValue}`
        });
        validation.isValid = false;
      }
    }

    // 验证JBC代币地址
    if (data.protocol.jbcToken && data.protocol.jbcToken !== config.jbcAddress) {
      validation.issues.push({
        field: 'jbcToken',
        expected: config.jbcAddress,
        actual: data.protocol.jbcToken,
        description: 'JBC代币地址不匹配'
      });
      validation.isValid = false;
    }

    // 检查合约状态
    if (data.protocol.paused === true) {
      validation.warnings.push({
        field: 'paused',
        description: '合约处于暂停状态'
      });
    }

    if (data.protocol.emergencyPaused === true) {
      validation.warnings.push({
        field: 'emergencyPaused',
        description: '合约处于紧急暂停状态'
      });
    }

    return validation;
  }

  formatValue(field, value) {
    const numValue = Number(value);
    
    if (field.includes('Percent') || field.includes('Tax')) {
      return `${numValue}%`;
    }
    
    if (field === 'ticketFlexibilityDuration') {
      const hours = numValue / 3600;
      return `${numValue}s (${hours}小时)`;
    }
    
    if (field.includes('Reserve') || field.includes('Pool')) {
      return `${ethers.formatEther(value)} MC`;
    }
    
    return numValue.toString();
  }

  generateComparisonReport() {
    console.log('\n📊 Test vs P-prod 环境对比报告');
    console.log('=' .repeat(80));

    const testData = this.results.test;
    const prodData = this.results['p-prod'];

    // 基础信息对比
    console.log('\n🏗️ 基础配置对比:');
    this.compareBasicConfig(testData, prodData);

    // 百分比配置对比
    console.log('\n💰 奖励分配对比:');
    this.compareRewardConfig(testData, prodData);

    // 钱包地址对比
    console.log('\n👛 钱包地址对比:');
    this.compareWalletConfig(testData, prodData);

    // JBC代币对比
    console.log('\n🪙 JBC代币对比:');
    this.compareJBCConfig(testData, prodData);

    // 状态和数值对比
    console.log('\n📈 状态和数值对比:');
    this.compareStateConfig(testData, prodData);

    // 验证结果
    console.log('\n✅ 环境验证结果:');
    this.compareValidation(testData, prodData);

    // 生成总结
    console.log('\n🎯 对比总结:');
    this.generateSummary(testData, prodData);
  }

  compareBasicConfig(testData, prodData) {
    const basicFields = ['owner', 'paused', 'emergencyPaused', 'SECONDS_IN_UNIT'];
    
    basicFields.forEach(field => {
      const testValue = testData.protocol[field];
      const prodValue = prodData.protocol[field];
      
      console.log(`  ${field}:`);
      console.log(`    Test: ${this.formatDisplayValue(testValue)}`);
      console.log(`    P-prod: ${this.formatDisplayValue(prodValue)}`);
      
      if (this.valuesEqual(testValue, prodValue)) {
        console.log(`    状态: ✅ 相同`);
      } else {
        console.log(`    状态: ⚠️ 不同`);
      }
      console.log('');
    });
  }

  compareRewardConfig(testData, prodData) {
    const rewardFields = [
      'directRewardPercent', 'levelRewardPercent', 'marketingPercent',
      'buybackPercent', 'lpInjectionPercent', 'treasuryPercent',
      'redemptionFeePercent', 'swapBuyTax', 'swapSellTax'
    ];
    
    rewardFields.forEach(field => {
      const testValue = testData.protocol[field];
      const prodValue = prodData.protocol[field];
      
      console.log(`  ${field}:`);
      console.log(`    Test: ${this.formatDisplayValue(testValue)}`);
      console.log(`    P-prod: ${this.formatDisplayValue(prodValue)}`);
      
      if (this.valuesEqual(testValue, prodValue)) {
        console.log(`    状态: ✅ 相同`);
      } else {
        console.log(`    状态: ⚠️ 不同`);
      }
      console.log('');
    });
  }

  compareWalletConfig(testData, prodData) {
    const walletFields = ['marketingWallet', 'treasuryWallet', 'lpInjectionWallet', 'buybackWallet'];
    
    walletFields.forEach(field => {
      const testValue = testData.protocol[field];
      const prodValue = prodData.protocol[field];
      
      console.log(`  ${field}:`);
      console.log(`    Test: ${this.formatDisplayValue(testValue)}`);
      console.log(`    P-prod: ${this.formatDisplayValue(prodValue)}`);
      
      if (this.valuesEqual(testValue, prodValue)) {
        console.log(`    状态: ✅ 相同`);
      } else {
        console.log(`    状态: ⚠️ 不同`);
      }
      console.log('');
    });
  }

  compareJBCConfig(testData, prodData) {
    const jbcFields = ['name', 'symbol', 'decimals', 'totalSupply', 'owner'];
    
    jbcFields.forEach(field => {
      const testValue = testData.jbc[field];
      const prodValue = prodData.jbc[field];
      
      console.log(`  ${field}:`);
      console.log(`    Test: ${this.formatDisplayValue(testValue)}`);
      console.log(`    P-prod: ${this.formatDisplayValue(prodValue)}`);
      
      if (this.valuesEqual(testValue, prodValue)) {
        console.log(`    状态: ✅ 相同`);
      } else {
        console.log(`    状态: ⚠️ 不同`);
      }
      console.log('');
    });
  }

  compareStateConfig(testData, prodData) {
    const stateFields = [
      'liquidityEnabled', 'redeemEnabled', 'ticketFlexibilityDuration',
      'nextTicketId', 'nextStakeId', 'swapReserveMC', 'swapReserveJBC', 'levelRewardPool'
    ];
    
    stateFields.forEach(field => {
      const testValue = testData.protocol[field];
      const prodValue = prodData.protocol[field];
      
      console.log(`  ${field}:`);
      console.log(`    Test: ${this.formatDisplayValue(testValue)}`);
      console.log(`    P-prod: ${this.formatDisplayValue(prodValue)}`);
      
      if (this.valuesEqual(testValue, prodValue)) {
        console.log(`    状态: ✅ 相同`);
      } else {
        console.log(`    状态: ⚠️ 不同`);
      }
      console.log('');
    });
  }

  compareValidation(testData, prodData) {
    console.log(`  Test环境验证:`);
    console.log(`    有效性: ${testData.validation?.isValid ? '✅ 有效' : '❌ 无效'}`);
    if (testData.validation?.issues?.length > 0) {
      console.log(`    问题: ${testData.validation.issues.length} 个`);
      testData.validation.issues.forEach(issue => {
        console.log(`      - ${issue.description}`);
      });
    }
    if (testData.validation?.warnings?.length > 0) {
      console.log(`    警告: ${testData.validation.warnings.length} 个`);
      testData.validation.warnings.forEach(warning => {
        console.log(`      - ${warning.description}`);
      });
    }

    console.log(`\n  P-prod环境验证:`);
    console.log(`    有效性: ${prodData.validation?.isValid ? '✅ 有效' : '❌ 无效'}`);
    if (prodData.validation?.issues?.length > 0) {
      console.log(`    问题: ${prodData.validation.issues.length} 个`);
      prodData.validation.issues.forEach(issue => {
        console.log(`      - ${issue.description}`);
      });
    }
    if (prodData.validation?.warnings?.length > 0) {
      console.log(`    警告: ${prodData.validation.warnings.length} 个`);
      prodData.validation.warnings.forEach(warning => {
        console.log(`      - ${warning.description}`);
      });
    }
  }

  generateSummary(testData, prodData) {
    const differences = [];
    const similarities = [];
    
    // 分析所有字段的差异
    const allFields = new Set([
      ...Object.keys(testData.protocol),
      ...Object.keys(prodData.protocol)
    ]);

    allFields.forEach(field => {
      const testValue = testData.protocol[field];
      const prodValue = prodData.protocol[field];
      
      if (this.valuesEqual(testValue, prodValue)) {
        similarities.push(field);
      } else {
        differences.push(field);
      }
    });

    console.log(`  📊 统计信息:`);
    console.log(`    相同配置: ${similarities.length} 项`);
    console.log(`    不同配置: ${differences.length} 项`);
    console.log(`    配置一致性: ${((similarities.length / (similarities.length + differences.length)) * 100).toFixed(1)}%`);

    if (differences.length > 0) {
      console.log(`\n  ⚠️ 主要差异:`);
      differences.slice(0, 5).forEach(field => {
        console.log(`    - ${field}`);
      });
    }

    console.log(`\n  🎯 环境状态:`);
    console.log(`    Test环境: ${testData.validation?.isValid ? '✅ 正常' : '❌ 异常'}`);
    console.log(`    P-prod环境: ${prodData.validation?.isValid ? '✅ 正常' : '❌ 异常'}`);
    
    // 关键差异提醒
    const criticalDifferences = differences.filter(field => 
      field === 'SECONDS_IN_UNIT' || field === 'owner' || field.includes('Percent')
    );
    
    if (criticalDifferences.length > 0) {
      console.log(`\n  🚨 关键差异 (${criticalDifferences.length} 项):`);
      criticalDifferences.forEach(field => {
        console.log(`    - ${field}: 需要注意环境差异`);
      });
    }
  }

  formatDisplayValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'object' && value.error) {
      return `❌ ${value.error}`;
    }
    
    if (typeof value === 'object' && value.formatted) {
      return value.formatted;
    }
    
    if (typeof value === 'boolean') {
      return value ? '✅ true' : '❌ false';
    }
    
    if (typeof value === 'string' && value.startsWith('0x')) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }
    
    return value.toString();
  }

  valuesEqual(val1, val2) {
    if (val1 === val2) return true;
    
    // 处理对象类型
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      if (val1?.raw && val2?.raw) {
        return val1.raw === val2.raw;
      }
      if (val1?.error && val2?.error) {
        return true; // 都有错误认为相同
      }
      return false;
    }
    
    return false;
  }
}

// 主执行函数
async function main() {
  const comparator = new ContractEnvironmentComparator();
  
  try {
    await comparator.compareEnvironments();
  } catch (error) {
    console.error('❌ 环境对比失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('contract-environment-comparison.js')) {
  main().catch(console.error);
}

export { ContractEnvironmentComparator };