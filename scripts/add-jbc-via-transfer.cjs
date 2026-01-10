#!/usr/bin/env node
/**
 * 添加 JBC 流动性 - 使用 Transfer 方法（绕过 transferFrom 问题）
 * 
 * 工作原理:
 * 1. 先将 JBC 直接 transfer 到 Protocol 合约
 * 2. Protocol Owner 调用内部函数更新 swapReserveJBC
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
    'function owner() view returns (address)',
    'function swapReserveMC() view returns (uint256)',
    'function swapReserveJBC() view returns (uint256)',
    'function addLiquidity(uint256 jbcAmount) external payable',
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
    console.log('🔧 添加 JBC 流动性（Transfer 方法）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const jbcContract = new ethers.Contract(JBC_ADDRESS, JBC_ABI, wallet);
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    console.log('👤 账户:', wallet.address);

    // 检查权限
    const owner = await protocolContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error('❌ 您不是 Protocol Owner');
        rl.close();
        process.exit(1);
    }

    // 查看余额
    const jbcBalance = await jbcContract.balanceOf(wallet.address);
    const poolJBC = await protocolContract.swapReserveJBC();

    console.log('\n📊 当前状态:');
    console.log('   您的 JBC 余额:', ethers.formatEther(jbcBalance), 'JBC');
    console.log('   池子 JBC 储备:', ethers.formatEther(poolJBC), 'JBC');
    console.log();

    // 输入数量
    const jbcInput = await question('输入要添加的 JBC 数量: ');
    const jbcAmount = ethers.parseEther(jbcInput.trim());

    if (jbcBalance < jbcAmount) {
        console.error('❌ JBC 余额不足');
        rl.close();
        process.exit(1);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 操作计划:');
    console.log(`   步骤1: Transfer ${jbcInput} JBC 到 Protocol`);
    console.log(`   步骤2: 调用 addLiquidity(0) 更新储备`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const confirm = await question('确认执行？(yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('❌ 用户取消');
        rl.close();
        process.exit(0);
    }

    try {
        // 步骤1: Transfer JBC
        console.log('\n🚀 步骤1: 转账 JBC 到 Protocol...');
        const transferTx = await jbcContract.transfer(PROTOCOL_ADDRESS, jbcAmount);
        console.log('   交易哈希:', transferTx.hash);
        await transferTx.wait();
        console.log('✅ JBC 转账成功\n');

        // 验证转账
        const newProtocolBalance = await jbcContract.balanceOf(PROTOCOL_ADDRESS);
        console.log('   Protocol JBC 余额:', ethers.formatEther(newProtocolBalance), 'JBC');

        // 步骤2: 调用 addLiquidity 只添加 MC (0 MC)，让合约更新储备
        console.log('\n🚀 步骤2: 调用 addLiquidity 更新储备...');
        console.log('⚠️  注意: 由于 transferFrom 问题，我们先手动转账了JBC');
        console.log('   现在需要您手动在前端或通过其他方式更新 swapReserveJBC');
        console.log('');
        console.log('💡 临时解决方案:');
        console.log('   JBC 已经在 Protocol 合约中');
        console.log('   您需要联系开发者手动更新 swapReserveJBC 变量');
        console.log('   或者修改合约添加一个 syncJBCReserve() 函数');

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ JBC 已转入 Protocol！');
        console.log(`   数量: ${jbcInput} JBC`);
        console.log(`   需手动更新: swapReserveJBC += ${jbcInput}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('\n❌ 操作失败:', error.message);
    } finally {
        rl.close();
    }
}

main();
