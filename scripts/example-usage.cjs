const { ethers } = require("hardhat");

/**
 * 部署脚本使用示例
 * 演示如何使用部署和回滚脚本
 */

async function main() {
    console.log("📚 P-prod时间单位修复脚本使用示例\n");
    
    console.log("🔧 1. 执行升级部署:");
    console.log("   npx hardhat run scripts/deploy-time-unit-fix.cjs --network mc");
    console.log("   - 自动备份当前合约状态");
    console.log("   - 执行升级前验证检查");
    console.log("   - 部署新的V4实现合约");
    console.log("   - 执行UUPS代理升级");
    console.log("   - 初始化V4功能");
    console.log("   - 执行升级后验证");
    console.log("   - 生成详细升级报告\n");
    
    console.log("🔄 2. 紧急回滚（如果需要）:");
    console.log("   npx hardhat run scripts/rollback-upgrade.cjs --network mc");
    console.log("   - 自动选择最新备份文件");
    console.log("   - 执行回滚前验证");
    console.log("   - 回滚到升级前状态");
    console.log("   - 验证回滚结果");
    console.log("   - 生成回滚报告\n");
    
    console.log("📋 3. 验证升级结果:");
    console.log("   - 检查合约版本: getVersionV4() 应返回 '4.0.0'");
    console.log("   - 检查时间单位: getEffectiveSecondsInUnit() 应返回 86400");
    console.log("   - 检查修复状态: timeUnitFixed 应为 true");
    console.log("   - 检查基础功能: owner(), paused() 等\n");
    
    console.log("📁 4. 生成的文件:");
    console.log("   - 备份文件: ./backups/p-prod-backup-before-time-fix-*.json");
    console.log("   - 升级报告: ./reports/p-prod-time-unit-fix-report-*.md");
    console.log("   - 回滚报告: ./reports/p-prod-time-unit-fix-rollback-report-*.md\n");
    
    console.log("⚠️  5. 注意事项:");
    console.log("   - 确保连接到正确的网络 (MC Chain, Chain ID: 88813)");
    console.log("   - 确保账户有足够的MC代币支付gas费用");
    console.log("   - 升级前建议在测试环境先验证");
    console.log("   - 保留好备份文件以备回滚使用");
    console.log("   - 升级完成后需要执行用户数据迁移\n");
    
    console.log("🔍 6. 故障排除:");
    console.log("   - 如果升级失败，检查升级报告中的错误信息");
    console.log("   - 如果需要回滚，运行回滚脚本");
    console.log("   - 如果回滚也失败，请联系技术团队");
    console.log("   - 所有操作都有详细日志记录\n");
    
    // 显示当前网络信息
    try {
        const network = await ethers.provider.getNetwork();
        const [deployer] = await ethers.getSigners();
        const balance = await ethers.provider.getBalance(deployer.address);
        
        console.log("🌐 当前环境信息:");
        console.log(`   网络: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`   部署账户: ${deployer.address}`);
        console.log(`   账户余额: ${ethers.formatEther(balance)} ETH`);
        
        if (network.chainId === 88813n) {
            console.log("   ✅ 已连接到MC Chain");
        } else {
            console.log("   ⚠️  未连接到MC Chain，请切换网络");
        }
        
    } catch (error) {
        console.log("   ❌ 无法获取网络信息:", error.message);
    }
}

main().catch((error) => {
    console.error("❌ 示例脚本执行失败:", error);
    process.exit(1);
});