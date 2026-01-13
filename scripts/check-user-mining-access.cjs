/**
 * 检查用户是否可以访问挖矿页面
 */

const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getDirectReferrals(address) view returns (address[])",
];

async function checkUserMiningAccess(userAddress) {
    console.log(`🔍 检查用户挖矿页面访问权限...\n`);
    console.log(`用户地址: ${userAddress}\n`);

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
        
        // 1. 检查用户基本信息
        console.log("1️⃣ 检查用户基本信息...");
        const userInfo = await protocol.userInfo(userAddress);
        
        const referrer = userInfo.referrer || ethers.ZeroAddress;
        const isActive = userInfo.isActive || false;
        const activeDirects = Number(userInfo.activeDirects || 0);
        const teamCount = Number(userInfo.teamCount || 0);
        
        console.log(`   推荐人: ${referrer}`);
        console.log(`   是否激活: ${isActive ? '✅ 是' : '❌ 否'}`);
        console.log(`   直推人数: ${activeDirects}`);
        console.log(`   团队人数: ${teamCount}`);
        
        // 2. 检查门票信息
        console.log("\n2️⃣ 检查门票信息...");
        try {
            const ticket = await protocol.userTicket(userAddress);
            const ticketId = Number(ticket.ticketId || 0);
            const ticketAmount = ethers.formatEther(ticket.amount || 0);
            const purchaseTime = Number(ticket.purchaseTime || 0);
            const exited = ticket.exited || false;
            
            console.log(`   门票ID: ${ticketId}`);
            console.log(`   门票金额: ${ticketAmount} MC`);
            console.log(`   购买时间: ${purchaseTime > 0 ? new Date(purchaseTime * 1000).toISOString() : '无'}`);
            console.log(`   是否退出: ${exited ? '是' : '否'}`);
            
            if (ticketId === 0 || parseFloat(ticketAmount) === 0) {
                console.log(`   ⚠️  用户没有有效门票`);
            } else if (exited) {
                console.log(`   ⚠️  用户门票已退出`);
            } else {
                console.log(`   ✅ 用户有有效门票`);
            }
        } catch (e) {
            console.log(`   ❌ 查询门票失败: ${e.message}`);
        }
        
        // 3. 检查质押信息
        console.log("\n3️⃣ 检查质押信息...");
        try {
            const stakes = [];
            for (let i = 0; i < 10; i++) {
                try {
                    const stake = await protocol.userStakes(userAddress, i);
                    if (stake && stake.id && Number(stake.id) > 0) {
                        stakes.push({
                            id: Number(stake.id),
                            amount: ethers.formatEther(stake.amount || 0),
                            active: stake.active || false,
                        });
                    }
                } catch (e) {
                    break;
                }
            }
            
            console.log(`   质押数量: ${stakes.length}`);
            if (stakes.length > 0) {
                stakes.forEach((stake, index) => {
                    console.log(`   质押 ${index + 1}: ID=${stake.id}, 金额=${stake.amount} MC, 状态=${stake.active ? '激活' : '未激活'}`);
                });
            } else {
                console.log(`   ⚠️  用户没有质押记录`);
            }
        } catch (e) {
            console.log(`   ❌ 查询质押失败: ${e.message}`);
        }
        
        // 4. 检查推荐人状态
        console.log("\n4️⃣ 检查推荐人状态...");
        if (referrer === ethers.ZeroAddress) {
            console.log(`   ❌ 用户没有推荐人`);
        } else {
            console.log(`   ✅ 用户有推荐人: ${referrer}`);
            
            // 检查推荐人是否有效
            try {
                const referrerInfo = await protocol.userInfo(referrer);
                const referrerIsActive = referrerInfo.isActive || false;
                console.log(`   推荐人激活状态: ${referrerIsActive ? '✅ 激活' : '❌ 未激活'}`);
            } catch (e) {
                console.log(`   ⚠️  无法查询推荐人信息: ${e.message}`);
            }
        }
        
        // 5. 诊断问题
        console.log("\n" + "=".repeat(80));
        console.log("📊 诊断结果");
        console.log("=".repeat(80));
        
        const issues = [];
        
        if (referrer === ethers.ZeroAddress) {
            issues.push("❌ 没有推荐人 - 需要绑定推荐人才能使用挖矿功能");
        }
        
        if (!isActive) {
            issues.push("❌ 用户未激活 - 需要购买门票才能激活");
        }
        
        try {
            const ticket = await protocol.userTicket(userAddress);
            if (Number(ticket.ticketId) === 0 || parseFloat(ethers.formatEther(ticket.amount || 0)) === 0) {
                issues.push("❌ 没有有效门票 - 需要购买门票");
            } else if (ticket.exited) {
                issues.push("❌ 门票已退出 - 需要重新购买门票");
            }
        } catch (e) {
            issues.push("❌ 无法查询门票信息");
        }
        
        if (issues.length === 0) {
            console.log("✅ 用户应该可以正常访问挖矿页面");
            console.log("\n如果仍然无法显示，可能的原因：");
            console.log("  1. 前端缓存问题 - 尝试清除缓存并刷新");
            console.log("  2. 网络连接问题 - 检查RPC连接");
            console.log("  3. 前端代码问题 - 检查浏览器控制台错误");
        } else {
            console.log("⚠️  发现以下问题，可能导致无法访问挖矿页面：\n");
            issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            console.error("\n⚠️  RPC连接超时，可能是网络问题");
        }
        process.exit(1);
    }
}

// 主函数
async function main() {
    const userAddress = process.argv[2] || "0x6BA8221531a30EF41260367fDe92a034c178Bb2b";
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的地址格式");
        process.exit(1);
    }
    
    await checkUserMiningAccess(userAddress);
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
