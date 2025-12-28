const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getDirectReferralsData(address) view returns (tuple(address user, uint256 ticketAmount, uint256 joinTime)[])"
];

async function diagnoseTeamVolume(userAddress) {
    console.log(`🔍 诊断用户 ${userAddress} 的团队总业绩\n`);

    // Setup provider
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);

    try {
        // 获取用户信息
        const userInfo = await protocolContract.userInfo(userAddress);
        const userTicket = await protocolContract.userTicket(userAddress);
        
        console.log("👤 用户基本信息:");
        console.log(`   推荐人: ${userInfo[0]}`);
        console.log(`   直推人数: ${userInfo[1]}`);
        console.log(`   团队人数: ${userInfo[2]}`);
        console.log(`   总收益: ${ethers.formatEther(userInfo[3])} MC`);
        console.log(`   当前上限: ${ethers.formatEther(userInfo[4])} MC`);
        console.log(`   是否激活: ${userInfo[5]}`);
        console.log(`   退费金额: ${ethers.formatEther(userInfo[6])} MC`);
        console.log(`   🎯 团队总业绩: ${ethers.formatEther(userInfo[7])} MC`);
        console.log(`   团队总上限: ${ethers.formatEther(userInfo[8])} MC`);
        console.log(`   最大门票: ${ethers.formatEther(userInfo[9])} MC`);
        console.log(`   最大单票: ${ethers.formatEther(userInfo[10])} MC`);
        
        console.log("\n🎫 用户门票信息:");
        console.log(`   门票ID: ${userTicket[0]}`);
        console.log(`   门票金额: ${ethers.formatEther(userTicket[1])} MC`);
        console.log(`   购买时间: ${userTicket[2] > 0 ? new Date(Number(userTicket[2]) * 1000).toLocaleString() : '未购买'}`);
        console.log(`   是否退出: ${userTicket[3]}`);
        
        // 获取直推用户信息
        console.log("\n👥 直推用户分析:");
        console.log("-".repeat(80));
        
        try {
            const directReferrals = await protocolContract.getDirectReferralsData(userAddress);
            let totalDirectTickets = 0n;
            let activeDirects = 0;
            
            console.log(`直推用户数量: ${directReferrals.length}`);
            
            if (directReferrals.length > 0) {
                console.log("\n直推用户详情:");
                for (let i = 0; i < directReferrals.length; i++) {
                    const referral = directReferrals[i];
                    const ticketAmount = referral.ticketAmount;
                    const isActive = ticketAmount > 0n;
                    
                    if (isActive) {
                        activeDirects++;
                        totalDirectTickets += ticketAmount;
                    }
                    
                    console.log(`   ${i + 1}. ${referral.user}`);
                    console.log(`      门票金额: ${ethers.formatEther(ticketAmount)} MC`);
                    console.log(`      状态: ${isActive ? '✅ 活跃' : '❌ 未激活'}`);
                    console.log(`      加入时间: ${referral.joinTime > 0 ? new Date(Number(referral.joinTime) * 1000).toLocaleString() : '未知'}`);
                    console.log("");
                }
                
                console.log(`活跃直推: ${activeDirects}/${directReferrals.length}`);
                console.log(`直推门票总额: ${ethers.formatEther(totalDirectTickets)} MC`);
            } else {
                console.log("   无直推用户");
            }
            
        } catch (error) {
            console.log("   获取直推用户信息失败:", error.message);
        }
        
        // 递归检查团队结构（简化版，只检查2层）
        console.log("\n🌳 团队结构分析:");
        console.log("-".repeat(80));
        
        try {
            const directAddresses = await protocolContract.getDirectReferrals(userAddress);
            let calculatedTeamVolume = 0n;
            
            console.log(`正在分析 ${directAddresses.length} 个直推用户的下级...`);
            
            for (let i = 0; i < Math.min(directAddresses.length, 10); i++) { // 限制检查前10个
                const directAddr = directAddresses[i];
                const directTicket = await protocolContract.userTicket(directAddr);
                const directInfo = await protocolContract.userInfo(directAddr);
                
                calculatedTeamVolume += directTicket[1]; // 直推的门票金额
                
                console.log(`\n直推 ${i + 1}: ${directAddr}`);
                console.log(`   门票: ${ethers.formatEther(directTicket[1])} MC`);
                console.log(`   下级团队业绩: ${ethers.formatEther(directInfo[7])} MC`);
                
                // 这个直推用户的团队业绩也应该算入上级的团队总业绩
                calculatedTeamVolume += directInfo[7];
            }
            
            if (directAddresses.length > 10) {
                console.log(`\n... 还有 ${directAddresses.length - 10} 个直推用户未显示`);
            }
            
            console.log(`\n📊 业绩对比:`);
            console.log(`   合约记录的团队总业绩: ${ethers.formatEther(userInfo[7])} MC`);
            console.log(`   计算得出的团队业绩: ${ethers.formatEther(calculatedTeamVolume)} MC`);
            
            const difference = userInfo[7] - calculatedTeamVolume;
            if (difference !== 0n) {
                console.log(`   ⚠️  差异: ${ethers.formatEther(difference)} MC`);
                if (difference > 0n) {
                    console.log(`   📈 合约记录比计算值高 ${ethers.formatEther(difference)} MC`);
                } else {
                    console.log(`   📉 合约记录比计算值低 ${ethers.formatEther(-difference)} MC`);
                }
            } else {
                console.log(`   ✅ 数据一致`);
            }
            
        } catch (error) {
            console.log("   团队结构分析失败:", error.message);
        }
        
        // 问题诊断
        console.log("\n🔧 问题诊断:");
        console.log("-".repeat(80));
        
        if (userInfo[7] === 0n && directReferrals && directReferrals.length > 0) {
            console.log("❌ 团队总业绩为0，但有直推用户 - 可能是历史数据问题");
            console.log("💡 建议: 需要管理员使用 batchUpdateUserStats 函数修复历史数据");
        } else if (userInfo[7] > 0n) {
            console.log("✅ 团队总业绩有数据");
        } else {
            console.log("ℹ️  团队总业绩为0，这是正常的（如果确实没有团队成员购买门票）");
        }
        
    } catch (error) {
        console.error("❌ 诊断过程中出现错误:", error.message);
    }
}

async function main() {
    const userAddress = process.argv[2];
    
    if (!userAddress) {
        console.log("使用方法: node scripts/diagnose-team-volume.cjs <用户地址>");
        console.log("示例: node scripts/diagnose-team-volume.cjs 0x1234567890123456789012345678901234567890");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await diagnoseTeamVolume(userAddress);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { diagnoseTeamVolume };