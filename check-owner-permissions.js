#!/usr/bin/env node

/**
 * Check Owner Permissions Script
 * Verifies if address 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48 has admin rights
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Contract addresses (update with actual deployed addresses)
const PROTOCOL_CONTRACT_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
const TARGET_ADDRESS = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";

// MC Chain RPC
const RPC_URL = process.env.MC_RPC_URL || "https://mc-rpc.com";

// Minimal ABI for owner check
const OWNER_ABI = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function emergencyPaused() view returns (bool)"
];

async function checkOwnerPermissions() {
    console.log("🔍 Checking Admin Permissions for JinbaoProtocol");
    console.log("=" .repeat(60));
    
    try {
        // Setup provider
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        console.log(`🌐 Connected to MC Chain: ${RPC_URL}`);
        
        // Setup contract
        const contract = new ethers.Contract(PROTOCOL_CONTRACT_ADDRESS, OWNER_ABI, provider);
        console.log(`📋 Contract Address: ${PROTOCOL_CONTRACT_ADDRESS}`);
        console.log(`🎯 Target Address: ${TARGET_ADDRESS}`);
        console.log("");
        
        // Check current owner
        console.log("🔍 Checking Contract Owner...");
        const currentOwner = await contract.owner();
        console.log(`👑 Current Owner: ${currentOwner}`);
        
        // Compare addresses (case-insensitive)
        const isOwner = currentOwner.toLowerCase() === TARGET_ADDRESS.toLowerCase();
        
        console.log("");
        console.log("📊 PERMISSION ANALYSIS");
        console.log("-".repeat(40));
        
        if (isOwner) {
            console.log("✅ STATUS: FULL ADMIN RIGHTS");
            console.log("🔑 The target address IS the contract owner");
            console.log("");
            console.log("🚨 ADMIN CAPABILITIES:");
            console.log("  ✅ Emergency pause/unpause");
            console.log("  ✅ Contract upgrades");
            console.log("  ✅ Wallet configuration");
            console.log("  ✅ Fee and tax settings");
            console.log("  ✅ Liquidity management");
            console.log("  ✅ Reserve withdrawals");
            console.log("  ✅ User management");
            console.log("  ✅ Token recovery");
            console.log("");
            console.log("⚠️  SECURITY IMPACT: MAXIMUM");
            console.log("   This address has complete control over the protocol");
        } else {
            console.log("❌ STATUS: NO ADMIN RIGHTS");
            console.log("🔒 The target address is NOT the contract owner");
            console.log("");
            console.log("📋 AVAILABLE FUNCTIONS:");
            console.log("  ✅ Regular user functions only");
            console.log("  ❌ No admin privileges");
            console.log("  ❌ Cannot modify protocol settings");
            console.log("  ❌ Cannot pause/upgrade contract");
        }
        
        // Check contract status
        console.log("");
        console.log("🔧 CONTRACT STATUS");
        console.log("-".repeat(40));
        
        try {
            const isPaused = await contract.paused();
            console.log(`⏸️  Paused: ${isPaused ? "YES" : "NO"}`);
        } catch (e) {
            console.log("⏸️  Paused: Unable to check (method may not exist)");
        }
        
        try {
            const isEmergencyPaused = await contract.emergencyPaused();
            console.log(`🚨 Emergency Paused: ${isEmergencyPaused ? "YES" : "NO"}`);
        } catch (e) {
            console.log("🚨 Emergency Paused: Unable to check (method may not exist)");
        }
        
        // Network info
        console.log("");
        console.log("🌐 NETWORK INFORMATION");
        console.log("-".repeat(40));
        const network = await provider.getNetwork();
        console.log(`📡 Chain ID: ${network.chainId}`);
        console.log(`🏷️  Network Name: ${network.name || "MC Chain"}`);
        
        // Block info
        const blockNumber = await provider.getBlockNumber();
        console.log(`📦 Current Block: ${blockNumber}`);
        
        console.log("");
        console.log("✅ Permission check completed successfully!");
        
    } catch (error) {
        console.error("❌ Error checking permissions:", error.message);
        
        if (error.message.includes("could not detect network")) {
            console.log("");
            console.log("💡 TROUBLESHOOTING:");
            console.log("  - Check if MC_RPC_URL is correct");
            console.log("  - Verify network connectivity");
            console.log("  - Ensure MC Chain RPC is accessible");
        }
        
        if (error.message.includes("call revert")) {
            console.log("");
            console.log("💡 TROUBLESHOOTING:");
            console.log("  - Check if PROTOCOL_CONTRACT_ADDRESS is correct");
            console.log("  - Verify contract is deployed on this network");
            console.log("  - Ensure contract implements Ownable interface");
        }
        
        process.exit(1);
    }
}

// Additional function to check specific admin functions
async function checkAdminFunctionAccess() {
    console.log("");
    console.log("🔧 TESTING ADMIN FUNCTION ACCESS");
    console.log("=" .repeat(60));
    
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Extended ABI for testing admin functions
        const extendedABI = [
            "function owner() view returns (address)",
            "function emergencyPaused() view returns (bool)",
            "function liquidityEnabled() view returns (bool)",
            "function redeemEnabled() view returns (bool)",
            "function directRewardPercent() view returns (uint256)",
            "function levelRewardPercent() view returns (uint256)"
        ];
        
        const contract = new ethers.Contract(PROTOCOL_CONTRACT_ADDRESS, extendedABI, provider);
        
        console.log("📊 Current Protocol Settings:");
        console.log("-".repeat(40));
        
        try {
            const liquidityEnabled = await contract.liquidityEnabled();
            console.log(`💧 Liquidity Enabled: ${liquidityEnabled ? "YES" : "NO"}`);
        } catch (e) {
            console.log("💧 Liquidity Enabled: Unable to read");
        }
        
        try {
            const redeemEnabled = await contract.redeemEnabled();
            console.log(`🔄 Redeem Enabled: ${redeemEnabled ? "YES" : "NO"}`);
        } catch (e) {
            console.log("🔄 Redeem Enabled: Unable to read");
        }
        
        try {
            const directReward = await contract.directRewardPercent();
            console.log(`👥 Direct Reward %: ${directReward.toString()}`);
        } catch (e) {
            console.log("👥 Direct Reward %: Unable to read");
        }
        
        try {
            const levelReward = await contract.levelRewardPercent();
            console.log(`📊 Level Reward %: ${levelReward.toString()}`);
        } catch (e) {
            console.log("📊 Level Reward %: Unable to read");
        }
        
    } catch (error) {
        console.log("⚠️  Unable to read protocol settings:", error.message);
    }
}

// Main execution
async function main() {
    await checkOwnerPermissions();
    await checkAdminFunctionAccess();
    
    console.log("");
    console.log("📋 SUMMARY");
    console.log("=" .repeat(60));
    console.log("✅ Owner verification completed");
    console.log("✅ Protocol status checked");
    console.log("✅ Admin permissions analyzed");
    console.log("");
    console.log("📄 For detailed admin function list, see: ADMIN_PERMISSIONS_ANALYSIS.md");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    main().catch(console.error);
}

export { checkOwnerPermissions, checkAdminFunctionAccess };