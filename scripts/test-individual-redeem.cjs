const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing individual redeem functionality...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Tester:", deployer.address);

    // Contract addresses
    const PROXY_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
    const MC_TOKEN_ADDRESS = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    
    // Connect to contracts
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const protocolContract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    const ERC20 = await ethers.getContractFactory("MockERC20");
    const mcToken = ERC20.attach(MC_TOKEN_ADDRESS);
    
    console.log("\n📊 Current user state:");
    
    try {
        // Check user info
        const userInfo = await protocolContract.userInfo(deployer.address);
        console.log("User active:", userInfo.isActive);
        console.log("Max ticket amount:", ethers.formatEther(userInfo.maxTicketAmount));
        console.log("Refund fee amount:", ethers.formatEther(userInfo.refundFeeAmount));
        
        // Check user stakes
        console.log("\n📋 User stakes:");
        let stakeIndex = 0;
        const stakes = [];
        
        while (true) {
            try {
                const stake = await protocolContract.userStakes(deployer.address, stakeIndex);
                if (stake.amount === 0n) break;
                
                const endTime = Number(stake.startTime) + (Number(stake.cycleDays) * 86400); // Assuming SECONDS_IN_UNIT = 86400
                const isExpired = Math.floor(Date.now() / 1000) >= endTime;
                
                stakes.push({
                    index: stakeIndex,
                    id: stake.id.toString(),
                    amount: ethers.formatEther(stake.amount),
                    startTime: new Date(Number(stake.startTime) * 1000).toLocaleString(),
                    cycleDays: Number(stake.cycleDays),
                    active: stake.active,
                    paid: ethers.formatEther(stake.paid),
                    endTime: new Date(endTime * 1000).toLocaleString(),
                    isExpired,
                    canRedeem: stake.active && isExpired
                });
                
                console.log(`Stake ${stakeIndex}:`, {
                    amount: ethers.formatEther(stake.amount) + " MC",
                    cycleDays: Number(stake.cycleDays),
                    active: stake.active,
                    canRedeem: stake.active && isExpired
                });
                
                stakeIndex++;
            } catch (error) {
                break;
            }
        }
        
        if (stakes.length === 0) {
            console.log("❌ No stakes found for testing");
            return;
        }
        
        // Find a redeemable stake
        const redeemableStake = stakes.find(s => s.canRedeem);
        
        if (!redeemableStake) {
            console.log("⏳ No expired stakes available for redemption");
            console.log("📝 Available stakes:", stakes.map(s => `Index ${s.index}: ${s.amount} MC, expires ${s.endTime}`));
            return;
        }
        
        console.log(`\n🎯 Testing redemption of stake ${redeemableStake.index}:`);
        console.log("Amount:", redeemableStake.amount, "MC");
        console.log("Cycle:", redeemableStake.cycleDays, "days");
        
        // Check current balances
        const mcBalanceBefore = await mcToken.balanceOf(deployer.address);
        console.log("\n💰 Balances before redemption:");
        console.log("MC balance:", ethers.formatEther(mcBalanceBefore));
        
        // Check redemption fee
        const redemptionFeePercent = await protocolContract.redemptionFeePercent();
        const feeBase = userInfo.maxTicketAmount > 0 ? userInfo.maxTicketAmount : userInfo.refundFeeAmount;
        const expectedFee = (feeBase * redemptionFeePercent) / 100n;
        
        console.log("Expected fee:", ethers.formatEther(expectedFee), "MC");
        console.log("Fee percent:", redemptionFeePercent.toString() + "%");
        
        // Check if user has enough balance and allowance for fee
        if (mcBalanceBefore < expectedFee) {
            console.log("❌ Insufficient MC balance for fee");
            return;
        }
        
        const allowance = await mcToken.allowance(deployer.address, PROXY_ADDRESS);
        console.log("Current allowance:", ethers.formatEther(allowance));
        
        if (allowance < expectedFee) {
            console.log("🔓 Approving MC tokens for fee payment...");
            const approveTx = await mcToken.approve(PROXY_ADDRESS, expectedFee);
            await approveTx.wait();
            console.log("✅ Approval successful");
        }
        
        // Test the new redeemStake function
        console.log(`\n🔄 Calling redeemStake(${redeemableStake.index})...`);
        
        try {
            const tx = await protocolContract.redeemStake(redeemableStake.index);
            const receipt = await tx.wait();
            
            console.log("✅ Redemption successful!");
            console.log("Gas used:", receipt.gasUsed.toString());
            console.log("Transaction hash:", receipt.hash);
            
            // Check balances after
            const mcBalanceAfter = await mcToken.balanceOf(deployer.address);
            const balanceChange = mcBalanceAfter - mcBalanceBefore;
            
            console.log("\n💰 Balances after redemption:");
            console.log("MC balance:", ethers.formatEther(mcBalanceAfter));
            console.log("Balance change:", ethers.formatEther(balanceChange));
            
            // Verify the stake is now inactive
            const stakeAfter = await protocolContract.userStakes(deployer.address, redeemableStake.index);
            console.log("Stake active after redemption:", stakeAfter.active);
            
            // Check updated refund fee amount
            const userInfoAfter = await protocolContract.userInfo(deployer.address);
            console.log("Refund fee amount after:", ethers.formatEther(userInfoAfter.refundFeeAmount));
            
            // Parse events
            const redeemEvent = receipt.logs.find(log => {
                try {
                    const parsed = protocolContract.interface.parseLog(log);
                    return parsed.name === "Redeemed";
                } catch (e) {
                    return false;
                }
            });
            
            if (redeemEvent) {
                const parsed = protocolContract.interface.parseLog(redeemEvent);
                console.log("\n📊 Redemption details:");
                console.log("Principal returned:", ethers.formatEther(parsed.args.principal));
                console.log("Fee charged:", ethers.formatEther(parsed.args.fee));
            }
            
        } catch (error) {
            console.error("❌ Redemption failed:", error.message);
            
            if (error.message.includes("Insufficient balance for fee")) {
                console.log("💡 User needs more MC tokens to pay the redemption fee");
            } else if (error.message.includes("Insufficient allowance for fee")) {
                console.log("💡 User needs to approve more MC tokens for fee payment");
            } else if (error.message.includes("Invalid stake ID")) {
                console.log("💡 Stake ID is invalid or out of range");
            } else if (error.message.includes("Stake not active")) {
                console.log("💡 Stake has already been redeemed");
            } else if (error.message.includes("Stake not expired")) {
                console.log("💡 Stake has not reached maturity yet");
            }
        }
        
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });