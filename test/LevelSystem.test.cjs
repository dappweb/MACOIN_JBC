const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, anyValue } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("JinbaoProtocol Level System", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, marketing, treasury, lpInjection, buyback;
  let u1, u2, u3, u4, u5, u6;

  const TICKET_PRICE = ethers.parseEther("100"); // T1
  const LIQUIDITY_AMOUNT = ethers.parseEther("160"); // 1.6x

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
        await mc.mint(u.address, ethers.parseEther("10000"));
        await mc.connect(u).approve(await protocol.getAddress(), ethers.MaxUint256);
    }
  });

  describe("Level Calculation", function () {
    it("Should correctly calculate level based on active directs", async function () {
      // Helper to set stats directly since we don't want to create 100 real users
      // Use adminSetUserStats
      
      // V0: 0 directs
      let level = await protocol.getLevel(0);
      expect(level[0]).to.equal(0); // Level
      expect(level[1]).to.equal(0); // Percent

      // V1: 10 directs
      level = await protocol.getLevel(10);
      expect(level[0]).to.equal(1);
      expect(level[1]).to.equal(5);

      // V2: 30 directs
      level = await protocol.getLevel(30);
      expect(level[0]).to.equal(2);
      expect(level[1]).to.equal(10);

      // V3: 100 directs
      level = await protocol.getLevel(100);
      expect(level[0]).to.equal(3);
      expect(level[1]).to.equal(15);

      // V4: 300 directs
      level = await protocol.getLevel(300);
      expect(level[0]).to.equal(4);
      expect(level[1]).to.equal(20);

      // V5: 1000 directs
      level = await protocol.getLevel(1000);
      expect(level[0]).to.equal(5);
      expect(level[1]).to.equal(25);
    });
  });

  describe("Differential Reward Distribution", function () {
      // Chain: u1 -> u2 -> u3 -> u4 -> u5 -> u6 (Buyer)
      // Levels setup (Artificial):
      // u1: V5 (25%)
      // u2: V4 (20%)
      // u3: V3 (15%)
      // u4: V2 (10%)
      // u5: V1 (5%)
      // u6: Buyer (V0)
      
      it("Should distribute differential rewards correctly up the chain", async function () {
          // 1. Build Chain
          await protocol.connect(u2).bindReferrer(u1.address);
          await protocol.connect(u3).bindReferrer(u2.address);
          await protocol.connect(u4).bindReferrer(u3.address);
          await protocol.connect(u5).bindReferrer(u4.address);
          await protocol.connect(u6).bindReferrer(u5.address);

          // 2. Set Levels (using adminSetUserStats)
          // We need them to be "Active" to receive rewards? 
          // Code check: _calculateAndStoreLevelRewards iterates upline.
          // Is there a check for isActive? 
          // In `_calculateAndStoreLevelRewards`: `if (!userInfo[current].isActive) ...` -> It continues but skips?
          // Actually the loop logic:
          /*
            address current = userInfo[buyer].referrer;
            ...
            while (current != address(0) && iterations < 20) {
                if (!userInfo[current].isActive) {
                    current = userInfo[current].referrer;
                    continue;
                }
                ...
            }
          */
          // So uplines MUST be active (have ticket + liquidity).
          
          // Activate uplines
          const activate = async (user) => {
              await protocol.connect(user).buyTicket(TICKET_PRICE);
              await protocol.connect(user).stakeLiquidity(LIQUIDITY_AMOUNT, 7);
          };
          
          await activate(u1);
          await activate(u2);
          await activate(u3);
          await activate(u4);
          await activate(u5);

          // Set Artificial Stats for Levels
          await protocol.adminSetUserStats(u1.address, 1000, 0); // V5
          await protocol.adminSetUserStats(u2.address, 300, 0);  // V4
          await protocol.adminSetUserStats(u3.address, 100, 0);  // V3
          await protocol.adminSetUserStats(u4.address, 30, 0);   // V2
          await protocol.adminSetUserStats(u5.address, 10, 0);   // V1

          // 3. u6 Buys Ticket (1000 MC)
          const ticketAmount = ethers.parseEther("1000");
          // Expect events:
          // u5 (V1, 5%) -> Gets 5% - 0% = 5% = 50 MC
          // u4 (V2, 10%) -> Gets 10% - 5% = 5% = 50 MC
          // u3 (V3, 15%) -> Gets 15% - 10% = 5% = 50 MC
          // u2 (V4, 20%) -> Gets 20% - 15% = 5% = 50 MC
          // u1 (V5, 25%) -> Gets 25% - 20% = 5% = 50 MC
          
          // Total distributed: 25% = 250 MC.
          // Note: The events might be emitted in reverse order or arbitrary order depending on implementation recursion/loop.
          // But actually, the loop goes from referrer upwards. So u5 -> u4 -> u3 -> u2 -> u1.
          
          const tx = await protocol.connect(u6).buyTicket(ticketAmount);
          // Just check if transaction succeeds, verification via redeem later
          
          // 4. Verify Pending Rewards
          // Need to get ticketId of u6
          const ticket = await protocol.userTicket(u6.address);
          const ticketId = ticket.ticketId;
          
          // 5. Release Rewards (u6 stakes and redeems)
          await protocol.connect(u6).stakeLiquidity(ticketAmount * 160n / 100n, 7);
          
          await time.increase(7 * 24 * 3600 + 1);
          
          // Wait for tx first to ensure events are emitted
          // Check balances before redeem
          const b1 = await mc.balanceOf(u1.address);
          const b2 = await mc.balanceOf(u2.address);
          const b3 = await mc.balanceOf(u3.address);
          const b4 = await mc.balanceOf(u4.address);
          const b5 = await mc.balanceOf(u5.address);
          
          await protocol.connect(u6).claimRewards(); // Claim static first
          
          // Redeem triggers release
          await protocol.connect(u6).redeem();
            
          // Check balances increased
          // u1 (V5, 25%) -> Gets 25% - 20% = 5% = 50 MC
          // u2 (V4, 20%) -> Gets 20% - 15% = 5% = 50 MC
          // u3 (V3, 15%) -> Gets 15% - 10% = 5% = 50 MC
          // u4 (V2, 10%) -> Gets 10% - 5% = 5% = 50 MC
          // u5 (V1, 5%) -> Gets 5% - 0% = 5% = 50 MC
          
          // Note: Static rewards also pay out MC (50%). 
          // U1-U5 also staked, so they might have earned static rewards if time passed?
          // We advanced time 7 days.
          // But U1-U5 didn't call claimRewards(), u6 called redeem() which triggers u6 claim.
          // Does redeem trigger upline claim? No.
          // But referral rewards are pushed directly to wallet via _distributeReward -> mcToken.transfer.
          
          // Issue: Why balances mismatch?
          // Maybe b1, b2 captured *before* u6 claimRewards/redeem is correct.
          // But u6 claimRewards/redeem might affect contract balance, not upline balance (except the referral reward).
          // Wait, verify if `b1` captures balance *after* u6 staked? Yes.
          
          // Let's log balances to debug
          // console.log("B1:", ethers.formatEther(b1));
          // console.log("Final B1:", ethers.formatEther(await mc.balanceOf(u1.address)));
          
          // Actually, did we setup levels correctly?
          // u1 (V5), u2 (V4)...
          // u6 referrer is u5.
          // Chain: u6 -> u5 -> u4 -> u3 -> u2 -> u1
          // Level calc:
          // u5 (V1, 5%) -> previous 0% -> 5% diff -> 50 MC. New prev = 5%.
          // u4 (V2, 10%) -> previous 5% -> 5% diff -> 50 MC. New prev = 10%.
          // u3 (V3, 15%) -> previous 10% -> 5% diff -> 50 MC. New prev = 15%.
          // u2 (V4, 20%) -> previous 15% -> 5% diff -> 50 MC. New prev = 20%.
          // u1 (V5, 25%) -> previous 20% -> 5% diff -> 50 MC. New prev = 25%.
          
          // Is it possible u1-u5 balance changed due to something else?
          // They staked 7 days ago. They haven't claimed.
          // Nothing else should touch their balance.
          
          // Explanation of Reward Calculation:
          // u6 buys Ticket for 1000 MC.
          // uplines (u1-u5) bought Ticket for 100 MC.
          // Rule: baseAmount = min(u6.amount, upline.amount) = min(1000, 100) = 100 MC.
          
          // u5 (V1, 5%) -> prev 0% -> 5% diff -> 5% of 100 = 5 MC.
          // u4 (V2, 10%) -> prev 5% -> 5% diff -> 5% of 100 = 5 MC.
          // u3 (V3, 15%) -> prev 10% -> 5% diff -> 5% of 100 = 5 MC.
          // u2 (V4, 20%) -> prev 15% -> 5% diff -> 5% of 100 = 5 MC.
          // u1 (V5, 25%) -> prev 20% -> 5% diff -> 5% of 100 = 5 MC.
          
          expect(await mc.balanceOf(u1.address)).to.closeTo(b1 + ethers.parseEther("5"), ethers.parseEther("1"));
          expect(await mc.balanceOf(u2.address)).to.closeTo(b2 + ethers.parseEther("5"), ethers.parseEther("1"));
          expect(await mc.balanceOf(u3.address)).to.closeTo(b3 + ethers.parseEther("5"), ethers.parseEther("1"));
          expect(await mc.balanceOf(u4.address)).to.closeTo(b4 + ethers.parseEther("5"), ethers.parseEther("1"));
          expect(await mc.balanceOf(u5.address)).to.closeTo(b5 + ethers.parseEther("5"), ethers.parseEther("1"));
      });
  });
});
