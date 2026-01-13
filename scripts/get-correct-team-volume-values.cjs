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

async function getCorrectValues(address1, address2) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 获取地址1和地址2的正确数据\n");
    console.log("=".repeat(80));

    try {
        // 获取两个地址的信息
        const userInfo1 = await protocol.userInfo(address1);
        const userInfo2 = await protocol.userInfo(address2);
        const ticket1 = await protocol.userTicket(address1);
        const ticket2 = await protocol.userTicket(address2);

        const contractVolume1 = parseFloat(ethers.formatEther(userInfo1.teamTotalVolume));
        const contractVolume2 = parseFloat(ethers.formatEther(userInfo2.teamTotalVolume));
        const selfPurchase1 = parseFloat(ethers.formatEther(ticket1.amount || 0n));
        const selfPurchase2 = parseFloat(ethers.formatEther(ticket2.amount || 0n));
        const referrer2 = userInfo2.referrer.toLowerCase();
        const address1Lower = address1.toLowerCase();

        console.log("📊 当前合约中的数据:");
        console.log("-".repeat(80));
        console.log(`地址1: ${address1}`);
        console.log(`  推荐人: ${userInfo1.referrer}`);
        console.log(`  团队人数: ${userInfo1.teamCount.toString()}`);
        console.log(`  活跃直推数: ${userInfo1.activeDirects.toString()}`);
        console.log(`  自己购买: ${selfPurchase1.toFixed(4)} MC`);
        console.log(`  团队总业绩(当前): ${contractVolume1.toFixed(4)} MC`);
        console.log("");
        console.log(`地址2: ${address2}`);
        console.log(`  推荐人: ${userInfo2.referrer}`);
        console.log(`  团队人数: ${userInfo2.teamCount.toString()}`);
        console.log(`  活跃直推数: ${userInfo2.activeDirects.toString()}`);
        console.log(`  自己购买: ${selfPurchase2.toFixed(4)} MC`);
        console.log(`  团队总业绩(当前): ${contractVolume2.toFixed(4)} MC`);

        console.log("\n" + "=".repeat(80));
        console.log("🔍 逻辑分析");
        console.log("=".repeat(80));

        if (referrer2 === address1Lower) {
            console.log("✅ 确认：地址1推荐地址2");
            console.log("\n📐 逻辑要求：");
            console.log("  地址1的团队总业绩应该 >= 地址2的团队总业绩");
            console.log("  因为地址1的团队包含地址2及其所有下级");
            console.log("\n💡 正确的计算方式：");
            console.log("  地址1的团队总业绩 = 地址1自己购买 + 地址1的所有下级购买");
            console.log("  地址2的团队总业绩 = 地址2自己购买 + 地址2的所有下级购买");
            console.log("  由于地址2是地址1的下级，所以：");
            console.log("  地址1的团队总业绩 >= 地址2的团队总业绩");

            console.log("\n" + "=".repeat(80));
            console.log("✅ 正确的修复值");
            console.log("=".repeat(80));

            // 地址2的正确值（需要重新计算，但根据当前数据，至少应该是合约值）
            // 由于递归计算可能不完整，我们使用更保守的方法：
            // 地址1的团队总业绩应该至少等于地址2的团队总业绩
            
            const correctVolume2 = contractVolume2; // 地址2的值（如果正确的话）
            const correctVolume1 = Math.max(contractVolume1, correctVolume2); // 地址1至少应该等于地址2

            console.log("\n地址1的正确值：");
            console.log(`  最小值（逻辑要求）: ${correctVolume2.toFixed(4)} MC`);
            console.log(`  当前合约值: ${contractVolume1.toFixed(4)} MC`);
            console.log(`  建议修复值: ${correctVolume1.toFixed(4)} MC`);
            console.log(`  （至少应该等于地址2的值，因为地址1的团队包含地址2）`);

            console.log("\n地址2的正确值：");
            console.log(`  当前合约值: ${contractVolume2.toFixed(4)} MC`);
            console.log(`  建议修复值: ${correctVolume2.toFixed(4)} MC`);
            console.log(`  （如果地址2的值是正确的，则保持不变）`);

            console.log("\n" + "=".repeat(80));
            console.log("🔧 修复命令");
            console.log("=".repeat(80));
            console.log("\n地址1修复：");
            console.log(`adminSetTeamTotalVolume(`);
            console.log(`  "${address1}",`);
            console.log(`  ${ethers.parseEther(correctVolume1.toString()).toString()}`);
            console.log(`)`);
            console.log(`// 设置为 ${correctVolume1.toFixed(4)} MC (至少等于地址2的值)`);

            console.log("\n地址2修复（如果需要）：");
            console.log(`adminSetTeamTotalVolume(`);
            console.log(`  "${address2}",`);
            console.log(`  ${ethers.parseEther(correctVolume2.toString()).toString()}`);
            console.log(`)`);
            console.log(`// 设置为 ${correctVolume2.toFixed(4)} MC`);

            console.log("\n" + "=".repeat(80));
            console.log("📋 总结");
            console.log("=".repeat(80));
            console.log(`地址1当前值: ${contractVolume1.toFixed(4)} MC`);
            console.log(`地址2当前值: ${contractVolume2.toFixed(4)} MC`);
            console.log(`\n问题: 地址1 < 地址2，不符合逻辑`);
            console.log(`\n修复方案:`);
            console.log(`  地址1应该至少设置为: ${correctVolume1.toFixed(4)} MC`);
            console.log(`  (等于或大于地址2的值)`);

        } else {
            console.log(`⚠️  地址2的推荐人不是地址1，而是: ${userInfo2.referrer}`);
        }

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 运行
const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

getCorrectValues(address1, address2).catch(console.error);
