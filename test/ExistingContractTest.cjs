const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("现有合约功能测试", function () {
    let timeUnitContract;
    let v3Contract;
    let owner;
    let user1;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        try {
            // 测试TimeUnitFixContract（独立合约）
            const TimeUnitFixContract = await ethers.getContractFactory("TimeUnitFixContract");
            timeUnitContract = await TimeUnitFixContract.deploy();
            await timeUnitContract.waitForDeployment();
            
            // 直接调用初始化，不使用代理
            await timeUnitContract.initialize();
            
            console.log("✅ TimeUnitFixContract 部署成功");
        } catch (error) {
            console.error("❌ 合约部署失败:", error.message);
            // 尝试不初始化的方式
            const TimeUnitFixContract = await ethers.getContractFactory("TimeUnitFixContract");
            timeUnitContract = await TimeUnitFixContract.deploy();
            await timeUnitContract.waitForDeployment();
            console.log("✅ TimeUnitFixContract 部署成功（未初始化）");
        }
    });

    describe("TimeUnitFixContract 测试", function () {
        it("应该正确设置时间单位", async function () {
            expect(await timeUnitContract.getEffectiveSecondsInUnit()).to.equal(86400);
            expect(await timeUnitContract.timeUnitFixed()).to.be.true;
        });

        it("应该返回正确版本", async function () {
            expect(await timeUnitContract.getVersion()).to.equal("4.0.0");
        });

        it("应该能设置和查询迁移状态", async function () {
            await timeUnitContract.setTotalUsersToMigrate(5);
            expect(await timeUnitContract.totalUsersToMigrate()).to.equal(5);
            
            const progress = await timeUnitContract.getMigrationProgress();
            expect(progress.totalUsers).to.equal(5);
            expect(progress.migratedUsers).to.equal(0);
            expect(progress.progressPercent).to.equal(0);
        });

        it("应该能迁移用户", async function () {
            await timeUnitContract.setTotalUsersToMigrate(1);
            
            const tx = await timeUnitContract.migrateUserData(user1.address);
            await expect(tx).to.emit(timeUnitContract, "UserDataMigrated");
            
            expect(await timeUnitContract.userDataMigrated(user1.address)).to.be.true;
            expect(await timeUnitContract.totalUsersMigrated()).to.equal(1);
        });

        it("应该能批量迁移用户", async function () {
            const users = [user1.address, owner.address];
            await timeUnitContract.setTotalUsersToMigrate(2);
            
            await timeUnitContract.batchMigrateUsers(users);
            
            expect(await timeUnitContract.userDataMigrated(user1.address)).to.be.true;
            expect(await timeUnitContract.userDataMigrated(owner.address)).to.be.true;
            expect(await timeUnitContract.totalUsersMigrated()).to.equal(2);
        });

        it("应该能完成迁移", async function () {
            await timeUnitContract.setTotalUsersToMigrate(1);
            await timeUnitContract.migrateUserData(user1.address);
            
            const tx = await timeUnitContract.completeMigration();
            await expect(tx).to.emit(timeUnitContract, "MigrationCompleted");
        });
    });

    describe("时间单位验证", function () {
        it("SECONDS_IN_UNIT_NEW 应该是 86400", async function () {
            const newUnit = await timeUnitContract.SECONDS_IN_UNIT_NEW();
            expect(newUnit).to.equal(86400);
        });

        it("SECONDS_IN_UNIT_OLD 应该是 60", async function () {
            const oldUnit = await timeUnitContract.SECONDS_IN_UNIT_OLD();
            expect(oldUnit).to.equal(60);
        });

        it("getTimeUnitFixStatus 应该返回正确信息", async function () {
            const status = await timeUnitContract.getTimeUnitFixStatus();
            
            expect(status.isFixed).to.be.true;
            expect(status.oldUnit).to.equal(60);
            expect(status.newUnit).to.equal(86400);
            expect(status.fixTime).to.be.gt(0);
            expect(status.migrationProgress).to.equal(0);
        });
    });

    describe("错误处理", function () {
        it("不能迁移零地址", async function () {
            await expect(
                timeUnitContract.migrateUserData(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("不能设置无效用户总数", async function () {
            await expect(
                timeUnitContract.setTotalUsersToMigrate(0)
            ).to.be.revertedWith("Invalid user count");
        });

        it("不能重复迁移用户", async function () {
            await timeUnitContract.setTotalUsersToMigrate(1);
            await timeUnitContract.migrateUserData(user1.address);
            
            await expect(
                timeUnitContract.migrateUserData(user1.address)
            ).to.be.revertedWith("User already migrated");
        });

        it("批量迁移不能超过50个用户", async function () {
            const users = Array(51).fill(0).map(() => ethers.Wallet.createRandom().address);
            
            await expect(
                timeUnitContract.batchMigrateUsers(users)
            ).to.be.revertedWith("Batch size too large");
        });
    });
});