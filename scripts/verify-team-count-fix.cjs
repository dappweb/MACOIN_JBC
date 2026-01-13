/**
 * 验证团队人数修复计算（只查询，不修复）
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
];

/**
 * 计算用户的实际团队人数（递归计算）
 */
async function calculateActualTeamCount(protocol, userAddress, visited = new Set(), depth = 0) {
    try {
        // 防止循环引用和过深递归
        if (visited.has(userAddress.toLowerCase()) || depth > 20) {
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
                // 递归计算直推的团队人数
                const referralSubTeamCount = await calculateActualTeamCount(protocol, referral, visited, depth + 1);
                totalTeamCount += Math.max(referralTeamCount, referralSubTeamCount);
            } catch (e) {
                console.warn(`    ⚠️  查询直推 ${referral.substring(0, 10)}... 失败: ${e.message}`);
            }
        }
        
        return totalTeamCount;
    } catch (error) {
        console.error(`❌ 计算 ${userAddress} 团队人数失败:`, error.message);
        return 0;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log("🔍 验证团队人数修复计算...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    // 从一致性检查报告加载有问题的用户
    const reportFile = path.join(__dirname, '../output/data-consistency-report.json');
    if (!fs.existsSync(reportFile)) {
        console.error(`❌ 未找到一致性检查报告: ${reportFile}`);
        console.error("   请先运行: node scripts/check-data-consistency.cjs");
        process.exit(1);
    }
    
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    const logicIssues = report.details.filter(d => d.type === 'logic_error');
    
    if (logicIssues.length === 0) {
        console.log("✅ 没有发现逻辑错误用户");
        process.exit(0);
    }
    
    console.log(`📊 找到 ${logicIssues.length} 个逻辑错误用户\n`);
    
    // 验证每个用户
    const verificationResults = [];
    
    for (let i = 0; i < logicIssues.length; i++) {
        const issue = logicIssues[i];
        const userAddress = issue.user;
        
        console.log(`\n[${i + 1}/${logicIssues.length}] 验证用户: ${userAddress}`);
        console.log(`  问题: ${issue.message}`);
        
        try {
            // 获取当前数据
            const userInfo = await protocol.userInfo(userAddress);
            const activeDirects = Number(userInfo.activeDirects || 0);
            const currentTeamCount = Number(userInfo.teamCount || 0);
            
            console.log(`  当前数据: 直推=${activeDirects}, 团队=${currentTeamCount}`);
            
            // 计算正确的团队人数
            console.log(`  计算中...`);
            const calculatedTeamCount = await calculateActualTeamCount(protocol, userAddress);
            
            // 团队人数至少应该等于直推人数
            const correctedTeamCount = Math.max(calculatedTeamCount, activeDirects);
            
            console.log(`  计算结果: ${calculatedTeamCount}`);
            console.log(`  修正后团队人数: ${correctedTeamCount}`);
            console.log(`  需要增加: ${correctedTeamCount - currentTeamCount}`);
            
            verificationResults.push({
                address: userAddress,
                activeDirects,
                currentTeamCount,
                calculatedTeamCount,
                correctedTeamCount,
                increase: correctedTeamCount - currentTeamCount
            });
            
        } catch (e) {
            console.error(`  ❌ 验证失败: ${e.message}`);
            verificationResults.push({
                address: userAddress,
                error: e.message
            });
        }
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 保存验证结果
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(outputDir, `team-count-verification-${timestamp}.json`);
    
    const result = {
        verifyTime: new Date().toISOString(),
        totalUsers: logicIssues.length,
        results: verificationResults
    };
    
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 验证结果汇总");
    console.log("=".repeat(80));
    
    const successResults = verificationResults.filter(r => !r.error);
    console.log(`成功验证: ${successResults.length}/${logicIssues.length}`);
    
    if (successResults.length > 0) {
        const totalIncrease = successResults.reduce((sum, r) => sum + (r.increase || 0), 0);
        console.log(`总需要增加的团队人数: ${totalIncrease}`);
        console.log(`平均增加: ${(totalIncrease / successResults.length).toFixed(2)}`);
    }
    
    console.log(`\n💾 验证结果已保存到: ${resultFile}`);
    console.log("\n✅ 验证完成！");
    console.log("\n如果验证结果正确，可以运行修复脚本:");
    console.log("  node scripts/fix-team-count-issue.cjs");
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
