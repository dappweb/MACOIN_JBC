const { ethers } = require("hardhat");

const PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const TARGET_USER = "0x0ea4a4b654CD77e9eA5B088633E6d5d5B4BBb720"; // The user in screenshot

async function main() {
    console.log("Testing admin update on:", PROTOCOL_ADDRESS);
    
    // Get signer (should be owner from .env)
    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const protocol = await ethers.getContractAt("JinbaoProtocolV4", PROTOCOL_ADDRESS, signer);
    
    // Check owner
    const owner = await protocol.owner();
    console.log("Contract Owner:", owner);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("Signer is NOT owner! Aborting.");
        return;
    }

    // Try to set active directs
    console.log("Attempting to set active directs to 1...");
    try {
        // Test a simple setter first to verify onlyOwner
        console.log("Testing setTicketFlexibilityDuration (simple onlyOwner check)...");
        // Get current value
        const currentDuration = await protocol.ticketFlexibilityDuration();
        console.log("Current duration:", currentDuration.toString());
        
        await protocol.setTicketFlexibilityDuration(currentDuration); // Set to same value
         console.log("setTicketFlexibilityDuration succeeded! onlyOwner is working.");
 
         // Test adminSetReferrer to check userInfo access
         console.log("Testing adminSetReferrer...");
         const currentUserInfo = await protocol.userInfo(TARGET_USER);
         console.log("Current referrer:", currentUserInfo.referrer);
         
         const newReferrer = "0x0000000000000000000000000000000000000001"; // address(1)
         
         try {
             // Estimate gas
             const gasRef = await protocol.adminSetReferrer.estimateGas(TARGET_USER, newReferrer);
             console.log("adminSetReferrer gas estimate (valid referrer):", gasRef.toString());
             
             // We won't actually send it to avoid messing up data, or maybe we should?
             // Since it's a testnet/dev env, maybe it's fine. But let's just trust estimate.
         } catch (e) {
             console.log("adminSetReferrer estimate failed:", e.message);
         }

         // Estimate gas for adminSetActiveDirects
         console.log("Testing adminSetActiveDirects...");
         try {
             const gasEstimate = await protocol.adminSetActiveDirects.estimateGas(TARGET_USER, 1);
             console.log("Gas estimate for adminSetActiveDirects:", gasEstimate.toString());
             
             const tx = await protocol.adminSetActiveDirects(TARGET_USER, 1);
             console.log("Transaction sent:", tx.hash);
             await tx.wait();
             console.log("adminSetActiveDirects Confirmed!");
         } catch (e) {
             console.log("adminSetActiveDirects failed:", e.message);
         }

         // Estimate gas for adminSetTeamCount
         console.log("Testing adminSetTeamCount...");
         try {
             const gasEstimate = await protocol.adminSetTeamCount.estimateGas(TARGET_USER, 10);
             console.log("Gas estimate for adminSetTeamCount:", gasEstimate.toString());
         } catch (e) {
             console.log("adminSetTeamCount failed:", e.message);
         }
        
    } catch (e) {
        console.error("Failed to set active directs:", e);
        if (e.data) {
            console.error("Error data:", e.data);
        }
    }

    // Check result
    const userInfo = await protocol.userInfo(TARGET_USER);
    console.log("New Active Directs:", userInfo.activeDirects.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
