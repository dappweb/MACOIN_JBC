const { ethers } = require('hardhat');

async function main() {
    console.log('🔧 [Ticket Purchase Fix] Starting comprehensive fix...\n');

    try {
        // 1. Check if Hardhat network is running
        console.log('🌐 [Network Check]');
        try {
            const provider = ethers.provider;
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ Network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`✅ Block Number: ${blockNumber}`);
        } catch (err) {
            console.log('❌ Network connection failed. Please start Hardhat network:');
            console.log('   npx hardhat node');
            return;
        }

        // 2. Deploy contracts if needed
        console.log('\n🚀 [Contract Deployment]');
        const [deployer] = await ethers.getSigners();
        console.log(`Deployer: ${deployer.address}`);

        // Deploy MC Token
        const MC = await ethers.getContractFactory('MockMC');
        const mc = await MC.deploy();
        await mc.waitForDeployment();
        const mcAddress = await mc.getAddress();
        console.log(`✅ MC Token: ${mcAddress}`);

        // Deploy JBC Token
        const JBC = await ethers.getContractFactory('JBC');
        const jbc = await JBC.deploy(deployer.address);
        await jbc.waitForDeployment();
        const jbcAddress = await jbc.getAddress();
        console.log(`✅ JBC Token: ${jbcAddress}`);

        // Deploy Protocol
        const { upgrades } = require('hardhat');
        const JinbaoProtocol = await ethers.getContractFactory('JinbaoProtocol');
        const protocol = await upgrades.deployProxy(JinbaoProtocol, [
            mcAddress,
            jbcAddress,
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address
        ], { initializer: 'initialize' });
        
        await protocol.waitForDeployment();
        const protocolAddress = await protocol.getAddress();
        console.log(`✅ Protocol: ${protocolAddress}`);

        // Setup JBC
        await jbc.setProtocol(protocolAddress);
        console.log('✅ JBC protocol address set');

        // Add liquidity
        const liquidityAmount = ethers.parseEther('10000');
        await mc.approve(protocolAddress, liquidityAmount);
        await jbc.approve(protocolAddress, liquidityAmount);
        await protocol.addLiquidity(liquidityAmount, liquidityAmount);
        console.log('✅ Initial liquidity added');

        // 3. Test ticket purchase
        console.log('\n🎫 [Testing Ticket Purchase]');
        const ticketAmount = ethers.parseEther('1000');
        
        // Approve and buy ticket
        await mc.approve(protocolAddress, ethers.MaxUint256);
        const buyTx = await protocol.buyTicket(ticketAmount);
        await buyTx.wait();
        console.log('✅ Test ticket purchase successful');

        // 4. Update frontend configuration
        console.log('\n📝 [Frontend Configuration Update]');
        const fs = require('fs');
        const path = require('path');
        
        const web3ContextPath = path.join(__dirname, '..', 'src', 'Web3Context.tsx');
        let web3Content = fs.readFileSync(web3ContextPath, 'utf8');
        
        // Update contract addresses
        const newAddresses = `// Contract Addresses - Updated for local Hardhat network
export const CONTRACT_ADDRESSES = {
  MC_TOKEN: "${mcAddress}",
  JBC_TOKEN: "${jbcAddress}",
  PROTOCOL: "${protocolAddress}" // Local Hardhat deployment
};`;

        // Replace the contract addresses section
        web3Content = web3Content.replace(
            /\/\/ Contract Addresses[\s\S]*?};/,
            newAddresses
        );

        fs.writeFileSync(web3ContextPath, web3Content);
        console.log('✅ Frontend configuration updated');

        // 5. Save deployment info
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
            testResults: {
                ticketPurchase: 'success',
                mcBalance: ethers.formatEther(await mc.balanceOf(deployer.address)),
                jbcBalance: ethers.formatEther(await jbc.balanceOf(deployer.address))
            }
        };

        const deploymentFile = `deployments/fix-deployment-${Date.now()}.json`;
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`✅ Deployment info saved: ${deploymentFile}`);

        // 6. Final instructions
        console.log('\n🎉 [Fix Complete]');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ All contracts deployed and tested successfully!');
        console.log('✅ Frontend configuration updated!');
        console.log('✅ Ticket purchase functionality verified!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n📋 [Next Steps for User]');
        console.log('1. 确保钱包连接到本地网络:');
        console.log('   - Network: Hardhat Local');
        console.log('   - RPC URL: http://localhost:8545');
        console.log('   - Chain ID: 31337');
        console.log('');
        console.log('2. 导入测试账户 (可选):');
        console.log(`   - Address: ${deployer.address}`);
        console.log('   - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
        console.log(`   - MC Balance: ${ethers.formatEther(await mc.balanceOf(deployer.address))} MC`);
        console.log('');
        console.log('3. 刷新前端页面，现在应该可以正常购买门票了！');
        
        console.log('\n🔧 [Contract Addresses]');
        console.log(`MC Token: ${mcAddress}`);
        console.log(`JBC Token: ${jbcAddress}`);
        console.log(`Protocol: ${protocolAddress}`);

    } catch (error) {
        console.error('❌ Fix failed:', error);
        console.log('\n🆘 [Manual Steps]');
        console.log('1. 确保 Hardhat 网络正在运行: npx hardhat node');
        console.log('2. 重新运行此脚本: node scripts/fix-ticket-purchase.cjs');
        console.log('3. 检查网络连接和钱包配置');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });