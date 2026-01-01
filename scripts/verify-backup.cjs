const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 备份数据验证脚本
 * 验证备份数据的完整性和准确性
 */

class BackupVerifier {
    constructor(backupFilePath) {
        this.backupFilePath = backupFilePath;
        this.backupData = null;
        this.contract = null;
        this.verificationResults = {
            overall: false,
            contractConfig: false,
            userInfo: false,
            tickets: false,
            stakes: false,
            dynamicRewards: false,
            pendingRewards: false,
            errors: [],
            warnings: []
        };
    }

    /**
     * 加载备份数据
     */
    loadBackupData() {
        console.log("📂 加载备份数据...");
        
        if (!fs.existsSync(this.backupFilePath)) {
            throw new Error(`备份文件不存在: ${this.backupFilePath}`);
        }
        
        try {
            const data = fs.readFileSync(this.backupFilePath, 'utf8');
            this.backupData = JSON.parse(data);
            
            console.log(`✅ 备份数据加载成功`);
            console.log(`   - 备份时间: ${new Date(this.backupData.metadata.timestamp).toLocaleString()}`);
            console.log(`   - 区块号: ${this.backupData.metadata.blockNumber}`);
            console.log(`   - 用户数量: ${this.backupData.statistics.totalUsers}`);
            
        } catch (error) {
            throw new Error(`加载备份数据失败: ${error.message}`);
        }
    }

    /**
     * 初始化合约连接
     */
    async initializeContract() {
        console.log("🔧 初始化合约连接...");
        
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        
        const contractABI = [
            "function owner() view returns (address)",
            "function paused() view returns (bool)",
            "function mcToken() view returns (address)",
            "function jbcToken() view returns (address)",
            "function getVersionV3() view returns (string)",
            "function userInfo(address) view returns (uint256,uint256,uint256,uint256,uint256,address,bool)",
            "function tickets(address,uint256) view returns (uint256,uint256,bool)",
            "function stakes(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
            "function pendingRewards(address) view returns (uint256)",
            "function getUserDynamicRewards(address) view returns (uint256,uint256,uint256,uint256)"
        ];
        
        this.contract = new ethers.Contract(
            this.backupData.metadata.contractAddress,
            contractABI,
            provider
        );
        
        console.log("✅ 合约连接成功");
    }

    /**
     * 验证合约配置
     */
    async verifyContractConfig() {
        console.log("🔍 验证合约配置...");
        
        try {
            const currentOwner = await this.contract.owner();
            const currentPaused = await this.contract.paused();
            const currentMcToken = await this.contract.mcToken();
            const currentJbcToken = await this.contract.jbcToken();
            const currentVersion = await this.contract.getVersionV3();
            
            const config = this.backupData.contractConfig;
            
            // 验证各项配置
            const checks = [
                { name: "Owner", backup: config.owner, current: currentOwner },
                { name: "Paused", backup: config.paused, current: currentPaused },
                { name: "MC Token", backup: config.mcToken, current: currentMcToken },
                { name: "JBC Token", backup: config.jbcToken, current: currentJbcToken },
                { name: "Version", backup: config.version, current: currentVersion }
            ];
            
            let allMatch = true;
            
            for (const check of checks) {
                if (check.backup.toString() === check.current.toString()) {
                    console.log(`   ✅ ${check.name}: 匹配`);
                } else {
                    console.log(`   ❌ ${check.name}: 不匹配`);
                    console.log(`      备份: ${check.backup}`);
                    console.log(`      当前: ${check.current}`);
                    this.verificationResults.errors.push(`${check.name} 配置不匹配`);
                    allMatch = false;
                }
            }
            
            this.verificationResults.contractConfig = allMatch;
            
        } catch (error) {
            this.verificationResults.errors.push(`合约配置验证失败: ${error.message}`);
            console.error("❌ 合约配置验证失败:", error.message);
        }
    }

