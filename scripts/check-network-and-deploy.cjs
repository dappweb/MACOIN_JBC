const { ethers } = require('hardhat');

async function main() {
    console.log('🌐 [Network & Contract Check] Starting analysis...\n');

    try {
        const provider = ethers.provider;
        const [signer] = await ethers.getSigners();
        
        // 1. Check network info
        console.log('📋 [Network Info]');
        const network = await provider.getNetwork();
        console.log(`Network Name: ${network.name}`);
        console.log(`Chain ID: ${network.chainId}`);
        console.log(`Block Number: ${await provider.getBlockNumber()}`);
        console.log(`Deployer: ${signer.address}\n`);

        // 2. Check expected contract addresses
        const expectedAddresses = {
            mcToken: '0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF',
            jbcToken: '0xA743cB357a9f59D349efB7985072779a094658dD',
            protocol: '0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19'
        };

        console.log('🔍 [Contract Existence Check]');
        for (const [name, address] of Object.entries(expectedAddresses)) {
            const code = await provider.getCode(address);
            const exists = code !== '0x';
            console.log(`${name}: ${address} - ${exists ? '✅ Exists' : '❌ Missing'}`);
        }
        console.log();

        // 3. If contracts are missing, deploy them
        const mcCode = await provider.getCode(expectedAddresses.mcToken);
        const jbcCode = await provider.getCode(expectedAddresses.jbcToken);
        const protocolCode = await provider.getCode(expectedAddresses.protocol);

        if (mcCode === '0x' || jbcCode === '0x') {
            console.log('🚀 [Deploying Missing Contracts]');
            
            let mcAddress, jbcAddress;
            
            // Deploy MC token if missing
            if (mcCode === '0x') {
                console.log('Deploying MC token...');
                const MC = await ethers.getContractFactory('MockMC');
                const mc = await MC.deploy();
                await mc.waitForDeployment();
                mcAddress = await mc.getAddress();
                console.log(`✅ MC Token deployed at: ${mcAddress}`);
            } else {
                mcAddress = expectedAddresses.mcToken;
            }

            // Deploy JBC token if missing
            if (jbcCode === '0x') {
                console.log('Deploying JBC token...');
                const JBC = await ethers.getContractFactory('JBC');
                const jbc = await JBC.deploy();
                await jbc.waitForDeployment();
                jbcAddress = await jbc.getAddress();
                console.log(`✅ JBC Token deployed at: ${jbcAddress}`);
            } else {
                jbcAddress = expectedAddresses.jbcToken;
            }

            // Deploy protocol if missing
            if (protocolCode === '0x') {
                console.log('Deploying JinbaoProtocol...');
                
                const wallets = {
                    marketing: signer.address,
                    treasury: signer.address,
                    lpInjection: signer.address,
                    buyback: signer.address
                };

                const JinbaoProtocol = await ethers.getContractFactory('JinbaoProtocol');
                const protocol = await upgrades.deployProxy(JinbaoProtocol, [
                    mcAddress,
                    jbcAddress,
                    wallets.marketing,
                    wallets.treasury,
                    wallets.lpInjection,
                    wallets.buyback
                ], { initializer: 'initialize' });
                
                await protocol.waitForDeployment();
                const protocolAddress = await protocol.getAddress();
                console.log(`✅ JinbaoProtocol deployed at: ${protocolAddress}`);

                // Initialize swap with liquidity
                console.log('Initializing swap with liquidity...');
                const mc = await ethers.getContractAt('MockMC', mcAddress);
                const jbc = await ethers.getContractAt('JBC', jbcAddress);
                
                const liquidityAmount = ethers.parseEther('10000');
                
                // Approve tokens
                await mc.approve(protocolAddress, liquidityAmount);
                await jbc.approve(protocolAddress, liquidityAmount);
                
                // Add initial liquidity
                await protocol.addLiquidity(liquidityAmount, liquidityAmount);
                console.log('✅ Initial liquidity added');
            }

            // Save deployment info
            const deploymentInfo = {
                network: network.name,
                chainId: network.chainId.toString(),
                timestamp: new Date().toISOString(),
                deployer: signer.address,
                contracts: {
                    mcToken: mcAddress,
                    jbcToken: jbcAddress,
                    protocol: protocolCode !== '0x' ? expectedAddresses.protocol : protocolAddress
                }
            };

            const fs = require('fs');
            const deploymentFile = `deployments/emergency-deployment-${Date.now()}.json`;
            fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
            console.log(`📄 Deployment info saved to: ${deploymentFile}`);

        } else {
            console.log('✅ All contracts exist, checking functionality...');
            
            // Test MC token
            try {
                const mc = await ethers.getContractAt('MockMC', expectedAddresses.mcToken);
                const balance = await mc.balanceOf(signer.address);
                console.log(`MC Balance: ${ethers.formatEther(balance)} MC`);
            } catch (err) {
                console.log('❌ MC token test failed:', err.message);
            }
        }

    } catch (error) {
        console.error('❌ Network check failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });