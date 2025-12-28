const { ethers } = require('hardhat');

async function main() {
    console.log('🎫 [MC Chain Ticket Purchase Test] Starting test...\n');

    try {
        // MC Chain contract addresses
        const addresses = {
            mcToken: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
            jbcToken: "0xA743cB357a9f59D349efB7985072779a094658dD",
            protocol: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
        };

        const [signer] = await ethers.getSigners();
        console.log('📋 [Test Info]');
        console.log(`User: ${signer.address}`);
        console.log(`Network: MC Chain (${await ethers.provider.getNetwork().then(n => n.chainId)})`);
        console.log(`Block: ${await ethers.provider.getBlockNumber()}\n`);

        // Get contract instances
        const mc = await ethers.getContractAt('MockMC', addresses.mcToken);
        const protocol = await ethers.getContractAt('JinbaoProtocol', addresses.protocol);

        // Check balances
        console.log('💰 [Balance Check]');
        const mcBalance = await mc.balanceOf(signer.address);
        console.log(`MC Balance: ${ethers.formatEther(mcBalance)} MC`);
        
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

        // Check current ticket
        console.log('\n🎫 [Current Ticket Status]');
        const ticket = await protocol.userTicket(signer.address);
        console.log(`Current Ticket: ${ethers.formatEther(ticket.amount)} MC`);
        console.log(`Purchase Time: ${ticket.purchaseTime > 0 ? new Date(Number(ticket.purchaseTime) * 1000).toLocaleString() : 'Never'}`);
        console.log(`Exited: ${ticket.exited ? 'Yes' : 'No'}`);

        // Check user info
        const userInfo = await protocol.userInfo(signer.address);
        console.log(`Total Revenue: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
        console.log(`Current Cap: ${ethers.formatEther(userInfo.currentCap)} MC`);

        // Test ticket purchase
        const ticketAmount = ethers.parseEther('1000'); // 1000 MC ticket
        console.log(`\n🛒 [Testing Ticket Purchase: ${ethers.formatEther(ticketAmount)} MC]`);

        if (mcBalance < ticketAmount) {
            console.log(`❌ Insufficient MC balance. Need: ${ethers.formatEther(ticketAmount)} MC`);
            return;
        }

        // Check allowance
        const allowance = await mc.allowance(signer.address, addresses.protocol);
        console.log(`Current Allowance: ${ethers.formatEther(allowance)} MC`);

        if (allowance < ticketAmount) {
            console.log('⚙️  Approving MC tokens...');
            const approveTx = await mc.approve(addresses.protocol, ethers.MaxUint256);
            console.log(`Approval TX: ${approveTx.hash}`);
            await approveTx.wait();
            console.log('✅ Approval successful');
        }

        // Buy ticket
        console.log('🎫 Purchasing ticket...');
        try {
            const buyTx = await protocol.buyTicket(ticketAmount);
            console.log(`Purchase TX: ${buyTx.hash}`);
            const receipt = await buyTx.wait();
            console.log(`✅ Ticket purchased! Gas used: ${receipt.gasUsed}`);

            // Verify purchase
            console.log('\n🔍 [Verification]');
            const newMcBalance = await mc.balanceOf(signer.address);
            console.log(`New MC Balance: ${ethers.formatEther(newMcBalance)} MC`);
            console.log(`MC Spent: ${ethers.formatEther(mcBalance - newMcBalance)} MC`);

            const newTicket = await protocol.userTicket(signer.address);
            console.log(`New Ticket Amount: ${ethers.formatEther(newTicket.amount)} MC`);
            console.log(`Purchase Time: ${new Date(Number(newTicket.purchaseTime) * 1000).toLocaleString()}`);

            const newUserInfo = await protocol.userInfo(signer.address);
            console.log(`Max Ticket Amount: ${ethers.formatEther(newUserInfo.maxTicketAmount)} MC`);
            console.log(`Max Single Ticket: ${ethers.formatEther(newUserInfo.maxSingleTicketAmount)} MC`);

            console.log('\n🎉 [Success]');
            console.log('✅ Ticket purchase on MC Chain successful!');
            console.log('✅ Frontend should now work correctly on MC Chain');

        } catch (buyError) {
            console.log(`❌ Ticket purchase failed: ${buyError.message}`);
            
            // Try to decode the error
            if (buyError.data) {
                try {
                    const decodedError = protocol.interface.parseError(buyError.data);
                    console.log(`Decoded Error: ${decodedError.name}`);
                    if (decodedError.args && decodedError.args.length > 0) {
                        console.log(`Error Args:`, decodedError.args);
                    }
                } catch (decodeErr) {
                    console.log('Could not decode error data');
                }
            }
        }

        console.log('\n📱 [Frontend Setup]');
        console.log('To use the frontend with MC Chain:');
        console.log('1. Add MC Chain network to your wallet:');
        console.log('   - Network Name: MC Chain');
        console.log('   - RPC URL: https://chain.mcerscan.com/');
        console.log('   - Chain ID: 88813');
        console.log('   - Currency Symbol: MC');
        console.log('   - Block Explorer: https://mcerscan.com');
        console.log('');
        console.log('2. Import your account or ensure you have MC tokens');
        console.log('3. Refresh the frontend page');
        console.log('4. Connect wallet and test ticket purchase');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });