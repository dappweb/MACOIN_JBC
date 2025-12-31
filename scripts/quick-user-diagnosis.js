#!/usr/bin/env node

/**
 * 快速用户诊断脚本
 * 针对用户 0x7eFaD6Bef04631BE34De71b2Df9378C727f185b7 的购票问题进行快速诊断
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

// 配置
const TARGET_USER = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';
const MC_CHAIN_ID = 88813;
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5'; // 从部署报告获取的正确地址

// 协议合约ABI (简化版)
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function owner() view returns (address)",
  "function buyTicket() external payable",
  "function hasReferrer(address) view returns (bool)"
];

class QuickDiagnostic {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async runDiagnosis() {
    console.log('🔍 开始快速诊断用户购票问题...');
    console.log(`👤 目标用户: ${TARGET_USER}`);
    console.log('=' .repeat(80));

    const results = {
      userAddress: TARGET_USER,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    try {
      // 1. 检查网络连接
      console.log('\n📡 1. 检查网络连接状态...');
      results.checks.network = await this.checkNetworkStatus();
      this.printNetworkStatus(results.checks.network);

      // 2. 检查用户余额
      console.log('\n💰 2. 检查用户MC余额...');
      results.checks.balance = await this.checkUserBalance();
      this.printBalanceStatus(results.checks.balance);

      // 3. 检查合约状态
      console.log('\n🏗️ 3. 检查协议合约状态...');
      results.checks.contract = await this.checkContractStatus();
      this.printContractStatus(results.checks.contract);

      // 4. 检查用户在协议中的状态
      console.log('\n👥 4. 检查用户协议状态...');
      results.checks.userProtocolStatus = await this.checkUserProtocolStatus();
      this.printUserProtocolStatus(results.checks.userProtocolStatus);

      // 5. 模拟购票交易
      console.log('\n🎫 5. 模拟购票交易...');
      results.checks.transactionSimulation = await this.simulatePurchaseTransaction();
      this.printTransactionSimulation(results.checks.transactionSimulation);

      // 6. 生成诊断总结
      console.log('\n📋 6. 诊断总结和建议...');
      const summary = this.generateDiagnosticSummary(results.checks);
      this.printDiagnosticSummary(summary);

      // 保存诊断结果
      await this.saveDiagnosticResults({ ...results, summary });

    } catch (error) {
      console.error('❌ 诊断过程中发生错误:', error.message);
      results.error = error.message;
    }

    return results;
  }

  async checkNetworkStatus() {
    try {
      const startTime = Date.now();
      const [network, blockNumber] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber()
      ]);
      const latency = Date.now() - startTime;

      return {
        success: true,
        chainId: Number(network.chainId),
        isCorrectNetwork: Number(network.chainId) === MC_CHAIN_ID,
        blockNumber,
        latency,
        networkHealth: latency < 1000 ? 'good' : latency < 3000 ? 'slow' : 'poor'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkUserBalance() {
    try {
      const balance = await this.provider.getBalance(TARGET_USER);
      const balanceInMC = parseFloat(ethers.formatEther(balance));
      
      // 估算购票所需金额 (100 MC + Gas费)
      const ticketAmount = 100;
      const estimatedGas = 0.01; // 估算Gas费
      const totalRequired = ticketAmount + estimatedGas;

      return {
        success: true,
        currentBalance: balanceInMC,
        currentBalanceWei: balance.toString(),
        requiredForTicket: totalRequired,
        isSufficient: balanceInMC >= totalRequired,
        shortfall: balanceInMC < totalRequired ? totalRequired - balanceInMC : 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkContractStatus() {
    try {
      const [isPaused, isEmergencyPaused, owner, contractBalance] = await Promise.all([
        this.contract.paused().catch(() => null),
        this.contract.emergencyPaused().catch(() => null),
        this.contract.owner().catch(() => null),
        this.provider.getBalance(PROTOCOL_ADDRESS)
      ]);

      return {
        success: true,
        isPaused,
        isEmergencyPaused,
        owner,
        contractBalance: parseFloat(ethers.formatEther(contractBalance)),
        isAccessible: isPaused !== null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isAccessible: false
      };
    }
  }

  async checkUserProtocolStatus() {
    try {
      const [userInfo, userTicket] = await Promise.all([
        this.contract.userInfo(TARGET_USER).catch(() => null),
        this.contract.userTicket(TARGET_USER).catch(() => null)
      ]);

      let hasReferrer = false;
      let isOwner = false;

      if (userInfo) {
        hasReferrer = userInfo.referrer !== ethers.ZeroAddress;
      }

      // 检查是否是合约拥有者
      try {
        const owner = await this.contract.owner();
        isOwner = TARGET_USER.toLowerCase() === owner.toLowerCase();
      } catch (error) {
        // 忽略错误
      }

      return {
        success: true,
        userInfo: userInfo ? {
          referrer: userInfo.referrer,
          hasReferrer,
          isActive: userInfo.isActive,
          totalRevenue: parseFloat(ethers.formatEther(userInfo.totalRevenue)),
          currentCap: parseFloat(ethers.formatEther(userInfo.currentCap)),
          maxTicketAmount: parseFloat(ethers.formatEther(userInfo.maxTicketAmount)),
          maxSingleTicketAmount: parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
        } : null,
        userTicket: userTicket ? {
          ticketId: userTicket.ticketId.toString(),
          amount: parseFloat(ethers.formatEther(userTicket.amount)),
          purchaseTime: Number(userTicket.purchaseTime),
          exited: userTicket.exited
        } : null,
        isOwner,
        canPurchase: isOwner || hasReferrer
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async simulatePurchaseTransaction() {
    try {
      const ticketAmount = ethers.parseEther("100");
      
      // 尝试估算Gas费用
      let gasEstimate = null;
      let gasError = null;
      
      try {
        gasEstimate = await this.contract.buyTicket.estimateGas({ 
          value: ticketAmount,
          from: TARGET_USER 
        });
      } catch (error) {
        gasError = error.message;
      }

      return {
        success: gasEstimate !== null,
        ticketAmount: "100",
        gasEstimate: gasEstimate ? gasEstimate.toString() : null,
        gasError,
        canSimulate: gasEstimate !== null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateDiagnosticSummary(checks) {
    const issues = [];
    const solutions = [];

    // 分析网络问题
    if (!checks.network?.success) {
      issues.push({
        type: 'network',
        severity: 'critical',
        description: '无法连接到MC Chain网络'
      });
      solutions.push('请检查网络连接，确保钱包已连接到MC Chain (Chain ID: 88813)');
    } else if (!checks.network.isCorrectNetwork) {
      issues.push({
        type: 'network',
        severity: 'high',
        description: `当前连接到错误的网络 (Chain ID: ${checks.network.chainId})`
      });
      solutions.push('请在钱包中切换到MC Chain网络 (Chain ID: 88813)');
    }

    // 分析余额问题
    if (!checks.balance?.success) {
      issues.push({
        type: 'balance',
        severity: 'critical',
        description: '无法获取用户余额'
      });
    } else if (!checks.balance.isSufficient) {
      issues.push({
        type: 'balance',
        severity: 'high',
        description: `MC余额不足，当前 ${checks.balance.currentBalance} MC，需要 ${checks.balance.requiredForTicket} MC`
      });
      solutions.push(`请充值至少 ${checks.balance.shortfall.toFixed(4)} MC到钱包地址`);
    }

    // 分析合约问题
    if (!checks.contract?.success || !checks.contract.isAccessible) {
      issues.push({
        type: 'contract',
        severity: 'critical',
        description: '无法访问协议合约'
      });
      solutions.push('合约可能暂时不可用，请稍后重试或联系技术支持');
    } else if (checks.contract.isPaused) {
      issues.push({
        type: 'contract',
        severity: 'high',
        description: '协议合约当前处于暂停状态'
      });
      solutions.push('合约暂时暂停维护，请等待恢复后重试');
    }

    // 分析用户协议状态问题
    if (checks.userProtocolStatus?.success && !checks.userProtocolStatus.canPurchase) {
      issues.push({
        type: 'referrer',
        severity: 'high',
        description: '用户未绑定推荐人且非合约拥有者'
      });
      solutions.push('请先绑定推荐人后再尝试购买门票');
    }

    // 分析交易模拟问题
    if (!checks.transactionSimulation?.success) {
      issues.push({
        type: 'transaction',
        severity: 'medium',
        description: '购票交易模拟失败'
      });
      if (checks.transactionSimulation?.gasError) {
        solutions.push(`交易预检查失败: ${checks.transactionSimulation.gasError}`);
      }
    }

    return {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      issues,
      solutions,
      canPurchaseTicket: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      recommendedAction: this.getRecommendedAction(issues)
    };
  }

  getRecommendedAction(issues) {
    if (issues.some(i => i.type === 'network' && i.severity === 'critical')) {
      return '立即检查网络连接和钱包配置';
    }
    if (issues.some(i => i.type === 'balance' && i.severity === 'high')) {
      return '充值MC代币到钱包';
    }
    if (issues.some(i => i.type === 'contract' && i.severity === 'critical')) {
      return '等待合约服务恢复';
    }
    if (issues.some(i => i.type === 'referrer')) {
      return '绑定推荐人';
    }
    if (issues.length === 0) {
      return '可以尝试购买门票';
    }
    return '按优先级解决发现的问题';
  }

  // 打印方法
  printNetworkStatus(status) {
    if (status.success) {
      console.log(`  ✅ 网络连接: 成功`);
      console.log(`  🌐 Chain ID: ${status.chainId} ${status.isCorrectNetwork ? '(正确)' : '(错误，应为88813)'}`);
      console.log(`  📊 区块高度: ${status.blockNumber}`);
      console.log(`  ⚡ 延迟: ${status.latency}ms (${status.networkHealth})`);
    } else {
      console.log(`  ❌ 网络连接: 失败 - ${status.error}`);
    }
  }

  printBalanceStatus(status) {
    if (status.success) {
      console.log(`  💰 当前余额: ${status.currentBalance} MC`);
      console.log(`  🎫 购票需要: ${status.requiredForTicket} MC (含Gas费)`);
      console.log(`  ${status.isSufficient ? '✅' : '❌'} 余额状态: ${status.isSufficient ? '充足' : `不足 ${status.shortfall.toFixed(4)} MC`}`);
    } else {
      console.log(`  ❌ 余额检查: 失败 - ${status.error}`);
    }
  }

  printContractStatus(status) {
    if (status.success) {
      console.log(`  🏗️ 合约访问: ${status.isAccessible ? '✅ 正常' : '❌ 失败'}`);
      console.log(`  ⏸️ 暂停状态: ${status.isPaused ? '❌ 已暂停' : '✅ 正常运行'}`);
      console.log(`  🚨 紧急暂停: ${status.isEmergencyPaused ? '❌ 已暂停' : '✅ 正常'}`);
      console.log(`  💎 合约余额: ${status.contractBalance} MC`);
    } else {
      console.log(`  ❌ 合约检查: 失败 - ${status.error}`);
    }
  }

  printUserProtocolStatus(status) {
    if (status.success) {
      console.log(`  👤 用户状态: ${status.userInfo ? '✅ 已注册' : '❌ 未注册'}`);
      if (status.userInfo) {
        console.log(`  🔗 推荐人: ${status.userInfo.hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
        console.log(`  🎫 门票金额: ${status.userTicket?.amount || 0} MC`);
        console.log(`  💰 总收益: ${status.userInfo.totalRevenue} MC`);
        console.log(`  📊 收益上限: ${status.userInfo.currentCap} MC`);
      }
      console.log(`  👑 管理员权限: ${status.isOwner ? '✅ 是' : '❌ 否'}`);
      console.log(`  🎫 可购票: ${status.canPurchase ? '✅ 是' : '❌ 否'}`);
    } else {
      console.log(`  ❌ 用户状态检查: 失败 - ${status.error}`);
    }
  }

  printTransactionSimulation(status) {
    if (status.success) {
      console.log(`  🎫 模拟购票: ✅ 成功`);
      console.log(`  ⛽ Gas估算: ${status.gasEstimate} wei`);
    } else {
      console.log(`  🎫 模拟购票: ❌ 失败`);
      if (status.gasError) {
        console.log(`  ❌ 错误信息: ${status.gasError}`);
      }
    }
  }

  printDiagnosticSummary(summary) {
    console.log(`\n📊 诊断结果总结:`);
    console.log(`  🔍 发现问题: ${summary.totalIssues} 个`);
    console.log(`  🚨 严重问题: ${summary.criticalIssues} 个`);
    console.log(`  ⚠️ 高优先级: ${summary.highIssues} 个`);
    console.log(`  🎫 可购票状态: ${summary.canPurchaseTicket ? '✅ 可以购票' : '❌ 暂时无法购票'}`);
    
    if (summary.issues.length > 0) {
      console.log(`\n🔧 发现的问题:`);
      summary.issues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`  ${index + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
      });
    }

    if (summary.solutions.length > 0) {
      console.log(`\n💡 建议的解决方案:`);
      summary.solutions.forEach((solution, index) => {
        console.log(`  ${index + 1}. ${solution}`);
      });
    }

    console.log(`\n🎯 推荐行动: ${summary.recommendedAction}`);
  }

  async saveDiagnosticResults(results) {
    const filename = `diagnostic-${TARGET_USER.slice(0, 8)}-${Date.now()}.json`;
    
    try {
      await fs.writeFile(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 诊断结果已保存到: ${filename}`);
    } catch (error) {
      console.log(`\n❌ 保存诊断结果失败: ${error.message}`);
    }
  }
}

// 主执行函数
async function main() {
  const diagnostic = new QuickDiagnostic();
  
  try {
    await diagnostic.runDiagnosis();
  } catch (error) {
    console.error('❌ 诊断执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('quick-user-diagnosis.js')) {
  main().catch(console.error);
}

export { QuickDiagnostic };