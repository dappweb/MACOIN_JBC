#!/usr/bin/env node

/**
 * 检查P-prod合约的管理功能
 * 确认是否支持SECONDS_IN_UNIT修改
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// P-prod环境配置
const P_PROD_CONFIG = {
  name: 'P-prod Environment',
  rpcUrl: 'https://chain.mcerscan.com/',
  protocolAddress: '0x515871E9eADbF976b546113BbD48964383f86E61'
};

// 可能的管理员函数ABI
const ADMIN_FUNCTIONS_ABI = [
  // 基础查询函数
  "function owner() view returns (address)",
  "function SECONDS_IN_UNIT() view returns (uint256)",
  
  // 可能的管理员修改函数
  "function setSecondsInUnit(uint256 _seconds) external",
  "function updateSecondsInUnit(uint256 _seconds) external", 
  "function changeSecondsInUnit(uint256 _seconds) external",
  "function setTimeUnit(uint256 _seconds) external",
  "function updateTimeUnit(uint256 _seconds) external",
  
  // 其他可能的管理员函数
  "function setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lp, uint256 _treasury) external",
  "function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external",
  "function setRedemptionFeePercent(uint256 _fee) external",
  "function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external",
  "function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external",
  "function setTicketFlexibilityDuration(uint256 _duration) external",
  "function transferOwnership(address newOwner) external",
  "function pause() external",
  "function unpause() external",
  "function emergencyPause() external",
  "function emergencyUnpause() external"
];

class ContractAdminChecker {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(P_PROD_CONFIG.rpcUrl);
    this.contract = new ethers.Contract(P_PROD_CONFIG.protocolAddress, ADMIN_FUNCTIONS_ABI, this.provider);
  }

  async checkAdminFunctions() {
    console.log('🔍 检查P-prod合约管理功能...');
    console.log('=' .repeat(80));
    console.log(`合约地址: ${P_PROD_CONFIG.protocolAddress}`);
    
    // 基础信息检查
    await this.checkBasicInfo();
    
    // 检查管理员函数
    await this.checkTimeUnitFunctions();
    
    // 检查其他管理员函数
    await this.checkOtherAdminFunctions();
    
    // 生成建议
    this.generateRecommendations();
  }

  async checkBasicInfo() {
    console.log('\n📋 基础信息检查:');
    
    try {
      const owner = await this.contract.owner();
      console.log(`✅ 合约所有者: ${owner}`);
      
      const secondsInUnit = await this.contract.SECONDS_IN_UNIT();
      console.log(`✅ 当前SECONDS_IN_UNIT: ${secondsInUnit} 秒`);
      
      // 检查合约代码
      const code = await this.provider.getCode(P_PROD_CONFIG.protocolAddress);
      console.log(`✅ 合约代码长度: ${code.length} 字符`);
      
    } catch (error) {
      console.log(`❌ 基础信息检查失败: ${error.message}`);
    }
  }

  async checkTimeUnitFunctions() {
    console.log('\n🕐 时间单位修改函数检查:');
    
    const timeUnitFunctions = [
      'setSecondsInUnit',
      'updateSecondsInUnit', 
      'changeSecondsInUnit',
      'setTimeUnit',
      'updateTimeUnit'
    ];
    
    let foundTimeUnitFunction = false;
    
    for (const funcName of timeUnitFunctions) {
      try {
        // 尝试获取函数选择器
        const fragment = this.contract.interface.getFunction(funcName);
        if (fragment) {
          console.log(`✅ 找到函数: ${funcName}(${fragment.inputs.map(i => i.type).join(', ')})`);
          console.log(`   选择器: ${fragment.selector}`);
          foundTimeUnitFunction = true;
        }
      } catch (error) {
        console.log(`❌ 函数不存在: ${funcName}`);
      }
    }
    
    if (!foundTimeUnitFunction) {
      console.log(`⚠️ 未找到时间单位修改函数，可能需要合约升级`);
    }
    
    return foundTimeUnitFunction;
  }

  async checkOtherAdminFunctions() {
    console.log('\n🛠️ 其他管理员函数检查:');
    
    const adminFunctions = [
      'setDistributionConfig',
      'setSwapTaxes', 
      'setRedemptionFeePercent',
      'setWallets',
      'setOperationalStatus',
      'setTicketFlexibilityDuration',
      'transferOwnership',
      'pause',
      'unpause',
      'emergencyPause',
      'emergencyUnpause'
    ];
    
    const availableFunctions = [];
    
    for (const funcName of adminFunctions) {
      try {
        const fragment = this.contract.interface.getFunction(funcName);
        if (fragment) {
          console.log(`✅ ${funcName}: 可用`);
          availableFunctions.push(funcName);
        }
      } catch (error) {
        console.log(`❌ ${funcName}: 不可用`);
      }
    }
    
    console.log(`\n📊 管理员函数统计: ${availableFunctions.length}/${adminFunctions.length} 可用`);
    
    return availableFunctions;
  }

  generateRecommendations() {
    console.log('\n💡 切换方案建议:');
    
    // 检查是否有时间单位修改函数
    let hasTimeUnitFunction = false;
    try {
      this.contract.interface.getFunction('setSecondsInUnit');
      hasTimeUnitFunction = true;
    } catch (e) {
      // 尝试其他可能的函数名
      const alternatives = ['updateSecondsInUnit', 'changeSecondsInUnit', 'setTimeUnit'];
      for (const alt of alternatives) {
        try {
          this.contract.interface.getFunction(alt);
          hasTimeUnitFunction = true;
          break;
        } catch (e) {
          // 继续尝试
        }
      }
    }
    
    if (hasTimeUnitFunction) {
      console.log(`✅ 推荐方案: 直接调用管理员函数修改SECONDS_IN_UNIT`);
      console.log(`   优势: 简单快速，风险最低`);
      console.log(`   步骤: 调用函数 → 验证结果 → 完成`);
      console.log(`   执行命令: node scripts/switch-pprod-to-daily-staking.js`);
    } else {
      console.log(`⚠️ 推荐方案: 合约升级 (UUPS模式)`);
      console.log(`   原因: 未找到直接修改SECONDS_IN_UNIT的函数`);
      console.log(`   步骤: 准备新实现 → 升级合约 → 验证结果`);
      console.log(`   风险: 中等，需要充分测试`);
    }
    
    console.log(`\n📋 执行前准备:`);
    console.log(`1. 确认管理员私钥已设置 (PRIVATE_KEY环境变量)`);
    console.log(`2. 在测试环境先验证切换流程`);
    console.log(`3. 备份当前所有质押数据`);
    console.log(`4. 通知用户即将进行的变更`);
    console.log(`5. 准备回滚方案 (如果需要)`);
    
    console.log(`\n⚠️ 重要提醒:`);
    console.log(`- 此操作将永久改变质押周期计算方式`);
    console.log(`- 建议在用户活跃度较低的时间执行`);
    console.log(`- 确保有技术团队待命处理可能的问题`);
  }

  // 检查合约是否可升级
  async checkUpgradeability() {
    console.log('\n🔄 检查合约升级能力:');
    
    try {
      // 检查是否是代理合约
      const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
      const implementation = await this.provider.getStorageAt(P_PROD_CONFIG.protocolAddress, implementationSlot);
      
      if (implementation !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log(`✅ 检测到UUPS代理合约`);
        console.log(`   实现合约: 0x${implementation.slice(-40)}`);
        console.log(`   支持升级: 是`);
        return true;
      } else {
        console.log(`❌ 非代理合约，不支持升级`);
        return false;
      }
    } catch (error) {
      console.log(`⚠️ 无法确定升级能力: ${error.message}`);
      return false;
    }
  }
}

// 主执行函数
async function main() {
  const checker = new ContractAdminChecker();
  
  try {
    await checker.checkAdminFunctions();
    await checker.checkUpgradeability();
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('check-contract-admin-functions.js')) {
  main().catch(console.error);
}

export { ContractAdminChecker };