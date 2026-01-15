/**
 * 修复所有用户的团队人数问题
 * 根据直推用户和他们的团队人数重新计算正确的teamCount
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

// 从数据一致性报告读取问题用户
function loadIssuesFromReport() {
    const reportPath = path.join(__dirname, '../output/data-consistency-report.json');
    if (!fs.existsSync(reportPath)) {
        console.error(`❌ 未找到数据一致性报告: ${reportPath}`);
        console.error("   请先运行: node scripts/check-data-consistency.cjs");
        process.exit(1);
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const issues = report.details.filter(d => 
        d.type === 'logic_error' || d.type === 'level_mismatch'
    );
    
    return issues;
}

// 递归计算用户的团队人数
async function calculateTeamCount(protocol, userAddress, visited = new Set()) {
    if (visited.has(userAddress.toLowerCase())) {
        console.warn(`   ⚠️  检测到循环引用: ${userAddress}`);
        return 0;
    }
    visited.add(userAddress.toLowerCase());
    
    try {
        // 获取直推用户
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        
        if (directReferrals.length === 0) {
            return 0;
        }
        
        // 计算所有直推用户的团队人数总和
        let totalTeamCount = directReferrals.length; // 至少包括所有直推用户
        
        for (const referral of directReferrals) {
            const referralInfo = await protocol.userInfo(referral);
            const referralTeamCount = Number(referralInfo.teamCount || 0);
            
            // 递归计算直推用户的团队人数
            const referralCalculatedCount = await calculateTeamCount(protocol, referral, new Set(visited));
            
            // 使用较大的值（合约中的值或计算出的值）
            const referralActualCount = Math.max(referralTeamCount, referralCalculatedCount);
            
            totalTeamCount += referralActualCount;
        }
        
        return totalTeamCount;
    } catch (error) {
        console.error(`   ❌ 计算用户 ${userAddress} 的团队人数失败: ${error.message}`);
        return 0;
    }
}

// 主函数
async function main() {
    console.log("🔧 开始修复所有用户的团队人数问题...\n");
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
        console.error(`   可能是RPC连接问题，请检查网络`);
        process.exit(1);
    }
    
    // 加载问题用户
    const issues = loadIssuesFromReport();
    console.log(`📊 找到 ${issues.length} 个需要修复的用户\n`);
    
    if (issues.length === 0) {
        console.log("✅ 没有发现需要修复的用户");
        process.exit(0);
    }
    
    const results = [];
    
    // 修复每个用户
    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const userAddress = issue.user;
        
        console.log(`\n[${i + 1}/${issues.length}] 处理用户: ${userAddress}`);
        console.log(`  问题类型: ${issue.type}`);
        
        if (issue.type === 'logic_error') {
            console.log(`  问题: ${issue.message}`);
            console.log(`  直推人数: ${issue.activeDirects}, 当前团队人数: ${issue.teamCount}`);
        } else if (issue.type === 'level_mismatch') {
            console.log(`  问题: 等级不匹配`);
            console.log(`  当前等级: V${issue.level}, 团队人数: ${issue.teamCount}`);
            console.log(`  期望等级: ${issue.expectedLevel}, 期望范围: ${issue.expectedRange}`);
        }
        
        try {
            // 获取当前数据
            const userInfo = await protocol.userInfo(userAddress);
            const currentTeamCount = Number(userInfo.teamCount || 0);
            const activeDirects = Number(userInfo.activeDirects || 0);
            
            // 计算正确的团队人数
            console.log(`  🔍 计算正确的团队人数...`);
            const calculatedTeamCount = await calculateTeamCount(protocol, userAddress);
            
            // 团队人数至少应该等于直推人数
            const newTeamCount = Math.max(calculatedTeamCount, activeDirects);
            
            console.log(`  当前团队人数: ${currentTeamCount}`);
            console.log(`  计算出的团队人数: ${calculatedTeamCount}`);
            console.log(`  直推人数: ${activeDirects}`);
            console.log(`  建议团队人数: ${newTeamCount}`);
            
            if (currentTeamCount === newTeamCount) {
                console.log(`  ✅ 团队人数已正确，无需修复`);
                results.push({
                    user: userAddress,
                    status: 'skipped',
                    reason: 'already_correct',
                    currentTeamCount,
                    newTeamCount
                });
                continue;
            }
            
            // 执行修复
            console.log(`  🔧 修复: 设置团队人数为 ${newTeamCount}`);
            
            const tx = await protocol.adminSetTeamCount(userAddress, newTeamCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 交易已确认: 区块 ${receipt.blockNumber}`);
            
            // 验证修复结果
            const updatedInfo = await protocol.userInfo(userAddress);
            const updatedTeamCount = Number(updatedInfo.teamCount || 0);
            console.log(`  ✅ 修复后团队人数: ${updatedTeamCount}`);
            
            results.push({
                user: userAddress,
                status: 'success',
                currentTeamCount,
                newTeamCount,
                updatedTeamCount,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            });
            
            // 等待一段时间避免nonce问题
            if (i < issues.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (e) {
            console.error(`  ❌ 修复失败: ${e.message}`);
            if (e.message.includes('timeout') || e.message.includes('TIMEOUT')) {
                console.error(`  ⚠️  RPC连接超时，请稍后重试`);
            }
            
            results.push({
                user: userAddress,
                status: 'failed',
                error: e.message
            });
        }
    }
    
    // 保存结果
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(outputDir, `team-count-fix-results-${timestamp}.json`);
    fs.writeFileSync(resultFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalIssues: issues.length,
        results: results
    }, null, 2));
    
    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果汇总");
    console.log("=".repeat(80));
    
    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    
    console.log(`总问题数: ${issues.length}`);
    console.log(`成功修复: ${successCount}`);
    console.log(`跳过（已正确）: ${skippedCount}`);
    console.log(`修复失败: ${failedCount}`);
    console.log(`\n详细结果已保存到: ${resultFile}`);
    
    if (failedCount > 0) {
        console.log("\n⚠️  部分用户修复失败，请检查错误信息并重试");
        process.exit(1);
    } else {
        console.log("\n✅ 所有用户修复完成！");
    }
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
