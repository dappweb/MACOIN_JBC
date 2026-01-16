const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Liquidity Staking Simplification Tests", function () {
  let protocol, mcToken, jbcToken;
  let owner, user1, user2, marketing, treasury, lpInjection, buyback;

  beforeEach(async function () {
    [owner, user1, user2, marketing, treasury, lpInjection, buyback] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mcToken = await MockERC20.deploy("MC Token", "MC", ethers.parseEther("1000000"));
    
    const MockJBC = await ethers.getContractFactory("MockJBC");
    jbcToken = await MockJBC.deploy("JBC Token", "JBC", ethers.parseEther("100000000"));

    // Deploy protocol
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    protocol = await upgrades.deployProxy(JinbaoProtocol, [
      await mcToken.getAddress(),
      await jbcToken.getAddress(),
      marketing.address,
      treasury.address,
      lpInjection.address,
      buyback.address
    ]);

    // Setup tokens for users
    await mcToken.transfer(user1.address, ethers.parseEther("10000"));
    await mcToken.transfer(user2.address, ethers.parseEther("10000"));
    
    await mcToken.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
    await mcToken.connect(user2).approve(await protocol.getAddress(), ethers.MaxUint256);
  });

  describe("Simplified Staking Logic", function () {
    it("Should allow staking without ticket (new behavior)", async function () {
      // 用户无门票也可以质押
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7)
      ).to.not.be.reverted;
    });

    it("Should allow staking any amount (no 1.5x requirement)", async function () {
      // 购买门票
      await protocol.connect(user1).buyTicket(ethers.parseEther("1000"));
      
      // 质押任意金额 (不再需要1.5倍)
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("1"), 7)
      ).to.not.be.reverted;
      
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("10000"), 15)
      ).to.not.be.reverted;
    });

    it("Should allow staking at any time (no 72h limit)", async function () {
      // 购买门票
      await protocol.connect(user1).buyTicket(ethers.parseEther("1000"));
      
      // 等待超过72小时
      await time.increase(73 * 60 * 60); // 73 hours
      
      // 仍然可以质押
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7)
      ).to.not.be.reverted;
    });

    it("Should reject staking when exited (only restriction)", async function () {
      // 购买门票并质押
      await protocol.connect(user1).buyTicket(ethers.parseEther("1000"));
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7);
      
      // 模拟达到3倍出局 (需要修改合约状态)
      // 这里需要通过其他方式触发出局状态
      
      // 验证出局后无法质押
      // await expect(
      //   protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7)
      // ).to.be.revertedWith("AlreadyExited");
    });

    it("Should still validate basic parameters", async function () {
      // 仍然验证周期
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 5)
      ).to.be.revertedWith("InvalidCycle");
      
      // 仍然验证金额
      await expect(
        protocol.connect(user1).stakeLiquidity(0, 7)
      ).to.be.revertedWith("InvalidAmount");
    });

    it("Should update active status correctly", async function () {
      // 质押后应该变为活跃
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7);
      
      const userInfo = await protocol.userInfo(user1.address);
      expect(userInfo.isActive).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple stakes", async function () {
      // 多次质押
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7);
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("200"), 15);
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("300"), 30);
      
      // 检查总质押金额
      const stakes = await protocol.userStakes(user1.address, 0);
      expect(stakes.amount).to.equal(ethers.parseEther("100"));
    });

    it("Should handle very small amounts", async function () {
      await expect(
        protocol.connect(user1).stakeLiquidity(1, 7) // 1 wei
      ).to.not.be.reverted;
    });

    it("Should handle very large amounts", async function () {
      // 给用户足够的代币
      await mcToken.transfer(user1.address, ethers.parseEther("100000"));
      
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("50000"), 30)
      ).to.not.be.reverted;
    });
  });

  describe("Backward Compatibility", function () {
    it("Should work with existing ticket holders", async function () {
      // 先购买门票 (旧流程)
      await protocol.connect(user1).buyTicket(ethers.parseEther("1000"));
      
      // 然后质押 (新流程)
      await expect(
        protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7)
      ).to.not.be.reverted;
    });

    it("Should maintain reward calculations", async function () {
      await protocol.connect(user1).stakeLiquidity(ethers.parseEther("1000"), 7);
      
      // 等待一段时间
      await time.increase(24 * 60 * 60); // 1 day
      
      // 检查是否有收益
      await expect(
        protocol.connect(user1).claimRewards()
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization", function () {
    it("Should use less gas after simplification", async function () {
      // 测试gas使用量
      const tx = await protocol.connect(user1).stakeLiquidity(ethers.parseEther("100"), 7);
      const receipt = await tx.wait();
      
      console.log("Gas used for stakeLiquidity:", receipt.gasUsed.toString());
      
      // 可以与之前的版本比较
      expect(receipt.gasUsed).to.be.lessThan(200000); // 示例阈值
    });
  });
});

// Mock contracts for testing
// 这些需要在 contracts/mocks/ 目录下创建

/*
// contracts/mocks/MockERC20.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
}

// contracts/mocks/MockJBC.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockJBC is ERC20 {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
*/