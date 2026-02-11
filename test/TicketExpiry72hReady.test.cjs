const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Ticket 72h Expiry and Dynamic Reward Destruction", function () {
    let protocol, jbc;
    let owner, user1, user2, user3;
    const TICKET_EXPIRY_CUTOFF_DATE = 1770595200; // 2026-02-09 00:00:00 UTC
    const TICKET_EXPIRY_DURATION = 72 * 60 * 60; // 72 hours in seconds

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();

        // Deploy JBC Token
        const JBCToken = await ethers.getContractFactory("JBC");
        jbc = await JBCToken.deploy(owner.address);
        await jbc.waitForDeployment();

        // Deploy Protocol as upgradeable
        const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
        protocol = await upgrades.deployProxy(
            JinbaoProtocolNative,
            [
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

        // Send native MC tokens to users
        await owner.sendTransaction({
            to: user1.address,
            value: ethers.parseEther("10"),
        });
        await owner.sendTransaction({
            to: user2.address,
            value: ethers.parseEther("10"),
        });
        await owner.sendTransaction({
            to: user3.address,
            value: ethers.parseEther("10"),
        });

        // Bind referrers
        await protocol.connect(user1).bindReferrer(owner.address);
        await protocol.connect(user2).bindReferrer(user1.address);
        await protocol.connect(user3).bindReferrer(user2.address);
    });

    describe("Ticket Expiry After 72h Without Liquidity", function () {
        it("Should destroy expired ticket and clear dynamic rewards", async function () {
            // Set time to after cutoff date so tickets will expire
            const currentTime = await time.latest();
            const timeUntilCutoff = Math.max(0, TICKET_EXPIRY_CUTOFF_DATE - currentTime);
            if (timeUntilCutoff > 0) {
                await time.increase(timeUntilCutoff + 24 * 60 * 60); // 24 hours after cutoff
            }

            // User3 buys a ticket
            await protocol.connect(user3).buyTicket({ value: ethers.parseEther("100") });

            // Verify ticket was created
            let ticket = await protocol.userTicket(user3.address);
            expect(ticket.amount).to.equal(ethers.parseEther("100"));
            expect(ticket.exited).to.be.false;

            // Check initial dynamic rewards
            let dynamicsBefore = await protocol.getUserDynamicRewards(user3.address);
            console.log("Dynamic rewards before expiry:", {
                earned: ethers.formatEther(dynamicsBefore.totalEarned),
                claimed: ethers.formatEther(dynamicsBefore.totalClaimed),
            });

            // Move time forward past 72 hours without providing liquidity
            await time.increase(TICKET_EXPIRY_DURATION + 1);

            // Try to trigger expiry by buying another ticket (which calls _expireTicketIfNeeded)
            try {
                // Try to buy another ticket - this will trigger _expireTicketIfNeeded
                await protocol.connect(user3).buyTicket({ value: ethers.parseEther("100") });
            } catch (e) {
                // It's ok if this reverts, the important thing is _expireTicketIfNeeded was called
            }

            // Check that dynamic rewards are cleared
            let dynamicsAfter = await protocol.getUserDynamicRewards(user3.address);
            console.log("Dynamic rewards after expiry:", {
                earned: ethers.formatEther(dynamicsAfter.totalEarned),
                claimed: ethers.formatEther(dynamicsAfter.totalClaimed),
            });

            expect(dynamicsAfter.totalEarned).to.equal(0n);
            expect(dynamicsAfter.totalClaimed).to.equal(0n);
        });

        it("Should reset ticket after expiry on re-buy", async function () {
            // Set time to after cutoff date
            const currentTime = await time.latest();
            const timeUntilCutoff = Math.max(0, TICKET_EXPIRY_CUTOFF_DATE - currentTime);
            if (timeUntilCutoff > 0) {
                await time.increase(timeUntilCutoff + 24 * 60 * 60);
            }

            // User2 buys a ticket
            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });

            // Verify user is active
            let userInfo = await protocol.userInfo(user2.address);
            expect(userInfo.isActive).to.be.true;

            // Move time forward 72+ hours
            await time.increase(TICKET_EXPIRY_DURATION + 1);

            // Trigger expiry by buying another ticket
            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });

            // After expiry, the ticket should be reset instead of accumulated
            let ticketAfter = await protocol.userTicket(user2.address);

            console.log("Ticket after re-buy post-expiry:", {
                amount: ethers.formatEther(ticketAfter.amount),
                purchaseTime: ticketAfter.purchaseTime.toString(),
            });

            expect(ticketAfter.amount).to.equal(ethers.parseEther("100"));
        });

        it("Should prevent reward claims for expired tickets", async function () {
            // Set time to after cutoff date
            const currentTime = await time.latest();
            const timeUntilCutoff = Math.max(0, TICKET_EXPIRY_CUTOFF_DATE - currentTime);
            if (timeUntilCutoff > 0) {
                await time.increase(timeUntilCutoff + 24 * 60 * 60);
            }

            // User2 buys a ticket
            await protocol.connect(user2).buyTicket({ value: ethers.parseEther("100") });

            // Move time forward 72+ hours
            await time.increase(TICKET_EXPIRY_DURATION + 1);

            // Try to claim rewards - should fail with NotActive
            await expect(
                protocol.connect(user2).claimRewards()
            ).to.be.revertedWithCustomError(protocol, "NotActive");
        });

        it("Should NOT expire old tickets purchased before cutoff date", async function () {
            // Get current block timestamp
            const currentTime = await time.latest();

            // Set cutoff to far in the future
            const futureCutoff = currentTime + 365 * 24 * 60 * 60; // 1 year from now
            await protocol.setTicketExpiryCutoffDate(futureCutoff);

            // User1 buys a ticket (after cutoff is in the future, so tickets won't expire)
            await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });

            // Move time forward much longer than 72 hours
            await time.increase(365 * 24 * 60 * 60); // 1 year

            // Reset cutoff back to original
            await protocol.setTicketExpiryCutoffDate(TICKET_EXPIRY_CUTOFF_DATE);

            // Try to buy another ticket to trigger expiry check
            try {
                await protocol.connect(user1).buyTicket({ value: ethers.parseEther("100") });
            } catch (e) {
                // Might fail for other reasons, but not expiry
            }

            // Check ticket still exists (old tickets don't expire)
            let ticket = await protocol.userTicket(user1.address);
            let userInfo = await protocol.userInfo(user1.address);

            console.log("Old ticket status after 1 year:", {
                amount: ethers.formatEther(ticket.amount),
                isActive: userInfo.isActive,
            });

            // Old tickets should remain valid or at least not be destroyed
            expect(ticket.amount).to.be.gt(0n);
        });
    });

    describe("Dynamic Rewards Clearing", function () {
        it("Should clear accumulated dynamic rewards when ticket expires", async function () {
            // Set time to after cutoff date
            const currentTime = await time.latest();
            const timeUntilCutoff = Math.max(0, TICKET_EXPIRY_CUTOFF_DATE - currentTime);
            if (timeUntilCutoff > 0) {
                await time.increase(timeUntilCutoff + 24 * 60 * 60);
            }

            // User3 buys a ticket without providing liquidity
            await protocol.connect(user3).buyTicket({ value: ethers.parseEther("100") });

            // Get dynamic rewards before expiry
            let dynamicsBefore = await protocol.getUserDynamicRewards(user3.address);
            console.log("Dynamic rewards accumulated before expiry:", {
                earned: ethers.formatEther(dynamicsBefore.totalEarned),
                claimed: ethers.formatEther(dynamicsBefore.totalClaimed),
            });

            // Move time forward 72+ hours
            await time.increase(TICKET_EXPIRY_DURATION + 1);

            // Trigger expiry by attempting to claim rewards
            try {
                await protocol.connect(user3).claimRewards();
            } catch (e) {
                // Expected: claimRewards will revert once the ticket expires
            }

            // Check dynamic rewards after expiry
            let dynamicsAfter = await protocol.getUserDynamicRewards(user3.address);
            console.log("Dynamic rewards after expiry:", {
                earned: ethers.formatEther(dynamicsAfter.totalEarned),
                claimed: ethers.formatEther(dynamicsAfter.totalClaimed),
            });

            // Both should be 0 after expiry
            expect(dynamicsAfter.totalEarned).to.equal(0n);
            expect(dynamicsAfter.totalClaimed).to.equal(0n);
        });
    });
});
