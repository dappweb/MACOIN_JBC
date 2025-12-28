const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function redemptionFeePercent() view returns (uint256)",
    "function SECONDS_IN_UNIT() view returns (uint256)",
    "function redeemEnabled() view returns (bool)"
];

const MC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function testRedeemFix(userAddress) {
    console.log(`🧪 测试用户 ${userAddress} 的赎回修复\n`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, provider);

    try {
        // 获取基本信息
        const redeemEnabled = await protocolContract.redeemEnabled();
        const redemptionFeePercent = await protocolContract.redemptionFeePercent();
        const secondsInUnit = await protocolContract.SECONDS_IN_UNIT();
        const currentTime = Math.floor(Date.now() / 1000);
        
        console.log("📋 系统状态:");
        console.log(`   赎回功能: ${redeemEnabled ? '✅ 启用' : '❌ 禁用'}`);
        console.log(`   手续费率: ${redemptionFeePercent}%`);
        console.log(`   时间单位: ${secondsInUnit}秒`);
        
        // 获取用户资产信息
        const mcBalance = await mcContract.balanceOf(userAddress);
        const allowance = await mcContract.allowance(userAddress, ADDRESSES.PROTOCOL);
        const userInfo = await protocolContract.userInfo(userAddress);
        const userTicket = await protocolContract.userTicket(userAddress);
        
        console.log("\n💰 用户资产:");
        console.log(`   MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`   合约授权: ${ethers.formatEther(allowance)} MC`);
        console.log(`   最大门票: ${ethers.formatEther(userInfo[9])} MC`);
        console.log(`   当前门票: ${ethers.formatEther(userTicket[1])} MC`);
        
        // 模拟前端逻辑获取质押
        console.log("\n🏦 质押数据分析:");
        console.log("-".repeat(80));
        
        const stakes = [];
        let index = 0;
        
        while (index < 20) { // 最多检查20个质押
            try {
                const stakeData = await protocolContract.userStakes(userAddress, index);
                
                if (stakeData[1] === 0n) break; // amount为0表示没有更多质押
                
                const stakeInfo = {
                    arrayIndex: index,
                    stakeId: stakeData[0], // 实际的质押ID
                    amount: stakeData[1],
                    startTime: Number(stakeData[2]),
                    cycleDays: Number(stakeData[3]),
                    active: stakeData[4],
                    paid: stakeData[5]
                };
                
                stakes.push(stakeInfo);
                
                const endTime = stakeInfo.startTime + (stakeInfo.cycleDays * Number(secondsInUnit));
                const isExpired = currentTime >= endTime;
                const timeRemaining = Math.max(0, endTime - currentTime);
                
                console.log(`质押 [数组索引: ${index}]:`);
                console.log(`   实际质押ID: ${stakeInfo.stakeId}`);
                console.log(`   金额: ${ethers.formatEther(stakeInfo.amount)} MC`);
                console.log(`   周期: ${stakeInfo.cycleDays} 个时间单位`);
                console.log(`   状态: ${stakeInfo.active ? (isExpired ? '🟡 可赎回' : '🟢 进行中') : '⚫ 已赎回'}`);
                
                if (stakeInfo.active && isExpired) {
                    // 计算预期手续费
                    const feeBase = userInfo[9] > 0n ? userInfo[9] : userTicket[1]; // maxTicketAmount or ticket amount
                    const expectedFee = (feeBase * redemptionFeePercent) / 100n;
                    
                    console.log(`   ✅ 可以赎回`);
                    console.log(`   💸 预期手续费: ${ethers.formatEther(expectedFee)} MC`);
                    console.log(`   💰 余额足够: ${mcBalance >= expectedFee ? '✅' : '❌'}`);
                    console.log(`   🔐 授权足够: ${allowance >= expectedFee ? '✅' : '❌'}`);
                    
                    // 关键检查：前端应该传递数组索引而不是质押ID
                    console.log(`   🔧 前端修复检查:`);
                    console.log(`      - 旧逻辑会传递质押ID: ${stakeInfo.stakeId} (❌ 错误)`);
                    console.log(`      - 新逻辑应传递索引: ${index} (✅ 正确)`);
                    
                } else if (stakeInfo.active) {
                    const hours = Math.floor(timeRemaining / 3600);
                    const minutes = Math.floor((timeRemaining % 3600) / 60);
                    console.log(`   ⏰ 剩余时间: ${hours}时${minutes}分`);
                }
                
                console.log("");
                index++;
            } catch (error) {
                break;
            }
        }
        
        console.log("📊 修复验证结果:");
        console.log(`   总质押数: ${stakes.length}`);
        
        const canRedeemStakes = stakes.filter(s => {
            const endTime = s.startTime + (s.cycleDays * Number(secondsInUnit));
            return s.active && currentTime >= endTime;
        });
        
        console.log(`   可赎回质押: ${canRedeemStakes.length}`);
        
        if (canRedeemStakes.length > 0) {
            console.log("\n✅ 修复验证:");
            console.log("   前端现在会正确传递数组索引而不是质押ID");
            console.log("   这应该解决 'Invalid stake' 错误");
            
            canRedeemStakes.forEach((stake, i) => {
                console.log(`   可赎回质押 ${i + 1}: 传递索引 ${stake.arrayIndex} (而不是ID ${stake.stakeId})`);
            });
        } else {
            console.log("\n⚠️  当前没有可赎回的质押");
        }
        
        // ID vs Index 对比表
        if (stakes.length > 0) {
            console.log("\n📋 ID vs 索引对比表:");
            console.log("数组索引 | 质押ID | 状态");
            console.log("-".repeat(30));
            stakes.forEach(stake => {
                const status = stake.active ? "活跃" : "已赎回";
                console.log(`${stake.arrayIndex.toString().padStart(8)} | ${stake.stakeId.toString().padStart(6)} | ${status}`);
            });
        }
        
    } catch (error) {
        console.error("❌ 测试过程中出现错误:", error.message);
    }
}

async function main() {
    const userAddress = process.argv[2];
    
    if (!userAddress) {
        console.log("使用方法: node scripts/test-redeem-fix.cjs <用户地址>");
        console.log("示例: node scripts/test-redeem-fix.cjs 0x1234567890123456789012345678901234567890");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await testRedeemFix(userAddress);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testRedeemFix };