const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)"
];

const MC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

async function diagnoseAdminLiquidity(userAddress, mcAmount = "1") {
    console.log(`🔍 诊断管理员流动性添加功能\n`);
    console.log(`用户地址: ${userAddress}`);
    console.log(`测试MC数量: ${mcAmount} MC\n`);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, provider);
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, provider);
    
    // For write operations
    const protocolContractWithSigner = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);
    const mcContractWithSigner = new ethers.Contract(ADDRESSES.MC_TOKEN, MC_ABI, wallet);

    try {
        console.log("1. 权限检查:");
        console.log("-".repeat(50));
        
        const contractOwner = await protocolContract.owner();
        const isOwner = contractOwner.toLowerCase() === userAddress.toLowerCase();
        const isWalletOwner = contractOwner.toLowerCase() === wallet.address.toLowerCase();
        
        console.log(`   合约所有者: ${contractOwner}`);
        console.log(`   用户地址: ${userAddress}`);
        console.log(`   钱包地址: ${wallet.address}`);
        console.log(`   用户是所有者: ${isOwner ? '✅' : '❌'}`);
        console.log(`   钱包是所有者: ${isWalletOwner ? '✅' : '❌'}`);
        
        if (!isOwner && !isWalletOwner) {
            console.log("\n❌ 权限问题: 用户和钱包都不是合约所有者");
            return;
        }
        
        console.log("\n2. 余额检查:");
        console.log("-".repeat(50));
        
        const mcBalance = await mcContract.balanceOf(userAddress);
        const walletMcBalance = await mcContract.balanceOf(wallet.address);
        const amount = ethers.parseEther(mcAmount);
        
        console.log(`   用户MC余额: ${ethers.formatEther(mcBalance)} MC`);
        console.log(`   钱包MC余额: ${ethers.formatEther(walletMcBalance)} MC`);
        console.log(`   需要数量: ${mcAmount} MC`);
        console.log(`   用户余额足够: ${mcBalance >= amount ? '✅' : '❌'}`);
        console.log(`   钱包余额足够: ${walletMcBalance >= amount ? '✅' : '❌'}`);
        
        console.log("\n3. 授权检查:");
        console.log("-".repeat(50));
        
        const userAllowance = await mcContract.allowance(userAddress, ADDRESSES.PROTOCOL);
        const walletAllowance = await mcContract.allowance(wallet.address, ADDRESSES.PROTOCOL);
        
        console.log(`   用户授权额度: ${ethers.formatEther(userAllowance)} MC`);
        console.log(`   钱包授权额度: ${ethers.formatEther(walletAllowance)} MC`);
        console.log(`   用户授权足够: ${userAllowance >= amount ? '✅' : '❌'}`);
        console.log(`   钱包授权足够: ${walletAllowance >= amount ? '✅' : '❌'}`);
        
        console.log("\n4. 流动性池状态:");
        console.log("-".repeat(50));
        
        const reserveMC = await protocolContract.swapReserveMC();
        const reserveJBC = await protocolContract.swapReserveJBC();
        
        console.log(`   当前MC储备: ${ethers.formatEther(reserveMC)} MC`);
        console.log(`   当前JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
        
        console.log("\n5. 模拟添加流动性:");
        console.log("-".repeat(50));
        
        // 使用钱包地址进行测试（如果钱包是所有者）
        if (isWalletOwner) {
            console.log("   使用钱包地址进行测试...");
            
            // 检查是否需要授权
            if (walletAllowance < amount) {
                console.log("   需要先授权MC代币...");
                try {
                    // 模拟授权（不实际执行）
                    console.log(`   模拟授权: approve(${ADDRESSES.PROTOCOL}, ${ethers.formatEther(amount)})`);
                    console.log("   ✅ 授权模拟成功");
                } catch (error) {
                    console.log(`   ❌ 授权模拟失败: ${error.message}`);
                }
            }
            
            // 模拟添加流动性调用
            try {
                console.log(`   模拟调用: addLiquidity(${ethers.formatEther(amount)}, 0)`);
                
                // 使用 callStatic 进行模拟调用（不实际执行）
                await protocolContractWithSigner.addLiquidity.staticCall(amount, 0);
                console.log("   ✅ addLiquidity 模拟调用成功");
                
            } catch (error) {
                console.log(`   ❌ addLiquidity 模拟调用失败:`);
                console.log(`      错误: ${error.message}`);
                
                if (error.message.includes("Ownable")) {
                    console.log("      原因: 权限问题 - 调用者不是合约所有者");
                } else if (error.message.includes("insufficient")) {
                    console.log("      原因: 余额或授权不足");
                } else if (error.message.includes("transfer")) {
                    console.log("      原因: 代币转账失败");
                }
            }
        } else {
            console.log("   ⚠️  钱包不是合约所有者，跳过模拟测试");
        }
        
        console.log("\n6. 问题诊断:");
        console.log("-".repeat(50));
        
        if (!isOwner) {
            console.log("❌ 主要问题: 用户不是合约所有者");
            console.log("💡 解决方案:");
            console.log("   1. 使用合约所有者钱包连接");
            console.log("   2. 或者联系合约所有者转移所有权");
            console.log(`   3. 合约所有者地址: ${contractOwner}`);
        } else if (mcBalance < amount) {
            console.log("❌ 主要问题: MC余额不足");
            console.log("💡 解决方案:");
            console.log("   1. 获取更多MC代币");
            console.log(`   2. 或者减少添加数量（当前余额: ${ethers.formatEther(mcBalance)} MC）`);
        } else if (userAllowance < amount) {
            console.log("❌ 主要问题: MC授权不足");
            console.log("💡 解决方案:");
            console.log("   1. 先授权MC代币给合约");
            console.log(`   2. 需要授权数量: ${mcAmount} MC`);
        } else {
            console.log("✅ 所有检查通过，应该可以正常添加流动性");
            console.log("💡 如果仍然失败，可能是:");
            console.log("   1. 网络延迟或状态不同步");
            console.log("   2. 前端钱包连接问题");
            console.log("   3. Gas费不足");
        }
        
    } catch (error) {
        console.error("❌ 诊断过程中出现错误:", error.message);
    }
}

async function main() {
    const userAddress = process.argv[2];
    const mcAmount = process.argv[3] || "1";
    
    if (!userAddress) {
        console.log("使用方法: node scripts/diagnose-admin-liquidity.cjs <用户地址> [MC数量]");
        console.log("示例: node scripts/diagnose-admin-liquidity.cjs 0x1234567890123456789012345678901234567890 1");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    await diagnoseAdminLiquidity(userAddress, mcAmount);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { diagnoseAdminLiquidity };