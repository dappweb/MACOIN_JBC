#!/usr/bin/env node

/**
 * Check Owner Addresses for Both P-Prod and Test Environments
 * Compares contract owners between production and test branches
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Environment configurations
const ENVIRONMENTS = {
  'p-prod': {
    name: 'Production (p-prod branch)',
    protocolAddress: '0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5',
    jbcAddress: '0x1Bf9ACe2485BC3391150762a109886d0B85f40Da',
    rpcUrl: 'https://chain.mcerscan.com/',
    description: 'Production environment deployed from p-prod branch'
  },
  'test': {
    name: 'Test/Preview (test branch)',
    protocolAddress: process.env.TEST_PROTOCOL_CONTRACT_ADDRESS || '0x7a216BeA62eF7629904E0d30b24F6842c9b0d660',
    jbcAddress: process.env.TEST_JBC_CONTRACT_ADDRESS || '0xA743cB357a9f59D349efB7985072779a094658dD',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://chain.mcerscan.com/',
    description: 'Test environment deployed from test branch'
  }
};

// Contract ABI for owner checks
const OWNER_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function emergencyPaused() view returns (bool)",
  "function liquidityEnabled() view returns (bool)",
  "function redeemEnabled() view returns (bool)"
];

async function checkEnvironmentOwner(envKey, config) {
  console.log(`\n🔍 Checking ${config.name}`);
  console.log("=".repeat(60));
  
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    console.log(`🌐 RPC URL: ${config.rpcUrl}`);
    console.log(`📋 Protocol Contract: ${config.protocolAddress}`);
    console.log(`🪙 JBC Contract: ${config.jbcAddress}`);
    
    // Check network
    const network = await provider.getNetwork();
    console.log(`📡 Chain ID: ${network.chainId}`);
    
    // Check protocol contract owner
    const protocolContract = new ethers.Contract(config.protocolAddress, OWNER_ABI, provider);
    
    console.log("\n📊 PROTOCOL CONTRACT ANALYSIS");
    console.log("-".repeat(40));
    
    const protocolOwner = await protocolContract.owner();
    console.log(`👑 Protocol Owner: ${protocolOwner}`);
    
    // Check contract status
    try {
      const liquidityEnabled = await protocolContract.liquidityEnabled();
      console.log(`💧 Liquidity Enabled: ${liquidityEnabled ? "YES" : "NO"}`);
    } catch (e) {
      console.log("💧 Liquidity Enabled: Unable to check");
    }
    
    try {
      const redeemEnabled = await protocolContract.redeemEnabled();
      console.log(`🔄 Redeem Enabled: ${redeemEnabled ? "YES" : "NO"}`);
    } catch (e) {
      console.log("🔄 Redeem Enabled: Unable to check");
    }
    
    try {
      const emergencyPaused = await protocolContract.emergencyPaused();
      console.log(`🚨 Emergency Paused: ${emergencyPaused ? "YES" : "NO"}`);
    } catch (e) {
      console.log("🚨 Emergency Paused: Unable to check");
    }
    
    // Check JBC contract owner (if it has owner function)
    console.log("\n🪙 JBC CONTRACT ANALYSIS");
    console.log("-".repeat(40));
    
    try {
      const jbcContract = new ethers.Contract(config.jbcAddress, OWNER_ABI, provider);
      const jbcOwner = await jbcContract.owner();
      console.log(`👑 JBC Owner: ${jbcOwner}`);
    } catch (e) {
      console.log("👑 JBC Owner: Unable to check (may not have owner function)");
    }
    
    return {
      environment: envKey,
      protocolOwner,
      protocolAddress: config.protocolAddress,
      jbcAddress: config.jbcAddress,
      chainId: network.chainId.toString(),
      status: 'success'
    };
    
  } catch (error) {
    console.error(`❌ Error checking ${config.name}:`, error.message);
    return {
      environment: envKey,
      error: error.message,
      status: 'error'
    };
  }
}

async function compareEnvironments() {
  console.log("🔍 JINBAO PROTOCOL - ENVIRONMENT OWNER COMPARISON");
  console.log("=".repeat(80));
  console.log("📅 Date:", new Date().toISOString());
  console.log("🎯 Purpose: Compare contract owners between p-prod and test branches");
  
  const results = {};
  
  // Check each environment
  for (const [envKey, config] of Object.entries(ENVIRONMENTS)) {
    results[envKey] = await checkEnvironmentOwner(envKey, config);
  }
  
  // Summary comparison
  console.log("\n📊 ENVIRONMENT COMPARISON SUMMARY");
  console.log("=".repeat(80));
  
  const prodResult = results['p-prod'];
  const testResult = results['test'];
  
  if (prodResult.status === 'success' && testResult.status === 'success') {
    console.log("\n🏭 PRODUCTION ENVIRONMENT (p-prod branch)");
    console.log("-".repeat(50));
    console.log(`👑 Protocol Owner: ${prodResult.protocolOwner}`);
    console.log(`📋 Protocol Contract: ${prodResult.protocolAddress}`);
    console.log(`🪙 JBC Contract: ${prodResult.jbcAddress}`);
    console.log(`📡 Chain ID: ${prodResult.chainId}`);
    
    console.log("\n🧪 TEST ENVIRONMENT (test branch)");
    console.log("-".repeat(50));
    console.log(`👑 Protocol Owner: ${testResult.protocolOwner}`);
    console.log(`📋 Protocol Contract: ${testResult.protocolAddress}`);
    console.log(`🪙 JBC Contract: ${testResult.jbcAddress}`);
    console.log(`📡 Chain ID: ${testResult.chainId}`);
    
    // Compare owners
    console.log("\n🔄 OWNER COMPARISON");
    console.log("-".repeat(50));
    
    const sameOwner = prodResult.protocolOwner.toLowerCase() === testResult.protocolOwner.toLowerCase();
    
    if (sameOwner) {
      console.log("✅ SAME OWNER: Both environments have the same protocol owner");
      console.log(`👑 Common Owner: ${prodResult.protocolOwner}`);
    } else {
      console.log("⚠️ DIFFERENT OWNERS: Environments have different protocol owners");
      console.log(`🏭 Production Owner: ${prodResult.protocolOwner}`);
      console.log(`🧪 Test Owner: ${testResult.protocolOwner}`);
    }
    
    // Compare contracts
    console.log("\n📋 CONTRACT COMPARISON");
    console.log("-".repeat(50));
    
    const sameProtocol = prodResult.protocolAddress.toLowerCase() === testResult.protocolAddress.toLowerCase();
    const sameJBC = prodResult.jbcAddress.toLowerCase() === testResult.jbcAddress.toLowerCase();
    
    console.log(`📋 Protocol Contracts: ${sameProtocol ? "SAME" : "DIFFERENT"}`);
    console.log(`🪙 JBC Contracts: ${sameJBC ? "SAME" : "DIFFERENT"}`);
    
    if (!sameProtocol) {
      console.log(`   🏭 Prod Protocol: ${prodResult.protocolAddress}`);
      console.log(`   🧪 Test Protocol: ${testResult.protocolAddress}`);
    }
    
    if (!sameJBC) {
      console.log(`   🏭 Prod JBC: ${prodResult.jbcAddress}`);
      console.log(`   🧪 Test JBC: ${testResult.jbcAddress}`);
    }
    
  } else {
    console.log("❌ Unable to complete comparison due to errors in one or both environments");
    
    if (prodResult.status === 'error') {
      console.log(`🏭 Production Error: ${prodResult.error}`);
    }
    
    if (testResult.status === 'error') {
      console.log(`🧪 Test Error: ${testResult.error}`);
    }
  }
  
  // Check specific address permissions
  console.log("\n🎯 SPECIFIC ADDRESS ANALYSIS");
  console.log("=".repeat(80));
  
  const targetAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  console.log(`🎯 Target Address: ${targetAddress}`);
  
  for (const [envKey, result] of Object.entries(results)) {
    if (result.status === 'success') {
      const isOwner = result.protocolOwner.toLowerCase() === targetAddress.toLowerCase();
      console.log(`${envKey === 'p-prod' ? '🏭' : '🧪'} ${ENVIRONMENTS[envKey].name}: ${isOwner ? '✅ IS OWNER' : '❌ NOT OWNER'}`);
    }
  }
  
  return results;
}

async function generateReport(results) {
  console.log("\n📄 GENERATING DETAILED REPORT");
  console.log("=".repeat(80));
  
  const reportData = {
    timestamp: new Date().toISOString(),
    environments: results,
    targetAddress: "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48",
    summary: {
      sameOwners: false,
      sameContracts: false,
      targetHasAdminRights: false
    }
  };
  
  if (results['p-prod'].status === 'success' && results['test'].status === 'success') {
    reportData.summary.sameOwners = results['p-prod'].protocolOwner.toLowerCase() === results['test'].protocolOwner.toLowerCase();
    reportData.summary.sameContracts = results['p-prod'].protocolAddress.toLowerCase() === results['test'].protocolAddress.toLowerCase();
    
    const targetAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
    reportData.summary.targetHasAdminRights = 
      results['p-prod'].protocolOwner.toLowerCase() === targetAddress.toLowerCase() ||
      results['test'].protocolOwner.toLowerCase() === targetAddress.toLowerCase();
  }
  
  console.log("✅ Report data compiled");
  console.log(`📊 Same Owners: ${reportData.summary.sameOwners ? 'YES' : 'NO'}`);
  console.log(`📋 Same Contracts: ${reportData.summary.sameContracts ? 'YES' : 'NO'}`);
  console.log(`🎯 Target Has Admin Rights: ${reportData.summary.targetHasAdminRights ? 'YES' : 'NO'}`);
  
  return reportData;
}

// Main execution
async function main() {
  try {
    const results = await compareEnvironments();
    const report = await generateReport(results);
    
    console.log("\n🎉 ANALYSIS COMPLETE");
    console.log("=".repeat(80));
    console.log("✅ Environment comparison completed");
    console.log("✅ Owner verification completed");
    console.log("✅ Contract analysis completed");
    console.log("\n📋 Key Findings:");
    console.log(`   • Same owners across environments: ${report.summary.sameOwners ? 'YES' : 'NO'}`);
    console.log(`   • Same contracts across environments: ${report.summary.sameContracts ? 'YES' : 'NO'}`);
    console.log(`   • Target address has admin rights: ${report.summary.targetHasAdminRights ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error("❌ Fatal error during analysis:", error);
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { compareEnvironments, generateReport };