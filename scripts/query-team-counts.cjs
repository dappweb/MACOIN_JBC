const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 查询单个用户的团队人数
 */
async function queryUserTeamCount(protocol, userAddress) {
    try {
        const userInfo = await protocol.userInfo(userAddress);
        const teamCount = userInfo.teamCount?.toString() || '0';
        const activeDirects = userInfo.activeDirects?.toString() || '0';
        const referrer = userInfo.referrer || ethers.ZeroAddress;
        
        // 查询等级信息
        let levelInfo = { level: 0, percent: 0 };
        try {
            const levelData = await protocol.getUserLevel(userAddress);
            levelInfo = {
                level: Number(levelData.level || 0),
                percent: Number(levelData.percent || 0)
            };
        } catch (e) {
            // 如果getUserLevel不存在，忽略
        }
        
        return {
            address: userAddress,
            referrer: referrer,
            activeDirects: Number(activeDirects),
            teamCount: Number(teamCount),
            level: levelInfo.level,
            percent: levelInfo.percent,
            isActive: userInfo.isActive || false
        };
    } catch (error) {
        console.error(`❌ 查询 ${userAddress} 失败:`, error.message);
        return {
            address: userAddress,
            referrer: ethers.ZeroAddress,
            activeDirects: 0,
            teamCount: 0,
            level: 0,
            percent: 0,
            isActive: false,
            error: error.message
        };
    }
}

/**
 * 从文件读取地址列表
 */
function readAddressesFromFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const addresses = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && ethers.isAddress(line));
        return addresses;
    } catch (error) {
        console.error(`❌ 读取文件失败: ${error.message}`);
        return [];
    }
}

/**
 * 从事件查询所有注册用户
 */
async function getAllUsersFromEvents(protocol, provider) {
    try {
        console.log("📊 查询所有注册用户事件...");
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 200000); // 查询最近20万个区块
        
        // 查询BoundReferrer事件（绑定推荐人时）
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        
        // 查询TicketPurchased事件（购买门票时，可能包含新用户）
        const ticketEvents = await protocol.queryFilter(
            protocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );
        
        const users = new Set();
        
        // 从BoundReferrer事件获取用户
        boundEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
        });
        
        // 从TicketPurchased事件获取用户（可能包含未绑定推荐人的用户）
        ticketEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
        });
        
        console.log(`✅ 找到 ${users.size} 个用户 (BoundReferrer: ${boundEvents.length}, TicketPurchased: ${ticketEvents.length})`);
        return Array.from(users);
    } catch (error) {
        console.error(`❌ 查询用户事件失败: ${error.message}`);
        return [];
    }
}

/**
 * 主函数
 */
