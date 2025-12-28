const { ethers } = require('hardhat');

async function main() {
    console.log('🎫 [Ticket Purchase Test] Starting test...\n');

    try {
        // Use the new local contract addresses
        const mcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
        const jbcAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
        const protocolAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
        
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        console.log('📋 [Test Info]');
        console.log(`User: ${userAddress}`);
        console.log(`MC Token: ${mcAddress}`);
        console.log(`Protocol: ${protocolAddress}\n`);

        // Get contract instances
        const mc = await ethers.getContractAt('MockMC', mcAddress);
        const protocol = await ethers.getContractAt('JinbaoProtocol', protocolAddress);

        // 1. Check initial balances
        console.log('💰 [Initial State]');
        const mcBalance = await mc.balanceOf(userAddress);
        console.log(`MC Balance: ${ethers.formatEther(mcBalance)} MC`);
        
        const ticket = await protocol.userTicket(userAddress);
        console.log(`Current Ticket: ${ethers.formatEther(ticket.amount)} MC`);
        console.log(`Ticket Exited: ${ticket.exited}\n`);

        // 2. Test ticket purchase (1000 MC)
        const ticketAmount = ethers.parseEther('1000');
        console.log('🎫 [Testing Ticket Purchase]');
        console.log(`Attempting to buy ticket for: ${ethers.formatEther(ticketAmount)} MC`);

        // Check if approval is needed
        const allowance = await mc.allowance(userAddress, protocolAddress);
        console.log(`Current Allowance: ${ethers.formatEther(allowance)} MC`);
        
        if (allowance < ticketAmount) {
            console.log('⚙️  Approving MC tokens...');
            const approveTx = await mc.approve(protocolAddress, ethers.MaxUint256);
            await approveTx.wait();
            console.log('✅ Approval successful');
        }

        // Buy ticket
        console.log('🛒 Purchasing ticket...');
        const buyTx = await protocol.buyTicket(ticketAmount);
        const receipt = await buyTx.wait();
        console.log(`✅ Ticket purchased! Gas used: ${receipt.gasUsed}`);

        // 3. Verify purchase
        console.log('\n🔍 [Verification]');
        const newMcBalance = await mc.balanceOf(userAddress);
        console.log(`New MC Balance: ${ethers.formatEther(newMcBalance)} MC`);
        console.log(`MC Spent: ${ethers.formatEther(mcBalance - newMcBalance)} MC`);

        const newTicket = await protocol.userTicket(userAddress);
        console.log(`New Ticket Amount: ${ethers.formatEther(newTicket.amount)} MC`);
        console.log(`Purchase Time: ${new Date(Number(newTicket.purchaseTime) * 1000).toLocaleString()}`);

        // 4. Check user info
        const userInfo = await protocol.userInfo(userAddress);
        console.log(`Max Ticket Amount: ${ethers.formatEther(userInfo.maxTicketAmount)} MC`);
        console.log(`Max Single Ticket: ${ethers.formatEther(userInfo.maxSingleTicketAmount)} MC`);

        console.log('\n🎉 [Test Complete]');
        console.log('Ticket purchase functionality is working correctly!');
        console.log('The frontend should now be able to purchase tickets successfully.');

    } catch (error) {
        console.error('❌ Test failed:', error);
        
        // Try to decode the error
        if (error.data) {
            try {
                const protocol = await ethers.getContractAt('JinbaoProtocol', '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9');
                const decodedError = protocol.interface.parseError(error.data);
                console.log(`Decoded Error: ${decodedError.name}`);
                if (decodedError.args && decodedError.args.length > 0) {
                    console.log(`Error Args:`, decodedError.args);
                }
            } catch (decodeErr) {
                console.log('Could not decode error data');
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });