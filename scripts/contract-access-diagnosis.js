#!/usr/bin/env node

/**
 * 合约访问诊断脚本
 * 专门诊断合约访问异常问题
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const TARGET_USER = '0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82';
const MC_CHAIN_ID = 88813;
const PROTOCOL_ADDRESS = '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5';

// 多个RPC端点
const RPC_URLS = [
  'https://chain.mcerscan.com/'
];

// 协议合约ABI
const PROTOCOL_ABI = [
  "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
  "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function owner() view returns (address)",
  "function buyTicket() external payable"
];

class ContractAccessDiagnostic {
  constructor() {
    this.providers = RPC_URLS.map(url => new ethers.JsonRpcProvider(url));
    this.contracts = this.providers.map(provider => 
      new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider)
    );
  }

  async diagnoseContractAccess() {
    console.log('🔍 诊断合约访问问题...');
    console.log(`👤 用户地址: ${TARGET_USER}`);
    console.log(`🏗️ 合约地址: ${PROTOCOL_ADDRESS}`);
    console.log('=' .repeat(70));

    const results = [];

    for (let i = 0; i < RPC_URLS.length; i++) {
      const rpcUrl = RPC_URLS[i];
      const provider = this.providers[i];
      const contract = this.contracts[i];

      console.log(`\n📡 测试RPC端点 ${i + 1}: ${rpcUrl}`);
      
      const result = {
        rpcUrl,
        index: i + 1,
        tests: {}
      };

      try {
        // 1. 基础网络连接测试
        const startTime = Date.now();
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const latency = Date.now() - startTime;
        
        result.tests.network = {
          success: true,
          chainId: Number(network.chainId),
          blockNumber,
          latency
        };
        
        console.log(`  ✅ 网络连接: 成功 (${latency}ms)`);
        console.log(`  🌐 Chain ID: ${Number(network.chainId)}`);
        console.log(`  📊 区块高度: ${blockNumber}`);

        // 2. 合约基础函数测试
        const contractTests = [
          { name: 'paused', func: () => contract.paused() },
          { name: 'emergencyPaused', func: () => contract.emergencyPaused() },
          { name: 'owner', func: () => contract.owner() },
          { name: 'userInfo', func: () => contract.userInfo(TARGET_USER) },
          { name: 'userTicket', func: () => contract.userTicket(TARGET_USER) }
        ];

        for (const test of contractTests) {
          try {
            const testStart = Date.now();
            const testResult = await test.func();
            const testLatency = Date.now() - testStart;
            
            result.tests[test.name] = {
              success: true,
              result: testResult,
              latency: testLatency
            };
            
            console.log(`  ✅ ${test.name}: 成功 (${testLatency}ms)`);
          } catch (error) {
            result.tests[test.name] = {
              success: false,
              error: error.message
            };
            
            console.log(`  ❌ ${test.name}: 失败 - ${error.message}`);
          }
        }

        // 3. 购票交易模拟测试
        try {
          const gasEstimate = await contract.buyTicket.estimateGas({ 
            value: ethers.parseEther("100"),
            from: TARGET_USER 
          });
          
          result.tests.buyTicketSimulation = {
            success: true,
            gasEstimate: gasEstimate.toString()
          };
          
          console.log(`  ✅ 购票模拟: 成功 (Gas: ${gasEstimate})`);
        } catch (error) {
          result.tests.buyTicketSimulation = {
            success: false,
            error: error.message
          };
          
          console.log(`  ❌ 购票模拟: 失败 - ${error.message}`);
        }

      } catch (error) {
        result.tests.network = {
          success: false,
          error: error.message
        };
        
        console.log(`  ❌ 网络连接: 失败 - ${error.message}`);
      }

      results.push(result);
    }

    // 分析结果
    this.analyzeResults(results);
    
    return results;
  }

  analyzeResults(results) {
    console.log('\n📊 诊断结果分析:');
    console.log('=' .repeat(70));

    const workingRPCs = results.filter(r => r.tests.network?.success);
    const contractAccessible = results.filter(r => 
      r.tests.paused?.success || r.tests.owner?.success
    );
    const canSimulatePurchase = results.filter(r => 
      r.tests.buyTicketSimulation?.success
    );

    console.log(`\n🌐 RPC端点状态:`);
    console.log(`  ✅ 可用RPC: ${workingRPCs.length}/${results.length}`);
    console.log(`  🏗️ 合约可访问: ${contractAccessible.length}/${results.length}`);
    console.log(`  🎫 可模拟购票: ${canSimulatePurchase.length}/${results.length}`);

    if (workingRPCs.length === 0) {
      console.log('\n🚨 严重问题: 所有RPC端点都无法访问');
      console.log('💡 建议: 检查网络连接或联系技术支持');
    } else if (contractAccessible.length === 0) {
      console.log('\n⚠️ 合约访问问题: 所有RPC都无法访问合约函数');
      console.log('💡 可能原因:');
      console.log('  - 合约正在升级或维护');
      console.log('  - 合约地址发生变更');
      console.log('  - RPC节点同步问题');
    } else if (canSimulatePurchase.length > 0) {
      console.log('\n✅ 好消息: 用户可以尝试购票！');
      console.log('💡 建议:');
      console.log('  - 直接在前端尝试购票');
      console.log('  - 如果失败，尝试刷新页面重新连接');
      console.log('  - 确保钱包连接到正确的网络');
    }

    // 推荐最佳RPC
    if (canSimulatePurchase.length > 0) {
      const bestRPC = canSimulatePurchase.reduce((best, current) => {
        const bestLatency = best.tests.network?.latency || Infinity;
        const currentLatency = current.tests.network?.latency || Infinity;
        return currentLatency < bestLatency ? current : best;
      });

      console.log(`\n🎯 推荐使用RPC: ${bestRPC.rpcUrl}`);
      console.log(`   延迟: ${bestRPC.tests.network.latency}ms`);
    }
  }
}

// 主执行函数
async function main() {
  const diagnostic = new ContractAccessDiagnostic();
  
  try {
    await diagnostic.diagnoseContractAccess();
  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('contract-access-diagnosis.js')) {
  main().catch(console.error);
}

export { ContractAccessDiagnostic };