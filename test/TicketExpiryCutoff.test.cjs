const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Ticket Expiry Cutoff Date", function () {
  let protocol, mc, jbc;
  let owner, user1, user2, referrer;

  const HOURS_72 = 72 * 60 * 60;

  beforeEach(async function () {
    [owner, user1, user2, referrer] = await ethers.getSigners();

    // Deploy MC Token
    const MCToken = await ethers.getContractFactory("MockMC");
    mc = await MCToken.deploy();
    await mc.waitForDeployment();

    // Deploy JBC Token
    const JBCToken = await ethers.getContractFactory("JBC");
    jbc = await JBCToken.deploy(owner.address);
    await jbc.waitForDeployment();

    // Deploy Protocol as upgradeable
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    protocol = await upgrades.deployProxy(
      JinbaoProtocol,
      [
        await mc.getAddress(),
        await jbc.getAddress(),
        owner.address,
        owner.address,
        owner.address,
        owner.address,
      ],
      { initializer: "initialize" }
    );
    await protocol.waitForDeployment();

    // Transfer JBC tokens to protocol for rewards
    await jbc.transfer(await protocol.getAddress(), ethers.parseEther("10000000"));

    // Mint MC to users and approve
    await mc.mint(user1.address, ethers.parseEther("10000"));
    await mc.mint(user2.address, ethers.parseEther("10000"));
    await mc.mint(referrer.address, ethers.parseEther("10000"));

    await mc.connect(user1).approve(await protocol.getAddress(), ethers.MaxUint256);
    await mc.connect(user2).approve(await protocol.getAddress(), ethers.MaxUint256);
    await mc.connect(referrer).approve(await protocol.getAddress(), ethers.MaxUint256);

    // Bind referrer
    await protocol.connect(referrer).bindReferrer(owner.address);
    await protocol.connect(user1).bindReferrer(referrer.address);
    await protocol.connect(user2).bindReferrer(referrer.address);
  });

  it("Should have correct default cutoff date", async function () {
    const cutoffDate = await protocol.ticketExpiryCutoffDate();
    const expectedCutoff = 1770595200n; // 2026-02-09 00:00:00 UTC
    expect(cutoffDate).to.equal(expectedCutoff);
    
    console.log("   Default cutoff date:", new Date(Number(cutoffDate) * 1000).toISOString());
  });

  it("Should allow owner to update cutoff date", async function () {
    const currentCutoff = await protocol.ticketExpiryCutoffDate();
    const newCutoffDate = Number(currentCutoff) + 86400; // +1 day
    await protocol.setTicketExpiryCutoffDate(newCutoffDate);
    
    const updated = await protocol.ticketExpiryCutoffDate();
    expect(updated).to.equal(newCutoffDate);
  });

  it("Should NOT expire old tickets (purchased before cutoff)", async function () {
    // Get current block timestamp
    const currentTime = await time.latest();
    
    // Set cutoff to be in the future (e.g., current time + 10 hours)
    const futureCutoff = currentTime + 10 * 60 * 60;
    await protocol.setTicketExpiryCutoffDate(futureCutoff);
    
    // User1 buys ticket now (before future cutoff)
    await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
    
    let ticket = await protocol.userTicket(user1.address);
    expect(ticket.amount).to.equal(ethers.parseEther("100"));
    
    // Fast forward 73 hours (beyond 72-hour limit)
    await time.increase(73 * 60 * 60);
    
    // Try to buy another ticket, which should trigger _expireTicketIfNeeded
    // Since the first ticket was purchased before cutoff, it should NOT expire
    await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
    
    ticket = await protocol.userTicket(user1.address);
    // Ticket should be accumulated, not expired
    expect(ticket.amount).to.equal(ethers.parseEther("200"));
    
    console.log("   ✅ Old ticket (before cutoff) did NOT expire after 73 hours");
  });

  it("Should expire new tickets (purchased on/after cutoff)", async function () {
    // Get current block timestamp
    const currentTime = await time.latest();
    
    // Set cutoff to be now
    await protocol.setTicketExpiryCutoffDate(currentTime);
    
    // User2 buys ticket after cutoff is set
    await protocol.connect(user2).buyTicket(ethers.parseEther("100"));
    
    let ticket = await protocol.userTicket(user2.address);
    expect(ticket.amount).to.equal(ethers.parseEther("100"));
    
    // Fast forward 73 hours (beyond 72-hour limit)
    await time.increase(73 * 60 * 60);
    
    // Try to buy another ticket, which should trigger _expireTicketIfNeeded
    // Since the first ticket was purchased on/after cutoff, it SHOULD expire
    await protocol.connect(user2).buyTicket(ethers.parseEther("300"));
    
    ticket = await protocol.userTicket(user2.address);
    // Old ticket should be expired and cleared, new ticket is 300
    expect(ticket.amount).to.equal(ethers.parseEther("300"));
    
    console.log("   ✅ New ticket (on/after cutoff) DID expire after 73 hours");
  });

  it("Should NOT expire new tickets within 72 hours", async function () {
    // Get current block timestamp
    const currentTime = await time.latest();
    
    // Set cutoff to be now
    await protocol.setTicketExpiryCutoffDate(currentTime);
    
    // User2 buys ticket
    await protocol.connect(user2).buyTicket(ethers.parseEther("100"));
    
    // Fast forward 71 hours (within 72-hour limit)
    await time.increase(71 * 60 * 60);
    
    // Try to buy another ticket
    await protocol.connect(user2).buyTicket(ethers.parseEther("100"));
    
    const ticket = await protocol.userTicket(user2.address);
    // Ticket should be accumulated since it's within 72 hours
    expect(ticket.amount).to.equal(ethers.parseEther("200"));
    
    console.log("   ✅ New ticket within 72 hours did NOT expire");
  });

  it("Should use cutoff logic in stakeLiquidity", async function () {
    // Test with old ticket (before cutoff)
    const currentTime = await time.latest();
    const futureCutoff = currentTime + 10 * 60 * 60;
    await protocol.setTicketExpiryCutoffDate(futureCutoff);
    
    await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
    
    // Fast forward 73 hours
    await time.increase(73 * 60 * 60);
    
    // Try to stake liquidity - should succeed even after 72 hours
    await expect(
      protocol.connect(user1).stakeLiquidity(ethers.parseEther("150"), 7)
    ).to.not.be.reverted;
    
    console.log("   ✅ Old ticket can stake even after 72 hours");
    
    // Test with new ticket (on/after cutoff)
    const newTime = await time.latest();
    await protocol.setTicketExpiryCutoffDate(newTime);
    await protocol.connect(user2).buyTicket(ethers.parseEther("100"));
    
    // Fast forward 73 hours
    await time.increase(73 * 60 * 60);
    
    // Try to stake liquidity - should fail because ticket expired
    await expect(
      protocol.connect(user2).stakeLiquidity(ethers.parseEther("150"), 7)
    ).to.be.reverted;
    
    console.log("   ✅ New ticket cannot stake after 72 hours (expired)");
  });
});
