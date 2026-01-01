const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * P-prod环境合约状态备份脚本
 * 用于时间单位修复前的完整数据备份
 */

// 配置
const CONFIG = {
    PROXY_ADDRESS: "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5",
    RPC_URL: "https://chain.mcerscan.com/",
    BACKUP_DIR: "./backups",
    BATCH_SIZE: 50, // 批量查询大小
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000 // 2秒
};

class ContractStateBackup {
    constructor() {
        this.contract = null;
        this.backupData = {
            metadata: {
                timestamp: Date.now(),
                blockNumber: 0,
                contractAddress: CONFIG.PROXY_ADDRESS,
                version: "V3",
                purpose: "时间单位修复前备份"
            },
            contractConfig: {},
            userAccounts: [],
            userInfo: {},
            tickets: {},
            stakes: {},
            dynamicRewards: {},
            referrals: {},
            pendingRewards: {},
            tokenBalances: {},
            statistics: {
                totalUsers: 0,
                totalTickets: 0,
                totalStakes: 0,
                totalDynamicRewards: 0,
                totalPendingRewards: 0
            }
        };
    }

    /**
     * 初始化合约连接
     */
    async initialize() {
        console.log("🔧 初始化合约连接...");
        
        // 连接到MC Chain
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        
        // 获取合约实例
        const contractABI = [
            // 基础查询函数
            "function owner() view returns (address)",
            "function paused() view returns (bool)",
            "function mcToken() view returns (address)",
            "function jbcToken() view returns (address)",
            "function getVersionV3() view returns (string)",
            
            // 用户信息查询
            "function userInfo(address) view returns (uint256,uint256,uint256,uint256,uint256,address,bool)",
            "function tickets(address,uint256) view returns (uint256,uint256,bool)",
            "function stakes(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
            "function referrals(address,uint256) view returns (address)",
            "function pendingRewards(address) view returns (uint256)",
            
            // V3动态奖励查询
            "function getUserDynamicRewards(address) view returns (uint256,uint256,uint256,uint256)",
            "function getUserDynamicRewardsList(address,uint256,uint256) view returns (tuple(uint256,uint256,uint8,address,bool,uint256)[])",
            "function totalDynamicEarned(address) view returns (uint256)",
            "function totalDynamicClaimed(address) view returns (uint256)",
            
            // 代币余额查询
            "function balanceOf(address) view returns (uint256)"
        ];
        
        this.contract = new ethers.Contract(CONFIG.PROXY_ADDRESS, contractABI, provider);
        
        // 获取当前区块号
        this.backupData.metadata.blockNumber = await provider.getBlockNumber();
        
        console.log(`✅ 合约连接成功，当前区块: ${this.backupData.metadata.blockNumber}`);
    }

    /**
     * 备份合约基础配置
     */
    async backupContractConfig() {
        console.log("📋 备份合约基础配置...");
        
        try {
            this.backupData.contractConfig = {
                owner: await this.contract.owner(),
                paused: await this.contract.paused(),
                mcToken: await this.contract.mcToken(),
                jbcToken: await this.contract.jbcToken(),
                version: await this.contract.getVersionV3()
            };
            
            console.log(`✅ 合约配置备份完成`);
            console.log(`   - Owner: ${this.backupData.contractConfig.owner}`);
            console.log(`   - Paused: ${this.backupData.contractConfig.paused}`);
            console.log(`   - Version: ${this.backupData.contractConfig.version}`);
        } catch (error) {
            console.error("❌ 备份合约配置失败:", error.message);
            throw error;
        }
    }

    /**
     * 发现所有用户账户
     * 通过事件日志或已知活跃用户列表
     */
    async discoverUserAccounts() {
        console.log("🔍 发现用户账户...");
        
        // 已知的活跃用户列表
        const knownUsers = [
            "0x2D68a5850a4805C6Fe6648E5870b68456e2A7c82",
            "0x5067d182d5f15511f0c71194a25cc67b05c20b02"
        ];
        
        // 验证用户是否活跃
        for (const user of knownUsers) {
            try {
                // 验证地址格式
                if (!ethers.isAddress(user)) {
                    console.warn(`⚠️  无效地址格式: ${user}`);
                    continue;
                }
                
                const userInfo = await this.contract.userInfo(user);
                
                // 检查用户是否有任何活动（不仅仅是isActive标志）
                const hasActivity = userInfo[0] > 0 || // totalTickets > 0
                                  userInfo[1] > 0 || // totalStaked > 0
                                  userInfo[2] > 0 || // totalRewards > 0
                                  userInfo[6];       // isActive
                
                if (hasActivity) {
                    this.backupData.userAccounts.push(user);
                    console.log(`   ✓ 发现活跃用户: ${user.slice(0,8)}...`);
                }
            } catch (error) {
                console.warn(`⚠️  检查用户 ${user} 失败:`, error.message);
            }
        }
        
        // 如果没有发现用户，尝试从合约事件中获取
        if (this.backupData.userAccounts.length === 0) {
            console.log("🔍 尝试从合约事件中发现用户...");
            await this.discoverUsersFromEvents();
        }
        
        console.log(`✅ 发现 ${this.backupData.userAccounts.length} 个活跃用户`);
        this.backupData.statistics.totalUsers = this.backupData.userAccounts.length;
    }

    /**
     * 从合约事件中发现用户
     */
    async discoverUsersFromEvents() {
        try {
            // 获取最近的区块范围
            const currentBlock = await this.contract.provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000); // 最近10000个区块
            
            console.log(`   查询区块范围: ${fromBlock} - ${currentBlock}`);
            
            // 查询Transfer事件（如果合约有的话）
            const filter = {
                address: CONFIG.PROXY_ADDRESS,
                fromBlock: fromBlock,
                toBlock: currentBlock
            };
            
            const logs = await this.contract.provider.getLogs(filter);
            const userSet = new Set();
            
            // 从事件日志中提取用户地址
            for (const log of logs.slice(0, 100)) { // 限制处理数量
                try {
                    // 尝试从topics中提取地址
                    if (log.topics && log.topics.length > 1) {
                        for (let i = 1; i < log.topics.length; i++) {
                            const topic = log.topics[i];
                            if (topic.length === 66) { // 0x + 64 hex chars
                                const address = ethers.getAddress('0x' + topic.slice(-40));
                                if (ethers.isAddress(address) && address !== ethers.ZeroAddress) {
                                    userSet.add(address);
                                }
                            }
                        }
                    }
                } catch (error) {
                    // 忽略解析错误
                }
            }
            
            // 验证从事件中发现的用户
            for (const user of Array.from(userSet).slice(0, 20)) { // 限制验证数量
                try {
                    const userInfo = await this.contract.userInfo(user);
                    const hasActivity = userInfo[0] > 0 || userInfo[1] > 0 || userInfo[2] > 0 || userInfo[6];
                    
                    if (hasActivity && !this.backupData.userAccounts.includes(user)) {
                        this.backupData.userAccounts.push(user);
                        console.log(`   ✓ 从事件发现用户: ${user.slice(0,8)}...`);
                    }
                } catch (error) {
                    // 忽略验证错误
                }
            }
            
        } catch (error) {
            console.warn("⚠️  从事件发现用户失败:", error.message);
        }
    }

    /**
     * 备份用户基础信息
     */
    async backupUserInfo() {
        console.log("👥 备份用户基础信息...");
        
        for (let i = 0; i < this.backupData.userAccounts.length; i++) {
            const user = this.backupData.userAccounts[i];
            
            try {
                const userInfo = await this.contract.userInfo(user);
                
                this.backupData.userInfo[user] = {
                    totalTickets: userInfo[0].toString(),
                    totalStaked: userInfo[1].toString(),
                    totalRewards: userInfo[2].toString(),
                    referralCount: userInfo[3].toString(),
                    teamCount: userInfo[4].toString(),
                    referrer: userInfo[5],
                    isActive: userInfo[6]
                };
                
                console.log(`   ✓ 用户 ${user.slice(0,8)}... 信息备份完成`);
            } catch (error) {
                console.error(`   ❌ 用户 ${user} 信息备份失败:`, error.message);
            }
        }
        
        console.log(`✅ 用户基础信息备份完成`);
    }

    /**
     * 备份用户门票数据
     */
    async backupUserTickets() {
        console.log("🎫 备份用户门票数据...");
        
        for (const user of this.backupData.userAccounts) {
            try {
                const userInfo = this.backupData.userInfo[user];
                const ticketCount = parseInt(userInfo.totalTickets);
                
                this.backupData.tickets[user] = [];
                
                for (let i = 0; i < ticketCount; i++) {
                    try {
                        const ticket = await this.contract.tickets(user, i);
                        this.backupData.tickets[user].push({
                            amount: ticket[0].toString(),
                            timestamp: ticket[1].toString(),
                            isActive: ticket[2]
                        });
                        this.backupData.statistics.totalTickets++;
                    } catch (error) {
                        console.warn(`   ⚠️  用户 ${user} 门票 ${i} 备份失败`);
                    }
                }
                
                console.log(`   ✓ 用户 ${user.slice(0,8)}... ${ticketCount} 张门票备份完成`);
            } catch (error) {
                console.error(`   ❌ 用户 ${user} 门票备份失败:`, error.message);
            }
        }
        
        console.log(`✅ 门票数据备份完成，总计 ${this.backupData.statistics.totalTickets} 张门票`);
    }

    /**
     * 备份用户质押数据
     */
    async backupUserStakes() {
        console.log("💰 备份用户质押数据...");
        
        for (const user of this.backupData.userAccounts) {
            try {
                // 估算质押数量（通过尝试查询）
                this.backupData.stakes[user] = [];
                let stakeIndex = 0;
                
                while (stakeIndex < 100) { // 最多查询100个质押
                    try {
                        const stake = await this.contract.stakes(user, stakeIndex);
                        
                        if (stake[0].toString() === "0") break; // 没有更多质押
                        
                        this.backupData.stakes[user].push({
                            amount: stake[0].toString(),
                            startTime: stake[1].toString(),
                            endTime: stake[2].toString(),
                            cycleDays: stake[3].toString(),
                            isActive: stake[4]
                        });
                        
                        this.backupData.statistics.totalStakes++;
                        stakeIndex++;
                    } catch (error) {
                        break; // 没有更多质押
                    }
                }
                
                console.log(`   ✓ 用户 ${user.slice(0,8)}... ${stakeIndex} 个质押备份完成`);
            } catch (error) {
                console.error(`   ❌ 用户 ${user} 质押备份失败:`, error.message);
            }
        }
        
        console.log(`✅ 质押数据备份完成，总计 ${this.backupData.statistics.totalStakes} 个质押`);
    }

    /**
     * 备份用户动态奖励数据 (V3新增)
     */
    async backupUserDynamicRewards() {
        console.log("🎁 备份用户动态奖励数据...");
        
        for (const user of this.backupData.userAccounts) {
            try {
                // 获取动态奖励概览
                const rewardOverview = await this.contract.getUserDynamicRewards(user);
                
                this.backupData.dynamicRewards[user] = {
                    overview: {
                        totalEarned: rewardOverview[0].toString(),
                        totalClaimed: rewardOverview[1].toString(),
                        pendingAmount: rewardOverview[2].toString(),
                        claimableAmount: rewardOverview[3].toString()
                    },
                    rewards: []
                };
                
                // 获取详细奖励列表
                try {
                    const rewardsList = await this.contract.getUserDynamicRewardsList(user, 0, 100);
                    
                    for (const reward of rewardsList) {
                        this.backupData.dynamicRewards[user].rewards.push({
                            amount: reward[0].toString(),
                            timestamp: reward[1].toString(),
                            sourceType: reward[2],
                            fromUser: reward[3],
                            claimed: reward[4],
                            unlockTime: reward[5].toString()
                        });
                        this.backupData.statistics.totalDynamicRewards++;
                    }
                } catch (error) {
                    console.warn(`   ⚠️  用户 ${user} 动态奖励列表获取失败`);
                }
                
                console.log(`   ✓ 用户 ${user.slice(0,8)}... 动态奖励备份完成`);
            } catch (error) {
                console.error(`   ❌ 用户 ${user} 动态奖励备份失败:`, error.message);
            }
        }
        
        console.log(`✅ 动态奖励数据备份完成，总计 ${this.backupData.statistics.totalDynamicRewards} 个奖励`);
    }

    /**
     * 备份待提取奖励
     */
    async backupPendingRewards() {
        console.log("⏳ 备份待提取奖励...");
        
        for (const user of this.backupData.userAccounts) {
            try {
                const pendingReward = await this.contract.pendingRewards(user);
                this.backupData.pendingRewards[user] = pendingReward.toString();
                
                if (pendingReward > 0) {
                    this.backupData.statistics.totalPendingRewards++;
                }
                
                console.log(`   ✓ 用户 ${user.slice(0,8)}... 待提取奖励: ${ethers.formatEther(pendingReward)} MC`);
            } catch (error) {
                console.error(`   ❌ 用户 ${user} 待提取奖励备份失败:`, error.message);
            }
        }
        
        console.log(`✅ 待提取奖励备份完成`);
    }

    /**
     * 保存备份数据到文件
     */
    async saveBackupData() {
        console.log("💾 保存备份数据...");
        
        // 确保备份目录存在
        if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
            fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
        }
        
        // 生成备份文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `p-prod-time-unit-fix-backup-${timestamp}.json`;
        const filepath = path.join(CONFIG.BACKUP_DIR, filename);
        
        // 保存备份数据
        fs.writeFileSync(filepath, JSON.stringify(this.backupData, null, 2));
        
        // 生成备份摘要
        const summary = {
            filename,
            timestamp: this.backupData.metadata.timestamp,
            blockNumber: this.backupData.metadata.blockNumber,
            statistics: this.backupData.statistics,
            fileSize: fs.statSync(filepath).size
        };
        
        const summaryPath = path.join(CONFIG.BACKUP_DIR, `backup-summary-${timestamp}.json`);
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log(`✅ 备份数据已保存:`);
        console.log(`   - 备份文件: ${filepath}`);
        console.log(`   - 摘要文件: ${summaryPath}`);
        console.log(`   - 文件大小: ${(summary.fileSize / 1024 / 1024).toFixed(2)} MB`);
        
        return { filepath, summaryPath, summary };
    }

    /**
     * 执行完整备份流程
     */
    async executeFullBackup() {
        console.log("🚀 开始执行P-prod环境完整备份...");
        console.log(`📅 备份时间: ${new Date().toLocaleString()}`);
        console.log(`🔗 合约地址: ${CONFIG.PROXY_ADDRESS}`);
        
        try {
            // 1. 初始化
            await this.initialize();
            
            // 2. 备份合约配置
            await this.backupContractConfig();
            
            // 3. 发现用户账户
            await this.discoverUserAccounts();
            
            // 4. 备份用户数据
            await this.backupUserInfo();
            await this.backupUserTickets();
            await this.backupUserStakes();
            await this.backupUserDynamicRewards();
            await this.backupPendingRewards();
            
            // 5. 保存备份数据
            const result = await this.saveBackupData();
            
            console.log("\n🎉 备份完成！");
            console.log("📊 备份统计:");
            console.log(`   - 用户数量: ${this.backupData.statistics.totalUsers}`);
            console.log(`   - 门票数量: ${this.backupData.statistics.totalTickets}`);
            console.log(`   - 质押数量: ${this.backupData.statistics.totalStakes}`);
            console.log(`   - 动态奖励: ${this.backupData.statistics.totalDynamicRewards}`);
            console.log(`   - 待提取奖励用户: ${this.backupData.statistics.totalPendingRewards}`);
            
            return result;
            
        } catch (error) {
            console.error("❌ 备份过程中发生错误:", error);
            throw error;
        }
    }
}

// 主函数
async function main() {
    const backup = new ContractStateBackup();
    
    try {
        const result = await backup.executeFullBackup();
        console.log("\n✅ 备份脚本执行成功");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ 备份脚本执行失败:", error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ContractStateBackup, CONFIG };