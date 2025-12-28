const { ethers } = require('hardhat');

async function main() {
    console.log('👥 [User Level Check] Checking user level data...\n');

    try {
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);
        
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        console.log('📋 [User Info]');
        console.log(`Address: ${userAddress}`);
        console.log(`Network: MC Chain\n`);

        // Get user info
        console.log('👤 [User Data from Contract]');
        const userInfo = await protocol.userInfo(userAddress);
        
        console.log(`Referrer: ${userInfo[0]}`);
        console.log(`Active Directs: ${userInfo[1]}`);
        console.log(`Team Count: ${userInfo[2]}`);
        console.log(`Total Revenue: ${ethers.formatEther(userInfo[3])} MC`);
        console.log(`Current Cap: ${ethers.formatEther(userInfo[4])} MC`);
        console.log(`Is Active: ${userInfo[5]}`);
        console.log(`Refund Fee Amount: ${ethers.formatEther(userInfo[6])} MC`);
        console.log(`Team Total Volume: ${ethers.formatEther(userInfo[7])} MC`);
        console.log(`Team Total Cap: ${ethers.formatEther(userInfo[8])} MC`);

        // Calculate level based on team count
        console.log('\n🏆 [Level Calculation]');
        const teamCount = Number(userInfo[2]);
        console.log(`Team Count: ${teamCount}`);
        
        let level = "V0";
        if (teamCount >= 10000) level = "V9";
        else if (teamCount >= 5000) level = "V8";
        else if (teamCount >= 2000) level = "V7";
        else if (teamCount >= 1000) level = "V6";
        else if (teamCount >= 500) level = "V5";
        else if (teamCount >= 200) level = "V4";
        else if (teamCount >= 100) level = "V3";
        else if (teamCount >= 50) level = "V2";
        else if (teamCount >= 20) level = "V1";
        
        console.log(`Calculated Level: ${level}`);
        
        // Check if user has referrer
        console.log('\n👥 [Referrer Status]');
        const referrer = userInfo[0];
        if (referrer === ethers.ZeroAddress) {
            console.log('❌ No referrer set - this might affect team building');
        } else {
            console.log(`✅ Referrer: ${referrer}`);
        }

        // Check ticket status
        console.log('\n🎫 [Ticket Status]');
        const ticket = await protocol.userTicket(userAddress);
        console.log(`Ticket Amount: ${ethers.formatEther(ticket.amount)} MC`);
        console.log(`Purchase Time: ${ticket.purchaseTime > 0 ? new Date(Number(ticket.purchaseTime) * 1000).toLocaleString() : 'Never'}`);
        console.log(`Exited: ${ticket.exited}`);

        // Get direct referrals
        console.log('\n👨‍👩‍👧‍👦 [Direct Referrals]');
        try {
            const directReferrals = await protocol.getDirectReferrals(userAddress);
            console.log(`Direct Referrals Count: ${directReferrals.length}`);
            
            if (directReferrals.length > 0) {
                console.log('Direct Referrals:');
                directReferrals.forEach((addr, index) => {
                    console.log(`  ${index + 1}. ${addr}`);
                });
            } else {
                console.log('No direct referrals found');
            }
        } catch (err) {
            console.log(`❌ Could not fetch direct referrals: ${err.message}`);
        }

        // Analysis
        console.log('\n🔍 [Analysis]');
        if (teamCount === 0) {
            console.log('❌ Team count is 0 - this explains why level is V0');
            console.log('Possible reasons:');
            console.log('1. No users have bound you as referrer');
            console.log('2. Team count update logic might have issues');
            console.log('3. Historical data might need to be recalculated');
        } else {
            console.log(`✅ Team count is ${teamCount}, level should be ${level}`);
        }

        // Recommendations
        console.log('\n💡 [Recommendations]');
        if (teamCount === 0) {
            console.log('To increase your level:');
            console.log('1. Share your referral link to get direct referrals');
            console.log('2. Encourage referred users to bind you as referrer');
            console.log('3. Check if team count logic is working correctly');
            
            // Check if there's a team count update issue
            console.log('\n🔧 [Potential Fix]');
            console.log('If you should have team members but count is 0:');
            console.log('- This might be a data synchronization issue');
            console.log('- Admin might need to run team count recalculation');
            console.log('- Check if bindReferrer function is being called correctly');
        }

    } catch (error) {
        console.error('❌ Level check failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });