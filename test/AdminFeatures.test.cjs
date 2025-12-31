const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("JinbaoProtocol Admin Features", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, user1, marketing, treasury, lpInjection, buyback;

  beforeEach(async function () {
    [owner, user1, marketing, treasury, lpInjection, buyback] = await ethers.getSigners();

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
    protocol = await upgrades.deployProxy(
      Protocol,
      [
        await mc.getAddress(),
        await jbc.getAddress(),
        marketing.address,
        treasury.address,
        lpInjection.address,
        buyback.address,
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await protocol.waitForDeployment();

    // Fund Protocol with Swap Liquidity (via addLiquidity)
    // First approve
    await mc.approve(await protocol.getAddress(), ethers.MaxUint256);
    await jbc.approve(await protocol.getAddress(), ethers.MaxUint256);

    // Add 1000 MC and 1000 JBC
    await protocol.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("1000"));
  });

  describe("Admin Withdraw / Liquidity Management", function () {
    it("Should allow admin to withdraw MC and JBC from reserves", async function () {
      const withdrawAmount = ethers.parseEther("100");
      const initialMcBal = await mc.balanceOf(marketing.address);
      const initialJbcBal = await jbc.balanceOf(treasury.address);

      // Use withdrawSwapReserves(toMC, amountMC, toJBC, amountJBC)
      await protocol.withdrawSwapReserves(
        marketing.address, withdrawAmount,  // MC withdrawal
        treasury.address, withdrawAmount    // JBC withdrawal
      );

      expect(await mc.balanceOf(marketing.address)).to.equal(initialMcBal + withdrawAmount);
      expect(await jbc.balanceOf(treasury.address)).to.equal(initialJbcBal + withdrawAmount);
      expect(await protocol.swapReserveMC()).to.equal(ethers.parseEther("900"));
      expect(await protocol.swapReserveJBC()).to.equal(ethers.parseEther("900"));
    });

    it("Should fail if admin tries to withdraw more than reserves", async function () {
      const excessAmount = ethers.parseEther("2000"); // Only 1000 in reserve
      await expect(
        protocol.withdrawSwapReserves(marketing.address, excessAmount, treasury.address, 0)
      ).to.be.reverted;
    });
  });

  describe("Daily Burn", function () {
      it("Should fail if called too early", async function () {
          // Uses custom error 'ActionTooEarly()' 
          await expect(protocol.dailyBurn()).to.be.revertedWithCustomError(protocol, "ActionTooEarly");
      });

      it("Should burn 1% of JBC reserves after 24 hours", async function () {
          await time.increase(24 * 60 * 60 + 1); // +1 day

          const initialReserve = await protocol.swapReserveJBC(); // 1000
          const expectedBurn = initialReserve / 100n; // 10

          await expect(protocol.dailyBurn())
            .to.emit(protocol, "BuybackAndBurn")
            .withArgs(0, expectedBurn);

          expect(await protocol.swapReserveJBC()).to.equal(initialReserve - expectedBurn);
      });
  });

  describe("Ticket Expiration Logic (Lazy)", function () {
      it("Should expire ticket on new purchase if time passed", async function () {
          // User buys ticket
          await mc.mint(user1.address, ethers.parseEther("1000"));
          await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
          
          await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
          
          let ticket = await protocol.userTicket(user1.address);
          expect(ticket.amount).to.equal(ethers.parseEther("100"));

          // Fast forward 72h + 1s
          // Default duration is 72h
          await time.increase(72 * 60 * 60 + 1);

          // User buys new ticket
          // This should trigger _expireTicketIfNeeded, clear old ticket, and buy new one
          await protocol.connect(user1).buyTicket(ethers.parseEther("300"));

          ticket = await protocol.userTicket(user1.address);
          expect(ticket.amount).to.equal(ethers.parseEther("300")); // Should be new amount, not 100+300
          
          // If it didn't expire, it would be 400 (accumulation)
          // But since it expired, it reset to 0 then added 300.
      });
  });
});
