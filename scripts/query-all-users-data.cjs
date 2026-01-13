/**
 * 查询线上所有用户的完整数据
 * 包括：基本信息、财务数据、门票、质押、余额等
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_TOKEN_ADDRESS = process.env.JBC_TOKEN_ADDRESS || "0xAAb88c0Bc9f4A73019e4Dbfc5c8De82A8dCb970D";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
];

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
];

/**
 * 从事件查询所有注册用户
 */
async function getAllUsersFromEvents(protocol, provider) {
    try {
        console.log("📊 查询所有注册用户事件...");
        let currentBlock;
        try {
            currentBlock = await provider.getBlockNumber();
            console.log(`  当前区块高度: ${currentBlock}`);
        } catch (e) {
            console.error(`  ❌ 获取区块高度失败: ${e.message}`);
            throw e;
        }
        const fromBlock = Math.max(0, currentBlock - 500000); // 查询最近50万个区块
        console.log(`  查询区块范围: ${fromBlock} - ${currentBlock}`);
        
        // 查询BoundReferrer事件
        console.log("  查询 BoundReferrer 事件...");
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        
        // 查询TicketPurchased事件
        console.log("  查询 TicketPurchased 事件...");
        const ticketEvents = await protocol.queryFilter(
            protocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );
        
        // 查询LiquidityStaked事件
        console.log("  查询 LiquidityStaked 事件...");
        const stakeEvents = await protocol.queryFilter(
            protocol.filters.LiquidityStaked(),
            fromBlock,
            currentBlock
        );
        
        const users = new Set();
        
        // 从BoundReferrer事件获取用户
        boundEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer) {
                users.add(event.args.referrer.toLowerCase());
            }
        });
        
        // 从TicketPurchased事件获取用户
        ticketEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
        });
        
        // 从LiquidityStaked事件获取用户
        stakeEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
        });
        
        const userList = Array.from(users).filter(addr => addr !== ethers.ZeroAddress.toLowerCase());
        console.log(`✅ 找到 ${userList.length} 个用户 (BoundReferrer: ${boundEvents.length}, TicketPurchased: ${ticketEvents.length}, LiquidityStaked: ${stakeEvents.length})`);
        return userList;
    } catch (error) {
        console.error(`❌ 查询用户事件失败: ${error.message}`);
        return [];
    }
}

/**
 * 查询单个用户的完整数据
 */
