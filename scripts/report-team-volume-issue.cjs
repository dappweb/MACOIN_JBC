const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
];

async function reportTeamVolumeIssue(address1, address2) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 团队总业绩数据问题报告\n");
    console.log("=".repeat(80));
    console.log(`地址1: ${address1}`);
    console.log(`地址2: ${address2}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 查询两个地址的信息
        const userInfo1 = await protocol.userInfo(address1);
        const userInfo2 = await protocol.userInfo(address2);
        
        const contractVolume1 = parseFloat(ethers.formatEther(userInfo1.teamTotalVolume));
        const contractVolume2 = parseFloat(ethers.formatEther(userInfo2.teamTotalVolume));
        const referrer2 = userInfo2.referrer.toLowerCase();
        const address1Lower = address1.toLowerCase();
        
        // 获取用户自己的门票金额
        const ticket1 = await protocol.userTicket(address1);
        const ticket2 = await protocol.userTicket(address2);
        const selfVolume1 = parseFloat(ethers.formatEther(ticket1.amount || 0n));
        const selfVolume2 = parseFloat(ethers.formatEther(ticket2.amount || 0n));

        console.log("📊 当前数据:");
        console.log("-".repeat(80));
        console.log(`地址1:`);
        console.log(`  推荐人: ${userInfo1.referrer}`);
        console.log(`  团队人数: ${userInfo1.teamCount.toString()}`);
        console.log(`  活跃直推数: ${userInfo1.activeDirects.toString()}`);
        console.log(`  自己购买: ${selfVolume1.toFixed(4)} MC`);
        console.log(`  团队总业绩(合约): ${contractVolume1.toFixed(4)} MC`);
        console.log("");
        console.log(`地址2:`);
        console.log(`  推荐人: ${userInfo2.referrer}`);
        console.log(`  团队人数: ${userInfo2.teamCount.toString()}`);
        console.log(`  活跃直推数: ${userInfo2.activeDirects.toString()}`);
        console.log(`  自己购买: ${selfVolume2.toFixed(4)} MC`);
        console.log(`  团队总业绩(合约): ${contractVolume2.toFixed(4)} MC`);
        console.log("");

        console.log("=".repeat(80));
        console.log("🔍 问题分析:");
        console.log("=".repeat(80));
        
        if (referrer2 === address1Lower) {
            console.log("✅ 确认：地址1推荐地址2");
            console.log("");
            console.log("📐 逻辑要求：");
            console.log("  地址1的团队总业绩应该 >= 地址2的团队总业绩");
            console.log("  因为地址1的团队包含地址2及其所有下级");
            console.log("");
            console.log("📊 实际情况：");
            console.log(`  地址1的团队总业绩: ${contractVolume1.toFixed(4)} MC`);
            console.log(`  地址2的团队总业绩: ${contractVolume2.toFixed(4)} MC`);
            console.log(`  差额: ${(contractVolume1 - contractVolume2).toFixed(4)} MC`);
            console.log("");
            
            if (contractVolume1 < contractVolume2) {
                console.log("❌ 数据不符合逻辑！");
                console.log(`  地址1的团队总业绩(${contractVolume1.toFixed(4)} MC) < 地址2的团队总业绩(${contractVolume2.toFixed(4)} MC)`);
                console.log("");
                console.log("🔧 修复建议：");
                console.log(`  地址1的 teamTotalVolume 应该至少等于地址2的 teamTotalVolume`);
                console.log(`  建议值: ${contractVolume2.toFixed(4)} MC 或更高`);
                console.log("");
                console.log("💡 可能的原因：");
                console.log("  1. 地址1的 teamTotalVolume 没有正确更新");
                console.log("  2. 推荐关系变更后，数据没有重新计算");
                console.log("  3. 数据迁移时遗漏了某些更新");
            } else {
                console.log("✅ 数据符合逻辑");
            }
        } else {
            console.log(`⚠️  地址2的推荐人不是地址1`);
            console.log(`  地址2的推荐人: ${userInfo2.referrer}`);
        }

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 运行脚本
const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

reportTeamVolumeIssue(address1, address2).catch(console.error);
