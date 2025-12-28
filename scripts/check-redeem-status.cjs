const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

// ABIs
const MC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

const PROTOCOL_ABI = [
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function redemptionFeePercent() view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function redeemEnabled() view returns (bool)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)"
];

async function main() {
    console.log("🔍 开始检查赎回状态...\n");

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://rpc.mchainwallet.com");
    
    // Test user address (replace with actual user address)
    const userAddress = "0x4C4448B5c0e8b8e8b8e8b8e8b8e8b8e8b8e8b8e8"; // 需要替换为实际用户地址
    
    // Initialize contracts
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, provider);
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    try {
        console.log("📋 基本信息检查");
        console.log("=".repeat(50));
        
        // 1. 检查合约状态
        console.log("1. 合约状态检查:");
        const redeemEnabled = await protocolContract.redeemEnabled();
        const redemptionFeePercent = await protocolContract.redemptionFeePercent();
        const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
        
        console.log(`   ✓ 赎回功能启用: ${redeemEnabled}`);
        console.log(`   ✓ 赎回手续费率: ${redemptionFeePercent}%`);
        console.log(`   ✓ 时间单位(秒): ${secondsInUnit}`);
        
        // 2. 检查用户余额
        console.log("\n2. 用户余额检查:");
        const mcBalance = await mcContract.balanceOf(userAddress);
        const allowance = await mcContract.allowance(userAddress, ADDRESSES.PROTOCOL);
        
        console.log(`   ✓ MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`   ✓ 合约授权额度: ${ethers.formatEther(allowance)} MC`);
        
        // 3. 检查用户信息
        console.log("\n3. 用户信息检查:");
        const userInfo = await protocolContract.userInfo(userAddress);
        const userTicket = await protocolContract.userTicket(userAddress);
        
        console.log(`   ✓ 最大门票金额: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
        console.log(`   ✓ 当前门票金额: ${ethers.formatEther(userTicket.amount)} MC`);
        console.log(`   ✓ 退费金额: ${ethers.formatEther(userInfo.refundFeeAmount)} MC`);
        
        // 4. 检查质押记录
        console.log("\n4. 质押记录检查:");
        console.log("=".repeat(50));
        
        const currentTime = Math.floor(Date.now() / 1000);
        let stakeIndex = 0;
        let totalActiveStakes = 0;
        let totalExpiredStakes = 0;
        
        while (stakeIndex < 10) { // 最多检查10个质押
            try {
                const stake = await protocolContract.userStakes(userAddress, stakeIndex);
                
                if (stake.amount === 0n) break; // 没有更多质押
                
                const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(secondsInUnit));
                const isExpired = currentTime >= endTime;
                const timeRemaining = endTime - currentTime;
                
                console.log(`\n质押 #${stakeIndex}:`);
                console.log(`   ID: ${stake.id}`);
                console.log(`   金额: ${ethers.formatEther(stake.amount)} MC`);
                console.log(`   开始时间: ${new Date(Number(stake.startTime) * 1000).toLocaleString()}`);
                console.log(`   周期: ${stake.cycleDays} 个时间单位`);
                console.log(`   结束时间: ${new Date(endTime * 1000).toLocaleString()}`);
                console.log(`   状态: ${stake.active ? '活跃' : '已赎回'}`);
                console.log(`   已支付: ${ethers.formatEther(stake.paid)} MC`);
                console.log(`   是否到期: ${isExpired ? '✅ 是' : '❌ 否'}`);
                
                if (!isExpired && stake.active) {
                    const hours = Math.floor(timeRemaining / 3600);
                    const minutes = Math.floor((timeRemaining % 3600) / 60);
                    const seconds = timeRemaining % 60;
                    console.log(`   剩余时间: ${hours}时${minutes}分${seconds}秒`);
                }
                
                // 计算预期手续费
                if (stake.active && isExpired) {
                    const feeBase = userInfo.maxTicketAmount > 0n ? userInfo.maxTicketAmount : userTicket.amount;
                    const expectedFee = (feeBase * redemptionFeePercent) / 100n;
                    console.log(`   预期手续费: ${ethers.formatEther(expectedFee)} MC`);
                    console.log(`   余额足够支付手续费: ${mcBalance >= expectedFee ? '✅ 是' : '❌ 否'}`);
                    console.log(`   授权足够支付手续费: ${allowance >= expectedFee ? '✅ 是' : '❌ 否'}`);
                    totalExpiredStakes++;
                } else if (stake.active) {
                    totalActiveStakes++;
                }
                
                stakeIndex++;
            } catch (error) {
                break; // 没有更多质押
            }
        }
        
        // 5. 汇总信息
        console.log("\n📊 汇总信息");
        console.log("=".repeat(50));
        console.log(`总质押数量: ${stakeIndex}`);
        console.log(`活跃质押: ${totalActiveStakes}`);
        console.log(`可赎回质押: ${totalExpiredStakes}`);
        
        // 6. 检查流动性池状态
        console.log("\n6. 流动性池状态:");
        const reserveMC = await protocolContract.swapReserveMC();
        const reserveJBC = await protocolContract.swapReserveJBC();
        
        console.log(`   MC储备: ${ethers.formatEther(reserveMC)} MC`);
        console.log(`   JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
        
        if (reserveMC > 0n && reserveJBC > 0n) {
            const exchangeRate = Number(ethers.formatEther(reserveMC)) / Number(ethers.formatEther(reserveJBC));
            console.log(`   汇率: 1 JBC ≈ ${exchangeRate.toFixed(4)} MC`);
        }
        
        // 7. 问题诊断
        console.log("\n🔧 问题诊断");
        console.log("=".repeat(50));
        
        if (!redeemEnabled) {
            console.log("❌ 赎回功能已禁用");
        }
        
        if (totalExpiredStakes === 0) {
            console.log("⚠️  没有可赎回的质押（所有质押都未到期或已赎回）");
        }
        
        if (mcBalance === 0n) {
            console.log("❌ MC余额为0，无法支付手续费");
        }
        
        if (allowance === 0n && totalExpiredStakes > 0) {
            console.log("⚠️  需要先授权合约扣除MC作为手续费");
        }
        
        console.log("\n✅ 检查完成!");
        
    } catch (error) {
        console.error("❌ 检查过程中出现错误:", error.message);
        console.error("详细错误:", error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };