const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TimeUnitFixContractFixed - 修复版本测试", function () {
    let contract;
    let owner;
    let user1;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        // 部署修复版本的合约
        const TimeUnitFixContractFixed = await ethers.getContractFactory("TimeUnitFixContractFixed");
        contract = await TimeUnitFixContractFixed.deploy();
        await contract.waitForDeployment();
        
        console.log("✅ TimeUnitFixContractFixed 部署成功");
    });

    describe("基础功能测试", function () {
        it("应该正确初始化时间单位", async function () {
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
            expect(status.migrationProgress).to.equal(0);
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

        it("应该能批量迁移用户", async function () {
            const users = [user1.address, owner.address];
            await contract.connect(owner).setTotalUsersToMigrate(2);
            
            await contract.connect(owner).batchMigrateUsers(users);
            
            expect(await contract.userDataMigrated(user1.address)).to.be.true;
            expect(await contract.userDataMigrated(owner.address)).to.be.true;
            expect(await contract.totalUsersMigrated()).to.equal(2);
        });

        it("应该能完成迁移", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(1);
            await contract.connect(owner).migrateUserData(user1.address);
            
            const tx = await contract.connect(owner).completeMigration();
            await expect(tx).to.emit(contract, "MigrationCompleted");
        });
    });

    describe("时间单位验证", function () {
        it("SECONDS_IN_UNIT_NEW 应该是 86400", async function () {
            const newUnit = await contract.SECONDS_IN_UNIT_NEW();
            expect(newUnit).to.equal(86400);
        });

        it("SECONDS_IN_UNIT_OLD 应该是 60", async function () {
            const oldUnit = await contract.SECONDS_IN_UNIT_OLD();
            expect(oldUnit).to.equal(60);
        });

        it("getEffectiveSecondsInUnit 应该返回 86400", async function () {
            expect(await contract.getEffectiveSecondsInUnit()).to.equal(86400);
        });
    });

    describe("迁移进度测试", function () {
        it("应该正确计算迁移进度", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(10);
            
            let progress = await contract.getMigrationProgress();
            expect(progress.totalUsers).to.equal(10);
            expect(progress.migratedUsers).to.equal(0);
            expect(progress.progressPercent).to.equal(0);
            
            // 迁移一个用户
            await contract.connect(owner).migrateUserData(user1.address);
            
            progress = await contract.getMigrationProgress();
            expect(progress.totalUsers).to.equal(10);
            expect(progress.migratedUsers).to.equal(1);
            expect(progress.progressPercent).to.equal(10);
        });
    });

    describe("错误处理", function () {
        it("不能迁移零地址", async function () {
            await expect(
                contract.connect(owner).migrateUserData(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("不能设置无效用户总数", async function () {
            await expect(
                contract.connect(owner).setTotalUsersToMigrate(0)
            ).to.be.revertedWith("Invalid user count");
        });

        it("不能重复迁移用户", async function () {
            await contract.connect(owner).setTotalUsersToMigrate(1);
            await contract.connect(owner).migrateUserData(user1.address);
            
            await expect(
                contract.connect(owner).migrateUserData(user1.address)
            ).to.be.revertedWith("User already migrated");
        });

        it("批量迁移不能超过50个用户", async function () {
            const users = Array(51).fill(0).map(() => ethers.Wallet.createRandom().address);
            
            await expect(
                contract.connect(owner).batchMigrateUsers(users)
            ).to.be.revertedWith("Batch size too large");
        });

        it("非owner不能执行管理员功能", async function () {
            await expect(
                contract.connect(user1).setTotalUsersToMigrate(10)
            ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
        });
    });
});