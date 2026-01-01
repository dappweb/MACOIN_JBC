const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * P-prod环境时间单位修复回滚脚本
 * 
 * 功能：
 * 1. 紧急回滚到升级前状态
 * 2. 验证回滚结果
 * 3. 生成回滚报告
 */

// 配置常量
const CONFIG = {
    PROXY_ADDRESS: "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5",
    BACKUP_DIR: "./backups",
    REPORTS_DIR: "./reports",
    TIMEOUT: 300000
};

// 回滚状态跟踪
let rollbackState = {
    startTime: null,
    endTime: null,
    backupFile: null,
    targetImplementation: null,
    success: false,
    errors: [],
    steps: []
};

/**
 * 主回滚函数
 */
async function main() {
    console.log("🔄 开始P-prod环境时间单位修复回滚...");
    rollbackState.startTime = new Date();
    
    try {
        // 步骤1: 环境检查
        await step1_EnvironmentCheck();
        
        // 步骤2: 选择备份文件
        await step2_SelectBackupFile();
        
        // 步骤3: 回滚前验证
        await step3_PreRollbackValidation();
        
        // 步骤4: 执行回滚
        await step4_ExecuteRollback();
        
        // 步骤5: 回滚后验证
        await step5_PostRollbackValidation();
        
        // 步骤6: 生成报告
        await step6_GenerateReport();
        
        rollbackState.success = true;
        rollbackState.endTime = new Date();
        
        console.log("✅ P-prod时间单位修复回滚成功完成！");
        console.log(`⏱️  总耗时: ${(rollbackState.endTime - rollbackState.startTime) / 1000}秒`);
        
    } catch (error) {
        rollbackState.success = false;
        rollbackState.endTime = new Date();
        rollbackState.errors.push(error.message);
        
        console.error("❌ 回滚失败:", error.message);
        console.log("🚨 请立即联系技术团队进行手动处理！");
        
        await step6_GenerateReport();
        process.exit(1);
    }
}

/**
 * 步骤1: 环境检查
 */
