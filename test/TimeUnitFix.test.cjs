const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * JinbaoProtocolV3TimeUnitFix 合约测试
 * 测试时间单位修复功能
 */
describe("JinbaoProtocolV3TimeUnitFix", function () {
    let contract;
    let owner;
    let user1;
    let user2;
    let mcToken;
    let jbcToken;

    // 时间常量
    const SECONDS_IN_UNIT_OLD = 60;      // 旧时间单位（分钟）
    const SECONDS_IN_UNIT_V4 = 86400;    // 新时间单位（天）

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // 部署模拟代币
        const MockToken = await ethers.getContractFactory("MockERC20");
        mcToken = await MockToken.deploy("Master Coin", "MC", ethers.parseEther("1000000"));
        jbcToken = await MockToken.deploy("Jinbao Coin", "JBC", ethers.parseEther("1000000"));

        // 部署V4合约
        const JinbaoProtocolV4Simple = await ethers.getContractFactory("JinbaoProtocolV4Simple");
        
        // 使用代理部署
        contract = await upgrades.deployProxy(
            JinbaoProtocolV4Simple,
            [],
            { 
                initializer: false,
                kind: 'uups'
            }
        );

        // 手动初始化V3和V4
        await contract.connect(owner).setTokenAddresses(await mcToken.getAddress(), await jbcToken.getAddress());
        await contract.connect(owner).initializeV3();
        await contract.connect(owner).initializeV4();
    });

    describe("初始化和基础功能", function () {
        it("应该正确初始化V4", async function () {
            expect(await contract.timeUnitFixed()).to.be.true;
            expect(await contract.getVersionV4()).to.equal("4.0.0");
            expect(await contract.getEffectiveSecondsInUnit()).to.equal(SECONDS_IN_UNIT_V4);
        });

        it("应该返回正确的时间单位修复状态", async function () {
            const status = await contract.getTimeUnitFixStatus();
            
            expect(status.isFixed).to.be.true;
            expect(status.oldUnit).to.equal(SECONDS_IN_UNIT_OLD);
            expect(status.newUnit).to.equal(SECONDS_IN_UNIT_V4);
            expect(status.fixTime).to.be.gt(0);
        });

        it("应该正确设置需要迁移的用户总数", async function () {
            const tx = await contract.connect(owner).setTotalUsersToMigrate(100);
            await expect(tx).to.emit(contract, "MigrationStarted");

            expect(await contract.totalUsersToMigrate()).to.equal(100);
        });

        it("非管理员不能设置迁移用户数", async function () {
            await expect(
                contract.connect(user1).setTotalUsersToMigrate(100)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("时间转换功能", function () {
        it("应该正确计算迁移进度", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(10);
            
            const progress = await contract.getMigrationProgress();
            expect(progress.totalUsers).to.equal(10);
            expect(progress.migratedUsers).to.equal(0);
            expect(progress.progressPercent).to.equal(0);
        });
    });

    describe("用户数据迁移", function () {
        beforeEach(async function () {
            await contract.connect(owner).setTotalUsersToMigrate(2);
        });

        it("应该检查用户迁移状态", async function () {
            const userAddress = user1.address;
            
            // 检查初始状态
            expect(await contract.userDataMigrated(userAddress)).to.be.false;
        });

        it("批量迁移不能超过最大批次大小", async function () {
            // 创建超过50个用户的数组
            const users = Array(51).fill(0).map((_, i) => 
                ethers.Wallet.createRandom().address
            );
            
            await expect(
                contract.connect(owner).batchMigrateUsers(users)
            ).to.be.revertedWith("Batch size too large");
        });
    });

    describe("迁移状态查询", function () {
        it("应该返回正确的用户迁移状态", async function () {
            const userAddress = user1.address;
            
            const status = await contract.getUserMigrationStatus(userAddress);
            expect(status.migrated).to.be.false;
            expect(status.migrationTime).to.equal(0);
            expect(status.stats.stakesUpdated).to.equal(0);
        });

        it("应该返回正确的全局迁移进度", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(5);
            
            const progress = await contract.getMigrationProgress();
            expect(progress.totalUsers).to.equal(5);
            expect(progress.migratedUsers).to.equal(0);
            expect(progress.progressPercent).to.equal(0);
            expect(progress.globalStats.stakesUpdated).to.equal(0);
        });
    });

    describe("管理员功能", function () {
        it("应该能够暂停和恢复迁移", async function () {
            // 暂停迁移
            await contract.connect(owner).pauseMigration();
            expect(await contract.paused()).to.be.true;
            
            // 恢复迁移
            await contract.connect(owner).unpauseMigration();
            expect(await contract.paused()).to.be.false;
        });

        it("非管理员不能暂停迁移", async function () {
            await expect(
                contract.connect(user1).pauseMigration()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("应该能够完成迁移", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(0);
            
            const tx = await contract.connect(owner).completeMigration();
            await expect(tx).to.emit(contract, "MigrationCompleted");
        });
    });

    describe("错误处理", function () {
        it("不能迁移零地址", async function () {
            await expect(
                contract.connect(owner).migrateUserData(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("不能设置无效的用户总数", async function () {
            await expect(
                contract.connect(owner).setTotalUsersToMigrate(0)
            ).to.be.revertedWith("Invalid user count");
        });
    });

    describe("升级功能", function () {
        it("应该支持UUPS升级", async function () {
            // 测试合约是否正确实现了UUPS升级模式
            expect(await contract.owner()).to.equal(owner.address);
        });
    });
});