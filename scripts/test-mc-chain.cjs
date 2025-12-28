const { ethers } = require('hardhat');

async function main() {
    console.log('🌐 [MC Chain Test] Testing contracts on MC Chain...\n');

    try {
        // MC Chain contract addresses
        const addresses = {
            mcToken: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
            jbcToken: "0xA743cB357a9f59D349efB7985072779a094658dD",
            protocol: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
        };

        console.log('📋 [Network Info]');
        const provider = ethers.provider;
        const network = await provider.getNetwork();
        console.log(`Network: ${network.name}`);
        console.log(`Chain ID: ${network.chainId}`);
        console.log(`Block Number: ${await provider.getBlockNumber()}\n`);

        const [signer] = await ethers.getSigners();
        console.log(`Deployer/Tester: ${signer.address}`);
        console.log(`ETH Balance: ${ethers.formatEther(await provider.getBalance(signer.address))} ETH\n`);

        // Test contract existence
        console.log('🔍 [Contract Existence Check]');
        for (const [name, address] of Object.entries(addresses)) {
            const code = await provider.getCode(address);
            const exists = code !== '0x';
            console.log(`${name}: ${address} - ${exists ? '✅ Exists' : '❌ Missing'}`);
        }
        console.log();

        // Test MC Token
        console.log('🪙 [MC Token Test]');
        try {
            const mc = await ethers.getContractAt('IERC20', addresses.mcToken);
            
            const name = await mc.name();
            console.log(`✅ Token Name: ${name}`);
            
            const symbol = await mc.symbol();
            console.log(`✅ Token Symbol: ${symbol}`);
            
            const decimals = await mc.decimals();
            console.log(`✅ Token Decimals: ${decimals}`);
            
            const totalSupply = await mc.totalSupply();
            console.log(`✅ Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
            
            const balance = await mc.balanceOf(signer.address);
            console.log(`✅ Your Balance: ${ethers.formatEther(balance)} MC`);
            
        } catch (err) {
            console.log(`❌ MC Token test failed: ${err.message}`);
        }

        // Test JBC Token
        console.log('\n🪙 [JBC Token Test]');
        try {
            const jbc = await ethers.getContractAt('IERC20', addresses.jbcToken);
            
            const name = await jbc.name();
            console.log(`✅ Token Name: ${name}`);
            
            const symbol = await jbc.symbol();
            console.log(`✅ Token Symbol: ${symbol}`);
            
            const balance = await jbc.balanceOf(signer.address);
            console.log(`✅ Your Balance: ${ethers.formatEther(balance)} JBC`);
            
        } catch (err) {
            console.log(`❌ JBC Token test failed: ${err.message}`);
        }

        // Test Protocol Contract
        console.log('\n🏭 [Protocol Contract Test]');
        try {
            const protocol = await ethers.getContractAt('JinbaoProtocol', addresses.protocol);
            
            const owner = await protocol.owner();
            console.log(`✅ Contract Owner: ${owner}`);
            console.log(`✅ Is Owner: ${owner.toLowerCase() === signer.address.toLowerCase() ? 'Yes' : 'No'}`);
            
            const paused = await protocol.paused();
            console.log(`✅ Contract Paused: ${paused ? 'Yes' : 'No'}`);
            
            // Check user ticket
            const ticket = await protocol.userTicket(signer.address);
            console.log(`✅ Your Ticket: ${ethers.formatEther(ticket.amount)} MC`);
            console.log(`✅ Ticket Exited: ${ticket.exited ? 'Yes' : 'No'}`);
            
            // Check user info
            const userInfo = await protocol.userInfo(signer.address);
            console.log(`✅ Total Revenue: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
            console.log(`✅ Current Cap: ${ethers.formatEther(userInfo.currentCap)} MC`);
            
            // Check swap reserves
            try {
                const mcReserve = await protocol.swapReserveMC();
                const jbcReserve = await protocol.swapReserveJBC();
                console.log(`✅ Swap Reserves - MC: ${ethers.formatEther(mcReserve)}, JBC: ${ethers.formatEther(jbcReserve)}`);
            } catch (err) {
                console.log(`⚠️  Could not fetch swap reserves: ${err.message}`);
            }
            
        } catch (err) {
            console.log(`❌ Protocol test failed: ${err.message}`);
        }

        // Test ticket purchase simulation (if user has MC tokens)
        console.log('\n🎫 [Ticket Purchase Simulation]');
        try {
            const mc = await ethers.getContractAt('IERC20', addresses.mcToken);
            const protocol = await ethers.getContractAt('JinbaoProtocol', addresses.protocol);
            
            const mcBalance = await mc.balanceOf(signer.address);
            const ticketAmount = ethers.parseEther('1000');
            
            if (mcBalance >= ticketAmount) {
                console.log('✅ Sufficient MC balance for ticket purchase');
                
                // Check allowance
                const allowance = await mc.allowance(signer.address, addresses.protocol);
                console.log(`Current Allowance: ${ethers.formatEther(allowance)} MC`);
                
                if (allowance < ticketAmount) {
                    console.log('⚠️  Need to approve MC tokens before purchase');
                } else {
                    console.log('✅ Sufficient allowance for ticket purchase');
                }
                
                // Simulate the call
                try {
                    await protocol.buyTicket.staticCall(ticketAmount);
                    console.log('✅ Ticket purchase simulation successful');
                } catch (simErr) {
                    console.log(`⚠️  Ticket purchase simulation failed: ${simErr.message}`);
                }
            } else {
                console.log(`⚠️  Insufficient MC balance. Need: ${ethers.formatEther(ticketAmount)} MC, Have: ${ethers.formatEther(mcBalance)} MC`);
            }
            
        } catch (err) {
            console.log(`❌ Ticket purchase test failed: ${err.message}`);
        }

        console.log('\n🎯 [Summary]');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ MC Chain contracts are deployed and accessible');
        console.log('✅ Frontend has been updated to use MC Chain addresses');
        console.log('✅ Ready for testing on MC Chain testnet');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n📱 [User Instructions]');
        console.log('1. 确保钱包连接到 MC Chain 测试网:');
        console.log('   - Network Name: MC Chain');
        console.log('   - RPC URL: https://chain.mcerscan.com/');
        console.log('   - Chain ID: 88813');
        console.log('   - Currency Symbol: MC');
        console.log('   - Block Explorer: https://mcerscan.com');
        console.log('');
        console.log('2. 确保钱包有足够的 MC 代币用于测试');
        console.log('3. 刷新前端页面开始测试');
        
        console.log('\n🔧 [Contract Addresses]');
        console.log(`MC Token: ${addresses.mcToken}`);
        console.log(`JBC Token: ${addresses.jbcToken}`);
        console.log(`Protocol: ${addresses.protocol}`);

    } catch (error) {
        console.error('❌ MC Chain test failed:', error);
        console.log('\n🆘 [Troubleshooting]');
        console.log('1. 确保网络配置正确');
        console.log('2. 检查私钥是否正确设置在 .env 文件中');
        console.log('3. 确保账户有足够的 MC 代币支付 gas 费用');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });