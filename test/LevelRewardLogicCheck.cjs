const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("JinbaoProtocol Level Reward Logic Check", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, marketing, treasury, lpInjection, buyback;
  let u1, u2, u3, u4, u5, u6;

  // Constants
  const T100 = ethers.parseEther("100");
  const T1000 = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, marketing, treasury, lpInjection, buyback, u1, u2, u3, u4, u5, u6] = await ethers.getSigners();

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

    // Fund Users
    for (const u of [u1, u2, u3, u4, u5, u6]) {
        await mc.mint(u.address, ethers.parseEther("100000"));
        await mc.connect(u).approve(await protocol.getAddress(), ethers.MaxUint256);
    }

    // Build Chain: u1 <- u2 <- u3 <- u4 <- u5 <- u6
    await protocol.connect(u2).bindReferrer(u1.address);
    await protocol.connect(u3).bindReferrer(u2.address);
    await protocol.connect(u4).bindReferrer(u3.address);
    await protocol.connect(u5).bindReferrer(u4.address);
    await protocol.connect(u6).bindReferrer(u5.address);
  });

  // Helper to activate user
  const activate = async (user, ticketAmount) => {
      await protocol.connect(user).buyTicket(ticketAmount);
      // Stake 1.6x
      await protocol.connect(user).stakeLiquidity(ticketAmount * 160n / 100n, 7);
  };

  it("Test 1: Standard Differential Calculation (Normal Case)", async function () {
    // Setup Levels
    // u1: Level 3 (15%) - 100 directs
    // u2: Level 2 (10%) - 30 directs
    // u3: Level 1 (5%)  - 10 directs
    // u4: Level 0 (0%)  - 0 directs
    // u5: Buyer

    // Activate Uplines with 1000 MC Ticket
    await activate(u1, T1000);
    await activate(u2, T1000);
    await activate(u3, T1000);
    await activate(u4, T1000);

    // Set Stats
    await protocol.adminSetUserStats(u1.address, 100, 0, 0, 0);
    await protocol.adminSetUserStats(u2.address, 30, 0, 0, 0);
    await protocol.adminSetUserStats(u3.address, 10, 0, 0, 0);
    await protocol.adminSetUserStats(u4.address, 0, 0, 0, 0);

    // Record initial balances
    const b1_start = await mc.balanceOf(u1.address);
    const b2_start = await mc.balanceOf(u2.address);
    const b3_start = await mc.balanceOf(u3.address);
    const b4_start = await mc.balanceOf(u4.address);

    // u5 buys 1000 MC ticket
    await protocol.connect(u5).buyTicket(T1000);

    // 1. Check Pending Rewards (Balances should not change yet for non-direct uplines)
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start);
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start);
    expect(await mc.balanceOf(u3.address)).to.equal(b3_start);
    // u4 gets Direct Reward immediately
    expect(await mc.balanceOf(u4.address)).to.equal(b4_start + ethers.parseEther("250"));

    // u5 stakes and redeems to trigger release
    await protocol.connect(u5).stakeLiquidity(T1000 * 160n / 100n, 7);
    await time.increase(8 * 24 * 3600); // Wait 8 days
    await protocol.connect(u5).claimRewards();
    await protocol.connect(u5).redeem();

    // 2. Check Released Rewards
    // u4 (Level 0): 0% + 25% Direct Reward = 250 MC
    // u3 (Level 1): 5% of 1000 = 50 MC
    // u2 (Level 2): (10% - 5%) = 5% of 1000 = 50 MC
    // u1 (Level 3): (15% - 10%) = 5% of 1000 = 50 MC
    
    expect(await mc.balanceOf(u4.address)).to.equal(b4_start + ethers.parseEther("250")); // Direct Reward
    expect(await mc.balanceOf(u3.address)).to.equal(b3_start + ethers.parseEther("50"));
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start + ethers.parseEther("50"));
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start + ethers.parseEther("50"));
  });

  it("Test 2: Burn Mechanism (Base Amount Limit)", async function () {
    // u1: Level 3 (15%) - Ticket 100 MC
    // u2: Level 0 (0%)  - Ticket 1000 MC
    // u3: Buyer         - Ticket 1000 MC

    await activate(u1, T100); // Small ticket
    await activate(u2, T1000); // Big ticket but no level

    await protocol.adminSetUserStats(u1.address, 100, 0, 0, 0);
    await protocol.adminSetUserStats(u2.address, 0, 0, 0, 0);

    const b1_start = await mc.balanceOf(u1.address);

    // u3 buys 1000 MC
    await protocol.connect(u3).buyTicket(T1000);
    await protocol.connect(u3).stakeLiquidity(T1000 * 160n / 100n, 7);
    await time.increase(8 * 24 * 3600);
    await protocol.connect(u3).claimRewards();
    await protocol.connect(u3).redeem();

    // Expected:
    // u2: 0%
    // u1: 15% - 0% = 15%. 
    // But u1 ticket is 100, u3 is 1000. Base = min(100, 1000) = 100.
    // Reward = 100 * 15% = 15 MC.
    
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start + ethers.parseEther("15"));
  });

  it("Test 3: Level Skip (Compression)", async function () {
    // u1: Level 3 (15%)
    // u2: Level 0 (0%) - Skipped
    // u3: Level 1 (5%)
    // u4: Buyer

    await activate(u1, T1000);
    await activate(u2, T1000);
    await activate(u3, T1000);

    await protocol.adminSetUserStats(u1.address, 100, 0, 0, 0);
    await protocol.adminSetUserStats(u2.address, 0, 0, 0, 0);
    await protocol.adminSetUserStats(u3.address, 10, 0, 0, 0);

    const b1_start = await mc.balanceOf(u1.address);
    const b2_start = await mc.balanceOf(u2.address);
    const b3_start = await mc.balanceOf(u3.address);

    await protocol.connect(u4).buyTicket(T1000);
    await protocol.connect(u4).stakeLiquidity(T1000 * 160n / 100n, 7);
    await time.increase(8 * 24 * 3600);
    await protocol.connect(u4).claimRewards();
    await protocol.connect(u4).redeem();

    // Expected:
    // u3: 5% of 1000 = 50 MC (Level Reward)
    // u3: 25% of 1000 = 250 MC (Direct Reward) -> Total +300
    // u2: Level 0, 0% < 5%, No reward. previousPercent remains 5%.
    // u1: Level 3 (15%), 15% > 5%. Diff = 10%. Reward = 10% of 1000 = 100 MC.

    expect(await mc.balanceOf(u3.address)).to.equal(b3_start + ethers.parseEther("300"));
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start);
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start + ethers.parseEther("100"));
  });
});
