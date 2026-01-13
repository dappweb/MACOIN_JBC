/**
 * 修复团队人数小于直推人数的问题
 * 通过计算直推用户的团队人数来修正团队人数
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
];

/**
 * 计算用户的实际团队人数
 * 团队人数 = 直推人数 + 所有直推用户的团队人数
 */
async function calculateActualTeamCount(protocol, userAddress, visited = new Set()) {
    try {
        // 防止循环引用
        if (visited.has(userAddress.toLowerCase())) {
            return 0;
        }
        visited.add(userAddress.toLowerCase());
        
        // 获取直推列表
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        
        if (directReferrals.length === 0) {
            return 0;
        }
        
        // 团队人数 = 直推人数 + 每个直推的团队人数
        let totalTeamCount = directReferrals.length;
        
        // 递归计算每个直推的团队人数
        for (const referral of directReferrals) {
            try {
                const referralInfo = await protocol.userInfo(referral);
                const referralTeamCount = Number(referralInfo.teamCount || 0);
                totalTeamCount += referralTeamCount;
            } catch (e) {
                console.warn(`  ⚠️  查询直推 ${referral} 失败: ${e.message}`);
            }
        }
        
        return totalTeamCount;
    } catch (error) {
        console.error(`❌ 计算 ${userAddress} 团队人数失败:`, error.message);
        return 0;
    }
}

/**
 * 查找所有有问题的用户
 */
async function findProblematicUsers(protocol, allUsers) {
    console.log("\n🔍 查找有问题的用户（团队人数 < 直推人数）...\n");
    
    const problematicUsers = [];
    
    for (let i = 0; i < allUsers.length; i++) {
        const userAddress = allUsers[i];
        try {
            const userInfo = await protocol.userInfo(userAddress);
            const activeDirects = Number(userInfo.activeDirects || 0);
            const teamCount = Number(userInfo.teamCount || 0);
            
            if (teamCount < activeDirects) {
                problematicUsers.push({
                    address: userAddress,
                    activeDirects,
                    teamCount,
                    referrer: userInfo.referrer || ethers.ZeroAddress
                });
                console.log(`  ⚠️  ${userAddress}: 直推=${activeDirects}, 团队=${teamCount}`);
            }
            
            // 显示进度
            if ((i + 1) % 50 === 0) {
                console.log(`  已检查 ${i + 1}/${allUsers.length} 个用户...`);
            }
        } catch (e) {
            console.warn(`  ⚠️  查询 ${userAddress} 失败: ${e.message}`);
        }
        
        // 避免请求过快
        if ((i + 1) % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log(`\n✅ 找到 ${problematicUsers.length} 个有问题的用户\n`);
    return problematicUsers;
}

/**
 * 修复单个用户的团队人数
 */
async function fixUserTeamCount(protocol, signer, userAddress, newTeamCount) {
    try {
        console.log(`  🔧 修复 ${userAddress}: 设置团队人数为 ${newTeamCount}...`);
        
        const tx = await protocol.adminSetTeamCount(userAddress, newTeamCount);
        console.log(`  📝 交易已发送: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`  ✅ 交易已确认: 区块 ${receipt.blockNumber}`);
        
        return { success: true, txHash: tx.hash };
    } catch (error) {
        console.error(`  ❌ 修复失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 主函数
 */
async function main() {
    console.log("🚀 开始修复团队人数小于直推人数的问题...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    // 检查私钥
    if (!PRIVATE_KEY) {
        console.error("❌ 未设置 PRIVATE_KEY 环境变量");
        console.error("   请设置: export PRIVATE_KEY=your_private_key");
        process.exit(1);
    }

    // 创建provider和signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    
    // 检查是否是owner
    try {
        const owner = await protocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ 当前地址 ${wallet.address} 不是合约owner`);
            console.error(`   合约owner: ${owner}`);
            process.exit(1);
        }
        console.log(`✅ 确认是合约owner: ${wallet.address}\n`);
    } catch (e) {
        console.error(`❌ 检查owner失败: ${e.message}`);
        process.exit(1);
    }
    
    // 从已有数据文件加载用户列表
    const dataFile = path.join(__dirname, '../output/team-counts-results.json');
    if (!fs.existsSync(dataFile)) {
        console.error(`❌ 未找到数据文件: ${dataFile}`);
        console.error("   请先运行: node scripts/query-team-counts.cjs");
        process.exit(1);
    }
    
    const teamData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const allUsers = teamData.results.map(r => r.address);
    console.log(`📊 从数据文件加载 ${allUsers.length} 个用户\n`);
    
    // 查找有问题的用户
    const problematicUsers = await findProblematicUsers(protocol, allUsers);
    
    if (problematicUsers.length === 0) {
        console.log("✅ 没有发现需要修复的用户！");
        process.exit(0);
    }
    
    // 计算并修复每个用户的团队人数
    console.log("=".repeat(80));
    console.log("🔧 开始修复...\n");
    
    const results = [];
    
    for (let i = 0; i < problematicUsers.length; i++) {
        const user = problematicUsers[i];
        console.log(`\n[${i + 1}/${problematicUsers.length}] 处理用户: ${user.address}`);
        console.log(`  当前: 直推=${user.activeDirects}, 团队=${user.teamCount}`);
        
        // 计算正确的团队人数
        const actualTeamCount = await calculateActualTeamCount(protocol, user.address);
        console.log(`  计算的实际团队人数: ${actualTeamCount}`);
        
        // 团队人数至少应该等于直推人数
        const correctedTeamCount = Math.max(actualTeamCount, user.activeDirects);
        
        if (correctedTeamCount === user.teamCount) {
            console.log(`  ℹ️  团队人数已正确，无需修复`);
            results.push({
                address: user.address,
                oldTeamCount: user.teamCount,
                newTeamCount: correctedTeamCount,
                status: 'skipped',
                reason: 'already correct'
            });
            continue;
        }
        
        // 修复团队人数
        const fixResult = await fixUserTeamCount(protocol, wallet, user.address, correctedTeamCount);
        
        results.push({
            address: user.address,
            oldTeamCount: user.teamCount,
            newTeamCount: correctedTeamCount,
            activeDirects: user.activeDirects,
            status: fixResult.success ? 'fixed' : 'failed',
            txHash: fixResult.txHash,
            error: fixResult.error
        });
        
        // 等待一段时间避免nonce问题
        if (i < problematicUsers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // 保存修复结果
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(outputDir, `fix-team-count-report-${timestamp}.json`);
    
    const report = {
        fixTime: new Date().toISOString(),
        totalUsers: problematicUsers.length,
        fixedCount: results.filter(r => r.status === 'fixed').length,
        failedCount: results.filter(r => r.status === 'failed').length,
        skippedCount: results.filter(r => r.status === 'skipped').length,
        results: results
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果汇总");
    console.log("=".repeat(80));
    console.log(`总用户数: ${report.totalUsers}`);
    console.log(`已修复: ${report.fixedCount}`);
    console.log(`修复失败: ${report.failedCount}`);
    console.log(`已跳过: ${report.skippedCount}`);
    console.log(`\n💾 详细报告已保存到: ${reportFile}`);
    
    console.log("\n✅ 修复完成！");
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
