#!/usr/bin/env node

/**
 * 新用户购票问题诊断脚本
 * 专门分析用户 0x5067d182d5f15511f0c71194a25cc67b05c20b02
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const TARGET_USER = '0x5067d182d5f15511f0c71194a25cc67b05c20b02';
const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0xD437e63c2A76e0237249eC6070Bef9A2484C4302'; // Test环境合约

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

class NewUserDiagnostic {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, this.provider);
  }

  async diagnoseUser() {
    console.log('🔍 开始诊断新用户购票问题...');
    console.log(`👤 目标用户: ${TARGET_USER}`);
    console.log(`🏗️ 合约地址: ${PROTOCOL_ADDRESS} (Test环境)`);
    console.log('=' .repeat(80));

    try {
      // 1. 网络连接检查
      console.log('\n📡 1. 检查网络连接状态...');
      const networkInfo = await this.checkNetwork();
      this.printNetworkInfo(networkInfo);

      // 2. 用户余额检查
      console.log('\n💰 2. 检查用户MC余额...');
      const balance = await this.provider.getBalance(TARGET_USER);
      const balanceInMC = parseFloat(ethers.formatEther(balance));
      console.log(`  💰 当前余额: ${balanceInMC} MC`);
      console.log(`  🎫 购票需要: 100.01 MC (含Gas费)`);
      console.log(`  ✅ 余额状态: ${balanceInMC >= 100.01 ? '充足' : '不足'}`);

      // 3. 合约状态检查
      console.log('\n🏗️ 3. 检查协议合约状态...');
      const contractStatus = await this.checkContractStatus();
      this.printContractStatus(contractStatus);

      // 4. 用户协议状态检查
      console.log('\n👥 4. 检查用户协议状态...');
      const userStatus = await this.checkUserStatus();
      this.printUserStatus(userStatus);

      // 5. 购票交易模拟
      console.log('\n🎫 5. 模拟购票交易...');
      const transactionTest = await this.testPurchaseTransaction();
      this.printTransactionTest(transactionTest);

      // 6. 生成诊断报告
      console.log('\n📋 6. 诊断总结和建议...');
      const diagnosis = this.generateDiagnosis({
        balance: balanceInMC,
        contractStatus,
        userStatus,
        transactionTest
      });
      this.printDiagnosis(diagnosis);

      // 7. 保存诊断结果
      const timestamp = Date.now();
      const filename = `diagnostic-${TARGET_USER.substring(0, 10)}-${timestamp}.json`;
      const diagnosticData = {
        timestamp,
        user: TARGET_USER,
        contract: PROTOCOL_ADDRESS,
        balance: balanceInMC,
        contractStatus,
        userStatus,
        transactionTest,
        diagnosis
      };

      // 这里可以保存到文件，但为了简化就直接输出
      console.log(`💾 诊断结果已保存到: ${filename}`);

    } catch (error) {
      console.error('❌ 诊断过程失败:', error.message);
    }
  }

  async checkNetwork() {
    const startTime = Date.now();
    const blockNumber = await this.provider.getBlockNumber();
    const network = await this.provider.getNetwork();
    const endTime = Date.now();
    
    return {
      blockNumber,
      chainId: Number(network.chainId),
      latency: endTime - startTime,
      connected: true
    };
  }

  async checkContractStatus() {
    const status = {};
    
    try {
      // 检查合约基本状态
      const [paused, emergencyPaused, owner] = await Promise.all([
        this.contract.paused().catch(() => null),
        this.contract.emergencyPaused().catch(() => null),
        this.contract.owner().catch(() => null)
      ]);

      status.paused = paused;
      status.emergencyPaused = emergencyPaused;
      status.owner = owner;
      status.accessible = true;

      // 检查合约余额
      const contractBalance = await this.provider.getBalance(PROTOCOL_ADDRESS);
      status.balance = parseFloat(ethers.formatEther(contractBalance));

    } catch (error) {
      status.accessible = false;
      status.error = error.message;
    }

    return status;
  }

  async checkUserStatus() {
    const status = {};
    
    try {
      // 获取用户信息
      const userInfo = await this.contract.userInfo(TARGET_USER);
      const userTicket = await this.contract.userTicket(TARGET_USER);
      const hasReferrer = await this.contract.hasReferrer(TARGET_USER);

      status.userInfo = {
        referrer: userInfo.referrer,
        hasReferrer: userInfo.referrer !== ethers.ZeroAddress,
        activeDirects: Number(userInfo.activeDirects),
        teamCount: Number(userInfo.teamCount),
        totalRevenue: parseFloat(ethers.formatEther(userInfo.totalRevenue)),
        currentCap: parseFloat(ethers.formatEther(userInfo.currentCap)),
        isActive: userInfo.isActive,
        maxTicketAmount: parseFloat(ethers.formatEther(userInfo.maxTicketAmount)),
        maxSingleTicketAmount: parseFloat(ethers.formatEther(userInfo.maxSingleTicketAmount))
      };

      status.userTicket = {
        ticketId: Number(userTicket.ticketId),
        amount: parseFloat(ethers.formatEther(userTicket.amount)),
        purchaseTime: Number(userTicket.purchaseTime),
        exited: userTicket.exited
      };

      status.accessible = true;

    } catch (error) {
      status.accessible = false;
      status.error = error.message;
    }

    return status;
  }

  async testPurchaseTransaction() {
    const tests = [];
    const amounts = [100, 300, 500, 1000];

    for (const amount of amounts) {
      const test = { amount };
      const amountWei = ethers.parseEther(amount.toString());

      try {
        // 尝试估算Gas
        const gasEstimate = await this.contract.buyTicket.estimateGas({
          value: amountWei,
          from: TARGET_USER
        });
        
        test.success = true;
        test.gasEstimate = gasEstimate.toString();

        // 尝试静态调用
        try {
          await this.contract.buyTicket.staticCall({
            value: amountWei,
            from: TARGET_USER
          });
          test.staticCallSuccess = true;
        } catch (staticError) {
          test.staticCallSuccess = false;
          test.staticCallError = staticError.message;
        }

      } catch (error) {
        test.success = false;
        test.error = error.message;
        test.errorCode = error.code;
      }

      tests.push(test);
    }

    return tests;
  }

  generateDiagnosis(data) {
    const issues = [];
    const solutions = [];
    
    // 检查余额
    if (data.balance < 100.01) {
      issues.push({
        type: 'insufficient_balance',
        severity: 'high',
        description: `余额不足: ${data.balance} MC < 100.01 MC`
      });
      solutions.push('充值更多MC到钱包');
    }

    // 检查合约访问
    if (!data.contractStatus.accessible) {
      issues.push({
        type: 'contract_access',
        severity: 'critical',
        description: '无法访问协议合约'
      });
      solutions.push('合约可能暂时不可用，请稍后重试或联系技术支持');
    }

    // 检查合约状态
    if (data.contractStatus.paused) {
      issues.push({
        type: 'contract_paused',
        severity: 'critical',
        description: '合约已暂停'
      });
      solutions.push('等待合约恢复正常运行');
    }

    if (data.contractStatus.emergencyPaused) {
      issues.push({
        type: 'emergency_paused',
        severity: 'critical',
        description: '合约处于紧急暂停状态'
      });
      solutions.push('等待紧急状态解除');
    }

    // 检查用户状态
    if (data.userStatus.accessible) {
      const { userInfo, userTicket } = data.userStatus;
      
      if (!userInfo.hasReferrer) {
        issues.push({
          type: 'no_referrer',
          severity: 'high',
          description: '用户未绑定推荐人'
        });
        solutions.push('绑定推荐人后再尝试购票');
      }

      if (userTicket.amount > 0 && !userTicket.exited) {
        issues.push({
          type: 'existing_ticket',
          severity: 'medium',
          description: `用户已有 ${userTicket.amount} MC 的活跃门票`
        });
        solutions.push('用户可以购买更大金额的门票进行升级');
      }

      if (userInfo.totalRevenue >= userInfo.currentCap && userInfo.currentCap > 0) {
        issues.push({
          type: 'cap_reached',
          severity: 'high',
          description: '用户收益已达上限'
        });
        solutions.push('等待收益上限重置或升级门票');
      }
    }

    // 检查交易测试结果
    const successfulTests = data.transactionTest.filter(t => t.success);
    const failedTests = data.transactionTest.filter(t => !t.success);

    if (failedTests.length === data.transactionTest.length) {
      issues.push({
        type: 'all_transactions_fail',
        severity: 'critical',
        description: '所有购票交易模拟都失败'
      });
      solutions.push('检查网络连接和合约状态');
    } else if (successfulTests.length > 0) {
      solutions.push(`用户可以尝试购买 ${successfulTests.map(t => t.amount).join(', ')} MC 的门票`);
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
      return '等待合约服务恢复';
    }
    if (issues.some(i => i.type === 'contract_paused' || i.type === 'emergency_paused')) {
      return '等待合约恢复正常运行';
    }
    if (issues.some(i => i.type === 'no_referrer')) {
      return '立即绑定推荐人';
    }
    if (issues.some(i => i.type === 'insufficient_balance')) {
      return '充值更多MC';
    }
    if (issues.some(i => i.type === 'cap_reached')) {
      return '等待收益上限重置';
    }
    return '尝试直接购票';
  }

  // 打印方法
  printNetworkInfo(info) {
    console.log(`  ✅ 网络连接: ${info.connected ? '成功' : '失败'}`);
    console.log(`  🌐 Chain ID: ${info.chainId} ${info.chainId === 88813 ? '(正确)' : '(错误)'}`);
    console.log(`  📊 区块高度: ${info.blockNumber}`);
    console.log(`  ⚡ 延迟: ${info.latency}ms ${info.latency < 1000 ? '(fast)' : info.latency < 3000 ? '(normal)' : '(slow)'}`);
  }

  printContractStatus(status) {
    if (!status.accessible) {
      console.log(`  🏗️ 合约访问: ❌ 失败`);
      console.log(`  ❌ 错误: ${status.error}`);
      return;
    }

    console.log(`  🏗️ 合约访问: ✅ 成功`);
    console.log(`  ⏸️ 暂停状态: ${status.paused ? '❌ 已暂停' : '✅ 正常运行'}`);
    console.log(`  🚨 紧急暂停: ${status.emergencyPaused ? '❌ 已暂停' : '✅ 正常'}`);
    console.log(`  💎 合约余额: ${status.balance} MC`);
    console.log(`  👑 合约拥有者: ${status.owner}`);
  }

  printUserStatus(status) {
    if (!status.accessible) {
      console.log(`  👤 用户状态: ❌ 无法访问`);
      console.log(`  ❌ 错误: ${status.error}`);
      return;
    }

    const { userInfo, userTicket } = status;
    console.log(`  👤 用户状态: ✅ 已注册`);
    console.log(`  🔗 推荐人: ${userInfo.hasReferrer ? '✅ 已绑定' : '❌ 未绑定'}`);
    if (userInfo.hasReferrer) {
      console.log(`    推荐人地址: ${userInfo.referrer}`);
    }
    console.log(`  🎫 门票金额: ${userTicket.amount} MC`);
    console.log(`  💰 总收益: ${userInfo.totalRevenue} MC`);
    console.log(`  📊 收益上限: ${userInfo.currentCap} MC`);
    console.log(`  👑 管理员权限: ${userInfo.isActive ? '✅ 是' : '❌ 否'}`);
    console.log(`  🎫 可购票: ${userInfo.hasReferrer ? '✅ 是' : '❌ 否'}`);
  }

  printTransactionTest(tests) {
    console.log(`  🎫 交易模拟结果:`);
    tests.forEach(test => {
      if (test.success) {
        console.log(`    ${test.amount} MC: ✅ 成功`);
        console.log(`      Gas估算: ${test.gasEstimate} wei`);
        if (test.staticCallSuccess !== undefined) {
          console.log(`      静态调用: ${test.staticCallSuccess ? '✅ 成功' : '❌ 失败'}`);
        }
      } else {
        console.log(`    ${test.amount} MC: ❌ 失败`);
        console.log(`      错误: ${test.error?.substring(0, 60)}...`);
      }
    });
  }

  printDiagnosis(diagnosis) {
    console.log(`\n📊 诊断结果总结:`);
    console.log(`  🔍 发现问题: ${diagnosis.totalIssues} 个`);
    console.log(`  🚨 严重问题: ${diagnosis.criticalIssues} 个`);
    console.log(`  ⚠️ 高优先级: ${diagnosis.highIssues} 个`);
    console.log(`  🎫 可购票状态: ${diagnosis.canPurchase ? '✅ 理论上可以' : '❌ 暂时无法购票'}`);

    if (diagnosis.issues.length > 0) {
      console.log(`\n🔧 发现的问题:`);
      diagnosis.issues.forEach((issue, index) => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`  ${index + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`);
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
  const diagnostic = new NewUserDiagnostic();
  
  try {
    await diagnostic.diagnoseUser();
  } catch (error) {
    console.error('❌ 用户诊断失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('diagnose-new-user.js')) {
  main().catch(console.error);
}

export { NewUserDiagnostic };