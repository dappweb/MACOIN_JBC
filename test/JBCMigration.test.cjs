const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

// Skip this test suite - JBCv2 contract no longer exists
// Migration was for legacy v1->v2 upgrade which is complete
describe.skip("JBC Migration Tests", function () {
  let oldJBC, newJBC, migration;
  let owner, user1, user2;
  let migrationAddress;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 1亿

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署旧 JBC (模拟)
    const MockJBC = await ethers.getContractFactory("MockERC20");
    oldJBC = await MockJBC.deploy("Old Jinbao Coin", "JBC", INITIAL_SUPPLY);
    await oldJBC.waitForDeployment();

    // 部署新 JBCv2
    const JBCv2 = await ethers.getContractFactory("JBCv2");
    newJBC = await upgrades.deployProxy(
      JBCv2,
      [owner.address, owner.address, owner.address, owner.address],
      { initializer: "initialize", kind: "uups" }
    );
    await newJBC.waitForDeployment();

    // 部署迁移合约
    const JBCMigration = await ethers.getContractFactory("JBCMigration");
    migration = await JBCMigration.deploy(
      await oldJBC.getAddress(),
      await newJBC.getAddress()
    );
    await migration.waitForDeployment();
    migrationAddress = await migration.getAddress();

    // 设置迁移合约为新代币的铸造者
    await newJBC.setMinter(migrationAddress, true);

    // 给迁移合约充值新代币
    const fundAmount = ethers.parseEther("50000000"); // 5000万
    await newJBC.transfer(migrationAddress, fundAmount);

    // 给用户一些旧代币
    await oldJBC.transfer(user1.address, ethers.parseEther("1000"));
    await oldJBC.transfer(user2.address, ethers.parseEther("2000"));
  });

  describe("部署和初始化", function () {
    it("应该正确设置代币地址", async function () {
      expect(await migration.oldJBC()).to.equal(await oldJBC.getAddress());
      expect(await migration.newJBC()).to.equal(await newJBC.getAddress());
    });

    it("应该默认启用迁移", async function () {
      expect(await migration.migrationEnabled()).to.be.true;
    });

    it("应该正确初始化统计数据", async function () {
      expect(await migration.totalMigrated()).to.equal(0);
      expect(await migration.migrationCount()).to.equal(0);
    });
  });

  describe("代币迁移", function () {
    beforeEach(async function () {
      // 用户授权迁移合约
      await oldJBC.connect(user1).approve(migrationAddress, ethers.parseEther("1000"));
    });

    it("应该能够成功迁移代币", async function () {
      const migrateAmount = ethers.parseEther("500");
      
      const oldBalanceBefore = await oldJBC.balanceOf(user1.address);
      const newBalanceBefore = await newJBC.balanceOf(user1.address);
      
      await migration.connect(user1).migrate(migrateAmount);
      
      const oldBalanceAfter = await oldJBC.balanceOf(user1.address);
      const newBalanceAfter = await newJBC.balanceOf(user1.address);
      
      expect(oldBalanceBefore - oldBalanceAfter).to.equal(migrateAmount);
      expect(newBalanceAfter - newBalanceBefore).to.equal(migrateAmount);
    });

    it("应该正确更新迁移统计", async function () {
      const migrateAmount = ethers.parseEther("500");
      
      await migration.connect(user1).migrate(migrateAmount);
      
      expect(await migration.totalMigrated()).to.equal(migrateAmount);
      expect(await migration.migrationCount()).to.equal(1);
      expect(await migration.userMigrated(user1.address)).to.equal(migrateAmount);
    });

    it("应该发出迁移事件", async function () {
      const migrateAmount = ethers.parseEther("500");
      
      await expect(migration.connect(user1).migrate(migrateAmount))
        .to.emit(migration, "Migration")
        .withArgs(user1.address, migrateAmount, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));
    });

    it("不应该允许迁移0数量", async function () {
      await expect(
        migration.connect(user1).migrate(0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("不应该允许迁移超过余额的数量", async function () {
      const excessAmount = ethers.parseEther("2000");
      
      await expect(
        migration.connect(user1).migrate(excessAmount)
      ).to.be.revertedWith("Insufficient old JBC balance");
    });

    it("不应该允许在授权不足时迁移", async function () {
      const migrateAmount = ethers.parseEther("500");
      
      // 清除授权
      await oldJBC.connect(user1).approve(migrationAddress, 0);
      
      await expect(
        migration.connect(user1).migrate(migrateAmount)
      ).to.be.revertedWith("Old JBC transfer failed");
    });
  });

  describe("批量迁移", function () {
    beforeEach(async function () {
      // 用户授权迁移合约
      await oldJBC.connect(user1).approve(migrationAddress, ethers.parseEther("1000"));
      await oldJBC.connect(user2).approve(migrationAddress, ethers.parseEther("2000"));
    });

    it("应该能够批量迁移多个用户", async function () {
      const users = [user1.address, user2.address];
      const amounts = [ethers.parseEther("500"), ethers.parseEther("1000")];
      
      await migration.batchMigrate(users, amounts);
      
      expect(await newJBC.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await newJBC.balanceOf(user2.address)).to.equal(amounts[1]);
      expect(await migration.totalMigrated()).to.equal(amounts[0] + amounts[1]);
    });

    it("不应该允许数组长度不匹配", async function () {
      const users = [user1.address];
      const amounts = [ethers.parseEther("500"), ethers.parseEther("1000")];
      
      await expect(
        migration.batchMigrate(users, amounts)
      ).to.be.revertedWith("Array length mismatch");
    });

    it("不应该允许批量迁移过多用户", async function () {
      const users = new Array(101).fill(user1.address);
      const amounts = new Array(101).fill(ethers.parseEther("1"));
      
      await expect(
        migration.batchMigrate(users, amounts)
      ).to.be.revertedWith("Too many users");
    });
  });

  describe("管理功能", function () {
    it("应该能够启用/禁用迁移", async function () {
      await migration.setMigrationEnabled(false);
      expect(await migration.migrationEnabled()).to.be.false;
      
      await oldJBC.connect(user1).approve(migrationAddress, ethers.parseEther("500"));
      
      await expect(
        migration.connect(user1).migrate(ethers.parseEther("500"))
      ).to.be.revertedWith("Migration disabled");
      
      await migration.setMigrationEnabled(true);
      expect(await migration.migrationEnabled()).to.be.true;
    });

    it("应该能够向合约充值", async function () {
      const fundAmount = ethers.parseEther("1000");
      const balanceBefore = await newJBC.balanceOf(migrationAddress);
      
      await newJBC.approve(migrationAddress, fundAmount);
      await migration.fundContract(fundAmount);
      
      const balanceAfter = await newJBC.balanceOf(migrationAddress);
      expect(balanceAfter - balanceBefore).to.equal(fundAmount);
    });

    it("应该能够紧急提取代币", async function () {
      const withdrawAmount = ethers.parseEther("1000");
      const balanceBefore = await newJBC.balanceOf(owner.address);
      
      await migration.emergencyWithdraw(await newJBC.getAddress(), withdrawAmount);
      
      const balanceAfter = await newJBC.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });

    it("只有 owner 应该能够调用管理函数", async function () {
      await expect(
        migration.connect(user1).setMigrationEnabled(false)
      ).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount");
      
      await expect(
        migration.connect(user1).emergencyWithdraw(await newJBC.getAddress(), 1000)
      ).to.be.revertedWithCustomError(migration, "OwnableUnauthorizedAccount");
    });
  });

  describe("视图函数", function () {
    beforeEach(async function () {
      await oldJBC.connect(user1).approve(migrationAddress, ethers.parseEther("500"));
      await migration.connect(user1).migrate(ethers.parseEther("500"));
    });

    it("应该正确返回迁移统计", async function () {
      const stats = await migration.getMigrationStats();
      
      expect(stats.totalMigrated_).to.equal(ethers.parseEther("500"));
      expect(stats.migrationCount_).to.equal(1);
      expect(stats.enabled).to.be.true;
    });

    it("应该正确返回用户迁移信息", async function () {
      const userInfo = await migration.getUserMigrationInfo(user1.address);
      
      expect(userInfo.migrated).to.equal(ethers.parseEther("500"));
      expect(userInfo.oldBalance).to.equal(ethers.parseEther("500"));
      expect(userInfo.newBalance).to.equal(ethers.parseEther("500"));
    });

    it("应该正确检查迁移可行性", async function () {
      await oldJBC.connect(user2).approve(migrationAddress, ethers.parseEther("1000"));
      
      const canMigrate = await migration.canMigrate(user2.address, ethers.parseEther("1000"));
      expect(canMigrate.canMigrate_).to.be.true;
      expect(canMigrate.reason).to.equal("Can migrate");
    });

    it("应该正确返回迁移进度", async function () {
      const progress = await migration.getMigrationProgress();
      
      expect(progress.totalMigrated_).to.equal(ethers.parseEther("500"));
      expect(progress.migrationPercentage).to.be.gt(0);
    });
  });
});

// Note: MockERC20 contract is defined in contracts/MockERC20.sol