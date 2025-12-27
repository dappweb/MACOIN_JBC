const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Liquidity Requirement Logic (Based on Max Single Ticket)", function () {
    let protocol;
    let mcToken;
    let jbcToken;
    let owner, user1;
    
    // Constants
    const TICKET_100 = ethers.parseEther("100");
    const TICKET_300 = ethers.parseEther("300");
    const TICKET_500 = ethers.parseEther("500");
    
    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        
        // Deploy MC Token
        const MCToken = await ethers.getContractFactory("MockMC");
        mcToken = await MCToken.deploy();
        await mcToken.waitForDeployment();
        
        // Deploy JBC Token
        const JBCToken = await ethers.getContractFactory("JBC");
        jbcToken = await JBCToken.deploy(owner.address);
        await jbcToken.waitForDeployment();
        
        // Deploy Protocol
        const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
        protocol = await upgrades.deployProxy(JinbaoProtocol, [
            await mcToken.getAddress(),
            await jbcToken.getAddress(),
            owner.address,
            owner.address,
            owner.address,
            owner.address
        ], { 
            initializer: 'initialize',
            kind: 'uups' 
        });
        await protocol.waitForDeployment();
        
        // Setup User1
        await mcToken.transfer(user1.address, ethers.parseEther("10000"));
        await mcToken.connect(user1).approve(await protocol.getAddress(), ethers.parseEther("10000"));
        
        // Bind referrer
        await protocol.connect(user1).bindReferrer(owner.address);
    });
    
    it("Step 1: Buy 100 MC ticket. MaxSingle=100. Liquidity needed=150", async function () {
        await protocol.connect(user1).buyTicket(TICKET_100);
        
        const userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(TICKET_100);
        expect(userInfo.isActive).to.be.false; // No liquidity yet
        
        // Staking less than required should revert with LowLiquidity
        await expect(
            protocol.connect(user1).stakeLiquidity(ethers.parseEther("149"), 7)
        ).to.be.revertedWithCustomError(protocol, "LowLiquidity");
        
        // Stake correct amount
        await protocol.connect(user1).stakeLiquidity(ethers.parseEther("150"), 7);
        const userInfoAfterFullStake = await protocol.userInfo(user1.address);
        expect(userInfoAfterFullStake.isActive).to.be.true;
    });

    it("Step 2: Upgrade to 300 MC ticket (Total 400). MaxSingle=300. Liquidity needed=450", async function () {
        // Initial setup: 100 ticket + 150 liquidity
        await protocol.connect(user1).buyTicket(TICKET_100);
        await protocol.connect(user1).stakeLiquidity(ethers.parseEther("150"), 7);
        expect((await protocol.userInfo(user1.address)).isActive).to.be.true;
        
        // Buy 300 ticket. Total Ticket = 400. Max Single = 300.
        // Required Liquidity = 300 * 1.5 = 450.
        // Current Liquidity = 150.
        // Status should become inactive immediately upon purchase? 
        // Note: buyTicket calls _updateActiveStatus.
        
        await protocol.connect(user1).buyTicket(TICKET_300);
        
        const userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(TICKET_300);
        expect(userInfo.maxTicketAmount).to.equal(ethers.parseEther("400"));
        
        // Should be inactive because 150 < 450
        expect(userInfo.isActive).to.be.false;
        
        // Add 300 liquidity to reach 450
        await protocol.connect(user1).stakeLiquidity(ethers.parseEther("300"), 7);
        expect((await protocol.userInfo(user1.address)).isActive).to.be.true;
    });

    it("Step 3: Add small ticket (100) after big ticket (300). Total 500. MaxSingle stays 300. Liquidity needed stays 450", async function () {
        // Initial setup: 300 ticket + 450 liquidity
        await protocol.connect(user1).buyTicket(TICKET_300);
        await protocol.connect(user1).stakeLiquidity(ethers.parseEther("450"), 7);
        expect((await protocol.userInfo(user1.address)).isActive).to.be.true;
        
        // Buy 100 ticket. Total Ticket = 400. Max Single = 300.
        await protocol.connect(user1).buyTicket(TICKET_100);
        
        const userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(TICKET_300);
        expect(userInfo.maxTicketAmount).to.equal(ethers.parseEther("400"));
        
        // Liquidity Requirement should still be 450 (based on 300).
        // Current Liquidity is 450.
        // Should remain active.
        expect(userInfo.isActive).to.be.true;
        
        // Verify: If we needed based on total (400), we would need 600. 
        // Since we are active with 450, it proves we are using MaxSingle (300).
    });
});
