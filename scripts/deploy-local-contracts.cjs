const { ethers, upgrades } = require('hardhat');

async function main() {
    console.log('🚀 [Local Contract Deployment] Starting deployment...\n');

    try {
        const [deployer] = await ethers.getSigners();
        console.log('📋 [Deployment Info]');
        console.log(`Deployer: ${deployer.address}`);
        console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

        // 1. Deploy MC Token
        console.log('🪙 [Deploying MC Token]');
        const MC = await ethers.getContractFactory('MockMC');
        const mc = await MC.deploy();
        await mc.waitForDeployment();
        const mcAddress = await mc.getAddress();
        console.log(`✅ MC Token deployed at: ${mcAddress}`);

        // 2. Deploy JBC Token
        console.log('🪙 [Deploying JBC Token]');
        const JBC = await ethers.getContractFactory('JBC');
        const jbc = await JBC.deploy(deployer.address); // Pass initialOwner
        await jbc.waitForDeployment();
        const jbcAddress = await jbc.getAddress();
        console.log(`✅ JBC Token deployed at: ${jbcAddress}`);

        // 3. Deploy JinbaoProtocol
        console.log('🏭 [Deploying JinbaoProtocol]');
        const wallets = {
            marketing: deployer.address,
            treasury: deployer.address,
            lpInjection: deployer.address,
            buyback: deployer.address
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

        // 4. Set up JBC protocol address
        console.log('⚙️  [Setting up JBC Protocol Address]');
        await jbc.setProtocol(protocolAddress);
        console.log('✅ JBC protocol address set');

        // 5. Initialize swap with liquidity
        console.log('💧 [Adding Initial Liquidity]');
        const liquidityAmount = ethers.parseEther('10000');
        
        // Approve tokens
        await mc.approve(protocolAddress, liquidityAmount);
        await jbc.approve(protocolAddress, liquidityAmount);
        
        // Add initial liquidity
        await protocol.addLiquidity(liquidityAmount, liquidityAmount);
        console.log('✅ Initial liquidity added (10,000 MC + 10,000 JBC)');

        // 6. Test the setup
        console.log('🧪 [Testing Setup]');
        
        // Check MC balance
        const mcBalance = await mc.balanceOf(deployer.address);
        console.log(`MC Balance: ${ethers.formatEther(mcBalance)} MC`);
        
        // Check JBC balance
        const jbcBalance = await jbc.balanceOf(deployer.address);
        console.log(`JBC Balance: ${ethers.formatEther(jbcBalance)} JBC`);
        
        // Check swap reserves
        const reserves = await protocol.getReserves();
        console.log(`Swap Reserves - MC: ${ethers.formatEther(reserves[0])}, JBC: ${ethers.formatEther(reserves[1])}`);

        // 7. Save deployment info
        const deploymentInfo = {
            network: 'hardhat',
            chainId: '31337',
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            contracts: {
                mcToken: mcAddress,
                jbcToken: jbcAddress,
                protocol: protocolAddress
            },
            wallets: wallets,
            initialLiquidity: {
                mc: '10000.0',
                jbc: '10000.0'
            }
        };

        const fs = require('fs');
        const deploymentFile = `deployments/local-deployment-${Date.now()}.json`;
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 Deployment info saved to: ${deploymentFile}`);

        console.log('\n🎉 [Deployment Complete]');
        console.log('Contract addresses:');
        console.log(`MC Token: ${mcAddress}`);
        console.log(`JBC Token: ${jbcAddress}`);
        console.log(`JinbaoProtocol: ${protocolAddress}`);
        console.log('\nYou can now update your frontend to use these addresses.');

        // 8. Update Web3Context with new addresses
        console.log('\n📝 [Frontend Update Required]');
        console.log('Update src/Web3Context.tsx with these addresses:');
        console.log(`const PROTOCOL_ADDRESS = '${protocolAddress}';`);
        console.log(`const MC_ADDRESS = '${mcAddress}';`);

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });