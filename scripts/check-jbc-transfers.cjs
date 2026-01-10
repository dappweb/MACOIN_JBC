#!/usr/bin/env node
/**
 * 检查 JBC 历史转账记录
 * 找出 Protocol 合约的 JBC 去哪了
 */

const { ethers } = require('ethers');
require('dotenv').config();

const JBC_ADDRESS = '0x1Bf9ACe2485BC3391150762a109886d0B85f40Da';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

async function main() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 检查 JBC 历史转账记录');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
    const jbcContract = new ethers.Contract(
        JBC_ADDRESS,
        ['event Transfer(address indexed from, address indexed to, uint256 value)'],
        provider
    );

    console.log('📜 JBC 合约:', JBC_ADDRESS);
    console.log('📜 Protocol 合约:', PROTOCOL_ADDRESS);
    console.log();

    // 查询转入 Protocol 的记录
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 转入 Protocol 的 JBC:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const transferInFilter = jbcContract.filters.Transfer(null, PROTOCOL_ADDRESS);
    const transferInEvents = await jbcContract.queryFilter(transferInFilter, 0, 'latest');

    let totalIn = 0n;
    transferInEvents.forEach((event, index) => {
        const amount = event.args.value;
        totalIn += amount;
        console.log(`${index + 1}. 从 ${event.args.from.slice(0, 10)}... 转入 ${ethers.formatEther(amount)} JBC`);
        console.log(`   交易: ${event.transactionHash}`);
        console.log(`   区块: ${event.blockNumber}`);
        console.log();
    });

    console.log(`✅ 总转入: ${ethers.formatEther(totalIn)} JBC\n`);

    // 查询从 Protocol 转出的记录
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 从 Protocol 转出的 JBC:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const transferOutFilter = jbcContract.filters.Transfer(PROTOCOL_ADDRESS, null);
    const transferOutEvents = await jbcContract.queryFilter(transferOutFilter, 0, 'latest');

    let totalOut = 0n;
    transferOutEvents.forEach((event, index) => {
        const amount = event.args.value;
        totalOut += amount;
        console.log(`${index + 1}. 转出到 ${event.args.to.slice(0, 10)}... ${ethers.formatEther(amount)} JBC`);
        console.log(`   交易: ${event.transactionHash}`);
        console.log(`   区块: ${event.blockNumber}`);
        console.log();
    });

    console.log(`❌ 总转出: ${ethers.formatEther(totalOut)} JBC\n`);

    // 计算差额
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 统计结果:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`转入总量: ${ethers.formatEther(totalIn)} JBC`);
    console.log(`转出总量: ${ethers.formatEther(totalOut)} JBC`);

    const netBalance = totalIn - totalOut;
    console.log(`账面余额: ${ethers.formatEther(netBalance)} JBC`);
    console.log();

    // 检查实际余额
    const actualBalance = await provider.getBalance(PROTOCOL_ADDRESS);
    const jbcBalance = await new ethers.Contract(
        JBC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
    ).balanceOf(PROTOCOL_ADDRESS);

    console.log(`实际 JBC 余额: ${ethers.formatEther(jbcBalance)} JBC`);
    console.log();

    // 分析差异
    if (netBalance === jbcBalance) {
        console.log('✅ 数据一致：账面余额 = 实际余额');
    } else {
        const diff = netBalance - jbcBalance;
        console.log(`⚠️  数据不一致：差额 ${ethers.formatEther(diff)} JBC`);
        if (diff > 0n) {
            console.log('   说明：有 JBC 被转出但未记录在 Transfer 事件中');
            console.log('   可能原因：合约内部转账或 burn');
        } else {
            console.log('   说明：有 JBC 转入但未记录在 Transfer 事件中');
            console.log('   可能原因：直接 mint 到合约');
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 建议:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 检查转出交易，确定 JBC 去向');
    console.log('2. 检查 Protocol 合约代码中的 withdraw/remove 函数');
    console.log('3. 确认 swapReserveJBC 变量是否在每次转出时正确更新');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ 检查失败:', error.message);
        process.exit(1);
    });
