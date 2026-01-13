const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新合约
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A"; // 旧合约（已弃用，但历史数据仍存在）

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function queryUserTicketTotal(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`查询地址: ${userAddress}`);
    console.log("=".repeat(80));

    try {
        // 1. 查询当前门票状态（从新合约）
        const ticket = await protocol.userTicket(userAddress);
        const currentTicketAmount = parseFloat(ethers.formatEther(ticket.amount || 0n));
        const ticketId = ticket.ticketId?.toString() || '0';
        const purchaseTime = ticket.purchaseTime ? new Date(Number(ticket.purchaseTime) * 1000).toLocaleString('zh-CN') : 'N/A';
        const exited = ticket.exited || false;

        console.log("\n📋 当前门票状态 (新合约):");
        console.log(`  门票ID: ${ticketId}`);
        console.log(`  当前门票金额: ${currentTicketAmount.toFixed(4)} MC`);
        console.log(`  购买时间: ${purchaseTime}`);
        console.log(`  是否已退出: ${exited ? '是' : '否'}`);

        // 2. 查询历史购买记录（同时查询旧合约和新合约）
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = 0; // 从区块0开始查询，确保不遗漏任何记录
        
        console.log(`\n📊 查询历史购买记录 (区块 ${fromBlock} 到 ${currentBlock})...`);
        console.log(`  查询新合约: ${PROTOCOL_ADDRESS}`);
        console.log(`  查询旧合约: ${OLD_PROTOCOL_ADDRESS}`);
        
        let totalPurchased = 0n;
        let purchaseCount = 0;
        
        // 查询新合约的事件
        const newTicketEvents = await protocol.queryFilter(
            protocol.filters.TicketPurchased(userAddress),
            fromBlock
        );
        
        // 查询旧合约的事件
        const oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(userAddress),
            fromBlock
        );
        
        const allEvents = [
            ...oldTicketEvents.map(e => ({ ...e, source: '旧合约' })),
            ...newTicketEvents.map(e => ({ ...e, source: '新合约' }))
        ].sort((a, b) => a.blockNumber - b.blockNumber); // 按区块号排序

        if (allEvents.length > 0) {
            console.log(`\n  找到 ${allEvents.length} 条购买记录:`);
            for (const event of allEvents) {
                const amount = event.args.amount || 0n;
                const eventTicketId = event.args.ticketId?.toString() || 'N/A';
                const block = await provider.getBlock(event.blockNumber);
                const blockTime = block ? new Date(Number(block.timestamp) * 1000).toLocaleString('zh-CN') : '';
                
                totalPurchased += amount;
                purchaseCount++;
                
                console.log(`  [${purchaseCount}] ${blockTime} [${event.source}] 区块${event.blockNumber} - 金额: ${ethers.formatEther(amount)} MC, 门票ID: ${eventTicketId}`);
            }
            
            const totalPurchasedMC = parseFloat(ethers.formatEther(totalPurchased));
            console.log(`\n  ✅ 历史累计购买: ${totalPurchasedMC.toFixed(4)} MC`);
            console.log(`     - 旧合约: ${oldTicketEvents.length} 条记录`);
            console.log(`     - 新合约: ${newTicketEvents.length} 条记录`);
        } else {
            console.log("  未找到历史购买记录");
        }

        // 3. 查询用户信息（团队总业绩）
        const userInfo = await protocol.userInfo(userAddress);
        const teamTotalVolume = parseFloat(ethers.formatEther(userInfo.teamTotalVolume || 0n));
        const teamCount = userInfo.teamCount?.toString() || '0';
        const referrer = userInfo.referrer || '0x0000000000000000000000000000000000000000';

        console.log("\n👥 团队信息:");
        console.log(`  推荐人: ${referrer}`);
        console.log(`  团队人数: ${teamCount}`);
        console.log(`  团队总业绩: ${teamTotalVolume.toFixed(4)} MC`);

        // 4. 总结
        console.log("\n📊 门票总额统计:");
        console.log("-".repeat(80));
        console.log(`  自己购买的门票总额: ${Math.max(currentTicketAmount, parseFloat(ethers.formatEther(totalPurchased))).toFixed(4)} MC`);
        console.log(`    - 当前门票金额: ${currentTicketAmount.toFixed(4)} MC`);
        console.log(`    - 历史累计购买: ${parseFloat(ethers.formatEther(totalPurchased)).toFixed(4)} MC`);
        console.log(`  团队总业绩 (包含所有下级): ${teamTotalVolume.toFixed(4)} MC`);
        console.log("-".repeat(80));

        return {
            address: userAddress,
            currentTicketAmount,
            totalPurchased: parseFloat(ethers.formatEther(totalPurchased)),
            teamTotalVolume,
            teamCount: parseInt(teamCount),
            purchaseCount
        };

    } catch (error) {
        console.error(`\n❌ 查询失败:`, error.message);
        return null;
    }
}

async function main() {
    const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
    const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

    console.log("🔍 查询两个地址的社区门票总额");
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);

    const result1 = await queryUserTicketTotal(address1);
    const result2 = await queryUserTicketTotal(address2);

    // 对比总结
    if (result1 && result2) {
        console.log("\n\n");
        console.log("=".repeat(80));
        console.log("📊 对比总结");
        console.log("=".repeat(80));
        
        console.log("\n地址1:");
        console.log(`  自己购买总额: ${Math.max(result1.currentTicketAmount, result1.totalPurchased).toFixed(4)} MC`);
        console.log(`  团队总业绩: ${result1.teamTotalVolume.toFixed(4)} MC`);
        console.log(`  团队人数: ${result1.teamCount}`);
        console.log(`  购买次数: ${result1.purchaseCount}`);

        console.log("\n地址2:");
        console.log(`  自己购买总额: ${Math.max(result2.currentTicketAmount, result2.totalPurchased).toFixed(4)} MC`);
        console.log(`  团队总业绩: ${result2.teamTotalVolume.toFixed(4)} MC`);
        console.log(`  团队人数: ${result2.teamCount}`);
        console.log(`  购买次数: ${result2.purchaseCount}`);

        console.log("\n对比:");
        const selfTotal1 = Math.max(result1.currentTicketAmount, result1.totalPurchased);
        const selfTotal2 = Math.max(result2.currentTicketAmount, result2.totalPurchased);
        console.log(`  地址1自己购买: ${selfTotal1.toFixed(4)} MC`);
        console.log(`  地址2自己购买: ${selfTotal2.toFixed(4)} MC`);
        console.log(`  差额: ${Math.abs(selfTotal1 - selfTotal2).toFixed(4)} MC`);
        
        console.log(`\n  地址1团队总业绩: ${result1.teamTotalVolume.toFixed(4)} MC`);
        console.log(`  地址2团队总业绩: ${result2.teamTotalVolume.toFixed(4)} MC`);
        console.log(`  差额: ${Math.abs(result1.teamTotalVolume - result2.teamTotalVolume).toFixed(4)} MC`);
        
        if (result1.teamTotalVolume >= result2.teamTotalVolume) {
            console.log(`  ✅ 地址1的团队总业绩 >= 地址2（符合逻辑）`);
        } else {
            console.log(`  ⚠️  地址1的团队总业绩 < 地址2（不符合逻辑）`);
        }
        
        console.log("=".repeat(80));
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    });
