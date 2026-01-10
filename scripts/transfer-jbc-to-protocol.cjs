#!/usr/bin/env node
/**
 * 转账 1,000,001 JBC 到 Protocol 合约
 * 用于匹配 swapReserveJBC 储备变量
 */

const { ethers } = require('ethers');
const readline = require('readline');
require('dotenv').config();

const JBC_ADDRESS = '0x1Bf9ACe2485BC3391150762a109886d0B85f40Da';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const JBC_ABI = [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address) view returns (uint256)',
];

const PROTOCOL_ABI = [
    'function swapReserveJBC() view returns (uint256)',
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
    console.log('💰 转账 1,000,001 JBC 到 Protocol 合约');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const jbcContract = new ethers.Contract(JBC_ADDRESS, JBC_ABI, wallet);
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log('👤 您的地址:', wallet.address);
    console.log('🪙 JBC 合约:', JBC_ADDRESS);
    console.log('📜 Protocol 合约:', PROTOCOL_ADDRESS);
    console.log();

    // 检查余额
    const yourBalance = await jbcContract.balanceOf(wallet.address);
    const protocolBalance = await jbcContract.balanceOf(PROTOCOL_ADDRESS);
    const swapReserve = await protocolContract.swapReserveJBC();

    console.log('📊 当前状态:');
    console.log('   您的 JBC 余额:', ethers.formatEther(yourBalance), 'JBC');
    console.log('   Protocol JBC 余额:', ethers.formatEther(protocolBalance), 'JBC');
    console.log('   swapReserveJBC 变量:', ethers.formatEther(swapReserve), 'JBC');
    console.log();

    const targetAmount = ethers.parseEther('1000001');
    const needAmount = swapReserve - protocolBalance;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 转账计划:');
    console.log('   目标储备:', ethers.formatEther(swapReserve), 'JBC');
    console.log('   当前余额:', ethers.formatEther(protocolBalance), 'JBC');
    console.log('   需要转入:', ethers.formatEther(needAmount), 'JBC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 检查是否有足够余额
    if (yourBalance < needAmount) {
        console.error('❌ 您的 JBC 余额不足！');
        console.error(`   需要: ${ethers.formatEther(needAmount)} JBC`);
        console.error(`   拥有: ${ethers.formatEther(yourBalance)} JBC`);
        console.error(`   缺少: ${ethers.formatEther(needAmount - yourBalance)} JBC`);
        rl.close();
        process.exit(1);
    }

    // 确认
    console.log(`⚠️  警告: 您将要转账 ${ethers.formatEther(needAmount)} JBC 到 Protocol 合约`);
    console.log('   这个操作不可逆！请确认：');
    console.log('   1. 目标地址正确');
    console.log('   2. 数量正确');
    console.log();

    const confirm1 = await question('确认转账？(输入 yes 继续): ');
    if (confirm1.toLowerCase() !== 'yes') {
        console.log('\n❌ 用户取消');
        rl.close();
        process.exit(0);
    }

    const confirm2 = await question(`再次确认：转账 ${ethers.formatEther(needAmount)} JBC？(输入数字 ${ethers.formatEther(needAmount)}): `);
    if (confirm2.trim() !== ethers.formatEther(needAmount)) {
        console.log('\n❌ 确认失败，取消操作');
        rl.close();
        process.exit(0);
    }

    try {
        console.log('\n🚀 开始转账...');
        const tx = await jbcContract.transfer(PROTOCOL_ADDRESS, needAmount);
        console.log('📝 交易哈希:', tx.hash);
        console.log('🔗 查看交易: https://scan.mcerscan.com/tx/' + tx.hash);
        console.log('⏳ 等待确认...');

        const receipt = await tx.wait();
        console.log('✅ 转账成功！区块:', receipt.blockNumber);
        console.log();

        // 验证结果
        const newProtocolBalance = await jbcContract.balanceOf(PROTOCOL_ADDRESS);
        const finalSwapReserve = await protocolContract.swapReserveJBC();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 转账后状态:');
        console.log('   Protocol JBC 余额:', ethers.formatEther(newProtocolBalance), 'JBC');
        console.log('   swapReserveJBC 变量:', ethers.formatEther(finalSwapReserve), 'JBC');

        if (newProtocolBalance === finalSwapReserve) {
            console.log('   ✅ 数据一致！余额 = 储备');
        } else {
            const diff = newProtocolBalance - finalSwapReserve;
            console.log('   ⚠️  差异:', ethers.formatEther(diff), 'JBC');
            if (diff > 0n) {
                console.log('   说明: 实际余额大于储备变量');
            } else {
                console.log('   说明: 实际余额小于储备变量');
            }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🎉 操作完成！');

    } catch (error) {
        console.error('\n❌ 转账失败:', error.message);
        if (error.reason) {
            console.error('   原因:', error.reason);
        }
    } finally {
        rl.close();
    }
}

main();
