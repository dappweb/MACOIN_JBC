#!/usr/bin/env node
/**
 * 每日燃烧定时任务脚本
 * 
 * 使用方法:
 * 1. 直接运行: node scripts/daily-burn-cron.cjs
 * 2. 添加到 crontab: 
 *    crontab -e
 *    0 10 * * * cd /path/to/project && node scripts/daily-burn-cron.cjs >> /var/log/daily-burn.log 2>&1
 * 
 * 环境变量 (在 .env 文件中配置):
 * - PRIVATE_KEY 或 OWNER_PRIVATE_KEY: Owner 钱包私钥
 */

require('dotenv').config();
const { ethers } = require('ethers');

const RPC_URL = 'https://chain.mcerscan.com/';
const PROTOCOL_ADDRESS = '0x0897Cee05E43B2eCf331cd80f881c211eb86844E';

const ABI = [
    'function dailyBurn() external',
    'function lastBurnTime() view returns (uint256)',
    'function swapReserveJBC() view returns (uint256)',
    'function owner() view returns (address)',
    'event BuybackAndBurn(uint256 mcAmount, uint256 jbcBurned)',
];

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    console.log(`[${timestamp}] ${message}`);
}

async function executeDailyBurn() {
    log('🔥 每日燃烧任务开始');
    log('='.repeat(60));

    // 检查私钥
    const privateKey = process.env.PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;
    if (!privateKey) {
        log('❌ 错误: 未配置 PRIVATE_KEY 或 OWNER_PRIVATE_KEY');
        process.exit(1);
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, ABI, wallet);

        log(`执行钱包: ${wallet.address}`);

        // 验证 Owner
        const owner = await protocol.owner();
        if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
            log(`❌ 错误: 钱包 ${wallet.address} 不是合约 Owner (${owner})`);
            process.exit(1);
        }
        log('✅ Owner 验证通过');

        // 检查是否可以燃烧
        const lastBurnTime = await protocol.lastBurnTime();
        const now = Math.floor(Date.now() / 1000);
        const nextBurnTime = Number(lastBurnTime) + 24 * 3600;

        if (now < nextBurnTime) {
            const remaining = nextBurnTime - now;
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            log(`⏳ 冷却中: 距离下次燃烧还需 ${hours}小时${minutes}分钟`);
            log(`   上次燃烧: ${new Date(Number(lastBurnTime) * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
            log(`   下次可燃烧: ${new Date(nextBurnTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
            process.exit(0);
        }

        // 获取 JBC 储备
        const jbcReserve = await protocol.swapReserveJBC();
        if (jbcReserve === 0n) {
            log('❌ 错误: JBC 储备为 0，无法燃烧');
            process.exit(1);
        }

        const expectedBurn = jbcReserve / 100n;
        log(`JBC 储备: ${ethers.formatEther(jbcReserve)} JBC`);
        log(`预计燃烧: ${ethers.formatEther(expectedBurn)} JBC (1%)`);

        // 执行燃烧
        log('📤 发送燃烧交易...');
        const tx = await protocol.dailyBurn();
        log(`   交易哈希: ${tx.hash}`);

        log('⏳ 等待交易确认...');
        const receipt = await tx.wait();
        log(`   ✅ 交易确认, 区块: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);

        // 验证结果
        const jbcReserveAfter = await protocol.swapReserveJBC();
        const actualBurned = jbcReserve - jbcReserveAfter;
        
        log('');
        log('🔥 燃烧完成!');
        log(`   实际燃烧: ${ethers.formatEther(actualBurned)} JBC`);
        log(`   剩余储备: ${ethers.formatEther(jbcReserveAfter)} JBC`);

        // 记录下次燃烧时间
        const newLastBurnTime = await protocol.lastBurnTime();
        const newNextBurnTime = Number(newLastBurnTime) + 24 * 3600;
        log(`   下次可燃烧: ${new Date(newNextBurnTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

    } catch (error) {
        log(`❌ 执行失败: ${error.message}`);
        
        if (error.message.includes('ActionTooEarly')) {
            log('   原因: 距离上次燃烧不足24小时');
        } else if (error.message.includes('InvalidAmount')) {
            log('   原因: JBC储备为0或燃烧量为0');
        }
        
        process.exit(1);
    }

    log('='.repeat(60));
    log('✅ 每日燃烧任务完成');
}

// 执行
executeDailyBurn().catch(err => {
    log(`❌ 未捕获的错误: ${err.message}`);
    process.exit(1);
});