async function main() {
    console.log("🚀 开始批量查询团队人数...\n");
    console.log(`📍 合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 获取地址列表
    let addresses = [];
    
    // 方式1: 从命令行参数获取
    const args = process.argv.slice(2);
    if (args.length > 0) {
        // 检查是否是文件路径
        if (args[0].endsWith('.txt') || args[0].endsWith('.csv')) {
            addresses = readAddressesFromFile(args[0]);
            console.log(`📄 从文件读取 ${addresses.length} 个地址\n`);
        } else {
            // 直接是地址列表
            addresses = args.filter(addr => ethers.isAddress(addr));
            console.log(`📋 从命令行参数获取 ${addresses.length} 个地址\n`);
        }
    }
    
    // 方式2: 如果没有提供地址，查询所有注册用户
    if (addresses.length === 0) {
        console.log("⚠️  未提供地址，将查询所有注册用户（可能需要较长时间）...\n");
        addresses = await getAllUsersFromEvents(protocol, provider);
        
        if (addresses.length === 0) {
            console.log("❌ 未找到任何用户，请提供地址列表");
            console.log("\n使用方法:");
            console.log("  node scripts/query-team-counts.cjs <address1> <address2> ...");
            console.log("  node scripts/query-team-counts.cjs addresses.txt");
            process.exit(1);
        }
    }

    // 去重
    addresses = [...new Set(addresses.map(addr => addr.toLowerCase()))];
    console.log(`📊 开始查询 ${addresses.length} 个地址的团队人数...\n`);

    // 批量查询
    const results = [];
    const batchSize = 10; // 每批查询10个
    
    for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        console.log(`📦 查询批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)} (${batch.length} 个地址)...`);
        
        const batchPromises = batch.map(addr => queryUserTeamCount(protocol, addr));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // 显示进度
        batchResults.forEach(result => {
            if (result.error) {
                console.log(`  ❌ ${result.address}: ${result.error}`);
            } else {
                console.log(`  ✅ ${result.address}: 团队人数=${result.teamCount}, 直推=${result.activeDirects}, 等级=V${result.level}`);
            }
        });
        
        // 避免请求过快
        if (i + batchSize < addresses.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // 汇总结果
    console.log("\n" + "=".repeat(100));
    console.log("📊 查询结果汇总");
    console.log("=".repeat(100));
    
    // 按团队人数排序
    const sortedResults = results
        .filter(r => !r.error)
        .sort((a, b) => b.teamCount - a.teamCount);
    
    console.log(`\n✅ 成功查询: ${sortedResults.length} 个地址`);
    console.log(`❌ 查询失败: ${results.length - sortedResults.length} 个地址\n`);
    
    // 显示前20名
    console.log("🏆 团队人数 TOP 20:");
    console.log("-".repeat(100));
    console.log("排名 | 地址                                    | 团队人数 | 直推 | 等级 | 推荐人");
    console.log("-".repeat(100));
    
    sortedResults.slice(0, 20).forEach((result, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const addr = result.address.substring(0, 10) + '...' + result.address.substring(34);
        const teamCount = result.teamCount.toString().padStart(8, ' ');
        const directs = result.activeDirects.toString().padStart(4, ' ');
        const level = `V${result.level}`.padStart(4, ' ');
        const referrer = result.referrer !== ethers.ZeroAddress 
            ? result.referrer.substring(0, 10) + '...' 
            : '无';
        
        console.log(`${rank}   | ${addr} | ${teamCount} | ${directs} | ${level} | ${referrer}`);
    });
    
    // 统计信息
    const totalTeamCount = sortedResults.reduce((sum, r) => sum + r.teamCount, 0);
    const avgTeamCount = sortedResults.length > 0 ? (totalTeamCount / sortedResults.length).toFixed(2) : 0;
    const maxTeamCount = sortedResults.length > 0 ? sortedResults[0].teamCount : 0;
    const minTeamCount = sortedResults.length > 0 ? sortedResults[sortedResults.length - 1].teamCount : 0;
    
    console.log("\n📈 统计信息:");
    console.log(`  总团队人数: ${totalTeamCount.toLocaleString()}`);
    console.log(`  平均团队人数: ${avgTeamCount}`);
    console.log(`  最大团队人数: ${maxTeamCount.toLocaleString()}`);
    console.log(`  最小团队人数: ${minTeamCount.toLocaleString()}`);
    
    // 等级分布
    const levelDistribution = {};
    sortedResults.forEach(r => {
        const level = `V${r.level}`;
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    });
    
    console.log("\n📊 等级分布:");
    Object.entries(levelDistribution)
        .sort((a, b) => parseInt(a[0].substring(1)) - parseInt(b[0].substring(1)))
        .forEach(([level, count]) => {
            console.log(`  ${level}: ${count} 人`);
        });
    
    // 保存结果到文件
    const outputFile = path.join(__dirname, '../output', 'team-counts-results.json');
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputData = {
        queryTime: new Date().toISOString(),
        totalAddresses: addresses.length,
        successCount: sortedResults.length,
        failCount: results.length - sortedResults.length,
        results: sortedResults,
        statistics: {
            totalTeamCount,
            avgTeamCount: parseFloat(avgTeamCount),
            maxTeamCount,
            minTeamCount,
            levelDistribution
        }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 结果已保存到: ${outputFile}`);
    
    // 保存CSV格式
    const csvFile = path.join(__dirname, '../output', 'team-counts-results.csv');
    const csvHeader = '地址,推荐人,直推人数,团队人数,等级,收益比例,是否激活\n';
    const csvRows = sortedResults.map(r => 
        `${r.address},${r.referrer},${r.activeDirects},${r.teamCount},V${r.level},${r.percent}%,${r.isActive}`
    ).join('\n');
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`💾 CSV格式已保存到: ${csvFile}`);
    
    console.log("\n✅ 查询完成！");
}

// 运行
main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
