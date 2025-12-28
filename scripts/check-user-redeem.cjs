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
    "function allowance(address owner, address spender) view returns (uint256)"
];

const PROTOCOL_ABI = [
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function redemptionFeePercent() view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function redeemEnabled() view returns (bool)"
];

async function checkUserRedeemStatus(userAddress) {
    console.log(`🔍 检查用户 ${userAddress} 的赎回状态\n`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    
    // Initialize contracts
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, provider);
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    try {
        // 获取基本信息
        const redeemEnabled = await protocolContract.redeemEnabled();
        const redemptionFeePercent = await protocolContract.redemptionFeePercent();
        const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
        const currentTime = Math.floor(Date.now() / 1000);
        
        console.log("📋 系统状态:");
        console.log(`   赎回功能: ${redeemEnabled ? '✅ 启用' : '❌ 禁用'}`);
        console.log(`   手续费率: ${redemptionFeePercent}%`);
        console.log(`   时间单位: ${secondsInUnit}秒 (${secondsInUnit/60}分钟)`);
        
        // 获取用户信息
        const mcBalance = await mcContract.balanceOf(userAddress);
        const allowance = await mcContract.allowance(userAddress, ADDRESSES.PROTOCOL);
        const userInfo = await protocolContract.userInfo(userAddress);
        const userTicket = await protocolContract.userTicket(userAddress);
        
        console.log("\n💰 用户资产:");
        console.log(`   MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`   合约授权: ${ethers.formatEther(allowance)} MC`);
        console.log(`   最大门票: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
        console.log(`   当前门票: ${ethers.formatEther(userTicket.amount)} MC`);
        
        // 检查质押记录
        console.log("\n🏦 质押记录:");
        console.log("-".repeat(80));
        
        let stakeIndex = 0;
        let canRedeemCount = 0;
        let totalRedeemableFee = 0n;
        
        while (stakeIndex < 20) { // 检查最多20个质押
            try {
                const stake = await protocolContract.userStakes(userAddress, stakeIndex);
                
                if (stake.amount === 0n) break;
                
                const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * Number(secondsInUnit));
                const isExpired = currentTime >= endTime;
                const timeRemaining = Math.max(0, endTime - currentTime);
                
                console.log(`质押 #${stakeIndex}:`);
                console.log(`   金额: ${ethers.formatEther(stake.amount)} MC`);
                console.log(`   周期: ${stake.cycleDays} 个时间单位`);
                console.log(`   状态: ${stake.active ? (isExpired ? '🟡 可赎回' : '🟢 进行中') : '⚫ 已赎回'}`);
                
                if (stake.active) {
                    if (isExpired) {
                        console.log(`   ✅ 已到期，可以赎回`);
                        canRedeemCount++;
                        
                        // 计算手续费
                        const feeBase = userInfo.maxTicketAmount > 0n ? userInfo.maxTicketAmount : userTicket.amount;
                        const fee = (feeBase * redemptionFeePercent) / 100n;
                        totalRedeemableFee += fee;
                        console.log(`   💸 预期手续费: ${ethers.formatEther(fee)} MC`);
                    } else {
                        const hours = Math.floor(timeRemaining / 3600);
                        const minutes = Math.floor((timeRemaining % 3600) / 60);
                        const seconds = timeRemaining % 60;
                        console.log(`   ⏰ 剩余时间: ${hours}时${minutes}分${seconds}秒`);
                    }
                }
                
                console.log("");
                stakeIndex++;
            } catch (error) {
                break;
            }
        }
        
        // 汇总和建议
        console.log("📊 汇总信息:");
        console.log(`   总质押数: ${stakeIndex}`);
        console.log(`   可赎回数: ${canRedeemCount}`);
        console.log(`   总手续费: ${ethers.formatEther(totalRedeemableFee)} MC`);
        
        console.log("\n🔧 赎回检查:");
        
        if (!redeemEnabled) {
            console.log("❌ 赎回功能已禁用，请联系管理员");
            return;
        }
        
        if (canRedeemCount === 0) {
            console.log("⚠️  当前没有可赎回的质押");
            return;
        }
        
        if (mcBalance < totalRedeemableFee) {
            console.log(`❌ MC余额不足支付手续费`);
            console.log(`   需要: ${ethers.formatEther(totalRedeemableFee)} MC`);
            console.log(`   当前: ${ethers.formatEther(mcBalance)} MC`);
            console.log(`   缺少: ${ethers.formatEther(totalRedeemableFee - mcBalance)} MC`);
            return;
        }
        
        if (allowance < totalRedeemableFee) {
            console.log(`⚠️  授权额度不足，需要先授权`);
            console.log(`   需要授权: ${ethers.formatEther(totalRedeemableFee)} MC`);
            console.log(`   当前授权: ${ethers.formatEther(allowance)} MC`);
            return;
        }
        
        console.log("✅ 所有检查通过，可以进行赎回操作!");
        
    } catch (error) {
        console.error("❌ 检查过程中出现错误:", error.message);
        if (error.message.includes("redemptionFeePercent")) {
            console.error("💡 提示: 可能是ABI问题，请确保前端ABI包含 redemptionFeePercent() 函数");
        }
    }
}

async function main() {
    const userAddress = process.argv[2];
    
    if (!userAddress) {
        console.log("使用方法: node scripts/check-user-redeem.cjs <用户地址>");
        console.log("示例: node scripts/check-user-redeem.cjs 0x1234567890123456789012345678901234567890");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await checkUserRedeemStatus(userAddress);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkUserRedeemStatus };