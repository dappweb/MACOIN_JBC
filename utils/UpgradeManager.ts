import { ethers } from "hardhat";
import { upgrades } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * 升级管理器
 * 提供合约升级的通用功能和工具
 */

export interface UpgradeConfig {
    proxyAddress: string;
    network: string;
    backupDir: string;
    reportsDir: string;
    timeout: number;
    maxRetry: number;
}

export interface BackupData {
    timestamp: string;
    network: any;
    proxyAddress: string;
    implementationAddress: string;
    contractData: any;
    blockNumber: number;
    blockHash: string;
}

export interface UpgradeResult {
    success: boolean;
    newImplementationAddress?: string;
    transactionHash?: string;
    gasUsed?: bigint;
    error?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class UpgradeManager {
    private config: UpgradeConfig;
    
    constructor(config: UpgradeConfig) {
        this.config = config;
        this.ensureDirectories();
    }
    
    /**
     * 确保必要的目录存在
     */
    private ensureDirectories(): void {
        if (!fs.existsSync(this.config.backupDir)) {
            fs.mkdirSync(this.config.backupDir, { recursive: true });
        }
        
        if (!fs.existsSync(this.config.reportsDir)) {
            fs.mkdirSync(this.config.reportsDir, { recursive: true });
        }
    }
    
    /**
     * 创建合约状态备份
     */
    async createBackup(contractName: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${contractName}-backup-${timestamp}.json`;
        const backupFilePath = path.join(this.config.backupDir, backupFileName);
        
        try {
            // 连接到当前合约
            const currentContract = await ethers.getContractAt(contractName, this.config.proxyAddress);
            
            // 收集基础数据
            const backupData: BackupData = {
                timestamp: new Date().toISOString(),
                network: await ethers.provider.getNetwork(),
                proxyAddress: this.config.proxyAddress,
                implementationAddress: await upgrades.erc1967.getImplementationAddress(this.config.proxyAddress),
                contractData: await this.collectContractData(currentContract),
                blockNumber: await ethers.provider.getBlockNumber(),
                blockHash: (await ethers.provider.getBlock("latest"))!.hash
            };
            
            // 保存备份
            fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
            
            return backupFilePath;
            
        } catch (error) {
            throw new Error(`创建备份失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * 收集合约数据
     */
    private async collectContractData(contract: any): Promise<any> {
        const data: any = {};
        
        try {
            // 尝试收集常见的合约状态
            if (contract.owner) {
                data.owner = await contract.owner().catch(() => "Unknown");
            }
            
            if (contract.paused) {
                data.paused = await contract.paused().catch(() => false);
            }
            
            if (contract.VERSION_V3) {
                data.version = await contract.VERSION_V3().catch(() => "Unknown");
            }
            
            if (contract.getVersionV4) {
                data.versionV4 = await contract.getVersionV4().catch(() => null);
            }
            
            if (contract.timeUnitFixed) {
                data.timeUnitFixed = await contract.timeUnitFixed().catch(() => false);
            }
            
            if (contract.getEffectiveSecondsInUnit) {
                data.effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit().catch(() => null);
            }
            
        } catch (error) {
            console.warn("收集合约数据时出现警告:", error);
        }
        
        return data;
    }
    
    /**
     * 验证升级兼容性
     */
    async validateUpgrade(newContractFactory: any): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // 验证代理合约是否存在
            const proxyCode = await ethers.provider.getCode(this.config.proxyAddress);
            if (proxyCode === "0x") {
                result.errors.push(`代理合约不存在: ${this.config.proxyAddress}`);
                result.isValid = false;
            }
            
            // 验证升级兼容性
            try {
                await upgrades.validateUpgrade(this.config.proxyAddress, newContractFactory);
            } catch (error) {
                result.errors.push(`升级兼容性验证失败: ${error instanceof Error ? error.message : String(error)}`);
                result.isValid = false;
            }
            
            // 检查网络
            const network = await ethers.provider.getNetwork();
            if (this.config.network === "mc" && network.chainId !== 88813n) {
                result.errors.push("网络不匹配，期望MC Chain (88813)");
                result.isValid = false;
            }
            
            // 检查账户余额
            const [deployer] = await ethers.getSigners();
            const balance = await ethers.provider.getBalance(deployer.address);
            if (balance < ethers.parseEther("0.1")) {
                result.warnings.push("账户余额较低，可能不足以支付gas费用");
            }
            
        } catch (error) {
            result.errors.push(`验证过程出错: ${error instanceof Error ? error.message : String(error)}`);
            result.isValid = false;
        }
        
        return result;
    }
    
    /**
     * 执行升级
     */
    async executeUpgrade(newContractFactory: any, initializerData?: string): Promise<UpgradeResult> {
        try {
            console.log("开始执行升级...");
            
            // 执行升级
            const upgradedContract = await upgrades.upgradeProxy(
                this.config.proxyAddress,
                newContractFactory,
                {
                    timeout: this.config.timeout,
                    pollingInterval: 5000
                }
            );
            
            await upgradedContract.waitForDeployment();
            
            // 获取新实现地址
            const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(this.config.proxyAddress);
            
            // 如果有初始化数据，执行初始化
            let initTxHash: string | undefined;
            if (initializerData) {
                const initTx = await upgradedContract.initializeV4();
                const receipt = await initTx.wait();
                initTxHash = receipt!.hash;
            }
            
            return {
                success: true,
                newImplementationAddress,
                transactionHash: initTxHash
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * 验证升级结果
     */
    async validateUpgradeResult(expectedVersion?: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // 连接到升级后的合约
            const upgradedContract = await ethers.getContractAt("JinbaoProtocolV3TimeUnitFix", this.config.proxyAddress);
            
            // 验证版本
            if (expectedVersion) {
                try {
                    const version = await upgradedContract.getVersionV4();
                    if (version !== expectedVersion) {
                        result.errors.push(`版本验证失败，期望: ${expectedVersion}，实际: ${version}`);
                        result.isValid = false;
                    }
                } catch (error) {
                    result.errors.push("无法获取合约版本");
                    result.isValid = false;
                }
            }
            
            // 验证时间单位修复
            try {
                const timeUnitFixed = await upgradedContract.timeUnitFixed();
                const effectiveSecondsInUnit = await upgradedContract.getEffectiveSecondsInUnit();
                
                if (!timeUnitFixed) {
                    result.errors.push("时间单位未修复");
                    result.isValid = false;
                }
                
                if (effectiveSecondsInUnit !== 86400n) {
                    result.errors.push(`时间单位不正确，期望: 86400，实际: ${effectiveSecondsInUnit}`);
                    result.isValid = false;
                }
            } catch (error) {
                result.errors.push("无法验证时间单位修复状态");
                result.isValid = false;
            }
            
            // 验证基础功能
            try {
                const owner = await upgradedContract.owner();
                if (!owner || owner === ethers.ZeroAddress) {
                    result.warnings.push("合约所有者地址异常");
                }
            } catch (error) {
                result.warnings.push("无法获取合约所有者");
            }
            
        } catch (error) {
            result.errors.push(`验证过程出错: ${error instanceof Error ? error.message : String(error)}`);
            result.isValid = false;
        }
        
        return result;
    }
    
    /**
     * 生成升级报告
     */
    generateUpgradeReport(
        startTime: Date,
        endTime: Date,
        success: boolean,
        steps: string[],
        errors: string[],
        oldImplementation?: string,
        newImplementation?: string,
        backupFile?: string
    ): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFileName = `upgrade-report-${timestamp}.md`;
        const reportFilePath = path.join(this.config.reportsDir, reportFileName);
        
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;
        
        const report = `# 合约升级报告

## 升级概要
- **升级时间**: ${startTime.toISOString()}
- **完成时间**: ${endTime.toISOString()}
- **总耗时**: ${duration}秒
- **升级状态**: ${success ? '✅ 成功' : '❌ 失败'}
- **网络**: ${this.config.network}
- **代理合约**: ${this.config.proxyAddress}

## 升级详情
- **旧实现合约**: ${oldImplementation || 'Unknown'}
- **新实现合约**: ${newImplementation || 'Unknown'}
- **备份文件**: ${backupFile || 'None'}

## 执行步骤
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

${errors.length > 0 ? `## 错误记录\n${errors.map(error => `- ❌ ${error}`).join('\n')}` : '## 错误记录\n无错误'}

---
*报告生成时间: ${new Date().toISOString()}*
`;

        fs.writeFileSync(reportFilePath, report);
        return reportFilePath;
    }
    
    /**
     * 重试机制
     */
    async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries: number = this.config.maxRetry
    ): Promise<T> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                console.log(`⚠️  操作失败，重试 ${i + 1}/${maxRetries}: ${error instanceof Error ? error.message : String(error)}`);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // 递增延迟
            }
        }
        throw new Error("重试次数已用完");
    }
    
    /**
     * 获取最新备份文件
     */
    getLatestBackupFile(contractName: string): string | null {
        if (!fs.existsSync(this.config.backupDir)) {
            return null;
        }
        
        const backupFiles = fs.readdirSync(this.config.backupDir)
            .filter(file => file.startsWith(`${contractName}-backup-`) && file.endsWith('.json'))
            .sort()
            .reverse(); // 最新的在前
        
        return backupFiles.length > 0 ? path.join(this.config.backupDir, backupFiles[0]) : null;
    }
    
    /**
     * 读取备份数据
     */
    readBackupData(backupFilePath: string): BackupData {
        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`备份文件不存在: ${backupFilePath}`);
        }
        
        return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
}

export default UpgradeManager;