async function queryUserFullData(protocol, jbcToken, provider, userAddress) {
    try {
        const data = {
            address: userAddress,
            timestamp: new Date().toISOString(),
        };
        
        // 1. 用户基本信息
        try {
            const userInfo = await protocol.userInfo(userAddress);
            data.referrer = userInfo.referrer || ethers.ZeroAddress;
            data.activeDirects = Number(userInfo.activeDirects || 0);
            data.teamCount = Number(userInfo.teamCount || 0);
            data.totalRevenue = ethers.formatEther(userInfo.totalRevenue || 0);
            data.currentCap = ethers.formatEther(userInfo.currentCap || 0);
            data.isActive = userInfo.isActive || false;
            data.refundFeeAmount = ethers.formatEther(userInfo.refundFeeAmount || 0);
            data.teamTotalVolume = ethers.formatEther(userInfo.teamTotalVolume || 0);
            data.teamTotalCap = ethers.formatEther(userInfo.teamTotalCap || 0);
            data.maxTicketAmount = ethers.formatEther(userInfo.maxTicketAmount || 0);
            data.maxSingleTicketAmount = ethers.formatEther(userInfo.maxSingleTicketAmount || 0);
        } catch (e) {
            console.warn(`  ⚠️  查询用户信息失败 ${userAddress}: ${e.message}`);
            data.userInfoError = e.message;
        }
        
        // 2. 等级信息
        try {
            const levelData = await protocol.getUserLevel(userAddress);
            data.level = Number(levelData.level || 0);
            data.levelPercent = Number(levelData.percent || 0);
        } catch (e) {
            data.level = 0;
            data.levelPercent = 0;
        }
        
        // 3. 门票信息
        try {
            const ticket = await protocol.userTicket(userAddress);
            data.ticket = {
                ticketId: Number(ticket.ticketId || 0),
                amount: ethers.formatEther(ticket.amount || 0),
                purchaseTime: Number(ticket.purchaseTime || 0),
                purchaseTimeFormatted: new Date(Number(ticket.purchaseTime || 0) * 1000).toISOString(),
                exited: ticket.exited || false,
            };
        } catch (e) {
            data.ticket = null;
        }
        
        // 4. 质押信息（查询前10个质押）
        try {
            const stakes = [];
            for (let i = 0; i < 10; i++) {
                try {
                    const stake = await protocol.userStakes(userAddress, i);
                    if (stake && stake.id && Number(stake.id) > 0) {
                        stakes.push({
                            id: Number(stake.id),
                            amount: ethers.formatEther(stake.amount || 0),
                            startTime: Number(stake.startTime || 0),
                            startTimeFormatted: new Date(Number(stake.startTime || 0) * 1000).toISOString(),
                            cycleDays: Number(stake.cycleDays || 0),
                            active: stake.active || false,
                            paid: ethers.formatEther(stake.paid || 0),
                        });
                    }
                } catch (e) {
                    break; // 没有更多质押了
                }
            }
            data.stakes = stakes;
            data.stakeCount = stakes.length;
        } catch (e) {
            data.stakes = [];
            data.stakeCount = 0;
        }
        
        // 5. 余额信息
        try {
            const mcBalance = await provider.getBalance(userAddress);
            const jbcBalance = await jbcToken.balanceOf(userAddress);
            data.balances = {
                mc: ethers.formatEther(mcBalance),
                jbc: ethers.formatEther(jbcBalance),
            };
        } catch (e) {
            data.balances = { mc: "0", jbc: "0" };
        }
        
        // 6. 直推列表
        try {
            const directReferrals = await protocol.getDirectReferrals(userAddress);
            data.directReferrals = directReferrals.map(addr => addr.toLowerCase());
            data.directReferralsCount = directReferrals.length;
        } catch (e) {
            data.directReferrals = [];
            data.directReferralsCount = 0;
        }
        
        return data;
    } catch (error) {
        console.error(`❌ 查询 ${userAddress} 完整数据失败:`, error.message);
        return {
            address: userAddress,
            error: error.message,
            timestamp: new Date().toISOString(),
        };
    }
}

/**
 * 主函数
 */
