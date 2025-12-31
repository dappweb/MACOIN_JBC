#!/usr/bin/env node

/**
 * 购票失败深度分析脚本
 * 专门分析用户条件满足但购票仍然失败的情况
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const TARGET_USER = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';
const MC_CHAIN_ID = 88813;
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 完整的协议合约ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function owner() view returns (address)",
  "function buyTicket() external payable",
  "function hasReferrer(address) view returns (bool)",
  "function getTicketPrice(uint256) view returns (uint256)",
  "function maxTicketPerUser() view returns (uint256)",
  "function minTicketAmount() view returns (uint256)",
  "function maxTicketAmount() view returns (uint256)"
];

class PurchaseFailureAnalyzer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async analyzePurchaseFailure() {
    console.log('🔍 深度分析购票失败原因...');
    console.log(`👤 用户地址: ${TARGET_USER}`);
    console.log('=' .repeat(70));

    const analysis = {
      userAddress: TARGET_USER,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    try {
      // 1. 基础状态检查
      console.log('\n📊 1. 基础状态检查...');
      analysis.checks.basicStatus = await this.checkBasicStatus();
      this.printBasicStatus(analysis.checks.basicStatus);

      // 2. 购票限制检查
      console.log('\n🎫 2. 购票限制检查...');
      analysis.checks.purchaseRestrictions = await this.checkPurchaseRestrictions();
      this.printPurchaseRestrictions(analysis.checks.purchaseRestrictions);

      // 3. 合约状态详细检查
      console.log('\n🏗️ 3. 合约状态详细检查...');
      analysis.checks.contractDetails = await this.checkContractDetails();
      this.printContractDetails(analysis.checks.contractDetails);

      // 4. 交易失败原因模拟
      console.log('\n💥 4. 交易失败原因模拟...');
      analysis.checks.failureSimulation = await this.simulateFailureReasons();
      this.printFailureSimulation(analysis.checks.failureSimulation);

      // 5. 生成详细分析报告
      console.log('\n📋 5. 失败原因分析...');
      const failureAnalysis = this.generateFailureAnalysis(analysis.checks);
      this.printFailureAnalysis(failureAnalysis);

      // 保存分析结果
      await this.saveAnalysisResults({ ...analysis, failureAnalysis });

    } catch (error) {
      console.error('❌ 分析过程中发生错误:', error.message);
      analysis.error = error.message;
    }

    return analysis;
  }

  async checkBasicStatus() {
    try {
      const [balance, userInfo, userTicket, hasReferrer] = await Promise.all([
        this.provider.getBalance(TARGET_USER),
        this.contract.userInfo(TARGET_USER),
        this.contract.userTicket(TARGET_USER),
        this.contract.hasReferrer(TARGET_USER)
      ]);

      return {
        success: true,
        balance: parseFloat(ethers.formatEther(balance)),
        userInfo: {
          referrer: userInfo.referrer,
          hasReferrer: hasReferrer,
          isActive: userInfo.isActive,
          totalRevenue: parseFloat(ethers.formatEther(userInfo.totalRevenue)),
          currentCap: parseFloat(ethers.formatEther(userInfo.currentCap)),
          maxTicketAmount: parseFloat(ethers.formatEther(userInfo.maxTicketAmount)),
          maxSingleTicketAmount: parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
        },
        currentTicket: {
          amount: parseFloat(ethers.formatEther(userTicket.amount)),
          purchaseTime: Number(userTicket.purchaseTime),
          exited: userTicket.exited
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkPurchaseRestrictions() {
    try {
      const restrictions = {};

      // 检查各种购票限制
      try {
        restrictions.maxTicketPerUser = await this.contract.maxTicketPerUser();
      } catch (e) {
        restrictions.maxTicketPerUser = null;
      }

      try {
        restrictions.minTicketAmount = await this.contract.minTicketAmount();
      } catch (e) {
        restrictions.minTicketAmount = null;
      }

      try {
        restrictions.maxTicketAmount = await this.contract.maxTicketAmount();
      } catch (e) {
        restrictions.maxTicketAmount = null;
      }

      // 检查不同金额的门票价格
      const ticketAmounts = [100, 300, 500, 1000];
      restrictions.ticketPrices = {};

      for (const amount of ticketAmounts) {
        try {
          const price = await this.contract.getTicketPrice(ethers.parseEther(amount.toString()));
          restrictions.ticketPrices[amount] = parseFloat(ethers.formatEther(price));
        } catch (e) {
          restrictions.ticketPrices[amount] = null;
        }
      }

      return { success: true, restrictions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkContractDetails() {
    try {
      const details = {};

      // 检查合约的各种状态
      const statusChecks = [
        { name: 'paused', func: () => this.contract.paused() },
        { name: 'emergencyPaused', func: () => this.contract.emergencyPaused() },
        { name: 'owner', func: () => this.contract.owner() }
      ];

      for (const check of statusChecks) {
        try {
          details[check.name] = await check.func();
        } catch (error) {
          details[check.name] = { error: error.message };
        }
      }

      // 检查合约余额
      details.contractBalance = parseFloat(ethers.formatEther(
        await this.provider.getBalance(PROTOCOL_ADDRESS)
      ));

      return { success: true, details };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async simulateFailureReasons() {
    const simulations = [];

    // 模拟不同金额的购票交易
    const ticketAmounts = [100, 300, 500, 1000];

    for (const amount of ticketAmounts) {
      const simulation = {
        ticketAmount: amount,
        amountWei: ethers.parseEther(amount.toString())
      };

      try {
        // 尝试估算Gas
        const gasEstimate = await this.contract.buyTicket.estimateGas({
          value: simulation.amountWei,
          from: TARGET_USER
        });

        simulation.gasEstimate = gasEstimate.toString();
        simulation.success = true;
        simulation.canPurchase = true;

      } catch (error) {
        simulation.success = false;
        simulation.error = error.message;
        simulation.canPurchase = false;

        // 分析具体的失败原因
        if (error.message.includes('insufficient funds')) {
          simulation.failureReason = 'insufficient_funds';
        } else if (error.message.includes('paused')) {
          simulation.failureReason = 'contract_paused';
        } else if (error.message.includes('referrer')) {
          simulation.failureReason = 'no_referrer';
        } else if (error.message.includes('ticket')) {
          simulation.failureReason = 'ticket_restriction';
        } else if (error.message.includes('cap')) {
          simulation.failureReason = 'cap_exceeded';
        } else {
          simulation.failureReason = 'unknown';
        }
      }

      simulations.push(simulation);
    }

    return { success: true, simulations };
  }

  generateFailureAnalysis(checks) {
    const issues = [];
    const solutions = [];

    // 分析基础状态问题
    if (checks.basicStatus?.success) {
      const { balance, userInfo, currentTicket } = checks.basicStatus;

      // 检查余额问题
      if (balance < 100.01) {
        issues.push({
          type: 'balance',
          severity: 'high',
          description: `余额不足: ${balance} MC < 100.01 MC`
        });
        solutions.push('充值MC到钱包');
      }

      // 检查推荐人问题
      if (!userInfo.hasReferrer) {
        issues.push({
          type: 'referrer',
          severity: 'high',
          description: '未绑定推荐人'
        });
        solutions.push('绑定推荐人');
      }

      // 检查门票限制问题
      if (currentTicket.amount > 0 && !currentTicket.exited) {
        issues.push({
          type: 'existing_ticket',
          severity: 'medium',
          description: `已有活跃门票: ${currentTicket.amount} MC`
        });
        solutions.push('等待当前门票到期或退出后再购买新门票');
      }

      // 检查收益上限问题
      if (userInfo.currentCap <= userInfo.totalRevenue) {
        issues.push({
          type: 'cap_reached',
          severity: 'high',
          description: '收益已达上限，无法购买更多门票'
        });
        solutions.push('等待收益上限重置或升级门票等级');
      }
    }

    // 分析合约状态问题
    if (checks.contractDetails?.success) {
      const { details } = checks.contractDetails;

      if (details.paused === true) {
        issues.push({
          type: 'contract_paused',
          severity: 'critical',
          description: '合约已暂停'
        });
        solutions.push('等待合约恢复运行');
      }

      if (details.emergencyPaused === true) {
        issues.push({
          type: 'emergency_paused',
          severity: 'critical',
          description: '合约紧急暂停'
        });
        solutions.push('等待紧急状态解除');
      }
    }

    // 分析交易模拟结果
    if (checks.failureSimulation?.success) {
      const { simulations } = checks.failureSimulation;
      const failedSimulations = simulations.filter(s => !s.success);

      if (failedSimulations.length === simulations.length) {
        issues.push({
          type: 'all_amounts_fail',
          severity: 'critical',
          description: '所有门票金额都无法购买'
        });

        // 分析共同的失败原因
        const commonReason = failedSimulations[0]?.failureReason;
        if (failedSimulations.every(s => s.failureReason === commonReason)) {
          switch (commonReason) {
            case 'insufficient_funds':
              solutions.push('充值更多MC到钱包');
              break;
            case 'contract_paused':
              solutions.push('等待合约恢复');
              break;
            case 'no_referrer':
              solutions.push('绑定推荐人');
              break;
            case 'ticket_restriction':
              solutions.push('检查门票购买限制');
              break;
            case 'cap_exceeded':
              solutions.push('等待收益上限重置');
              break;
            default:
              solutions.push('联系技术支持分析具体问题');
          }
        }
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
    if (issues.some(i => i.type === 'contract_paused' || i.type === 'emergency_paused')) {
      return '等待合约恢复运行';
    }
    if (issues.some(i => i.type === 'referrer')) {
      return '绑定推荐人';
    }
    if (issues.some(i => i.type === 'balance')) {
      return '充值MC代币';
    }
    if (issues.some(i => i.type === 'cap_reached')) {
      return '等待收益上限重置';
    }
    if (issues.some(i => i.type === 'existing_ticket')) {
      return '等待当前门票到期';
    }
    if (issues.length === 0) {
      return '尝试直接购票或联系技术支持';
    }
    return '按优先级解决发现的问题';
  }

  // 打印方法
  printBasicStatus(status) {
    if (status.success) {
      console.log(`  💰 用户余额: ${status.balance} MC`);
      console.log(`  🔗 推荐人状态: ${status.userInfo.hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
      console.log(`  🎫 当前门票: ${status.currentTicket.amount} MC`);
      console.log(`  💰 总收益: ${status.userInfo.totalRevenue} MC`);
      console.log(`  📊 收益上限: ${status.userInfo.currentCap} MC`);
      console.log(`  ✅ 活跃状态: ${status.userInfo.isActive ? '是' : '否'}`);
    } else {
      console.log(`  ❌ 基础状态检查失败: ${status.error}`);
    }
  }

  printPurchaseRestrictions(restrictions) {
    if (restrictions.success) {
      const { restrictions: r } = restrictions;
      console.log(`  📏 最大门票数: ${r.maxTicketPerUser || '未设置'}`);
      console.log(`  📉 最小门票金额: ${r.minTicketAmount ? ethers.formatEther(r.minTicketAmount) + ' MC' : '未设置'}`);
      console.log(`  📈 最大门票金额: ${r.maxTicketAmount ? ethers.formatEther(r.maxTicketAmount) + ' MC' : '未设置'}`);
      
      console.log(`  💰 门票价格:`);
      Object.entries(r.ticketPrices).forEach(([amount, price]) => {
        console.log(`    ${amount} MC: ${price !== null ? price + ' MC' : '不可用'}`);
      });
    } else {
      console.log(`  ❌ 购票限制检查失败: ${restrictions.error}`);
    }
  }

  printContractDetails(details) {
    if (details.success) {
      const { details: d } = details;
      console.log(`  ⏸️ 暂停状态: ${d.paused?.error ? '检查失败' : (d.paused ? '已暂停' : '正常')}`);
      console.log(`  🚨 紧急暂停: ${d.emergencyPaused?.error ? '检查失败' : (d.emergencyPaused ? '已暂停' : '正常')}`);
      console.log(`  👑 合约拥有者: ${d.owner?.error ? '检查失败' : d.owner}`);
      console.log(`  💎 合约余额: ${d.contractBalance} MC`);
    } else {
      console.log(`  ❌ 合约详情检查失败: ${details.error}`);
    }
  }

  printFailureSimulation(simulation) {
    if (simulation.success) {
      console.log(`  🎫 购票模拟结果:`);
      simulation.simulations.forEach(sim => {
        if (sim.success) {
          console.log(`    ${sim.ticketAmount} MC: ✅ 可购买 (Gas: ${sim.gasEstimate})`);
        } else {
          console.log(`    ${sim.ticketAmount} MC: ❌ 失败 - ${sim.failureReason || '未知原因'}`);
          if (sim.error) {
            console.log(`      错误: ${sim.error.substring(0, 100)}...`);
          }
        }
      });
    } else {
      console.log(`  ❌ 交易模拟失败: ${simulation.error}`);
    }
  }

  printFailureAnalysis(analysis) {
    console.log(`\n📊 失败原因分析总结:`);
    console.log(`  🔍 发现问题: ${analysis.totalIssues} 个`);
    console.log(`  🚨 严重问题: ${analysis.criticalIssues} 个`);
    console.log(`  ⚠️ 高优先级: ${analysis.highIssues} 个`);
    console.log(`  🎫 可购票状态: ${analysis.canPurchaseTicket ? '✅ 理论上可以' : '❌ 存在阻碍'}`);

    if (analysis.issues.length > 0) {
      console.log(`\n🔧 发现的问题:`);
      analysis.issues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`  ${index + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
      });
    }

    if (analysis.solutions.length > 0) {
      console.log(`\n💡 建议的解决方案:`);
      analysis.solutions.forEach((solution, index) => {
        console.log(`  ${index + 1}. ${solution}`);
      });
    }

    console.log(`\n🎯 推荐行动: ${analysis.recommendedAction}`);
  }

  async saveAnalysisResults(results) {
    const filename = `purchase-failure-analysis-${TARGET_USER.slice(0, 8)}-${Date.now()}.json`;
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(results, null, 2));
      console.log(`\n💾 分析结果已保存到: ${filename}`);
    } catch (error) {
      console.log(`\n❌ 保存分析结果失败: ${error.message}`);
    }
  }
}

// 主执行函数
async function main() {
  const analyzer = new PurchaseFailureAnalyzer();
  
  try {
    await analyzer.analyzePurchaseFailure();
  } catch (error) {
    console.error('❌ 分析失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('purchase-failure-analysis.js')) {
  main().catch(console.error);
}

export { PurchaseFailureAnalyzer };