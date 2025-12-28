const { ethers } = require('hardhat');

async function main() {
    console.log('🎫 [Ticket Purchase Diagnosis] Starting comprehensive analysis...\n');

    try {
        // Get contract instances
        const protocolAddress = '0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19';
        const mcAddress = '0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF';
        
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);
        const mc = await ethers.getContractAt('IERC20', mcAddress);
        
        // Get signer (user account)
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        console.log('📋 [Contract Info]');
        console.log(`Protocol: ${protocolAddress}`);
        console.log(`MC Token: ${mcAddress}`);
        console.log(`User: ${userAddress}\n`);

        // 1. Check user's MC balance
        console.log('💰 [Balance Check]');
        const mcBalance = await mc.balanceOf(userAddress);
        console.log(`MC Balance: ${ethers.formatEther(mcBalance)} MC`);
        
        const ticketAmount = ethers.parseEther('1000'); // 1000 MC ticket
        console.log(`Required: ${ethers.formatEther(ticketAmount)} MC`);
        console.log(`Sufficient Balance: ${mcBalance >= ticketAmount ? '✅ Yes' : '❌ No'}\n`);

        // 2. Check allowance
        console.log('🔐 [Allowance Check]');
        const allowance = await mc.allowance(userAddress, protocolAddress);
        console.log(`Current Allowance: ${ethers.formatEther(allowance)} MC`);
        console.log(`Required: ${ethers.formatEther(ticketAmount)} MC`);
        console.log(`Sufficient Allowance: ${allowance >= ticketAmount ? '✅ Yes' : '❌ No'}\n`);

        // 3. Check current ticket status
        console.log('🎫 [Current Ticket Status]');
        try {
            const ticket = await protocol.userTicket(userAddress);
            console.log(`Current Ticket Amount: ${ethers.formatEther(ticket.amount)} MC`);
            console.log(`Purchase Time: ${new Date(Number(ticket.purchaseTime) * 1000).toLocaleString()}`);
            console.log(`Exited: ${ticket.exited ? '✅ Yes' : '❌ No'}`);
            
            if (ticket.amount > 0n && !ticket.exited) {
                console.log('⚠️  User already has an active ticket!');
            }
        } catch (err) {
            console.log('❌ Error checking ticket status:', err.message);
        }
        console.log();

        // 4. Check user info
        console.log('👤 [User Info]');
        try {
            const userInfo = await protocol.userInfo(userAddress);
            console.log(`Total Revenue: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
            console.log(`Current Cap: ${ethers.formatEther(userInfo.currentCap)} MC`);
            console.log(`Max Ticket Amount: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
            console.log(`Max Single Ticket: ${ethers.formatEther(userInfo.maxSingleTicketAmount)} MC`);
        } catch (err) {
            console.log('❌ Error checking user info:', err.message);
        }
        console.log();

        // 5. Check referrer status
        console.log('👥 [Referrer Status]');
        try {
            const referrer = await protocol.referrers(userAddress);
            console.log(`Has Referrer: ${referrer !== ethers.ZeroAddress ? '✅ Yes' : '❌ No'}`);
            if (referrer !== ethers.ZeroAddress) {
                console.log(`Referrer: ${referrer}`);
            }
        } catch (err) {
            console.log('❌ Error checking referrer:', err.message);
        }
        console.log();

        // 6. Simulate buyTicket call
        console.log('🧪 [Simulation Test]');
        try {
            // First check if approval is needed
            if (allowance < ticketAmount) {
                console.log('⚠️  Need to approve MC tokens first');
                console.log('Simulating approval...');
                
                try {
                    await mc.approve.staticCall(protocolAddress, ethers.MaxUint256);
                    console.log('✅ Approval simulation successful');
                } catch (approveErr) {
                    console.log('❌ Approval simulation failed:', approveErr.message);
                    return;
                }
            }

            // Simulate buyTicket
            console.log('Simulating buyTicket...');
            await protocol.buyTicket.staticCall(ticketAmount);
            console.log('✅ buyTicket simulation successful');
            
        } catch (err) {
            console.log('❌ buyTicket simulation failed:');
            console.log(`Error: ${err.message}`);
            
            // Try to decode the error
            if (err.data) {
                try {
                    const decodedError = protocol.interface.parseError(err.data);
                    console.log(`Decoded Error: ${decodedError.name}`);
                    if (decodedError.args && decodedError.args.length > 0) {
                        console.log(`Error Args:`, decodedError.args);
                    }
                } catch (decodeErr) {
                    console.log('Could not decode error data');
                }
            }
        }
        console.log();

        // 7. Check contract state
        console.log('📊 [Contract State]');
        try {
            const paused = await protocol.paused();
            console.log(`Contract Paused: ${paused ? '❌ Yes' : '✅ No'}`);
            
            const owner = await protocol.owner();
            console.log(`Contract Owner: ${owner}`);
            console.log(`Is User Owner: ${owner.toLowerCase() === userAddress.toLowerCase() ? '✅ Yes' : '❌ No'}`);
        } catch (err) {
            console.log('❌ Error checking contract state:', err.message);
        }

        console.log('\n🔍 [Diagnosis Complete]');
        console.log('If buyTicket simulation failed, check the error details above.');
        console.log('Common issues:');
        console.log('- Insufficient MC balance');
        console.log('- Insufficient allowance');
        console.log('- Already have active ticket');
        console.log('- Contract is paused');
        console.log('- Missing referrer (if required)');

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });