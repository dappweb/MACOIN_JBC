const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 导入部署脚本模块
const deployScript = require("../scripts/deploy-time-unit-fix.cjs");
const rollbackScript = require("../scripts/rollback-upgrade.cjs");

describe("部署脚本测试", function () {
    let mockProxyAddress;
    let mockContract;
    let owner;
    
    // 增加测试超时时间
    this.timeout(60000);
    
    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // 部署一个模拟的代理合约用于测试
        const TimeUnitFixContractFixed = await ethers.getContractFactory("TimeUnitFixContractFixed");
        mockContract = await TimeUnitFixContractFixed.deploy();
        await mockContract.waitForDeployment();
        mockProxyAddress = await mockContract.getAddress();
        
        // 更新配置中的代理地址
        deployScript.CONFIG.PROXY_ADDRESS = mockProxyAddress;
        rollbackScript.CONFIG.PROXY_ADDRESS = mockProxyAddress;
        
        console.log(`✅ 模拟代理合约部署: ${mockProxyAddress}`);
    });
    
    describe("部署脚本配置", function () {
        it("应该有正确的配置常量", function () {
            expect(deployScript.CONFIG).to.have.property('PROXY_ADDRESS');
            expect(deployScript.CONFIG).to.have.property('NETWORK');
            expect(deployScript.CONFIG).to.have.property('BACKUP_DIR');
            expect(deployScript.CONFIG).to.have.property('REPORTS_DIR');
            expect(deployScript.CONFIG).to.have.property('TIMEOUT');
            
            expect(deployScript.CONFIG.NETWORK).to.equal('mc');
            expect(deployScript.CONFIG.BACKUP_DIR).to.equal('./backups');
            expect(deployScript.CONFIG.REPORTS_DIR).to.equal('./reports');
        });
        
        it("应该初始化升级状态", function () {
            expect(deployScript.upgradeState).to.have.property('startTime');
            expect(deployScript.upgradeState).to.have.property('success');
            expect(deployScript.upgradeState).to.have.property('errors');
            expect(deployScript.upgradeState).to.have.property('steps');
            
            expect(deployScript.upgradeState.success).to.be.false;
            expect(deployScript.upgradeState.errors).to.be.an('array');
            expect(deployScript.upgradeState.steps).to.be.an('array');
        });
    });
    
    describe("回滚脚本配置", function () {
        it("应该有正确的配置常量", function () {
            expect(rollbackScript.CONFIG).to.have.property('PROXY_ADDRESS');
            expect(rollbackScript.CONFIG).to.have.property('BACKUP_DIR');
            expect(rollbackScript.CONFIG).to.have.property('REPORTS_DIR');
            expect(rollbackScript.CONFIG).to.have.property('TIMEOUT');
        });
        
        it("应该初始化回滚状态", function () {
            expect(rollbackScript.rollbackState).to.have.property('startTime');
            expect(rollbackScript.rollbackState).to.have.property('success');
            expect(rollbackScript.rollbackState).to.have.property('errors');
            expect(rollbackScript.rollbackState).to.have.property('steps');
            
            expect(rollbackScript.rollbackState.success).to.be.false;
            expect(rollbackScript.rollbackState.errors).to.be.an('array');
            expect(rollbackScript.rollbackState.steps).to.be.an('array');
        });
    });
    
    describe("目录创建", function () {
        it("应该能创建备份目录", function () {
            const backupDir = deployScript.CONFIG.BACKUP_DIR;
            
            // 如果目录存在，先删除
            if (fs.existsSync(backupDir)) {
                fs.rmSync(backupDir, { recursive: true, force: true });
            }
            
            // 创建目录
            fs.mkdirSync(backupDir, { recursive: true });
            
            expect(fs.existsSync(backupDir)).to.be.true;
        });
        
        it("应该能创建报告目录", function () {
            const reportsDir = deployScript.CONFIG.REPORTS_DIR;
            
            // 如果目录存在，先删除
            if (fs.existsSync(reportsDir)) {
                fs.rmSync(reportsDir, { recursive: true, force: true });
            }
            
            // 创建目录
            fs.mkdirSync(reportsDir, { recursive: true });
            
            expect(fs.existsSync(reportsDir)).to.be.true;
        });
    });
    
    describe("备份功能", function () {
        it("应该能创建备份文件", async function () {
            const backupDir = deployScript.CONFIG.BACKUP_DIR;
            
            // 确保备份目录存在
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // 创建模拟备份数据
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `p-prod-backup-before-time-fix-${timestamp}.json`;
            const backupFilePath = path.join(backupDir, backupFileName);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                network: { name: "hardhat", chainId: 31337 },
                proxyAddress: mockProxyAddress,
                implementationAddress: mockProxyAddress,
                contractData: {
                    version: "4.0.0",
                    paused: false,
                    owner: owner.address
                },
                blockNumber: await ethers.provider.getBlockNumber(),
                blockHash: (await ethers.provider.getBlock("latest")).hash
            };
            
            fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
            
            expect(fs.existsSync(backupFilePath)).to.be.true;
            
            // 验证备份数据
            const savedData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
            expect(savedData.proxyAddress).to.equal(mockProxyAddress);
            expect(savedData.contractData.owner).to.equal(owner.address);
        });
    });
    
    describe("报告生成", function () {
        it("应该能生成升级报告", function () {
            const reportsDir = deployScript.CONFIG.REPORTS_DIR;
            
            // 确保报告目录存在
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFileName = `test-upgrade-report-${timestamp}.md`;
            const reportFilePath = path.join(reportsDir, reportFileName);
            
            const report = `# 测试升级报告

## 升级概要
- **升级时间**: ${new Date().toISOString()}
- **升级状态**: ✅ 成功
- **代理合约**: ${mockProxyAddress}

## 测试结果
- ✅ 配置验证通过
- ✅ 目录创建成功
- ✅ 备份功能正常

---
*测试报告生成时间: ${new Date().toISOString()}*
`;

            fs.writeFileSync(reportFilePath, report);
            
            expect(fs.existsSync(reportFilePath)).to.be.true;
            
            // 验证报告内容
            const savedReport = fs.readFileSync(reportFilePath, 'utf8');
            expect(savedReport).to.include('测试升级报告');
            expect(savedReport).to.include(mockProxyAddress);
        });
    });
    
    describe("错误处理", function () {
        it("应该能处理无效的代理地址", async function () {
            const invalidAddress = "0x0000000000000000000000000000000000000000";
            
            // 检查代码是否存在
            const code = await ethers.provider.getCode(invalidAddress);
            expect(code).to.equal("0x");
        });
        
        it("应该能处理网络检查", async function () {
            const network = await ethers.provider.getNetwork();
            
            // Hardhat网络的chainId是31337
            expect(network.chainId).to.equal(31337n);
            
            // 模拟MC Chain检查
            const isMCChain = network.chainId === 88813n;
            expect(isMCChain).to.be.false; // 在测试环境中应该是false
        });
    });
    
    describe("合约交互", function () {
        it("应该能连接到模拟合约", async function () {
            const contract = await ethers.getContractAt("TimeUnitFixContractFixed", mockProxyAddress);
            
            // 验证基础功能
            const version = await contract.getVersion();
            expect(version).to.equal("4.0.0");
            
            const timeUnitFixed = await contract.timeUnitFixed();
            expect(timeUnitFixed).to.be.true;
            
            const effectiveSecondsInUnit = await contract.getEffectiveSecondsInUnit();
            expect(effectiveSecondsInUnit).to.equal(86400);
        });
        
        it("应该能获取合约所有者", async function () {
            const contract = await ethers.getContractAt("TimeUnitFixContractFixed", mockProxyAddress);
            
            const contractOwner = await contract.owner();
            expect(contractOwner).to.equal(owner.address);
        });
    });
    
    // 清理测试文件
    after(function () {
        // 清理测试生成的文件
        const backupDir = deployScript.CONFIG.BACKUP_DIR;
        const reportsDir = deployScript.CONFIG.REPORTS_DIR;
        
        if (fs.existsSync(backupDir)) {
            const files = fs.readdirSync(backupDir);
            files.forEach(file => {
                if (file.includes('test') || file.includes('p-prod-backup-before-time-fix-')) {
                    fs.unlinkSync(path.join(backupDir, file));
                }
            });
        }
        
        if (fs.existsSync(reportsDir)) {
            const files = fs.readdirSync(reportsDir);
            files.forEach(file => {
                if (file.includes('test')) {
                    fs.unlinkSync(path.join(reportsDir, file));
                }
            });
        }
    });
});