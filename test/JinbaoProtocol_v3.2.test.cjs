const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Jinbao Protocol System v3.2", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, user1, user2, referrer, marketing, treasury, lpInjection, buyback, lpPair, upline2;

  const TICKET_PRICE = ethers.parseEther("100"); // T1
  const LIQUIDITY_AMOUNT = ethers.parseEther("150"); // 1.5x

  beforeEach(async function () {
    [owner, user1, user2, referrer, marketing, treasury, lpInjection, buyback, lpPair, upline2] = await ethers.getSigners();

    // Deploy MC
    MockMC = await ethers.getContractFactory("MockMC");
    mc = await MockMC.deploy();
    await mc.waitForDeployment();

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
      lpInjection.address
    );
    await protocol.waitForDeployment();

    // Setup Permissions
    // Note: In real JBC, protocol might need minter role or similar, or just ownership. 
    // The interface IJBC has burn(). JBC.sol usually has owner-only burn or public burn?
    // Assuming JBC.sol allows burn.
    
    // Fund Protocol with MC and JBC for rewards/swaps
    await mc.transfer(await protocol.getAddress(), ethers.parseEther("1000000"));
    await jbc.transfer(await protocol.getAddress(), ethers.parseEther("1000000"));

    // Fund Users
    await mc.mint(user1.address, ethers.parseEther("10000"));
    await mc.mint(user2.address, ethers.parseEther("10000"));
    await mc.mint(referrer.address, ethers.parseEther("10000"));
    await mc.mint(upline2.address, ethers.parseEther("10000"));
  });

  describe("Ticket System & Distribution", function () {
    it("Should distribute ticket funds correctly (v3.2)", async function () {
      // Bind Referrer
      await protocol.connect(user1).bindReferrer(referrer.address);
      
      // Approve MC
      await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
      
      const initialMarketing = await mc.balanceOf(marketing.address);
      const initialReferrer = await mc.balanceOf(referrer.address);
      const initialProtocol = await mc.balanceOf(await protocol.getAddress());
      const initialTreasury = await mc.balanceOf(treasury.address);
      const initialLpInjection = await mc.balanceOf(lpInjection.address);

      // Buy Ticket
      await protocol.connect(user1).buyTicket(TICKET_PRICE);
      
      // Check Distribution
      // 1. Referrer: 25% = 25 MC
      // Note: Referrer has NO ticket, so _distributeReward will NOT pay.
      // Funds stay in Protocol.
      expect(await mc.balanceOf(referrer.address)).to.equal(initialReferrer);
      
      // 2. Differential (15%): Stays in Protocol (Pending)
      // 3. Buyback (5%): Stays in Protocol (Internal Swap MC->JBC, MC stays)
      // 4. Direct Reward (25%): Stays in Protocol (Referrer ineligible)
      // Total Stays: 15 + 5 + 25 = 45 MC.
      // Protocol Balance should increase by 45 MC.
      
      expect(await mc.balanceOf(await protocol.getAddress())).to.equal(initialProtocol + ethers.parseEther("45"));

      // 4. Marketing: 5% = 5 MC
      expect(await mc.balanceOf(marketing.address)).to.equal(initialMarketing + ethers.parseEther("5"));
      
      // 5. Treasury: 25% = 25 MC
      expect(await mc.balanceOf(treasury.address)).to.equal(initialTreasury + ethers.parseEther("25"));
      
      // 6. LpInjection: 25% = 25 MC
      expect(await mc.balanceOf(lpInjection.address)).to.equal(initialLpInjection + ethers.parseEther("25"));
    });
  });

  describe("Liquidity & Static Rewards", function () {
    it("Should allow staking and claiming static rewards", async function () {
      await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
      await protocol.connect(user1).buyTicket(TICKET_PRICE);

      // Stake Liquidity (150 MC) - 7 Days (2.0%)
      await protocol.connect(user1).stakeLiquidity(7);

      // Verify
      const ticket = await protocol.userTicket(user1.address);
      expect(ticket.liquidityProvided).to.be.true;
      expect(ticket.liquidityAmount).to.equal(LIQUIDITY_AMOUNT);

      // Fast forward 3.5 days (half cycle)
      // Rate: 2.0% daily. 150 * 0.02 = 3.0 MC daily.
      // Solidity uses integer division for days. 3.5 days -> 3 days.
      // 3 days * 3.0 = 9.0 MC total.
      // 50% MC = 4.5 MC.
      await time.increase(3.5 * 24 * 60 * 60);

      const initialMc = await mc.balanceOf(user1.address);
      
      await protocol.connect(user1).claimRewards();
      
      const finalMc = await mc.balanceOf(user1.address);
      
      // Received 4.5 MC.
      expect(finalMc - initialMc).to.be.closeTo(ethers.parseEther("4.5"), ethers.parseEther("0.1"));
    });
  });
  
  describe("Redemption & Fee Refund", function () {
      it("Should redeem and refund fee on next stake", async function () {
          await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
          await protocol.connect(user1).buyTicket(TICKET_PRICE);
          await protocol.connect(user1).stakeLiquidity(7);
          
          await time.increase(8 * 86400); // 8 days
          
          // Redeem
          // Fee = 1% of Ticket (100) = 1 MC.
          // Principal = 150 MC.
          // Return = 149 MC.
          
          const balBefore = await mc.balanceOf(user1.address);
          await protocol.connect(user1).redeem();
          const balAfter = await mc.balanceOf(user1.address);
          
          expect(balAfter - balBefore).to.equal(ethers.parseEther("149"));
          
          // Check userInfo refund fee
          const uInfo = await protocol.userInfo(user1.address);
          expect(uInfo.refundFeeAmount).to.equal(ethers.parseEther("1"));
          
          // Buy New Ticket and Stake
          await protocol.connect(user1).buyTicket(TICKET_PRICE);
          
          const balBeforeStake = await mc.balanceOf(user1.address);
          await protocol.connect(user1).stakeLiquidity(7);
          const balAfterStake = await mc.balanceOf(user1.address);
          
          // Stake costs 150 MC. Refund +1 MC. Net = -149 MC.
          expect(balBeforeStake - balAfterStake).to.equal(ethers.parseEther("149"));
      });
  });
});
