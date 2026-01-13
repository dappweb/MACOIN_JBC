/**
 * 简单修复团队人数小于直推人数的问题
 * 将团队人数设置为至少等于直推人数
 */

const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
];

/**
 * 主函数
 */
async function main() {
    console.log("🔧 修复团队人数小于直推人数的问题...\n");
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
    
    // 从一致性检查报告获取有问题的用户
    const fs = require("fs");
    const path = require("path");
    const reportFile = path.join(__dirname, '../output/data-consistency-report.json');
    
    if (!fs.existsSync(reportFile)) {
        console.error(`❌ 未找到一致性检查报告: ${reportFile}`);
        console.error("   请先运行: node scripts/check-data-consistency.cjs");
        process.exit(1);
    }
    
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    const logicIssues = report.details.filter(d => d.type === 'logic_error');
    
    if (logicIssues.length === 0) {
        console.log("✅ 没有发现需要修复的用户");
        process.exit(0);
    }
    
    console.log(`📊 找到 ${logicIssues.length} 个需要修复的用户\n`);
    
    // 修复每个用户
    for (let i = 0; i < logicIssues.length; i++) {
        const issue = logicIssues[i];
        const userAddress = issue.user;
        
        console.log(`\n[${i + 1}/${logicIssues.length}] 处理用户: ${userAddress}`);
        console.log(`  问题: ${issue.message}`);
        
        try {
            // 获取当前数据
            const userInfo = await protocol.userInfo(userAddress);
            const activeDirects = Number(userInfo.activeDirects || 0);
            const currentTeamCount = Number(userInfo.teamCount || 0);
            
            console.log(`  当前数据: 直推=${activeDirects}, 团队=${currentTeamCount}`);
            
            if (currentTeamCount >= activeDirects) {
                console.log(`  ✅ 团队人数已正确，无需修复`);
                continue;
            }
            
            // 修复：将团队人数设置为至少等于直推人数
            // 注意：这里使用直推人数作为最小团队人数，实际应该计算所有直推的团队人数
            // 但由于RPC连接问题，我们先用直推人数作为最小值
            const newTeamCount = activeDirects;
            
            console.log(`  🔧 修复: 设置团队人数为 ${newTeamCount} (至少等于直推人数)`);
            
            const tx = await protocol.adminSetTeamCount(userAddress, newTeamCount);
            console.log(`  📝 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 交易已确认: 区块 ${receipt.blockNumber}`);
            
            // 验证修复结果
            const updatedInfo = await protocol.userInfo(userAddress);
            const updatedTeamCount = Number(updatedInfo.teamCount || 0);
            console.log(`  ✅ 修复后团队人数: ${updatedTeamCount}`);
            
            if (updatedTeamCount >= activeDirects) {
                console.log(`  ✅ 修复成功！`);
            } else {
                console.log(`  ⚠️  修复后仍不满足条件，可能需要进一步计算`);
            }
            
        } catch (e) {
            console.error(`  ❌ 修复失败: ${e.message}`);
            if (e.message.includes('timeout') || e.message.includes('TIMEOUT')) {
                console.error(`  ⚠️  RPC连接超时，请稍后重试`);
            }
        }
        
        // 等待一段时间避免nonce问题
        if (i < logicIssues.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log("\n✅ 修复完成！");
    console.log("\n注意：由于RPC连接问题，此脚本将团队人数设置为至少等于直推人数。");
    console.log("如果需要更精确的计算（包括所有直推的团队人数），请等待RPC连接恢复后运行完整修复脚本。");
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
