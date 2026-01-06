#!/usr/bin/env node
/**
 * 直接添加流动性 - 绕过前端，直接调用合约
 * Direct Add Liquidity - Bypass frontend, call contract directly
 */

const { ethers } = require('ethers');
const readline = require('readline');
require('dotenv').config();

// 合约地址
const CONTRACT_ADDRESSES = {
    JBC_TOKEN: "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da",
    PROTOCOL: "0x0897Cee05E43B2eCf331cd80f881c211eb86844E",
};

// ABIs
const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function addLiquidity(uint256 jbcAmount) external payable",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
];

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 直接添加流动性工具');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 连接到 MC Chain
    const rpcUrl = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        console.error('❌ 错误：未找到 PRIVATE_KEY 环境变量');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`👤 账户地址: ${wallet.address}\n`);

    // 连接合约
    const protocolContract = new ethers.Contract(CONTRACT_ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);
    const jbcContract = new ethers.Contract(CONTRACT_ADDRESSES.JBC_TOKEN, JBC_ABI, wallet);

    // 检查权限
    const owner = await protocolContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 权限错误：您不是合约 Owner`);
        console.error(`   合约 Owner: ${owner}`);
        console.error(`   您的地址: ${wallet.address}`);
        process.exit(1);
    }
    console.log('✅ 权限检查通过\n');

    // 查看当前池子状态
    const poolMC = await protocolContract.swapReserveMC();
    const poolJBC = await protocolContract.swapReserveJBC();
    console.log('📊 当前池子状态:');
    console.log(`   MC 储备: ${ethers.formatEther(poolMC)} MC`);
    console.log(`   JBC 储备: ${ethers.formatEther(poolJBC)} JBC\n`);

    // 查看余额
    const mcBalance = await provider.getBalance(wallet.address);
    const jbcBalance = await jbcContract.balanceOf(wallet.address);
    console.log('💰 您的余额:');
    console.log(`   MC: ${ethers.formatEther(mcBalance)} MC`);
    console.log(`   JBC: ${ethers.formatEther(jbcBalance)} JBC\n`);

    // 输入要添加的数量
    const mcInput = await question('输入要添加的 MC 数量（回车跳过）: ');
    const jbcInput = await question('输入要添加的 JBC 数量（回车跳过）: ');

    const mcAmount = mcInput.trim() ? ethers.parseEther(mcInput.trim()) : 0n;
    const jbcAmount = jbcInput.trim() ? ethers.parseEther(jbcInput.trim()) : 0n;

    if (mcAmount === 0n && jbcAmount === 0n) {
        console.log('\n⚠️  未输入任何数量，退出');
        rl.close();
        process.exit(0);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 确认信息:');
    console.log(`   添加 MC: ${ethers.formatEther(mcAmount)} MC`);
    console.log(`   添加 JBC: ${ethers.formatEther(jbcAmount)} JBC`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const confirm = await question('确认添加流动性？(yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('\n❌ 用户取消');
        rl.close();
        process.exit(0);
    }

    console.log('\n🚀 开始添加流动性...\n');

    try {
        // 检查并授权 JBC
        if (jbcAmount > 0n) {
            const allowance = await jbcContract.allowance(wallet.address, CONTRACT_ADDRESSES.PROTOCOL);
            console.log(`🔍 检查 JBC 授权: ${ethers.formatEther(allowance)} JBC`);

            if (allowance < jbcAmount) {
                console.log('⚠️  JBC 授权不足，开始授权...');
                const approveTx = await jbcContract.approve(CONTRACT_ADDRESSES.PROTOCOL, ethers.MaxUint256);
                console.log(`📝 授权交易: ${approveTx.hash}`);
                await approveTx.wait();
                console.log('✅ JBC 授权成功\n');

                // 等待2秒确保状态更新
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log('✅ JBC 已授权\n');
            }
        }

        // 添加流动性
        console.log('💧 调用 addLiquidity...');
        const txParams = {};
        if (mcAmount > 0n) {
            txParams.value = mcAmount;
        }

        const tx = await protocolContract.addLiquidity(jbcAmount, txParams);
        console.log(`📝 交易已发送: ${tx.hash}`);
        console.log(`   查看交易: https://explorer.mcchain.io/tx/${tx.hash}\n`);

        console.log('⏳ 等待交易确认...');
        const receipt = await tx.wait();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ 流动性添加成功！');
        console.log(`   区块号: ${receipt.blockNumber}`);
        console.log(`   Gas 使用: ${receipt.gasUsed.toString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 查看新的池子状态
        const newPoolMC = await protocolContract.swapReserveMC();
        const newPoolJBC = await protocolContract.swapReserveJBC();
        console.log('📊 新的池子状态:');
        console.log(`   MC 储备: ${ethers.formatEther(newPoolMC)} MC (+${ethers.formatEther(newPoolMC - poolMC)})`);
        console.log(`   JBC 储备: ${ethers.formatEther(newPoolJBC)} JBC (+${ethers.formatEther(newPoolJBC - poolJBC)})\n`);

    } catch (error) {
        console.error('\n❌ 添加流动性失败:', error.message);
        if (error.reason) {
            console.error('   原因:', error.reason);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ 脚本执行失败:', error.message);
        process.exit(1);
    });
