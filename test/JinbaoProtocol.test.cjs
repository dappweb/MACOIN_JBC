const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Jinbao Protocol System", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, user1, user2, referrer, marketing, treasury, lpInjection, buyback, lpPair;

  const TICKET_PRICE = ethers.parseEther("100");
  const LIQUIDITY_AMOUNT = ethers.parseEther("150");

  beforeEach(async function () {
    [owner, user1, user2, referrer, marketing, treasury, lpInjection, buyback, lpPair] = await ethers.getSigners();

    // Deploy MC
    MockMC = await ethers.getContractFactory("MockMC");
    mc = await MockMC.deploy();
    await mc.waitForDeployment(); // Updated for ethers v6

    // Deploy JBC
    JBC = await ethers.getContractFactory("JBC");
    jbc = await JBC.deploy(owner.address);
    await jbc.waitForDeployment();

    // Deploy Protocol
    Protocol = await ethers.getContractFactory("JinbaoProtocol");
    protocol = await Protocol.deploy(
      await mc.getAddress(),
      await jbc.getAddress(),
      marketing.address,
      treasury.address,
      lpInjection.address,
      buyback.address
    );
    await protocol.waitForDeployment();

    // Setup Permissions
    await jbc.setProtocol(await protocol.getAddress());
    
    // Fund Protocol with MC and JBC for rewards
    await mc.transfer(await protocol.getAddress(), ethers.parseEther("1000000"));
    await jbc.transfer(await protocol.getAddress(), ethers.parseEther("1000000"));

    // Fund Users
    await mc.mint(user1.address, ethers.parseEther("10000"));
    await mc.mint(user2.address, ethers.parseEther("10000"));
  });

  describe("Token Mechanics (JBC)", function () {
    it("Should burn 50% on buy and 25% on sell", async function () {
      // Setup LP Pair
      await jbc.setPair(lpPair.address);
      
      // Transfer to user1 (No tax)
      await jbc.transfer(user1.address, ethers.parseEther("1000"));
      expect(await jbc.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));

      // Simulate Sell (User1 -> Pair)
      // Expect 25% tax
      await jbc.connect(user1).transfer(lpPair.address, ethers.parseEther("100"));
      // Recipient (Pair) should receive 75
      expect(await jbc.balanceOf(lpPair.address)).to.equal(ethers.parseEther("75"));
      
      // Simulate Buy (Pair -> User2)
      // Expect 50% tax
      // First fund Pair
      await jbc.transfer(lpPair.address, ethers.parseEther("1000"));
      const initialUser2 = await jbc.balanceOf(user2.address);
      
      // We need to simulate the pair calling transfer, so we impersonate or just use owner if owner was pair (but here lpPair is a signer)
      await jbc.connect(lpPair).transfer(user2.address, ethers.parseEther("100"));
      
      // User2 should receive 50
      expect(await jbc.balanceOf(user2.address)).to.equal(initialUser2 + ethers.parseEther("50"));
    });
  });

  describe("Protocol Flow", function () {
    it("Should distribute ticket funds correctly", async function () {
      // Bind Referrer
      await protocol.connect(user1).bindReferrer(referrer.address);
      
      // Approve MC
      await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
      
      const initialMarketing = await mc.balanceOf(marketing.address);
      const initialReferrer = await mc.balanceOf(referrer.address);

      // Buy Ticket
      await protocol.connect(user1).buyTicket(TICKET_PRICE);

      // Check Distribution
      // Referrer: 25% = 25 MC
      expect(await mc.balanceOf(referrer.address)).to.equal(initialReferrer + ethers.parseEther("25"));
      
      // Marketing: 5% + 15% (Level reward placeholder) = 20% = 20 MC
      expect(await mc.balanceOf(marketing.address)).to.equal(initialMarketing + ethers.parseEther("20"));
      
      // Treasury: 25% = 25 MC
      expect(await mc.balanceOf(treasury.address)).to.equal(ethers.parseEther("25"));
    });

    it("Should handle liquidity staking and rewards", async function () {
      // Buy Ticket
      await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
      await protocol.connect(user1).buyTicket(TICKET_PRICE);

      // Stake Liquidity (150 MC)
      await protocol.connect(user1).stakeLiquidity(7); // 7 Days

      // Verify Liquidity
      const ticket = await protocol.userTicket(user1.address);
      expect(ticket.liquidityProvided).to.be.true;
      expect(ticket.liquidityAmount).to.equal(LIQUIDITY_AMOUNT);

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60 + 1);

      // Claim Rewards
      // Rate: 2.0% daily * 7 days = 14%
      // 14% of 100 MC = 14 MC total reward
      // Split: 7 MC + 7 JBC (assuming 1:1 price mock)
      
      const initialMc = await mc.balanceOf(user1.address);
      const initialJbc = await jbc.balanceOf(user1.address);

      await protocol.connect(user1).claimRewards();

      const finalMc = await mc.balanceOf(user1.address);
      const finalJbc = await jbc.balanceOf(user1.address);

      // Allow for small rounding errors
      expect(finalMc - initialMc).to.be.closeTo(ethers.parseEther("7"), ethers.parseEther("0.1"));
      expect(finalJbc - initialJbc).to.be.closeTo(ethers.parseEther("7"), ethers.parseEther("0.1"));
    });

    it("Should handle redemption", async function () {
       // Setup
       await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
       await protocol.connect(user1).buyTicket(TICKET_PRICE);
       await protocol.connect(user1).stakeLiquidity(7);

       // Fast forward
       await time.increase(8 * 24 * 60 * 60);

       // Redeem
       // 1% Fee = 1 MC
       // Return = 150 MC Principal
       // User pays 1 MC fee (transferFrom) -> Protocol
       // Protocol sends 150 MC -> User
       // Net change for user: +150 - 1 = +149 MC
       
       const initialMc = await mc.balanceOf(user1.address);
       
       await protocol.connect(user1).redeem();
       
       const finalMc = await mc.balanceOf(user1.address);
       
       expect(finalMc - initialMc).to.equal(ethers.parseEther("149"));
    });
  });
});
