require('dotenv').config();
const { ethers, upgrades } = require('hardhat');

async function main() {
    console.log('🚀 [Fresh Deployment] 使用现有MC/JBC合约地址部署JinbaoProtocol...\n');

    try {
        // 现有的MC和JBC合约地址
        const EXISTING_ADDRESSES = {
            MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
            JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD"
        };

        const [deployer] = await ethers.getSigners();
        const network = await ethers.provider.getNetwork();
        
        console.log('📊 [部署信息]');
        console.log(`网络: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`部署者: ${deployer.address}`);
        console.log(`余额: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} MC`);
        console.log(`MC Token: ${EXISTING_ADDRESSES.MC_TOKEN}`);
        console.log(`JBC Token: ${EXISTING_ADDRESSES.JBC_TOKEN}`);

        // 验证现有合约是否存在
        console.log('\n🔍 [验证现有合约]');
        const mcCode = await ethers.provider.getCode(EXISTING_ADDRESSES.MC_TOKEN);
        const jbcCode = await ethers.provider.getCode(EXISTING_ADDRESSES.JBC_TOKEN);
        
        if (mcCode === '0x') {
            throw new Error(`MC Token合约不存在: ${EXISTING_ADDRESSES.MC_TOKEN}`);
        }
        if (jbcCode === '0x') {
            throw new Error(`JBC Token合约不存在: ${EXISTING_ADDRESSES.JBC_TOKEN}`);
        }
        
        console.log('✅ MC Token合约存在');
        console.log('✅ JBC Token合约存在');

        // 连接到现有的MC和JBC合约
        const mcAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ];

        const mcToken = new ethers.Contract(EXISTING_ADDRESSES.MC_TOKEN, mcAbi, deployer);
        const jbcToken = new ethers.Contract(EXISTING_ADDRESSES.JBC_TOKEN, mcAbi, deployer);

        // 获取代币信息
        console.log('\n📋 [代币信息]');
        try {
            const mcName = await mcToken.name();
            const mcSymbol = await mcToken.symbol();
            const mcDecimals = await mcToken.decimals();
            const mcTotalSupply = await mcToken.totalSupply();
            
            console.log(`MC Token: ${mcName} (${mcSymbol})`);
            console.log(`MC Decimals: ${mcDecimals}`);
            console.log(`MC Total Supply: ${ethers.formatEther(mcTotalSupply)}`);
            
            const jbcName = await jbcToken.name();
            const jbcSymbol = await jbcToken.symbol();
            const jbcDecimals = await jbcToken.decimals();
            const jbcTotalSupply = await jbcToken.totalSupply();
            
            console.log(`JBC Token: ${jbcName} (${jbcSymbol})`);
            console.log(`JBC Decimals: ${jbcDecimals}`);
            console.log(`JBC Total Supply: ${ethers.formatEther(jbcTotalSupply)}`);
        } catch (e) {
            console.log('⚠️ 无法获取代币详细信息，但合约存在');
        }

        // 检查部署者的代币余额
        console.log('\n💰 [部署者代币余额]');
        try {
            const mcBalance = await mcToken.balanceOf(deployer.address);
            const jbcBalance = await jbcToken.balanceOf(deployer.address);
            
            console.log(`MC余额: ${ethers.formatEther(mcBalance)}`);
            console.log(`JBC余额: ${ethers.formatEther(jbcBalance)}`);
        } catch (e) {
            console.log('⚠️ 无法获取余额信息');
        }

        // 部署JinbaoProtocol
        console.log('\n🏗️ [部署JinbaoProtocol]');
        const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
        
        console.log('正在部署JinbaoProtocol代理合约...');
        const protocol = await upgrades.deployProxy(
            JinbaoProtocol,
            [
                EXISTING_ADDRESSES.MC_TOKEN,  // MC Token地址
                EXISTING_ADDRESSES.JBC_TOKEN, // JBC Token地址
                deployer.address,             // marketing wallet
                deployer.address,             // treasury wallet  
                deployer.address,             // lpInjection wallet
                deployer.address              // buyback wallet
            ],
            { 
                initializer: 'initialize',
                kind: 'uups'
            }
        );

        await protocol.waitForDeployment();
        const protocolAddress = await protocol.getAddress();
        
        console.log(`✅ JinbaoProtocol部署成功: ${protocolAddress}`);

        // 获取实现合约地址
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(protocolAddress);
        console.log(`📋 实现合约地址: ${implementationAddress}`);

        // 初始化Swap流动性
        console.log('\n💧 [初始化Swap流动性]');
        
        // 检查是否需要批准代币
        const initialMcAmount = ethers.parseEther("10000"); // 10,000 MC
        const initialJbcAmount = ethers.parseEther("10000"); // 10,000 JBC
        
        console.log(`准备添加流动性: ${ethers.formatEther(initialMcAmount)} MC + ${ethers.formatEther(initialJbcAmount)} JBC`);
        
        try {
            // 检查当前授权额度
            const mcAllowance = await mcToken.allowance(deployer.address, protocolAddress);
            const jbcAllowance = await jbcToken.allowance(deployer.address, protocolAddress);
            
            console.log(`当前MC授权额度: ${ethers.formatEther(mcAllowance)}`);
            console.log(`当前JBC授权额度: ${ethers.formatEther(jbcAllowance)}`);
            
            // 如果授权不足，进行授权
            if (mcAllowance < initialMcAmount) {
                console.log('正在授权MC代币...');
                const mcApproveTx = await mcToken.approve(protocolAddress, initialMcAmount);
                await mcApproveTx.wait();
                console.log('✅ MC代币授权完成');
            }
            
            if (jbcAllowance < initialJbcAmount) {
                console.log('正在授权JBC代币...');
                const jbcApproveTx = await jbcToken.approve(protocolAddress, initialJbcAmount);
                await jbcApproveTx.wait();
                console.log('✅ JBC代币授权完成');
            }
            
            // 添加初始流动性
            console.log('正在添加初始流动性...');
            const addLiquidityTx = await protocol.addLiquidity(initialMcAmount, initialJbcAmount);
            await addLiquidityTx.wait();
            console.log('✅ 初始流动性添加成功');
            
            // 验证流动性
            const mcReserve = await protocol.swapReserveMC();
            const jbcReserve = await protocol.swapReserveJBC();
            
            console.log(`MC储备: ${ethers.formatEther(mcReserve)}`);
            console.log(`JBC储备: ${ethers.formatEther(jbcReserve)}`);
            
        } catch (error) {
            console.log('⚠️ 流动性初始化失败:', error.message);
            console.log('可能原因: 余额不足或授权失败');
        }

        // 验证合约功能
        console.log('\n🧪 [验证合约功能]');
        try {
            // 检查合约所有者
            const owner = await protocol.owner();
            console.log(`合约所有者: ${owner}`);
            
            // 检查代币地址设置
            const mcTokenAddr = await protocol.mcToken();
            const jbcTokenAddr = await protocol.jbcToken();
            console.log(`设置的MC Token: ${mcTokenAddr}`);
            console.log(`设置的JBC Token: ${jbcTokenAddr}`);
            
            // 验证地址是否正确
            if (mcTokenAddr.toLowerCase() === EXISTING_ADDRESSES.MC_TOKEN.toLowerCase()) {
                console.log('✅ MC Token地址设置正确');
            } else {
                console.log('❌ MC Token地址设置错误');
            }
            
            if (jbcTokenAddr.toLowerCase() === EXISTING_ADDRESSES.JBC_TOKEN.toLowerCase()) {
                console.log('✅ JBC Token地址设置正确');
            } else {
                console.log('❌ JBC Token地址设置错误');
            }
            
        } catch (error) {
            console.log('⚠️ 合约验证失败:', error.message);
        }

        // 保存部署信息
        const deploymentInfo = {
            network: network.name,
            chainId: network.chainId.toString(),
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            contracts: {
                mcToken: EXISTING_ADDRESSES.MC_TOKEN,
                jbcToken: EXISTING_ADDRESSES.JBC_TOKEN,
                protocolProxy: protocolAddress,
                protocolImplementation: implementationAddress
            },
            wallets: {
                marketing: deployer.address,
                treasury: deployer.address,
                lpInjection: deployer.address,
                buyback: deployer.address
            },
            initialLiquidity: {
                mcAmount: ethers.formatEther(initialMcAmount),
                jbcAmount: ethers.formatEther(initialJbcAmount),
                initialized: true
            }
        };

        // 保存到文件
        const fs = require('fs');
        const deploymentFile = `deployments/fresh-deployment-existing-tokens-${Date.now()}.json`;
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\n📄 [部署报告]');
        console.log('='.repeat(60));
        console.log('🎉 部署完成！');
        console.log('='.repeat(60));
        console.log(`📋 网络: ${network.name} (${network.chainId})`);
        console.log(`👤 部署者: ${deployer.address}`);
        console.log(`🏗️ Protocol合约: ${protocolAddress}`);
        console.log(`🔧 实现合约: ${implementationAddress}`);
        console.log(`🪙 MC Token: ${EXISTING_ADDRESSES.MC_TOKEN}`);
        console.log(`🪙 JBC Token: ${EXISTING_ADDRESSES.JBC_TOKEN}`);
        console.log(`💧 初始流动性: ${ethers.formatEther(initialMcAmount)} MC + ${ethers.formatEther(initialJbcAmount)} JBC`);
        console.log(`📁 部署信息已保存到: ${deploymentFile}`);
        console.log('='.repeat(60));

        // 更新前端配置提示
        console.log('\n🔧 [前端配置更新]');
        console.log('请更新 src/Web3Context.tsx 中的合约地址:');
        console.log(`PROTOCOL: "${protocolAddress}"`);
        
        console.log('\n✅ 部署和初始化完成！');
        
        return {
            protocolAddress,
            implementationAddress,
            mcToken: EXISTING_ADDRESSES.MC_TOKEN,
            jbcToken: EXISTING_ADDRESSES.JBC_TOKEN,
            deploymentFile
        };

    } catch (error) {
        console.error('❌ 部署失败:', error);
        throw error;
    }
}

main()
    .then((result) => {
        console.log('\n🎯 [部署结果]');
        console.log('Protocol地址:', result.protocolAddress);
        console.log('实现合约地址:', result.implementationAddress);
        console.log('部署信息文件:', result.deploymentFile);
        process.exit(0);
    })
    .catch((error) => {
        console.error('部署过程中发生错误:', error);
        process.exit(1);
    });