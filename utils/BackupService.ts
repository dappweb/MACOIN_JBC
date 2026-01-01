import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

/**
 * 备份服务工具类
 * 提供备份和恢复相关的通用功能
 */

export interface BackupMetadata {
    timestamp: number;
    blockNumber: number;
    contractAddress: string;
    version: string;
    purpose: string;
}

export interface BackupStatistics {
    totalUsers: number;
    totalTickets: number;
    totalStakes: number;
    totalDynamicRewards: number;
    totalPendingRewards: number;
}

export interface BackupData {
    metadata: BackupMetadata;
    contractConfig: any;
    userAccounts: string[];
    userInfo: Record<string, any>;
    tickets: Record<string, any[]>;
    stakes: Record<string, any[]>;
    dynamicRewards: Record<string, any>;
    referrals: Record<string, string[]>;
    pendingRewards: Record<string, string>;
    tokenBalances: Record<string, string>;
    statistics: BackupStatistics;
}

export interface RestoreOptions {
    dryRun?: boolean;
    batchSize?: number;
    skipValidation?: boolean;
    targetUsers?: string[];
}

export class BackupService {
    private provider: ethers.JsonRpcProvider;
    private contract: ethers.Contract;
    
    constructor(rpcUrl: string, contractAddress: string, contractABI: any[]) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.contract = new ethers.Contract(contractAddress, contractABI, this.provider);
    }

    /**
     * 加载备份数据
     */
    static loadBackupData(filePath: string): BackupData {
        if (!fs.existsSync(filePath)) {
            throw new Error(`备份文件不存在: ${filePath}`);
        }

        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data) as BackupData;
        } catch (error) {
            throw new Error(`加载备份数据失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 保存备份数据
     */
    static saveBackupData(data: BackupData, backupDir: string = './backups'): string {
        // 确保备份目录存在
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // 生成备份文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.json`;
        const filepath = path.join(backupDir, filename);

        // 保存备份数据
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        return filepath;
    }

    /**
     * 验证备份数据完整性
     */
    static validateBackupData(data: BackupData): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 验证必需字段
        if (!data.metadata) {
            errors.push('缺少元数据');
        }

        if (!data.contractConfig) {
            errors.push('缺少合约配置');
        }

        if (!Array.isArray(data.userAccounts)) {
            errors.push('用户账户列表无效');
        }

        if (!data.userInfo || typeof data.userInfo !== 'object') {
            errors.push('用户信息数据无效');
        }

        if (!data.statistics) {
            errors.push('缺少统计信息');
        }

        // 验证数据一致性
        if (data.userAccounts && data.userInfo) {
            const accountsCount = data.userAccounts.length;
            const userInfoCount = Object.keys(data.userInfo).length;
            
            if (accountsCount !== userInfoCount) {
                errors.push(`用户账户数量(${accountsCount})与用户信息数量(${userInfoCount})不匹配`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 比较两个备份数据的差异
     */
    static compareBackups(backup1: BackupData, backup2: BackupData): {
        identical: boolean;
        differences: string[];
        statistics: {
            backup1: BackupStatistics;
            backup2: BackupStatistics;
        };
    } {
        const differences: string[] = [];

        // 比较用户数量
        if (backup1.statistics.totalUsers !== backup2.statistics.totalUsers) {
            differences.push(`用户数量不同: ${backup1.statistics.totalUsers} vs ${backup2.statistics.totalUsers}`);
        }

        // 比较门票数量
        if (backup1.statistics.totalTickets !== backup2.statistics.totalTickets) {
            differences.push(`门票数量不同: ${backup1.statistics.totalTickets} vs ${backup2.statistics.totalTickets}`);
        }

        // 比较质押数量
        if (backup1.statistics.totalStakes !== backup2.statistics.totalStakes) {
            differences.push(`质押数量不同: ${backup1.statistics.totalStakes} vs ${backup2.statistics.totalStakes}`);
        }

        // 比较动态奖励数量
        if (backup1.statistics.totalDynamicRewards !== backup2.statistics.totalDynamicRewards) {
            differences.push(`动态奖励数量不同: ${backup1.statistics.totalDynamicRewards} vs ${backup2.statistics.totalDynamicRewards}`);
        }

        // 比较用户账户
        const users1 = new Set(backup1.userAccounts);
        const users2 = new Set(backup2.userAccounts);
        
        const onlyInBackup1 = [...users1].filter(user => !users2.has(user));
        const onlyInBackup2 = [...users2].filter(user => !users1.has(user));
        
        if (onlyInBackup1.length > 0) {
            differences.push(`仅在备份1中的用户: ${onlyInBackup1.join(', ')}`);
        }
        
        if (onlyInBackup2.length > 0) {
            differences.push(`仅在备份2中的用户: ${onlyInBackup2.join(', ')}`);
        }

        return {
            identical: differences.length === 0,
            differences,
            statistics: {
                backup1: backup1.statistics,
                backup2: backup2.statistics
            }
        };
    }

    /**
     * 获取备份文件列表
     */
    static getBackupFiles(backupDir: string = './backups'): Array<{
        filename: string;
        filepath: string;
        size: number;
        created: Date;
        metadata?: BackupMetadata;
    }> {
        if (!fs.existsSync(backupDir)) {
            return [];
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.json') && file.includes('backup'))
            .map(filename => {
                const filepath = path.join(backupDir, filename);
                const stats = fs.statSync(filepath);
                
                let metadata: BackupMetadata | undefined;
                try {
                    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    metadata = data.metadata;
                } catch (error) {
                    // 忽略解析错误
                }

                return {
                    filename,
                    filepath,
                    size: stats.size,
                    created: stats.birthtime,
                    metadata
                };
            })
            .sort((a, b) => b.created.getTime() - a.created.getTime()); // 按创建时间倒序

        return files;
    }

    /**
     * 清理旧备份文件
     */
    static cleanupOldBackups(backupDir: string = './backups', keepCount: number = 10): number {
        const files = this.getBackupFiles(backupDir);
        
        if (files.length <= keepCount) {
            return 0;
        }

        const filesToDelete = files.slice(keepCount);
        let deletedCount = 0;

        for (const file of filesToDelete) {
            try {
                fs.unlinkSync(file.filepath);
                deletedCount++;
            } catch (error) {
                console.warn(`删除备份文件失败: ${file.filename}`, error);
            }
        }

        return deletedCount;
    }

    /**
     * 创建备份摘要
     */
    static createBackupSummary(data: BackupData): {
        summary: string;
        details: Record<string, any>;
    } {
        const summary = `
备份摘要
========
时间: ${new Date(data.metadata.timestamp).toLocaleString()}
区块: ${data.metadata.blockNumber}
合约: ${data.metadata.contractAddress}
版本: ${data.metadata.version}
目的: ${data.metadata.purpose}

统计信息
--------
用户数量: ${data.statistics.totalUsers}
门票数量: ${data.statistics.totalTickets}
质押数量: ${data.statistics.totalStakes}
动态奖励: ${data.statistics.totalDynamicRewards}
待提取奖励用户: ${data.statistics.totalPendingRewards}

合约配置
--------
Owner: ${data.contractConfig.owner}
Paused: ${data.contractConfig.paused}
MC Token: ${data.contractConfig.mcToken}
JBC Token: ${data.contractConfig.jbcToken}
        `.trim();

        const details = {
            metadata: data.metadata,
            statistics: data.statistics,
            contractConfig: data.contractConfig,
            userAccountsPreview: data.userAccounts.slice(0, 5),
            totalDataSize: JSON.stringify(data).length
        };

        return { summary, details };
    }

    /**
     * 验证合约状态与备份数据的一致性
     */
    async validateAgainstContract(data: BackupData): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // 验证合约配置
            const currentOwner = await this.contract.owner();
            if (currentOwner !== data.contractConfig.owner) {
                errors.push(`Owner不匹配: 备份=${data.contractConfig.owner}, 当前=${currentOwner}`);
            }

            // 抽样验证用户数据
            const sampleUsers = data.userAccounts.slice(0, Math.min(5, data.userAccounts.length));
            
            for (const user of sampleUsers) {
                try {
                    const currentUserInfo = await this.contract.userInfo(user);
                    const backupUserInfo = data.userInfo[user];
                    
                    if (currentUserInfo[0].toString() !== backupUserInfo.totalTickets) {
                        warnings.push(`用户 ${user} 门票数量可能已变化`);
                    }
                } catch (error) {
                    warnings.push(`无法验证用户 ${user}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

        } catch (error) {
            errors.push(`合约验证失败: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 估算恢复时间
     */
    static estimateRestoreTime(data: BackupData, options: RestoreOptions = {}): {
        estimatedMinutes: number;
        breakdown: Record<string, number>;
    } {
        const batchSize = options.batchSize || 50;
        const userCount = options.targetUsers?.length || data.statistics.totalUsers;
        
        // 估算各阶段时间（分钟）
        const breakdown = {
            preparation: 5,
            userInfo: Math.ceil(userCount / batchSize) * 2,
            tickets: Math.ceil(data.statistics.totalTickets / batchSize) * 1,
            stakes: Math.ceil(data.statistics.totalStakes / batchSize) * 1,
            dynamicRewards: Math.ceil(data.statistics.totalDynamicRewards / batchSize) * 1,
            validation: options.skipValidation ? 0 : 10,
            finalization: 5
        };

        const estimatedMinutes = Object.values(breakdown).reduce((sum, time) => sum + time, 0);

        return { estimatedMinutes, breakdown };
    }
}

export default BackupService;