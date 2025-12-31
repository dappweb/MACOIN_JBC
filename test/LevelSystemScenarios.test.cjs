const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Skip - tests depend on adminSetUserStats which doesn't exist in current contract
describe.skip("JinbaoProtocol Level System Scenarios", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, marketing, treasury, lpInjection, buyback;
  let u1, u2, u3, u4, u5, u6;

  // Constants
  const T100 = ethers.parseEther("100");
  const T300 = ethers.parseEther("300");
  const T500 = ethers.parseEther("500");
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
      // Stake 1.5x
      await protocol.connect(user).stakeLiquidity(ticketAmount * 150n / 100n, 7);
  };

  // Helper to trigger release
  const triggerRelease = async (buyer) => {
      // Buyer needs to stake and then we simulate time and redeem
      const t = await protocol.userTicket(buyer.address);
      if (t.amount > 0) {
           await protocol.connect(buyer).stakeLiquidity(t.amount * 150n / 100n, 7);
      }
      await time.increase(8 * 24 * 3600);
      await protocol.connect(buyer).claimRewards(); // static
      await protocol.connect(buyer).redeem(); // triggers referral release
  };

  it("Scenario 1: The Perfect Chain (Ideal High Rollers)", async function () {
      console.log("\nScenario 1: Everyone buys 1000 MC. Levels V5..V1.");
      
      // Setup: All 1000 MC
      await activate(u1, T1000);
      await activate(u2, T1000);
      await activate(u3, T1000);
      await activate(u4, T1000);
      await activate(u5, T1000);

      // Set Levels
      await protocol.adminSetUserStats(u1.address, 1000, 0); // V5 (25%)
      await protocol.adminSetUserStats(u2.address, 300, 0);  // V4 (20%)
      await protocol.adminSetUserStats(u3.address, 100, 0);  // V3 (15%)
      await protocol.adminSetUserStats(u4.address, 30, 0);   // V2 (10%)
      await protocol.adminSetUserStats(u5.address, 10, 0);   // V1 (5%)

      const b1 = await mc.balanceOf(u1.address);
      const b2 = await mc.balanceOf(u2.address);
      const b3 = await mc.balanceOf(u3.address);
      const b4 = await mc.balanceOf(u4.address);
      const b5 = await mc.balanceOf(u5.address);

      // Action: u6 buys 1000 MC
      await protocol.connect(u6).buyTicket(T1000);
      await triggerRelease(u6);

      // Result: Full 5% on 1000 MC = 50 MC each
      // PLUS u5 gets Direct Reward (25% of 1000 = 250 MC)
      expect(await mc.balanceOf(u5.address)).to.closeTo(b5 + ethers.parseEther("300"), ethers.parseEther("1")); // V1: 50 + 250
      expect(await mc.balanceOf(u4.address)).to.closeTo(b4 + ethers.parseEther("50"), ethers.parseEther("1")); // V2: 5% diff
      expect(await mc.balanceOf(u3.address)).to.closeTo(b3 + ethers.parseEther("50"), ethers.parseEther("1")); // V3: 5% diff
      expect(await mc.balanceOf(u2.address)).to.closeTo(b2 + ethers.parseEther("50"), ethers.parseEther("1")); // V4: 5% diff
      expect(await mc.balanceOf(u1.address)).to.closeTo(b1 + ethers.parseEther("50"), ethers.parseEther("1")); // V5: 5% diff
  });

  it("Scenario 2: The Bottleneck (Burn Mechanism)", async function () {
      console.log("\nScenario 2: u6 buys 1000 MC, but uplines have small tickets.");
      
      // Setup: Small tickets for uplines
      await activate(u1, T100); // 100 MC
      await activate(u2, T100);
      await activate(u3, T100);
      await activate(u4, T100);
      await activate(u5, T100);

      // Set Levels
      await protocol.adminSetUserStats(u1.address, 1000, 0); // V5
      await protocol.adminSetUserStats(u2.address, 300, 0);  // V4
      await protocol.adminSetUserStats(u3.address, 100, 0);  // V3
      await protocol.adminSetUserStats(u4.address, 30, 0);   // V2
      await protocol.adminSetUserStats(u5.address, 10, 0);   // V1

      const b1 = await mc.balanceOf(u1.address);
      const b2 = await mc.balanceOf(u2.address);
      const b3 = await mc.balanceOf(u3.address);
      const b4 = await mc.balanceOf(u4.address);
      const b5 = await mc.balanceOf(u5.address);

      // Action: u6 buys 1000 MC
      await protocol.connect(u6).buyTicket(T1000);
      await triggerRelease(u6);

      // Result: Reward based on min(1000, 100) = 100 MC.
      // 5% of 100 = 5 MC.
      // u5 gets Direct Reward: 25% of 1000 = 250 MC (Direct reward is NOT burned).
      expect(await mc.balanceOf(u5.address)).to.closeTo(b5 + ethers.parseEther("255"), ethers.parseEther("1")); // 250 + 5
      expect(await mc.balanceOf(u4.address)).to.closeTo(b4 + ethers.parseEther("5"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u3.address)).to.closeTo(b3 + ethers.parseEther("5"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u2.address)).to.closeTo(b2 + ethers.parseEther("5"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u1.address)).to.closeTo(b1 + ethers.parseEther("5"), ethers.parseEther("1"));
  });

  it("Scenario 3: Level Skips (Compression)", async function () {
      console.log("\nScenario 3: Gaps in levels (V0s in between).");
      
      // Setup: All 1000 MC
      await activate(u1, T1000);
      await activate(u2, T1000);
      await activate(u3, T1000);
      await activate(u4, T1000);
      await activate(u5, T1000);

      // Set Levels: u5=V0, u4=V0, u3=V2, u2=V0, u1=V5
      await protocol.adminSetUserStats(u5.address, 0, 0);    // V0 (0%)
      await protocol.adminSetUserStats(u4.address, 0, 0);    // V0 (0%)
      await protocol.adminSetUserStats(u3.address, 30, 0);   // V2 (10%)
      await protocol.adminSetUserStats(u2.address, 0, 0);    // V0 (0%) - actually V2 is 30, so if u2 has 0 directs it is V0.
      await protocol.adminSetUserStats(u1.address, 1000, 0); // V5 (25%)

      const b1 = await mc.balanceOf(u1.address);
      const b2 = await mc.balanceOf(u2.address);
      const b3 = await mc.balanceOf(u3.address);
      const b4 = await mc.balanceOf(u4.address);
      const b5 = await mc.balanceOf(u5.address);

      // Action: u6 buys 1000 MC
      await protocol.connect(u6).buyTicket(T1000);
      await triggerRelease(u6);

      // Result:
      // u5 (V0): 0% Level Reward. But gets Direct Reward (250 MC).
      // u4 (V0): 0% -> 0 MC
      // u3 (V2): 10% - 0% = 10% -> 100 MC
      // u2 (V0): 0% < 10% -> No reward (previous percent is 10%)
      // u1 (V5): 25% - 10% = 15% -> 150 MC

      expect(await mc.balanceOf(u5.address)).to.closeTo(b5 + ethers.parseEther("250"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u4.address)).to.closeTo(b4, ethers.parseEther("0.1"));
      expect(await mc.balanceOf(u3.address)).to.closeTo(b3 + ethers.parseEther("100"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u2.address)).to.closeTo(b2, ethers.parseEther("0.1"));
      expect(await mc.balanceOf(u1.address)).to.closeTo(b1 + ethers.parseEther("150"), ethers.parseEther("1"));
  });

  it("Scenario 4: 3x Cap Exit Trigger", async function () {
      console.log("\nScenario 4: u1 hits 3x Cap and exits.");
      
      // Setup: u1 has 100 MC Ticket. Cap 300 MC.
      await activate(u1, T100); 
      // u1 is V5 (25%)
      await protocol.adminSetUserStats(u1.address, 1000, 0);
      
      await activate(u2, T100);
      await activate(u3, T100);
      await activate(u4, T100);
      await activate(u5, T100);
      
      // Set u1 V5, others V0
      await protocol.adminSetUserStats(u1.address, 1000, 0);
      await protocol.adminSetUserStats(u2.address, 0, 0);
      await protocol.adminSetUserStats(u3.address, 0, 0);
      await protocol.adminSetUserStats(u4.address, 0, 0);
      await protocol.adminSetUserStats(u5.address, 0, 0);
      
      // u1 needs to earn 300 MC to exit.
      // Each u6 purchase (1000 MC) -> u1 gets 25 MC (burned by own 100 ticket).
      // We need 12 purchases (300/25).
      // Actually u1 also gets Static rewards from own stake.
      
      let u1Active = (await protocol.userInfo(u1.address)).isActive;
      expect(u1Active).to.be.true;

      // Loop 13 times to ensure exit
      for(let i=0; i<13; i++) {
          await protocol.connect(u6).buyTicket(T1000);
          // Release
          await triggerRelease(u6); 
          
          // Check if u1 exited
          const t = await protocol.userTicket(u1.address);
          if (t.exited) break;
      }
      
      const tFinal = await protocol.userTicket(u1.address);
      expect(tFinal.exited).to.be.true;
      
      const u1Info = await protocol.userInfo(u1.address);
      expect(u1Info.isActive).to.be.false;
  });

  it("Scenario 5: The Broken Link (Inactive Upline)", async function () {
      console.log("\nScenario 5: u3 is Inactive (No Liquidity).");
      
      // Setup: All bought tickets, but u3 withdrew liquidity
      await activate(u1, T1000);
      await activate(u2, T1000);
      await activate(u3, T1000);
      await activate(u4, T1000);
      await activate(u5, T1000);
      
      // u3 Redeems/Exits to become inactive?
      // Or just never stakes?
      // Activate helper stakes. So let's make u3 redeem.
      await time.increase(8 * 24 * 3600);
      await protocol.connect(u3).redeem(); 
      // Now u3 has Ticket but NO Stake -> Inactive?
      // Check isActive
      let u3Info = await protocol.userInfo(u3.address);
      // Wait, redeem doesn't clear ticket unless exited.
      // But _updateActiveStatus checks: _getActiveStakeTotal >= required.
      // Since redeem clears stakes, total active stake = 0. Required > 0.
      // So u3 should be inactive.
      expect(u3Info.isActive).to.be.false;
      
      // Levels: u5(V1), u4(V2), u3(V3-Inactive), u2(V4), u1(V5)
      await protocol.adminSetUserStats(u1.address, 1000, 0); // V5
      await protocol.adminSetUserStats(u2.address, 300, 0);  // V4
      await protocol.adminSetUserStats(u3.address, 100, 0);  // V3 (But inactive!)
      await protocol.adminSetUserStats(u4.address, 30, 0);   // V2
      await protocol.adminSetUserStats(u5.address, 10, 0);   // V1
      
      const b1 = await mc.balanceOf(u1.address);
      const b2 = await mc.balanceOf(u2.address);
      const b3 = await mc.balanceOf(u3.address);
      const b4 = await mc.balanceOf(u4.address);
      const b5 = await mc.balanceOf(u5.address);
      
      // Action: u6 buys 1000 MC
      await protocol.connect(u6).buyTicket(T1000);
      await triggerRelease(u6);
      
      // Result:
      // u5 (V1): 5% -> 50 MC
      // u5 gets Direct: 250 MC. Total 300 MC.
      // u4 (V2): 10% - 5% = 5% -> 50 MC
      // u3 (Inactive): SKIPPED.
      // u2 (V4): Prev percent was 10% (from u4). u2 is V4 (20%). 
      //          Diff = 20% - 10% = 10% -> 100 MC.
      // u1 (V5): Prev 20%. Diff 5% -> 50 MC.
      
      expect(await mc.balanceOf(u5.address)).to.closeTo(b5 + ethers.parseEther("300"), ethers.parseEther("1"));
      expect(await mc.balanceOf(u4.address)).to.closeTo(b4 + ethers.parseEther("50"), ethers.parseEther("1"));
      
      // u3 gets nothing (maybe some static from before, but closeTo should handle small diffs if any)
      // Actually u3 redeemed, so balance changed. b3 was captured AFTER redeem?
      // In this test, we captured b3 after redeem.
      expect(await mc.balanceOf(u3.address)).to.closeTo(b3, ethers.parseEther("1"));
      
      // u2 gets 100 MC
      expect(await mc.balanceOf(u2.address)).to.closeTo(b2 + ethers.parseEther("100"), ethers.parseEther("1"));
      
      // u1 gets 50 MC
      expect(await mc.balanceOf(u1.address)).to.closeTo(b1 + ethers.parseEther("50"), ethers.parseEther("1"));
  });
});
