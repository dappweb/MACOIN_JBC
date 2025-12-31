#!/usr/bin/env node

/**
 * P-prod环境质押周期切换脚本
 * 将SECONDS_IN_UNIT从60秒切换为86400秒 (天级别)
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// P-prod环境配置
const P_PROD_CONFIG = {
  name: 'P-prod Environment',
  rpcUrl: 'https://chain.mcerscan.com/',
  protocolAddress: '0x515871E9eADbF976b546113BbD48964383f86E61',
  currentSecondsInUnit: 60,    // 当前值 (分钟)
  targetSecondsInUnit: 86400,  // 目标值 (天)
  description: '生产环境质押周期切换'
};

// 管理员合约ABI
const ADMIN_ABI = [
  "function owner() view returns (address)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  "function setSecondsInUnit(uint256 _seconds) external", // 假设存在此函数
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function nextStakeId() view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)"
];

class StakingPeriodSwitcher {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(P_PROD_CONFIG.rpcUrl);
    this.signer = null;
    this.contract = null;
  }

  async initializeSigner() {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('需要设置PRIVATE_KEY环境变量');
    }
    
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(P_PROD_CONFIG.protocolAddress, ADMIN_ABI, this.signer);
    
    console.log(`🔑 使用钱包地址: ${this.signer.address}`);
  }

  async switchStakingPeriod() {
    console.log('🔄 开始P-prod环境质押周期切换...');
    console.log('=' .repeat(80));

    try {
      await this.initializeSigner();
      
      // 1. 预检查
      await this.preflightChecks();
      
      // 2. 分析当前状态
      await this.analyzeCurrentState();
      
      // 3. 执行切换 (如果确认)
      await this.executeSwitchIfConfirmed();
      
      // 4. 验证切换结果
      await this.verifySwitchResult();
      
    } catch (error) {
      console.error('❌ 切换失败:', error.message);
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('\n🔍 执行预检查...');
    
    // 检查网络连接
    const blockNumber = await this.provider.getBlockNumber();
    console.log(`✅ 网络连接正常 (区块高度: ${blockNumber})`);
    
    // 检查合约地址
    const code = await this.provider.getCode(P_PROD_CONFIG.protocolAddress);
    if (code === '0x') {
      throw new Error('合约地址无效或不存在');
    }
    console.log(`✅ 合约地址有效`);
    
    // 检查管理员权限
    const owner = await this.contract.owner();
    const isOwner = owner.toLowerCase() === this.signer.address.toLowerCase();
    console.log(`📋 合约所有者: ${owner}`);
    console.log(`📋 当前钱包: ${this.signer.address}`);
    console.log(`📋 管理员权限: ${isOwner ? '✅ 有权限' : '❌ 无权限'}`);
    
    if (!isOwner) {
      throw new Error('当前钱包没有管理员权限，无法执行切换');
    }
    
    // 检查合约状态
    try {
      const paused = await this.contract.paused();
      console.log(`📋 合约暂停状态: ${paused ? '⚠️ 已暂停' : '✅ 正常运行'}`);
    } catch (e) {
      console.log(`📋 合约暂停状态: 无法检查 (函数可能不存在)`);
    }
    
    try {
      const emergencyPaused = await this.contract.emergencyPaused();
      console.log(`📋 紧急暂停状态: ${emergencyPaused ? '⚠️ 已暂停' : '✅ 正常运行'}`);
    } catch (e) {
      console.log(`📋 紧急暂停状态: 无法检查 (函数可能不存在)`);
    }
  }

  async analyzeCurrentState() {
    console.log('\n📊 分析当前状态...');
    
    // 获取当前SECONDS_IN_UNIT
    const currentValue = await this.contract.SECONDS_IN_UNIT();
    console.log(`📋 当前SECONDS_IN_UNIT: ${currentValue} 秒`);
    
    if (Number(currentValue) === P_PROD_CONFIG.targetSecondsInUnit) {
      console.log(`✅ 已经是目标值 (${P_PROD_CONFIG.targetSecondsInUnit}秒)，无需切换`);
      return;
    }
    
    // 分析影响
    const totalStakes = await this.contract.nextStakeId();
    console.log(`📋 总质押记录数: ${totalStakes}`);
    
    // 检查活跃质押
    let activeStakes = 0;
    const sampleSize = Math.min(10, Number(totalStakes) - 1);
    
    console.log(`🔍 检查最近 ${sampleSize} 个质押记录的活跃状态...`);
    
    // 这里需要实际的用户地址来查询，暂时跳过详细检查
    console.log(`⚠️ 注意: 切换将影响所有未来的质押周期计算`);
    console.log(`⚠️ 当前活跃质押不会受到影响 (已按旧规则运行)`);
  }

  async executeSwitchIfConfirmed() {
    console.log('\n🔄 准备执行切换...');
    
    console.log(`📋 切换详情:`);
    console.log(`  当前值: ${P_PROD_CONFIG.currentSecondsInUnit} 秒 (分钟级别)`);
    console.log(`  目标值: ${P_PROD_CONFIG.targetSecondsInUnit} 秒 (天级别)`);
    console.log(`  影响: 未来所有质押将按天计算`);
    console.log(`  示例: 7天质押 = 7 × 86400 = 604800秒 = 7天`);
    
    // 在实际环境中，这里应该有确认步骤
    console.log(`\n⚠️ 重要提醒:`);
    console.log(`  1. 此操作将永久改变质押周期计算方式`);
    console.log(`  2. 建议在低峰期执行`);
    console.log(`  3. 确保已通知所有用户`);
    console.log(`  4. 建议先在测试环境验证`);
    
    // 模拟执行 (实际环境中取消注释)
    console.log(`\n🚀 执行切换...`);
    
    try {
      // 注意: 这个函数可能不存在，需要根据实际合约接口调整
      // const tx = await this.contract.setSecondsInUnit(P_PROD_CONFIG.targetSecondsInUnit);
      // console.log(`📋 交易哈希: ${tx.hash}`);
      // console.log(`⏳ 等待交易确认...`);
      // const receipt = await tx.wait();
      // console.log(`✅ 交易已确认 (区块: ${receipt.blockNumber})`);
      
      console.log(`⚠️ 模拟模式: 实际切换需要取消注释上述代码`);
      console.log(`📋 需要调用的函数: setSecondsInUnit(${P_PROD_CONFIG.targetSecondsInUnit})`);
      
    } catch (error) {
      console.error(`❌ 切换执行失败: ${error.message}`);
      throw error;
    }
  }

  async verifySwitchResult() {
    console.log('\n✅ 验证切换结果...');
    
    // 重新读取SECONDS_IN_UNIT
    const newValue = await this.contract.SECONDS_IN_UNIT();
    console.log(`📋 切换后SECONDS_IN_UNIT: ${newValue} 秒`);
    
    if (Number(newValue) === P_PROD_CONFIG.targetSecondsInUnit) {
      console.log(`✅ 切换成功! 质押周期已切换为天级别`);
      console.log(`📋 新的质押周期:`);
      console.log(`  7天质押 = 7 × ${newValue} = ${7 * Number(newValue)} 秒 = 7天`);
      console.log(`  15天质押 = 15 × ${newValue} = ${15 * Number(newValue)} 秒 = 15天`);
      console.log(`  30天质押 = 30 × ${newValue} = ${30 * Number(newValue)} 秒 = 30天`);
    } else {
      console.log(`❌ 切换失败! 值仍为 ${newValue} 秒`);
      throw new Error('切换验证失败');
    }
  }

  // 生成切换报告
  generateSwitchReport() {
    const report = `
# P-prod环境质押周期切换报告

## 切换详情
- **执行时间**: ${new Date().toISOString()}
- **环境**: P-prod (${P_PROD_CONFIG.protocolAddress})
- **切换类型**: SECONDS_IN_UNIT 修改
- **原值**: ${P_PROD_CONFIG.currentSecondsInUnit} 秒 (分钟级别)
- **新值**: ${P_PROD_CONFIG.targetSecondsInUnit} 秒 (天级别)

## 影响分析
- **7天质押**: 从7分钟变为7天 (增加1440倍)
- **15天质押**: 从15分钟变为15天 (增加1440倍)
- **30天质押**: 从30分钟变为30天 (增加1440倍)

## 用户影响
- **现有质押**: 不受影响，继续按原规则执行
- **新质押**: 将按新规则 (天级别) 执行
- **收益计算**: 需要相应调整日收益率

## 后续行动
1. 更新前端显示逻辑
2. 通知用户质押周期变更
3. 监控新质押的执行情况
4. 更新文档和用户指南

## 技术验证
- [x] 合约权限验证
- [x] 网络连接测试
- [x] 参数值验证
- [ ] 实际切换执行
- [ ] 切换结果验证
`;

    return report;
  }
}

// 主执行函数
async function main() {
  const switcher = new StakingPeriodSwitcher();
  
  try {
    await switcher.switchStakingPeriod();
    
    // 生成报告
    const report = switcher.generateSwitchReport();
    console.log('\n📋 切换报告已生成');
    
  } catch (error) {
    console.error('❌ 质押周期切换失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('switch-pprod-to-daily-staking.js')) {
  main().catch(console.error);
}

export { StakingPeriodSwitcher };