async function main() {
    console.log("🚀 开始查询线上所有用户数据...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`📍 JBC Token地址: ${JBC_TOKEN_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    // 创建provider，增加超时时间和重试机制
    const provider = new ethers.JsonRpcProvider(RPC_URL, {
        name: "MC Chain",
        chainId: 88813,
    });
    
    // 测试连接
    console.log("🔗 测试RPC连接...");
    try {
        const blockNumber = await Promise.race([
            provider.getBlockNumber(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时')), 30000))
        ]);
        console.log(`✅ RPC连接成功，当前区块: ${blockNumber}\n`);
    } catch (e) {
        console.error(`❌ RPC连接失败: ${e.message}`);
        console.error(`   请检查网络连接或稍后重试`);
        console.error(`   如果问题持续，可以尝试使用其他RPC节点`);
        process.exit(1);
    }
    
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

    // 获取所有用户地址
    console.log("=".repeat(80));
    const addresses = await getAllUsersFromEvents(protocol, provider);
    
    if (addresses.length === 0) {
        console.log("❌ 未找到任何用户");
        process.exit(1);
    }
    
    console.log(`\n📊 开始查询 ${addresses.length} 个用户的完整数据...\n`);

    // 批量查询
    const results = [];
    const batchSize = 5; // 每批查询5个，避免请求过快
    
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(addresses.length / batchSize);
        
        console.log(`📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个用户)...`);
        
        const batchPromises = batch.map(addr => queryUserFullData(protocol, jbcToken, provider, addr));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // 显示进度
        batchResults.forEach(result => {
            if (result.error) {
                console.log(`  ❌ ${result.address.substring(0, 10)}...: ${result.error}`);
            } else {
                const hasTicket = result.ticket && Number(result.ticket.ticketId) > 0;
                const stakeCount = result.stakeCount || 0;
                console.log(`  ✅ ${result.address.substring(0, 10)}...: 团队=${result.teamCount || 0}, 直推=${result.activeDirects || 0}, 等级=V${result.level || 0}, 门票=${hasTicket ? '有' : '无'}, 质押=${stakeCount}`);
            }
        });
        
        // 避免请求过快
        if (i + batchSize < addresses.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 汇总结果
    console.log("\n" + "=".repeat(80));
    console.log("📊 查询结果汇总");
    console.log("=".repeat(80));
    
    const successResults = results.filter(r => !r.error);
    const failResults = results.filter(r => r.error);
    
    console.log(`\n✅ 成功查询: ${successResults.length} 个用户`);
    console.log(`❌ 查询失败: ${failResults.length} 个用户\n`);
    
    // 统计信息
    const totalTeamCount = successResults.reduce((sum, r) => sum + (r.teamCount || 0), 0);
    const totalRevenue = successResults.reduce((sum, r) => sum + parseFloat(r.totalRevenue || 0), 0);
    const usersWithTicket = successResults.filter(r => r.ticket && Number(r.ticket.ticketId) > 0).length;
    const usersWithStake = successResults.filter(r => (r.stakeCount || 0) > 0).length;
    const activeUsers = successResults.filter(r => r.isActive).length;
    
    console.log("📈 统计信息:");
    console.log(`  总用户数: ${successResults.length}`);
    console.log(`  激活用户: ${activeUsers}`);
    console.log(`  有门票用户: ${usersWithTicket}`);
    console.log(`  有质押用户: ${usersWithStake}`);
    console.log(`  总团队人数: ${totalTeamCount.toLocaleString()}`);
    console.log(`  总累计收益: ${totalRevenue.toFixed(2)} MC`);
    
    // 等级分布
    const levelDistribution = {};
    successResults.forEach(r => {
        const level = `V${r.level || 0}`;
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    });
    
    console.log("\n📊 等级分布:");
    Object.entries(levelDistribution)
        .sort((a, b) => parseInt(a[0].substring(1)) - parseInt(b[0].substring(1)))
        .forEach(([level, count]) => {
            console.log(`  ${level}: ${count} 人`);
        });
    
    // 保存结果到文件
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFile = path.join(outputDir, `all-users-data-${timestamp}.json`);
    const csvFile = path.join(outputDir, `all-users-data-${timestamp}.csv`);
    
    // 保存JSON
    const outputData = {
        queryTime: new Date().toISOString(),
        protocolAddress: PROTOCOL_ADDRESS,
        jbcTokenAddress: JBC_TOKEN_ADDRESS,
        totalUsers: addresses.length,
        successCount: successResults.length,
        failCount: failResults.length,
        statistics: {
            totalTeamCount,
            totalRevenue,
            usersWithTicket,
            usersWithStake,
            activeUsers,
            levelDistribution
        },
        users: successResults,
        errors: failResults
    };
    
    fs.writeFileSync(jsonFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 JSON结果已保存到: ${jsonFile}`);
    
    // 保存CSV
    const csvHeader = '地址,推荐人,直推人数,团队人数,等级,收益比例,累计收益(MC),收益上限(MC),是否激活,有门票,质押数量,MC余额,JBC余额\n';
    const csvRows = successResults.map(r => {
        const hasTicket = r.ticket && Number(r.ticket.ticketId) > 0 ? '是' : '否';
        return [
            r.address,
            r.referrer || '',
            r.activeDirects || 0,
            r.teamCount || 0,
            `V${r.level || 0}`,
            `${r.levelPercent || 0}%`,
            parseFloat(r.totalRevenue || 0).toFixed(6),
            parseFloat(r.currentCap || 0).toFixed(6),
            r.isActive ? '是' : '否',
            hasTicket,
            r.stakeCount || 0,
            parseFloat(r.balances?.mc || 0).toFixed(6),
            parseFloat(r.balances?.jbc || 0).toFixed(6),
        ].join(',');
    }).join('\n');
    
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`💾 CSV结果已保存到: ${csvFile}`);
    
    console.log("\n✅ 查询完成！");
}

// 运行
main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
