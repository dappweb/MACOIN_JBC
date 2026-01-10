#!/usr/bin/env node
/**
 * 诊断 JBC transferFrom 问题
 * 测试 JBC 合约的 transferFrom 是否能正常工作
 */

const { ethers } = require('ethers');
require('dotenv').config();

const JBC_ADDRESS = '0x1Bf9ACe2485BC3391150762a109886d0B85f40Da';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const JBC_ABI = [
    'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function owner() view returns (address)',
    'function protocolAddress() view returns (address)',
];

async function main() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 JBC TransferFrom 诊断工具');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const jbcContract = new ethers.Contract(JBC_ADDRESS, JBC_ABI, wallet);

    console.log('👤 当前账户:', wallet.address);
    console.log('🪙 JBC 合约:', JBC_ADDRESS);
    console.log('📜 Protocol:', PROTOCOL_ADDRESS);
    console.log();

    // 检查配置
    const jbcOwner = await jbcContract.owner();
    const protocolAddr = await jbcContract.protocolAddress();
    const balance = await jbcContract.balanceOf(wallet.address);
    const allowance = await jbcContract.allowance(wallet.address, PROTOCOL_ADDRESS);

    console.log('📊 JBC 合约状态:');
    console.log('   Owner:', jbcOwner);
    console.log('   Protocol Address:', protocolAddr);
    console.log('   您的余额:', ethers.formatEther(balance), 'JBC');
    console.log('   授权额度:', ethers.formatEther(allowance), 'JBC');
    console.log();

    // 测试1: 直接 transfer 到 Protocol
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('测试 1: 直接 transfer 1 JBC 到 Protocol');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const amount = ethers.parseEther('1');
        await jbcContract.transfer.staticCall(PROTOCOL_ADDRESS, amount);
        console.log('✅ transfer 静态调用成功！');
    } catch (error) {
        console.log('❌ transfer 静态调用失败:', error.message);
        console.log('   Data:', error.data);
    }
    console.log();

    // 测试2: transferFrom (模拟 Protocol 调用)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('测试 2: transferFrom 1 JBC（Owner → Protocol）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const amount = ethers.parseEther('1');

        // 先检查授权
        if (allowance < amount) {
            console.log('⚠️  授权不足，跳过测试');
        } else {
            console.log('🧪 执行静态调用: transferFrom(owner, protocol, 1 JBC)');
            await jbcContract.transferFrom.staticCall(wallet.address, PROTOCOL_ADDRESS, amount);
            console.log('✅ transferFrom 静态调用成功！');
        }
    } catch (error) {
        console.log('❌ transferFrom 静态调用失败!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('错误信息:', error.message);
        console.log('错误代码:', error.code);
        console.log('错误数据:', error.data);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (error.data === '0x82a6e09c') {
            console.log('\n🔍 错误分析: TransferFromFailed');
            console.log('');
            console.log('可能原因:');
            console.log('1. JBC 合约的 _update 函数在处理 transferFrom 时出错');
            console.log('2. 即使 from/to 都满足免税条件，仍然触发了某些检查失败');
            console.log('3. ERC20 标准实现与自定义 _update 逻辑冲突');
            console.log('');
            console.log('💡 解决方案:');
            console.log('需要修改 JBC 合约的 _update 函数');
            console.log('或者先 transfer 到一个中间地址，再转到 Protocol');
        }
    }
    console.log();

    // 测试3: 检查 Protocol 余额和合约状态
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('测试 3: 检查 Protocol 合约的 JBC 余额');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const protocolBalance = await jbcContract.balanceOf(PROTOCOL_ADDRESS);
    console.log('Protocol JBC 余额:', ethers.formatEther(protocolBalance), 'JBC');
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 诊断总结');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('根据测试结果，我们可以确定问题所在。');
    console.log('如果 transfer 成功但 transferFrom 失败，');
    console.log('说明问题在于 ERC20 的 transferFrom 实现。');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ 诊断失败:', error.message);
        process.exit(1);
    });
