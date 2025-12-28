const { ethers } = require('hardhat');

async function main() {
    console.log('🪙 [MC Token Status Check] Starting analysis...\n');

    try {
        const mcAddress = '0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF';
        const [signer] = await ethers.getSigners();
        const userAddress = signer.address;
        
        console.log('📋 [Basic Info]');
        console.log(`MC Token Address: ${mcAddress}`);
        console.log(`User Address: ${userAddress}\n`);

        // 1. Check if contract exists
        console.log('🔍 [Contract Existence Check]');
        const provider = ethers.provider;
        const code = await provider.getCode(mcAddress);
        console.log(`Contract Code Length: ${code.length}`);
        console.log(`Contract Exists: ${code !== '0x' ? '✅ Yes' : '❌ No'}\n`);

        if (code === '0x') {
            console.log('❌ MC Token contract does not exist at this address!');
            console.log('This could be the cause of the ticket purchase failure.\n');
            
            // Check if we have deployment records
            console.log('🔍 [Checking Deployment Records]');
            const fs = require('fs');
            const path = require('path');
            
            const deploymentsDir = path.join(__dirname, '..', 'deployments');
            if (fs.existsSync(deploymentsDir)) {
                const files = fs.readdirSync(deploymentsDir);
                console.log('Available deployment files:');
                files.forEach(file => {
                    if (file.includes('mc') || file.includes('MC')) {
                        console.log(`- ${file}`);
                    }
                });
            }
            return;
        }

        // 2. Try to get contract instance
        console.log('📄 [Contract Interface Check]');
        try {
            const mc = await ethers.getContractAt('IERC20', mcAddress);
            
            // Try basic calls
            const name = await mc.name();
            console.log(`Token Name: ${name}`);
            
            const symbol = await mc.symbol();
            console.log(`Token Symbol: ${symbol}`);
            
            const decimals = await mc.decimals();
            console.log(`Token Decimals: ${decimals}`);
            
            const totalSupply = await mc.totalSupply();
            console.log(`Total Supply: ${ethers.formatEther(totalSupply)} tokens\n`);
            
        } catch (err) {
            console.log('❌ Error getting contract info:', err.message);
            
            // Try with different interfaces
            console.log('\n🔄 [Trying Alternative Interfaces]');
            
            // Try as our custom MC token
            try {
                const mcCustom = await ethers.getContractAt('MC', mcAddress);
                const name = await mcCustom.name();
                console.log(`✅ Custom MC interface works - Name: ${name}`);
                
                const balance = await mcCustom.balanceOf(userAddress);
                console.log(`User Balance: ${ethers.formatEther(balance)} MC`);
                
            } catch (customErr) {
                console.log('❌ Custom MC interface failed:', customErr.message);
            }
        }

        // 3. Check network
        console.log('🌐 [Network Check]');
        const network = await provider.getNetwork();
        console.log(`Network Name: ${network.name}`);
        console.log(`Chain ID: ${network.chainId}`);
        console.log(`Block Number: ${await provider.getBlockNumber()}\n`);

        // 4. Check if this is the right network/address
        console.log('🎯 [Address Verification]');
        console.log('Expected MC Token: 0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF');
        console.log('Make sure this address is correct for your current network.');
        
    } catch (error) {
        console.error('❌ MC Token check failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });