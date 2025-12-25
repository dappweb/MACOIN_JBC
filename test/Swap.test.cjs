const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Jinbao Protocol Swap System", function () {
  let JBC, jbc;
  let MockMC, mc;
  let Protocol, protocol;
  let owner, user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

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
        owner.address,
        owner.address,
        owner.address,
        owner.address,
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await protocol.waitForDeployment();

    // Setup Permissions
    await jbc.setProtocol(await protocol.getAddress());
    
    const liquidityMC = ethers.parseEther("1000000");
    const liquidityJBC = ethers.parseEther("1000000");
    await mc.approve(await protocol.getAddress(), liquidityMC);
    await jbc.approve(await protocol.getAddress(), liquidityJBC);
    await protocol.addLiquidity(liquidityMC, liquidityJBC);

    // Fund User
    await mc.mint(user1.address, ethers.parseEther("10000"));
    await jbc.transfer(user1.address, ethers.parseEther("10000"));
  });

  it("Should swap MC to JBC with 50% tax", async function () {
      // User has MC, wants JBC
      const swapAmount = ethers.parseEther("100");
      
      // Approve MC
      await mc.connect(user1).approve(await protocol.getAddress(), swapAmount);
      
      const initialMcUser = await mc.balanceOf(user1.address);
      const initialJbcUser = await jbc.balanceOf(user1.address);
      const initialJbcProtocol = await jbc.balanceOf(await protocol.getAddress());
      const reserveMC = await protocol.swapReserveMC();
      const reserveJBC = await protocol.swapReserveJBC();
      const jbcOutput = await protocol.getAmountOut(swapAmount, reserveMC, reserveJBC);
      const tax = (jbcOutput * 50n) / 100n;
      const expectedUserOut = jbcOutput - tax;
      
      await protocol.connect(user1).swapMCToJBC(swapAmount);
      
      const finalMcUser = await mc.balanceOf(user1.address);
      const finalJbcUser = await jbc.balanceOf(user1.address);
      const finalJbcProtocol = await jbc.balanceOf(await protocol.getAddress());

      // Check MC Balance: -100
      expect(initialMcUser - finalMcUser).to.equal(swapAmount);
      
      expect(finalJbcUser - initialJbcUser).to.equal(expectedUserOut);
      
      expect(initialJbcProtocol - finalJbcProtocol).to.equal(jbcOutput);
  });

  it("Should swap JBC to MC with 25% tax", async function () {
      // User has JBC, wants MC
      const swapAmount = ethers.parseEther("100");
      
      // Approve JBC
      await jbc.connect(user1).approve(await protocol.getAddress(), swapAmount);
      
      const initialMcUser = await mc.balanceOf(user1.address);
      const initialJbcUser = await jbc.balanceOf(user1.address);
      const initialJbcProtocol = await jbc.balanceOf(await protocol.getAddress());
      const initialMcProtocol = await mc.balanceOf(await protocol.getAddress());
      const reserveMC = await protocol.swapReserveMC();
      const reserveJBC = await protocol.swapReserveJBC();
      const tax = (swapAmount * 25n) / 100n;
      const amountToSwap = swapAmount - tax;
      const expectedMcOut = await protocol.getAmountOut(amountToSwap, reserveJBC, reserveMC);
      
      await protocol.connect(user1).swapJBCToMC(swapAmount);
      
      const finalMcUser = await mc.balanceOf(user1.address);
      const finalJbcUser = await jbc.balanceOf(user1.address);
      const finalJbcProtocol = await jbc.balanceOf(await protocol.getAddress());
      const finalMcProtocol = await mc.balanceOf(await protocol.getAddress());

      // Check JBC Balance: -100
      expect(initialJbcUser - finalJbcUser).to.equal(swapAmount);
      
      expect(finalMcUser - initialMcUser).to.equal(expectedMcOut);
      
      // Check Protocol JBC Balance: +75 (100 in, 25 burned)
      // Actually: 100 JBC came in. 25 burned. Net +75.
      expect(finalJbcProtocol - initialJbcProtocol).to.equal(amountToSwap);
      
      // Check Protocol MC Balance: -75
      expect(initialMcProtocol - finalMcProtocol).to.equal(expectedMcOut);
  });
});
