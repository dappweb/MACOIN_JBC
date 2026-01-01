const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("JinbaoProtocolV3TimeUnitFix - 简化测试", function () {
    let contract;
    let owner;
    let user1;
    let mcToken;
    let jbcToken;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        try {
            // 部署模拟代币
            const MockToken = await ethers.getContractFactory("MockERC20");
            mcToken = await MockToken.deploy("Master Coin", "MC", ethers.parseEther("1000000"));
            jbcToken = await MockToken.deploy("Jinbao Coin", "JBC", ethers.parseEther("1000000"));

            // 部署V3TimeUnitFix合约
            const JinbaoProtocolV3TimeUnitFix = await ethers.getContractFactory("JinbaoProtocolV3TimeUnitFix");
            
            contract = await upgrades.deployProxy(
                JinbaoProtocolV3TimeUnitFix,
                [],
                { 
                    initializer: false,
                    kind: 'uups',
                    unsafeAllow: ['missing-public-upgradeto']
                }
            );

            // 设置代币地址
            await contract.connect(owner).setTokenAddresses(await mcToken.getAddress(), await jbcToken.getAddress());
            
            // 初始化V3
            await contract.connect(owner).initializeV3();
            
            // 初始化V4
            await contract.connect(owner).initializeV4();
            
            console.log("✅ 合约部署和初始化成功");
        } catch (error) {
            console.error("❌ 合约部署失败:", error.message);
            throw error;
        }
    });

    describe("基础功能测试", function () {
        it("应该正确初始化V4", async function () {
            expect(await contract.timeUnitFixed()).to.be.true;
            expect(await contract.getVersionV4()).to.equal("4.0.0");
            expect(await contract.getEffectiveSecondsInUnit()).to.equal(86400);
        });

        it("应该返回正确的时间单位状态", async function () {
            const status = await contract.getTimeUnitFixStatus();
            
            expect(status.isFixed).to.be.true;
            expect(status.oldUnit).to.equal(60);
            expect(status.newUnit).to.equal(86400);
            expect(status.fixTime).to.be.gt(0);
        });

        it("应该能设置迁移用户总数", async function () {
            const tx = await contract.connect(owner).setTotalUsersToMigrate(10);
            await expect(tx).to.emit(contract, "MigrationStarted");
            
            expect(await contract.totalUsersToMigrate()).to.equal(10);
        });

        it("应该能迁移用户数据", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(1);
            
            const tx = await contract.connect(owner).migrateUserData(user1.address);
            await expect(tx).to.emit(contract, "UserDataMigrated");
            
            expect(await contract.userDataMigrated(user1.address)).to.be.true;
            expect(await contract.totalUsersMigrated()).to.equal(1);
        });

        it("应该能完成迁移", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(1);
            await contract.connect(owner).migrateUserData(user1.address);
            
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

        it("不能重复迁移同一用户", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(1);
            await contract.connect(owner).migrateUserData(user1.address);
            
            await expect(
                contract.connect(owner).migrateUserData(user1.address)
            ).to.be.revertedWith("User already migrated");
        });
    });
});