    /**
     * 验证用户信息
     */
    async verifyUserInfo() {
        console.log("👥 验证用户信息...");
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of this.backupData.userAccounts) {
            try {
                const currentUserInfo = await this.contract.userInfo(user);
                const backupUserInfo = this.backupData.userInfo[user];
                
                const matches = [
                    currentUserInfo[0].toString() === backupUserInfo.totalTickets,
                    currentUserInfo[1].toString() === backupUserInfo.totalStaked,
                    currentUserInfo[2].toString() === backupUserInfo.totalRewards,
                    currentUserInfo[3].toString() === backupUserInfo.referralCount,
                    currentUserInfo[4].toString() === backupUserInfo.teamCount,
                    currentUserInfo[5] === backupUserInfo.referrer,
                    currentUserInfo[6] === backupUserInfo.isActive
                ];
                
                if (matches.every(match => match)) {
                    successCount++;
                    console.log(`   ✅ 用户 ${user.slice(0,8)}... 信息匹配`);
                } else {
                    errorCount++;
                    console.log(`   ❌ 用户 ${user.slice(0,8)}... 信息不匹配`);
                    this.verificationResults.errors.push(`用户 ${user} 信息不匹配`);
                }
                
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 用户 ${user} 验证失败:`, error.message);
                this.verificationResults.errors.push(`用户 ${user} 验证失败: ${error.message}`);
            }
        }
        
        this.verificationResults.userInfo = errorCount === 0;
        console.log(`📊 用户信息验证完成: ${successCount} 成功, ${errorCount} 失败`);
    }

    /**
     * 抽样验证门票数据
     */
    async verifyTickets() {
        console.log("🎫 抽样验证门票数据...");
        
        let successCount = 0;
        let errorCount = 0;
        
        // 抽样验证前5个用户的门票
        const sampleUsers = this.backupData.userAccounts.slice(0, Math.min(5, this.backupData.userAccounts.length));
        
        for (const user of sampleUsers) {
            try {
                const backupTickets = this.backupData.tickets[user] || [];
                
                for (let i = 0; i < Math.min(3, backupTickets.length); i++) {
                    const currentTicket = await this.contract.tickets(user, i);
                    const backupTicket = backupTickets[i];
                    
                    if (currentTicket[0].toString() === backupTicket.amount &&
                        currentTicket[1].toString() === backupTicket.timestamp &&
                        currentTicket[2] === backupTicket.isActive) {
                        successCount++;
                    } else {
                        errorCount++;
                        this.verificationResults.errors.push(`用户 ${user} 门票 ${i} 不匹配`);
                    }
                }
                
                console.log(`   ✅ 用户 ${user.slice(0,8)}... 门票抽样验证完成`);
                
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 用户 ${user} 门票验证失败:`, error.message);
            }
        }
        
        this.verificationResults.tickets = errorCount === 0;
        console.log(`📊 门票抽样验证完成: ${successCount} 成功, ${errorCount} 失败`);
    }

    /**
     * 抽样验证质押数据
     */
    async verifyStakes() {
        console.log("💰 抽样验证质押数据...");
        
        let successCount = 0;
        let errorCount = 0;
        
        // 抽样验证前5个用户的质押
        const sampleUsers = this.backupData.userAccounts.slice(0, Math.min(5, this.backupData.userAccounts.length));
        
        for (const user of sampleUsers) {
            try {
                const backupStakes = this.backupData.stakes[user] || [];
                
                for (let i = 0; i < Math.min(3, backupStakes.length); i++) {
                    const currentStake = await this.contract.stakes(user, i);
                    const backupStake = backupStakes[i];
                    
                    if (currentStake[0].toString() === backupStake.amount &&
                        currentStake[1].toString() === backupStake.startTime &&
                        currentStake[2].toString() === backupStake.endTime &&
                        currentStake[3].toString() === backupStake.cycleDays &&
                        currentStake[4] === backupStake.isActive) {
                        successCount++;
                    } else {
                        errorCount++;
                        this.verificationResults.errors.push(`用户 ${user} 质押 ${i} 不匹配`);
                    }
                }
                
                console.log(`   ✅ 用户 ${user.slice(0,8)}... 质押抽样验证完成`);
                
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 用户 ${user} 质押验证失败:`, error.message);
            }
        }
        
        this.verificationResults.stakes = errorCount === 0;
        console.log(`📊 质押抽样验证完成: ${successCount} 成功, ${errorCount} 失败`);
    }

    /**
     * 验证动态奖励数据
     */
    async verifyDynamicRewards() {
        console.log("🎁 验证动态奖励数据...");
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of this.backupData.userAccounts) {
            try {
                const currentRewards = await this.contract.getUserDynamicRewards(user);
                const backupRewards = this.backupData.dynamicRewards[user];
                
                if (backupRewards && backupRewards.overview) {
                    const matches = [
                        currentRewards[0].toString() === backupRewards.overview.totalEarned,
                        currentRewards[1].toString() === backupRewards.overview.totalClaimed,
                        currentRewards[2].toString() === backupRewards.overview.pendingAmount,
                        currentRewards[3].toString() === backupRewards.overview.claimableAmount
                    ];
                    
                    if (matches.every(match => match)) {
                        successCount++;
                        console.log(`   ✅ 用户 ${user.slice(0,8)}... 动态奖励匹配`);
                    } else {
                        errorCount++;
                        console.log(`   ❌ 用户 ${user.slice(0,8)}... 动态奖励不匹配`);
                        this.verificationResults.errors.push(`用户 ${user} 动态奖励不匹配`);
                    }
                } else {
                    this.verificationResults.warnings.push(`用户 ${user} 缺少动态奖励备份数据`);
                }
                
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 用户 ${user} 动态奖励验证失败:`, error.message);
            }
        }
        
        this.verificationResults.dynamicRewards = errorCount === 0;
        console.log(`📊 动态奖励验证完成: ${successCount} 成功, ${errorCount} 失败`);
    }

    /**
     * 验证待提取奖励
     */
    async verifyPendingRewards() {
        console.log("⏳ 验证待提取奖励...");
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of this.backupData.userAccounts) {
            try {
                const currentPending = await this.contract.pendingRewards(user);
                const backupPending = this.backupData.pendingRewards[user];
                
                if (currentPending.toString() === backupPending) {
                    successCount++;
                    console.log(`   ✅ 用户 ${user.slice(0,8)}... 待提取奖励匹配`);
                } else {
                    errorCount++;
                    console.log(`   ❌ 用户 ${user.slice(0,8)}... 待提取奖励不匹配`);
                    console.log(`      备份: ${backupPending}`);
                    console.log(`      当前: ${currentPending.toString()}`);
                    this.verificationResults.errors.push(`用户 ${user} 待提取奖励不匹配`);
                }
                
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 用户 ${user} 待提取奖励验证失败:`, error.message);
            }
        }
        
        this.verificationResults.pendingRewards = errorCount === 0;
        console.log(`📊 待提取奖励验证完成: ${successCount} 成功, ${errorCount} 失败`);
    }

    /**
     * 生成验证报告
     */
    generateVerificationReport() {
        console.log("\n📋 生成验证报告...");
        
        // 检查是否有实际数据需要验证
        const hasData = this.backupData.statistics.totalUsers > 0;
        
        const allPassed = Object.values(this.verificationResults)
            .filter(value => typeof value === 'boolean')
            .every(value => value);
        
        // 如果没有数据但合约配置正确，也认为验证通过
        const overallPassed = hasData ? allPassed : this.verificationResults.contractConfig;
        
        this.verificationResults.overall = overallPassed;
        
        const report = {
            timestamp: Date.now(),
            backupFile: this.backupFilePath,
            backupTimestamp: this.backupData.metadata.timestamp,
            hasData: hasData,
            verificationResults: this.verificationResults,
            summary: {
                overall: overallPassed ? "通过" : "失败",
                totalErrors: this.verificationResults.errors.length,
                totalWarnings: this.verificationResults.warnings.length,
                note: hasData ? "包含用户数据的完整验证" : "空数据备份的基础验证"
            }
        };
        
        // 保存验证报告
        const reportPath = this.backupFilePath.replace('.json', '-verification-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ 验证报告已保存: ${reportPath}`);
        
        return report;
    }

    /**
     * 执行完整验证
     */
    async executeFullVerification() {
        console.log("🔍 开始执行备份数据验证...");
        
        try {
            // 1. 加载备份数据
            this.loadBackupData();
            
            // 2. 初始化合约连接
            await this.initializeContract();
            
            // 3. 执行各项验证
            await this.verifyContractConfig();
            await this.verifyUserInfo();
            await this.verifyTickets();
            await this.verifyStakes();
            await this.verifyDynamicRewards();
            await this.verifyPendingRewards();
            
            // 4. 生成验证报告
            const report = this.generateVerificationReport();
            
            // 5. 输出结果
            console.log("\n🎉 验证完成！");
            console.log(`📊 验证结果: ${report.summary.overall}`);
            console.log(`❌ 错误数量: ${report.summary.totalErrors}`);
            console.log(`⚠️  警告数量: ${report.summary.totalWarnings}`);
            
            if (this.verificationResults.errors.length > 0) {
                console.log("\n❌ 错误详情:");
                this.verificationResults.errors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error}`);
                });
            }
            
            if (this.verificationResults.warnings.length > 0) {
                console.log("\n⚠️  警告详情:");
                this.verificationResults.warnings.forEach((warning, index) => {
                    console.log(`   ${index + 1}. ${warning}`);
                });
            }
            
            return report;
            
        } catch (error) {
            console.error("❌ 验证过程中发生错误:", error);
            throw error;
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error("❌ 请提供备份文件路径");
        console.log("用法: node verify-backup.cjs <backup-file-path>");
        process.exit(1);
    }
    
    const backupFilePath = args[0];
    const verifier = new BackupVerifier(backupFilePath);
    
    try {
        const report = await verifier.executeFullVerification();
        
        if (report.verificationResults.overall) {
            console.log("\n✅ 备份验证成功，数据完整性良好");
            process.exit(0);
        } else {
            console.log("\n❌ 备份验证失败，发现数据不一致");
            process.exit(1);
        }
        
    } catch (error) {
        console.error("\n❌ 验证脚本执行失败:", error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BackupVerifier };