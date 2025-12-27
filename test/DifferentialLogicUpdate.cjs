const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("JinbaoProtocol Logic Update Check", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, marketing, treasury, lpInjection, buyback;
  let u1, u2, u3, u4;

  const T1000 = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, marketing, treasury, lpInjection, buyback, u1, u2, u3, u4] = await ethers.getSigners();

    MockMC = await ethers.getContractFactory("MockMC");
    mc = await MockMC.deploy();
    await mc.waitForDeployment();

    JBC = await ethers.getContractFactory("JBC");
    jbc = await JBC.deploy(owner.address);
    await jbc.waitForDeployment();

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
    for (const u of [u1, u2, u3, u4]) {
        await mc.mint(u.address, ethers.parseEther("100000"));
        await mc.connect(u).approve(await protocol.getAddress(), ethers.MaxUint256);
    }

    // Chain: U1 <- U2 <- U3 <- U4
    await protocol.connect(u2).bindReferrer(u1.address);
    await protocol.connect(u3).bindReferrer(u2.address);
    await protocol.connect(u4).bindReferrer(u3.address);

    // Set Level Configs (Descending Order!)
    // V3: 3 directs, 15%
    // V2: 2 directs, 10%
    // V1: 1 direct, 5%
    await protocol.setLevelConfigs([
        { minDirects: 3, level: 3, percent: 15 },
        { minDirects: 2, level: 2, percent: 10 },
        { minDirects: 1, level: 1, percent: 5 }
    ]);

    // Activate U1, U2, U3 (Buy Ticket + Stake)
    const activate = async (user) => {
        await protocol.connect(user).buyTicket(T1000);
        await protocol.connect(user).stakeLiquidity(T1000 * 150n / 100n, 7);
    };
    await activate(u1);
    await activate(u2);
    await activate(u3);

    // Set Directs Count for Differential Levels
    await protocol.adminSetUserStats(u3.address, 1, 0, 0, 0); // V1
    await protocol.adminSetUserStats(u2.address, 2, 0, 0, 0); // V2
    await protocol.adminSetUserStats(u1.address, 3, 0, 0, 0); // V3
  });

  it("Ticket Purchase should trigger Fixed Level Reward", async function () {
    const b3_start = await mc.balanceOf(u3.address);
    const b2_start = await mc.balanceOf(u2.address);
    const b1_start = await mc.balanceOf(u1.address);

    // U4 Buys Ticket
    await protocol.connect(u4).buyTicket(T1000);

    // U3 (Direct): 25% (250) + 5% Fixed (50) = 300
    // U2 (2nd): 5% Fixed (50)
    // U1 (3rd): 5% Fixed (50)
    
    expect(await mc.balanceOf(u3.address)).to.equal(b3_start + ethers.parseEther("300"));
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start + ethers.parseEther("50"));
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start + ethers.parseEther("50"));
  });

  it("Liquidity Staking should trigger Differential Reward (Pending)", async function () {
    // U4 Buys Ticket first (required to stake)
    await protocol.connect(u4).buyTicket(T1000);
    
    const b3_start = await mc.balanceOf(u3.address);
    const b2_start = await mc.balanceOf(u2.address);
    const b1_start = await mc.balanceOf(u1.address);

    // U4 Stakes Liquidity
    const stakeAmount = ethers.parseEther("1500");
    const tx = await protocol.connect(u4).stakeLiquidity(stakeAmount, 7);
    const receipt = await tx.wait();
    
    // Check Events
    // Event signature: DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount)
    // We can filter logs
    const topic = protocol.interface.getEvent("DifferentialRewardRecorded").topicHash;
    const logs = receipt.logs.filter(x => x.topics[0] === topic);
    console.log("DifferentialRewardRecorded events:", logs.length);
    for(const log of logs) {
        const parsed = protocol.interface.parseLog(log);
        console.log(`Recorded: Upline ${parsed.args[1]} Amount ${ethers.formatEther(parsed.args[2])}`);
    }

    // Check No Immediate Payout
    expect(await mc.balanceOf(u3.address)).to.equal(b3_start);
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start);
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start);

    // Fast Forward 7 days + 1 second
    await time.increase(7 * 24 * 3600 + 1);

    // U4 Redeems
    await protocol.connect(u4).redeem();

    // Check Payouts
    // Base Amount for Differential is Stake Amount (1500)
    // Capped by Upline Ticket Amount?
    // U1, U2, U3 have T1000.
    // So Base Amount = min(1500, 1000) = 1000.
    
    // U3 (V1): 5% of 1000 = 50
    // U2 (V2): (10% - 5%) of 1000 = 50
    // U1 (V3): (15% - 10%) of 1000 = 50
    expect(await mc.balanceOf(u3.address)).to.equal(b3_start + ethers.parseEther("50"));
    expect(await mc.balanceOf(u2.address)).to.equal(b2_start + ethers.parseEther("50"));
    expect(await mc.balanceOf(u1.address)).to.equal(b1_start + ethers.parseEther("50"));
  });
});
