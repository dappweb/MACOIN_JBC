const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("JBCv2 Token Tests", function () {
  let jbcv2;
  let owner, treasury, marketing, liquidity, user1, user2;
  let jbcv2Address;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 1亿
  const MAX_SUPPLY = ethers.parseEther("1000000000");    // 10亿

  beforeEach(async function () {
    [owner, treasury, marketing, liquidity, user1, user2] = await ethers.getSigners();

    // 部署 JBCv2
    const JBCv2 = await ethers.getContractFactory("JBCv2");
    jbcv2 = await upgrades.deployProxy(
      JBCv2,
      [owner.address, treasury.address, marketing.address, liquidity.address],
      { initializer: "initialize", kind: "uups" }
    );
    await jbcv2.waitForDeployment();
    jbcv2Address = await jbcv2.getAddress();
  });

  describe("部署和初始化", function () {
    it("应该正确设置基本信息", async function () {
      expect(await jbcv2.name()).to.equal("Jinbao Coin");
      expect(await jbcv2.symbol()).to.equal("JBC");
      expect(await jbcv2.decimals()).to.equal(18);
      expect(await jbcv2.VERSION()).to.equal("2.0");
    });

    it("应该正确设置供应量", async function () {
      expect(await jbcv2.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await jbcv2.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await jbcv2.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("应该正确设置税收配置", async function () {
      const taxInfo = await jbcv2.getTaxInfo();
      expect(taxInfo.buyTax).to.equal(5000);    // 50%
      expect(taxInfo.sellTax).to.equal(2500);   // 25%
      expect(taxInfo.transferTax).to.equal(0);  // 0%
      expect(taxInfo.enabled).to.be.true;
    });

    it("应该正确设置钱包地址", async function () {
      expect(await jbcv2.treasuryWallet()).to.equal(treasury.address);
      expect(await jbcv2.marketingWallet()).to.equal(marketing.address);
      expect(await jbcv2.liquidityWallet()).to.equal(liquidity.address);
    });
  });

  describe("税收机制", function () {
    beforeEach(async function () {
      // 给用户一些代币用于测试
      await jbcv2.transfer(user1.address, ethers.parseEther("1000"));
      await jbcv2.transfer(user2.address, ethers.parseEther("1000"));
    });

    it("免税地址应该不收税", async function () {
      const amount = ethers.parseEther("100");
      const balanceBefore = await jbcv2.balanceOf(user1.address);
      
      // Owner 是免税地址
      await jbcv2.transfer(user1.address, amount);
      
      const balanceAfter = await jbcv2.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it("普通转账应该免税", async function () {
      const amount = ethers.parseEther("100");
      
      const balanceBefore = await jbcv2.balanceOf(user2.address);
      
      await jbcv2.connect(user1).transfer(user2.address, amount);
      
      const balanceAfter = await jbcv2.balanceOf(user2.address);
      expect(balanceAfter - balanceBefore).to.equal(amount); // 普通转账免税
    });

    it("应该能够更新税收配置", async function () {
      await jbcv2.setTaxConfig(4000, 2000, 0); // 40%, 20%, 0%
      
      const taxInfo = await jbcv2.getTaxInfo();
      expect(taxInfo.buyTax).to.equal(4000);
      expect(taxInfo.sellTax).to.equal(2000);
      expect(taxInfo.transferTax).to.equal(0);
    });

    it("不应该允许设置过高的税率", async function () {
      await expect(
        jbcv2.setTaxConfig(6000, 2500, 0) // 60% 买入税过高
      ).to.be.revertedWith("Tax too high");
    });
  });

  describe("质押功能", function () {
    beforeEach(async function () {
      await jbcv2.transfer(user1.address, ethers.parseEther("1000"));
    });

    it("应该能够质押代币", async function () {
      const stakeAmount = ethers.parseEther("100");
      const lockPeriod = 7 * 24 * 60 * 60; // 7天
      
      await jbcv2.connect(user1).stake(stakeAmount, lockPeriod);
      
      const stakingInfo = await jbcv2.getStakingInfo(user1.address);
      expect(stakingInfo.stakedAmount).to.equal(stakeAmount);
      expect(stakingInfo.lockPeriod).to.equal(lockPeriod);
    });

    it("不应该允许质押0数量", async function () {
      await expect(
        jbcv2.connect(user1).stake(0, 7 * 24 * 60 * 60)
      ).to.be.revertedWith("Cannot stake 0");
    });

    it("不应该允许锁定期少于7天", async function () {
      await expect(
        jbcv2.connect(user1).stake(ethers.parseEther("100"), 6 * 24 * 60 * 60)
      ).to.be.revertedWith("Minimum 7 days lock");
    });

    it("应该能够在锁定期后解除质押", async function () {
      const stakeAmount = ethers.parseEther("100");
      const lockPeriod = 7 * 24 * 60 * 60; // 7天
      
      await jbcv2.connect(user1).stake(stakeAmount, lockPeriod);
      
      // 快进时间
      await ethers.provider.send("evm_increaseTime", [lockPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      const balanceBefore = await jbcv2.balanceOf(user1.address);
      await jbcv2.connect(user1).unstake(stakeAmount);
      const balanceAfter = await jbcv2.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(stakeAmount);
    });
  });

  describe("铸造和燃烧", function () {
    it("授权地址应该能够铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await jbcv2.setMinter(owner.address, true);
      await jbcv2.mint(user1.address, mintAmount);
      
      expect(await jbcv2.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("不应该允许超过最大供应量铸造", async function () {
      const excessAmount = MAX_SUPPLY + 1n;
      
      await jbcv2.setMinter(owner.address, true);
      await expect(
        jbcv2.mint(user1.address, excessAmount)
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("应该能够燃烧代币", async function () {
      const burnAmount = ethers.parseEther("1000");
      const totalSupplyBefore = await jbcv2.totalSupply();
      
      await jbcv2.burn(burnAmount);
      
      const totalSupplyAfter = await jbcv2.totalSupply();
      expect(totalSupplyBefore - totalSupplyAfter).to.equal(burnAmount);
    });
  });

  describe("批量操作", function () {
    beforeEach(async function () {
      await jbcv2.transfer(user1.address, ethers.parseEther("1000"));
    });

    it("应该能够批量转账", async function () {
      const recipients = [user2.address, treasury.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await jbcv2.connect(user1).batchTransfer(recipients, amounts);
      
      expect(await jbcv2.balanceOf(user2.address)).to.equal(amounts[0]);
      expect(await jbcv2.balanceOf(treasury.address)).to.be.gte(amounts[1]); // 可能有税收
    });

    it("不应该允许数组长度不匹配", async function () {
      const recipients = [user2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await expect(
        jbcv2.connect(user1).batchTransfer(recipients, amounts)
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  describe("安全功能", function () {
    it("应该能够暂停和恢复合约", async function () {
      await jbcv2.pause();
      
      await expect(
        jbcv2.transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(jbcv2, "EnforcedPause");
      
      await jbcv2.unpause();
      
      await expect(
        jbcv2.transfer(user1.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("应该能够设置黑名单", async function () {
      await jbcv2.setBlacklisted(user1.address, true);
      
      await expect(
        jbcv2.transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Blacklisted address");
    });

    it("应该能够设置转账限制", async function () {
      const maxTransfer = ethers.parseEther("50");
      await jbcv2.setLimits(maxTransfer, ethers.parseEther("1000"));
      
      await expect(
        jbcv2.transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Exceeds max transfer");
    });
  });

  describe("治理功能", function () {
    it("应该支持投票权委托", async function () {
      await jbcv2.transfer(user1.address, ethers.parseEther("1000"));
      
      await jbcv2.connect(user1).delegate(user2.address);
      
      expect(await jbcv2.getVotes(user2.address)).to.equal(ethers.parseEther("1000"));
    });

    it("应该正确计算投票权重", async function () {
      const amount = ethers.parseEther("1000");
      await jbcv2.transfer(user1.address, amount);
      await jbcv2.connect(user1).delegate(user1.address);
      
      expect(await jbcv2.getVotes(user1.address)).to.equal(amount);
    });
  });

  describe("升级功能", function () {
    it("只有 owner 应该能够升级合约", async function () {
      const JBCv2New = await ethers.getContractFactory("JBCv2");
      
      await expect(
        upgrades.upgradeProxy(jbcv2Address, JBCv2New.connect(user1))
      ).to.be.reverted;
      
      // Owner 应该能够升级
      await expect(
        upgrades.upgradeProxy(jbcv2Address, JBCv2New.connect(owner))
      ).to.not.be.reverted;
    });
  });

  describe("视图函数", function () {
    it("应该正确返回供应量信息", async function () {
      const supplyInfo = await jbcv2.getSupplyInfo();
      
      expect(supplyInfo.totalSupply_).to.equal(INITIAL_SUPPLY);
      expect(supplyInfo.maxSupply_).to.equal(MAX_SUPPLY);
      expect(supplyInfo.totalBurned_).to.equal(0);
    });

    it("应该正确返回质押信息", async function () {
      await jbcv2.transfer(user1.address, ethers.parseEther("1000"));
      
      const stakeAmount = ethers.parseEther("100");
      const lockPeriod = 7 * 24 * 60 * 60;
      
      await jbcv2.connect(user1).stake(stakeAmount, lockPeriod);
      
      const stakingInfo = await jbcv2.getStakingInfo(user1.address);
      expect(stakingInfo.stakedAmount).to.equal(stakeAmount);
      expect(stakingInfo.canUnstake).to.be.false;
    });
  });
});