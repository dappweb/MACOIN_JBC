const { ethers } = require('hardhat');

async function main() {
    console.log('🧪 [Simple Contract Test] Starting...\n');

    try {
        const [signer] = await ethers.getSigners();
        console.log(`Signer: ${signer.address}`);
        console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} ETH\n`);

        // Test contract addresses from deployment
        const addresses = {
            mc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            jbc: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
            protocol: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
        };

        // Check if contracts exist
        console.log('🔍 [Contract Existence Check]');
        for (const [name, address] of Object.entries(addresses)) {
            const code = await signer.provider.getCode(address);
            console.log(`${name}: ${address} - ${code !== '0x' ? '✅ Exists' : '❌ Missing'}`);
        }
        console.log();

        // Try to get MC contract using the factory
        console.log('🪙 [MC Token Test]');
        try {
            const MC = await ethers.getContractFactory('MockMC');
            const mc = MC.attach(addresses.mc);
            
            const name = await mc.name();
            console.log(`✅ MC Name: ${name}`);
            
            const symbol = await mc.symbol();
            console.log(`✅ MC Symbol: ${symbol}`);
            
            const balance = await mc.balanceOf(signer.address);
            console.log(`✅ MC Balance: ${ethers.formatEther(balance)} MC`);
            
        } catch (err) {
            console.log(`❌ MC Test failed: ${err.message}`);
        }

        // Try to get Protocol contract
        console.log('\n🏭 [Protocol Test]');
        try {
            const Protocol = await ethers.getContractFactory('JinbaoProtocol');
            const protocol = Protocol.attach(addresses.protocol);
            
            const owner = await protocol.owner();
            console.log(`✅ Protocol Owner: ${owner}`);
            
            const ticket = await protocol.userTicket(signer.address);
            console.log(`✅ User Ticket: ${ethers.formatEther(ticket.amount)} MC`);
            
        } catch (err) {
            console.log(`❌ Protocol Test failed: ${err.message}`);
        }

        console.log('\n🎯 [Recommendation]');
        console.log('If tests pass, the contracts are working correctly.');
        console.log('Update your frontend to connect to the local Hardhat network (localhost:8545)');
        console.log('and use the contract addresses shown above.');

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