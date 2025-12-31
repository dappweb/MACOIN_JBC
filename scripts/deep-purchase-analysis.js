#!/usr/bin/env node

/**
 * 深度购票问题分析脚本
 * 专门分析用户购票失败的深层次原因
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const TARGET_USER = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';
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
  "function directReferrals(address, uint256) view returns (address)",
  "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)"
];

class DeepPurchaseAnalyzer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async analyzeDeepPurchaseIssue() {
    console.log('🔬 深度分析购票失败原因...');
    console.log(`👤 用户地址: ${TARGET_USER}`);
    console.log('=' .repeat(80));

    try {
      // 1. 基础信息收集
      console.log('\n📊 1. 收集基础信息...');
      const basicInfo = await this.collectBasicInfo();
      this.printBasicInfo(basicInfo);

      // 2. 合约状态深度检查
      console.log('\n🏗️ 2. 合约状态深度检查...');
      const contractStatus = await this.deepContractCheck();
      this.printContractStatus(contractStatus);

      // 3. 用户状态深度分析
      console.log('\n👤 3. 用户状态深度分析...');
      const userStatus = await this.deepUserAnalysis();
      this.printUserStatus(userStatus);

      // 4. 交易模拟和错误分析
      console.log('\n💥 4. 交易模拟和错误分析...');
      const transactionAnalysis = await this.analyzeTransactionFailure();
      this.printTransactionAnalysis(transactionAnalysis);

      // 5. 推荐人链分析
      console.log('\n🔗 5. 推荐人链分析...');
      const referrerAnalysis = await this.analyzeReferrerChain();
      this.printReferrerAnalysis(referrerAnalysis);

      // 6. 生成最终诊断
      console.log('\n🎯 6. 最终诊断结果...');
      const finalDiagnosis = this.generateFinalDiagnosis({
        basicInfo,
        contractStatus,
        userStatus,
        transactionAnalysis,
        referrerAnalysis
      });
      this.printFinalDiagnosis(finalDiagnosis);

    } catch (error) {
      console.error('❌ 深度分析失败:', error.message);
    }
  }

  async collectBasicInfo() {
    const balance = await this.provider.getBalance(TARGET_USER);
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    
    return {
      balance: parseFloat(ethers.formatEther(balance)),
      chainId: Number(network.chainId),
      blockNumber,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  async deepContractCheck() {
    const checks = {};
    
    // 测试各种合约函数的可访问性
    const functions = [
      { name: 'paused', func: () => this.contract.paused() },
      { name: 'emergencyPaused', func: () => this.contract.emergencyPaused() },
      { name: 'owner', func: () => this.contract.owner() },
      { name: 'userInfo', func: () => this.contract.userInfo(TARGET_USER) },
      { name: 'userTicket', func: () => this.contract.userTicket(TARGET_USER) },
      { name: 'hasReferrer', func: () => this.contract.hasReferrer(TARGET_USER) }
    ];

    for (const { name, func } of functions) {
      try {
        const result = await func();
        checks[name] = { success: true, result };
      } catch (error) {
        checks[name] = { success: false, error: error.message };
      }
    }

    return checks;
  }

  async deepUserAnalysis() {
    try {
      const [userInfo, userTicket] = await Promise.all([
        this.contract.userInfo(TARGET_USER),
        this.contract.userTicket(TARGET_USER)
      ]);

      // 检查推荐人状态
      let referrerInfo = null;
      if (userInfo.referrer !== ethers.ZeroAddress) {
        try {
          referrerInfo = await this.contract.userInfo(userInfo.referrer);
        } catch (error) {
          referrerInfo = { error: error.message };
        }
      }

      // 检查用户的质押历史
      const stakes = [];
      for (let i = 0; i < 5; i++) {
        try {
          const stake = await this.contract.userStakes(TARGET_USER, i);
          stakes.push({
            id: Number(stake.id),
            amount: parseFloat(ethers.formatEther(stake.amount)),
            startTime: Number(stake.startTime),
            cycleDays: Number(stake.cycleDays),
            active: stake.active,
            paid: parseFloat(ethers.formatEther(stake.paid))
          });
        } catch (error) {
          break; // 没有更多质押记录
        }
      }

      return {
        userInfo: {
          referrer: userInfo.referrer,
          hasReferrer: userInfo.referrer !== ethers.ZeroAddress,
          activeDirects: Number(userInfo.activeDirects),
          teamCount: Number(userInfo.teamCount),
          totalRevenue: parseFloat(ethers.formatEther(userInfo.totalRevenue)),
          currentCap: parseFloat(ethers.formatEther(userInfo.currentCap)),
          isActive: userInfo.isActive,
          maxTicketAmount: parseFloat(ethers.formatEther(userInfo.maxTicketAmount)),
          maxSingleTicketAmount: parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
        },
        userTicket: {
          ticketId: Number(userTicket.ticketId),
          amount: parseFloat(ethers.formatEther(userTicket.amount)),
          purchaseTime: Number(userTicket.purchaseTime),
          exited: userTicket.exited
        },
        referrerInfo,
        stakes
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeTransactionFailure() {
    const results = [];
    const amounts = [100, 300, 500, 1000];

    for (const amount of amounts) {
      const amountWei = ethers.parseEther(amount.toString());
      const analysis = { amount, amountWei: amountWei.toString() };

      try {
        // 尝试估算Gas
        const gasEstimate = await this.contract.buyTicket.estimateGas({
          value: amountWei,
          from: TARGET_USER
        });
        
        analysis.gasEstimate = gasEstimate.toString();
        analysis.success = true;
        
        // 尝试静态调用
        try {
          await this.contract.buyTicket.staticCall({
            value: amountWei,
            from: TARGET_USER
          });
          analysis.staticCallSuccess = true;
        } catch (staticError) {
          analysis.staticCallSuccess = false;
          analysis.staticCallError = staticError.message;
        }

      } catch (error) {
        analysis.success = false;
        analysis.error = error.message;
        analysis.errorCode = error.code;
        
        // 分析错误类型
        if (error.message.includes('insufficient funds')) {
          analysis.errorType = 'insufficient_funds';
        } else if (error.message.includes('missing revert data')) {
          analysis.errorType = 'missing_revert_data';
        } else if (error.message.includes('execution reverted')) {
          analysis.errorType = 'execution_reverted';
        } else {
          analysis.errorType = 'unknown';
        }
      }

      results.push(analysis);
    }

    return results;
  }

  async analyzeReferrerChain() {
    try {
      const userInfo = await this.contract.userInfo(TARGET_USER);
      
      if (userInfo.referrer === ethers.ZeroAddress) {
        return { hasReferrer: false, message: '用户未绑定推荐人' };
      }

      const referrerAddress = userInfo.referrer;
      const referrerInfo = await this.contract.userInfo(referrerAddress);
      
      // 检查推荐人是否是合约拥有者
      const owner = await this.contract.owner();
      const isOwnerReferrer = referrerAddress.toLowerCase() === owner.toLowerCase();

      return {
        hasReferrer: true,
        referrerAddress,
        isOwnerReferrer,
        referrerActive: referrerInfo.isActive,
        referrerTicketAmount: parseFloat(ethers.formatEther(referrerInfo.maxTicketAmount)),
        referrerDirects: Number(referrerInfo.activeDirects),
        referrerTeamCount: Number(referrerInfo.teamCount)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  generateFinalDiagnosis(data) {
    const issues = [];
    const solutions = [];
    
    // 分析合约访问问题
    if (data.contractStatus.userInfo && !data.contractStatus.userInfo.success) {
      issues.push({
        type: 'contract_access',
        severity: 'critical',
        description: '无法访问合约用户信息函数',
        details: data.contractStatus.userInfo.error
      });
      solutions.push('合约访问异常，可能是RPC节点问题或合约暂时不可用');
    }

    // 分析用户状态问题
    if (data.userStatus && !data.userStatus.error) {
      const { userInfo, userTicket } = data.userStatus;
      
      // 检查推荐人
      if (!userInfo.hasReferrer) {
        issues.push({
          type: 'no_referrer',
          severity: 'high',
          description: '用户未绑定推荐人'
        });
        solutions.push('绑定推荐人后再尝试购票');
      }

      // 检查现有门票
      if (userTicket.amount > 0 && !userTicket.exited) {
        issues.push({
          type: 'existing_ticket',
          severity: 'medium',
          description: `用户已有 ${userTicket.amount} MC 的活跃门票`
        });
        solutions.push('用户可以购买更大金额的门票进行升级');
      }

      // 检查收益上限
      if (userInfo.totalRevenue >= userInfo.currentCap) {
        issues.push({
          type: 'cap_reached',
          severity: 'high',
          description: '用户收益已达上限'
        });
        solutions.push('等待收益上限重置或升级门票');
      }
    }

    // 分析交易失败问题
    if (data.transactionAnalysis) {
      const failedTransactions = data.transactionAnalysis.filter(t => !t.success);
      const successfulTransactions = data.transactionAnalysis.filter(t => t.success);
      
      if (failedTransactions.length > 0) {
        const commonError = failedTransactions[0].errorType;
        issues.push({
          type: 'transaction_failure',
          severity: 'high',
          description: `交易模拟失败: ${commonError}`,
          details: failedTransactions.map(t => `${t.amount} MC: ${t.errorType}`)
        });
        
        if (commonError === 'insufficient_funds') {
          solutions.push('用户余额不足，需要充值更多MC');
        } else if (commonError === 'missing_revert_data') {
          solutions.push('可能是合约执行问题或参数错误');
        }
      }

      if (successfulTransactions.length > 0) {
        solutions.push(`用户可以尝试购买 ${successfulTransactions.map(t => t.amount).join(', ')} MC 的门票`);
      }
    }

    return {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      issues,
      solutions,
      canPurchase: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      recommendedAction: this.getRecommendedAction(issues)
    };
  }

  getRecommendedAction(issues) {
    if (issues.some(i => i.type === 'contract_access')) {
      return '等待合约访问恢复，或尝试刷新页面重新连接';
    }
    if (issues.some(i => i.type === 'no_referrer')) {
      return '立即绑定推荐人';
    }
    if (issues.some(i => i.type === 'cap_reached')) {
      return '等待收益上限重置';
    }
    if (issues.some(i => i.type === 'transaction_failure')) {
      return '检查余额并尝试购买较小金额门票';
    }
    return '尝试直接购票';
  }

  // 打印方法
  printBasicInfo(info) {
    console.log(`  💰 用户余额: ${info.balance} MC`);
    console.log(`  🌐 网络: Chain ID ${info.chainId}`);
    console.log(`  📊 区块高度: ${info.blockNumber}`);
  }

  printContractStatus(status) {
    Object.entries(status).forEach(([name, result]) => {
      if (result.success) {
        console.log(`  ✅ ${name}: 成功`);
        if (typeof result.result === 'boolean') {
          console.log(`    值: ${result.result}`);
        } else if (typeof result.result === 'string') {
          console.log(`    值: ${result.result}`);
        }
      } else {
        console.log(`  ❌ ${name}: 失败`);
        console.log(`    错误: ${result.error.substring(0, 100)}...`);
      }
    });
  }

  printUserStatus(status) {
    if (status.error) {
      console.log(`  ❌ 用户状态检查失败: ${status.error}`);
      return;
    }

    const { userInfo, userTicket, stakes } = status;
    console.log(`  👤 用户信息:`);
    console.log(`    推荐人: ${userInfo.hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
    console.log(`    活跃状态: ${userInfo.isActive ? '✅ 活跃' : '❌ 不活跃'}`);
    console.log(`    总收益: ${userInfo.totalRevenue} MC`);
    console.log(`    收益上限: ${userInfo.currentCap} MC`);
    console.log(`    最大门票: ${userInfo.maxTicketAmount} MC`);
    
    console.log(`  🎫 门票信息:`);
    console.log(`    门票ID: ${userTicket.ticketId}`);
    console.log(`    门票金额: ${userTicket.amount} MC`);
    console.log(`    已退出: ${userTicket.exited ? '是' : '否'}`);
    
    console.log(`  💎 质押记录: ${stakes.length} 条`);
    stakes.forEach((stake, i) => {
      console.log(`    ${i + 1}. ${stake.amount} MC, ${stake.cycleDays}天, ${stake.active ? '活跃' : '已结束'}`);
    });
  }

  printTransactionAnalysis(analysis) {
    console.log(`  🎫 交易模拟结果:`);
    analysis.forEach(result => {
      if (result.success) {
        console.log(`    ${result.amount} MC: ✅ 可购买 (Gas: ${result.gasEstimate})`);
        if (result.staticCallSuccess !== undefined) {
          console.log(`      静态调用: ${result.staticCallSuccess ? '✅ 成功' : '❌ 失败'}`);
          if (!result.staticCallSuccess) {
            console.log(`      静态调用错误: ${result.staticCallError?.substring(0, 50)}...`);
          }
        }
      } else {
        console.log(`    ${result.amount} MC: ❌ 失败 (${result.errorType})`);
        console.log(`      错误: ${result.error?.substring(0, 80)}...`);
      }
    });
  }

  printReferrerAnalysis(analysis) {
    if (analysis.error) {
      console.log(`  ❌ 推荐人分析失败: ${analysis.error}`);
      return;
    }

    if (!analysis.hasReferrer) {
      console.log(`  ❌ ${analysis.message}`);
      return;
    }

    console.log(`  ✅ 推荐人已绑定: ${analysis.referrerAddress}`);
    console.log(`  👑 是否为合约拥有者: ${analysis.isOwnerReferrer ? '是' : '否'}`);
    console.log(`  🎯 推荐人活跃状态: ${analysis.referrerActive ? '活跃' : '不活跃'}`);
    console.log(`  🎫 推荐人最大门票: ${analysis.referrerTicketAmount} MC`);
    console.log(`  👥 推荐人直推数: ${analysis.referrerDirects}`);
    console.log(`  🌐 推荐人团队数: ${analysis.referrerTeamCount}`);
  }

  printFinalDiagnosis(diagnosis) {
    console.log(`\n📊 最终诊断结果:`);
    console.log(`  🔍 发现问题: ${diagnosis.totalIssues} 个`);
    console.log(`  🚨 严重问题: ${diagnosis.criticalIssues} 个`);
    console.log(`  ⚠️ 高优先级: ${diagnosis.highIssues} 个`);
    console.log(`  🎫 可购票状态: ${diagnosis.canPurchase ? '✅ 理论上可以' : '❌ 存在阻碍'}`);

    if (diagnosis.issues.length > 0) {
      console.log(`\n🔧 发现的问题:`);
      diagnosis.issues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`  ${index + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
        if (issue.details) {
          if (Array.isArray(issue.details)) {
            issue.details.forEach(detail => console.log(`      - ${detail}`));
          } else {
            console.log(`      详情: ${issue.details}`);
          }
        }
      });
    }

    if (diagnosis.solutions.length > 0) {
      console.log(`\n💡 建议的解决方案:`);
      diagnosis.solutions.forEach((solution, index) => {
        console.log(`  ${index + 1}. ${solution}`);
      });
    }

    console.log(`\n🎯 推荐行动: ${diagnosis.recommendedAction}`);
  }
}

// 主执行函数
async function main() {
  const analyzer = new DeepPurchaseAnalyzer();
  
  try {
    await analyzer.analyzeDeepPurchaseIssue();
  } catch (error) {
    console.error('❌ 深度分析失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('deep-purchase-analysis.js')) {
  main().catch(console.error);
}

export { DeepPurchaseAnalyzer };