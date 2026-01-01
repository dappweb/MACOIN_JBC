const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("TimeUnitFixContract - 简化测试", function () {
    let contract;
    let owner;
    let user1;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        try {
            // 尝试部署独立的时间单位修复合约
            const TimeUnitFixContract = await ethers.getContractFactory("TimeUnitFixContract");
            
            contract = await upgrades.deployProxy(
                TimeUnitFixContract,
                [],
                { 
                    initializer: "initialize",
                    kind: 'uups'
                }
            );
            
            console.log("✅ 合约部署成功");
        } catch (error) {
            console.error("❌ 合约部署失败:", error.message);
            throw error;
        }
    });

    describe("基础功能测试", function () {
        it("应该正确初始化", async function () {
            expect(await contract.timeUnitFixed()).to.be.true;
            expect(await contract.getVersion()).to.equal("4.0.0");
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