const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Admin Functions Integration Test", function () {
    let protocol;
    let mcToken;
    let jbcToken;
    let owner, user1;
    
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
    });

    it("Should update redemption fee percent using setRedemptionFeePercent", async function () {
        // Default is 1%
        expect(await protocol.redemptionFeePercent()).to.equal(1);
        
        // Update to 5%
        await protocol.setRedemptionFeePercent(5);
        expect(await protocol.redemptionFeePercent()).to.equal(5);
    });

    it("Should update operational status using setOperationalStatus", async function () {
        // Default is true, true
        expect(await protocol.liquidityEnabled()).to.be.true;
        expect(await protocol.redeemEnabled()).to.be.true;
        
        // Toggle liquidity off, redeem on
        await protocol.setOperationalStatus(false, true);
        expect(await protocol.liquidityEnabled()).to.be.false;
        expect(await protocol.redeemEnabled()).to.be.true;
        
        // Toggle both off
        await protocol.setOperationalStatus(false, false);
        expect(await protocol.liquidityEnabled()).to.be.false;
        expect(await protocol.redeemEnabled()).to.be.false;
    });

    it("Should update wallets using setWallets", async function () {
        const newMarketing = user1.address;
        const newTreasury = user1.address;
        const newLp = user1.address;
        const newBuyback = user1.address;
        
        await protocol.setWallets(newMarketing, newTreasury, newLp, newBuyback);
        
        expect(await protocol.marketingWallet()).to.equal(newMarketing);
        expect(await protocol.treasuryWallet()).to.equal(newTreasury);
        expect(await protocol.lpInjectionWallet()).to.equal(newLp);
        expect(await protocol.buybackWallet()).to.equal(newBuyback);
    });

    it("Should update distribution config using setDistributionConfig", async function () {
        // direct, level, marketing, buyback, lp, treasury
        await protocol.setDistributionConfig(10, 10, 10, 10, 30, 30);
        
        expect(await protocol.directRewardPercent()).to.equal(10);
        expect(await protocol.levelRewardPercent()).to.equal(10);
        expect(await protocol.marketingPercent()).to.equal(10);
        expect(await protocol.buybackPercent()).to.equal(10);
        expect(await protocol.lpInjectionPercent()).to.equal(30);
        expect(await protocol.treasuryPercent()).to.equal(30);
    });

    it("Should update swap taxes using setSwapTaxes", async function () {
        await protocol.setSwapTaxes(30, 10);
        
        expect(await protocol.swapBuyTax()).to.equal(30);
        expect(await protocol.swapSellTax()).to.equal(10);
    });

    it("Should allow owner to add liquidity", async function () {
        const amount = ethers.parseEther("1000");
        
        // Owner needs MC tokens
        await mcToken.mint(owner.address, amount);
        await mcToken.approve(await protocol.getAddress(), amount);
        
        // Add MC liquidity
        await protocol.addLiquidity(amount, 0);
        
        expect(await protocol.swapReserveMC()).to.equal(amount);
    });

    it("Should fail if non-owner tries to update settings", async function () {
        await expect(
            protocol.connect(user1).setRedemptionFeePercent(5)
        ).to.be.revertedWithCustomError(protocol, "OwnableUnauthorizedAccount");
        
        await expect(
            protocol.connect(user1).setOperationalStatus(false, false)
        ).to.be.revertedWithCustomError(protocol, "OwnableUnauthorizedAccount");
    });
});