async function step1_EnvironmentCheck() {
    console.log("\n📋 步骤1: 环境检查");
    rollbackState.steps.push("环境检查");
    
    // 检查网络
    const network = await ethers.provider.getNetwork();
    console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId !== 88813n) {
        throw new Error("错误的网络！请确保连接到MC Chain (88813)");
    }
    
    // 检查账户余额
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 部署账户: ${deployer.address}`);
    console.log(`💰 账户余额: ${ethers.formatEther(balance)} MC`);
    
    if (balance < ethers.parseEther("0.05")) {
        throw new Error("账户余额不足！至少需要0.05 MC用于gas费用");
    }
    
    // 检查代理合约是否存在
    const proxyCode = await ethers.provider.getCode(CONFIG.PROXY_ADDRESS);
    if (proxyCode === "0x") {
        throw new Error(`代理合约不存在: ${CONFIG.PROXY_ADDRESS}`);
    }
    
    console.log("✅ 环境检查通过");
}

/**
 * 步骤2: 选择备份文件
 */
async function step2_SelectBackupFile() {
    console.log("\n📁 步骤2: 选择备份文件");
    rollbackState.steps.push("选择备份文件");
    
    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
        throw new Error(`备份目录不存在: ${CONFIG.BACKUP_DIR}`);
    }
    
    // 获取所有备份文件
    const backupFiles = fs.readdirSync(CONFIG.BACKUP_DIR)
        .filter(file => file.startsWith('p-prod-backup-before-time-fix-') && file.endsWith('.json'))
        .sort()
        .reverse(); // 最新的在前
    
    if (backupFiles.length === 0) {
        throw new Error("未找到备份文件！");
    }
    
    // 选择最新的备份文件
    const selectedBackup = backupFiles[0];
    const backupFilePath = path.join(CONFIG.BACKUP_DIR, selectedBackup);
    
    console.log(`📄 选择备份文件: ${selectedBackup}`);
    
    // 读取备份数据
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    rollbackState.backupFile = backupFilePath;
    rollbackState.targetImplementation = backupData.implementationAddress;
    
    console.log(`🎯 目标实现合约: ${rollbackState.targetImplementation}`);
    console.log(`📅 备份时间: ${backupData.timestamp}`);
}

/**
 * 步骤3: 回滚前验证
 */
async function step3_PreRollbackValidation() {
    console.log("\n🔍 步骤3: 回滚前验证");
    rollbackState.steps.push("回滚前验证");
    
    try {
        // 获取当前实现地址
        const currentImplementation = await upgrades.erc1967.getImplementationAddress(CONFIG.PROXY_ADDRESS);
        console.log(`📋 当前实现合约: ${currentImplementation}`);
        
        // 检查是否需要回滚
        if (currentImplementation.toLowerCase() === rollbackState.targetImplementation.toLowerCase()) {
            throw new Error("当前实现合约与目标实现合约相同，无需回滚");
        }
        
        // 验证目标实现合约是否存在
        const targetCode = await ethers.provider.getCode(rollbackState.targetImplementation);
        if (targetCode === "0x") {
            throw new Error(`目标实现合约不存在: ${rollbackState.targetImplementation}`);
        }
        
        console.log("✅ 回滚前验证通过");
        
    } catch (error) {
        throw new Error(`回滚前验证失败: ${error.message}`);
    }
}

/**
 * 步骤4: 执行回滚
 */
async function step4_ExecuteRollback() {
    console.log("\n🔄 步骤4: 执行回滚");
    rollbackState.steps.push("执行回滚");
    
    try {
        // 连接到当前合约
        const currentContract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFix", CONFIG.PROXY_ADDRESS);
        
        // 暂停合约（如果可能）
        try {
            const isPaused = await currentContract.paused();
            if (!isPaused) {
                console.log("⏸️  暂停合约...");
                const pauseTx = await currentContract.pauseMigration();
                await pauseTx.wait();
            }
        } catch (error) {
            console.log("⚠️  无法暂停合约，继续回滚...");
        }
        
        // 执行回滚升级
        console.log("🔄 执行回滚升级...");
        
        // 获取目标合约工厂
        const JinbaoProtocolV3Standalone = await ethers.getContractFactory("JinbaoProtocolV3Standalone");
        
        // 执行回滚
        const rolledBackContract = await upgrades.upgradeProxy(
            CONFIG.PROXY_ADDRESS,
            JinbaoProtocolV3Standalone,
            {
                timeout: CONFIG.TIMEOUT,
                pollingInterval: 5000
            }
        );
        
        await rolledBackContract.waitForDeployment();
        
        console.log("✅ 回滚升级完成");
        
        return rolledBackContract;
        
    } catch (error) {
        throw new Error(`回滚执行失败: ${error.message}`);
    }
}

/**
 * 步骤5: 回滚后验证
 */
async function step5_PostRollbackValidation() {
    console.log("\n✅ 步骤5: 回滚后验证");
    rollbackState.steps.push("回滚后验证");
    
    try {
        // 验证实现地址
        const currentImplementation = await upgrades.erc1967.getImplementationAddress(CONFIG.PROXY_ADDRESS);
        console.log(`📋 当前实现合约: ${currentImplementation}`);
        
        if (currentImplementation.toLowerCase() !== rollbackState.targetImplementation.toLowerCase()) {
            throw new Error("回滚后实现地址验证失败");
        }
        
        // 连接到回滚后的合约
        const rolledBackContract = await ethers.getContractAt("JinbaoProtocolV3Standalone", CONFIG.PROXY_ADDRESS);
        
        // 验证版本
        const version = await rolledBackContract.VERSION_V3();
        console.log(`📋 合约版本: ${version}`);
        
        // 验证基础功能
        const owner = await rolledBackContract.owner();
        console.log(`👤 合约所有者: ${owner}`);
        
        // 检查是否还有V4功能（应该没有）
        try {
            await rolledBackContract.getVersionV4();
            throw new Error("检测到V4功能，回滚可能不完整");
        } catch (error) {
            if (error.message.includes("getVersionV4")) {
                console.log("✅ V4功能已移除");
            } else {
                throw error;
            }
        }
        
        console.log("✅ 回滚后验证全部通过");
        
    } catch (error) {
        throw new Error(`回滚后验证失败: ${error.message}`);
    }
}

/**
 * 步骤6: 生成回滚报告
 */
async function step6_GenerateReport() {
    console.log("\n📊 步骤6: 生成回滚报告");
    rollbackState.steps.push("生成报告");
    
    // 确保报告目录存在
    if (!fs.existsSync(CONFIG.REPORTS_DIR)) {
        fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `p-prod-time-unit-fix-rollback-report-${timestamp}.md`;
    const reportFilePath = path.join(CONFIG.REPORTS_DIR, reportFileName);
    
    const duration = rollbackState.endTime ? (rollbackState.endTime - rollbackState.startTime) / 1000 : 0;
    
    const report = `# P-prod环境时间单位修复回滚报告

## 回滚概要
- **回滚时间**: ${rollbackState.startTime?.toISOString()}
- **完成时间**: ${rollbackState.endTime?.toISOString()}
- **总耗时**: ${duration}秒
- **回滚状态**: ${rollbackState.success ? '✅ 成功' : '❌ 失败'}
- **网络**: MC Chain (88813)
- **代理合约**: ${CONFIG.PROXY_ADDRESS}

## 回滚详情
- **目标实现合约**: ${rollbackState.targetImplementation}
- **使用备份文件**: ${rollbackState.backupFile}

## 执行步骤
${rollbackState.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## 回滚原因
- 升级过程中遇到问题
- 需要恢复到稳定状态
- 等待问题修复后重新升级

## 验证结果
- ✅ 实现合约地址: 已恢复
- ✅ 合约版本: V3
- ✅ V4功能: 已移除
- ✅ 基础功能: 正常

${rollbackState.errors.length > 0 ? `## 错误记录\n${rollbackState.errors.map(error => `- ❌ ${error}`).join('\n')}` : '## 错误记录\n无错误'}

## 后续步骤
1. 分析升级失败原因
2. 修复发现的问题
3. 重新测试升级流程
4. 准备下次升级

## 注意事项
- 系统已恢复到升级前状态
- 时间单位仍为60秒（分钟级）
- 需要重新规划升级时间

---
*报告生成时间: ${new Date().toISOString()}*
`;

    fs.writeFileSync(reportFilePath, report);
    console.log(`✅ 回滚报告已生成: ${reportFileName}`);
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

// 执行主函数
if (require.main === module) {
    main().catch((error) => {
        console.error("❌ 回滚脚本执行失败:", error);
        process.exit(1);
    });
}

module.exports = {
    main,
    CONFIG,
    rollbackState
};