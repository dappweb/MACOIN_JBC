const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 从事件获取所有用户（包括新旧合约）
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const users = new Set();
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`   查询区块范围: ${fromBlock} - ${currentBlock}`);
    
    // 查询所有 BoundReferrer 事件（新旧合约）
    for (const [name, protocol] of [["新合约", newProtocol], ["旧合约", oldProtocol]]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock
            );
            events.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    users.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ ${name} BoundReferrer: ${events.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ ${name} BoundReferrer 查询失败: ${error.message}`);
        }
    }
    
    // 查询所有 TicketPurchased 事件（新旧合约）
    for (const [name, protocol] of [["新合约", newProtocol], ["旧合约", oldProtocol]]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.TicketPurchased(),
                fromBlock
            );
            events.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ ${name} TicketPurchased: ${events.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ ${name} TicketPurchased 查询失败: ${error.message}`);
        }
    }
    
    return Array.from(users).filter(addr => addr !== ethers.ZeroAddress.toLowerCase());
}

/**
 * 从事件构建推荐关系图并计算正确的 teamCount
 */
async function buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    const referrerMap = new Map(); // user -> referrer
    const allUsers = new Set();
    
    // 从新旧合约获取所有 BoundReferrer 事件
    let totalEvents = 0;
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock
            );
            totalEvents += events.length;
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    // 如果用户还没有推荐人，或者新事件的区块号更大，则更新
                    const existing = referrerMap.get(user);
                    const blockNumber = event.blockNumber || (event.log && event.log.blockNumber) || 0;
                    if (!existing || blockNumber > (existing.blockNumber || 0)) {
                        referrerMap.set(user, { referrer, blockNumber });
                    }
                    allUsers.add(user);
                    allUsers.add(referrer);
                }
            });
        } catch (error) {
            console.error(`   查询事件失败: ${error.message}`);
        }
    }
    
    console.log(`   找到 ${totalEvents} 个 BoundReferrer 事件`);
    console.log(`   构建了 ${referrerMap.size} 个推荐关系`);
    console.log(`   总用户数: ${allUsers.size}`);
    
    // 构建反向映射：referrer -> [users]
    const referrerToUsers = new Map();
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (!referrerToUsers.has(referrer)) {
            referrerToUsers.set(referrer, []);
        }
        referrerToUsers.get(referrer).push(user);
    });
    
    console.log(`   构建了 ${referrerToUsers.size} 个推荐人的映射`);
    
    // 递归计算每个用户的 teamCount
    const teamCountCache = new Map();
    const visited = new Set();
    
    function calculateTeamCount(user) {
        if (teamCountCache.has(user)) {
            return teamCountCache.get(user);
        }
        
        if (visited.has(user)) {
            return 0; // 防止循环
        }
        visited.add(user);
        
        const directReferrals = referrerToUsers.get(user) || [];
        let count = directReferrals.length;
        
        for (const referral of directReferrals) {
            count += calculateTeamCount(referral);
        }
        
        visited.delete(user);
        teamCountCache.set(user, count);
        return count;
    }
    
    // 计算所有用户的 teamCount
    const calculatedTeamCounts = new Map();
    let calculatedCount = 0;
    for (const user of allUsers) {
        const count = calculateTeamCount(user);
        calculatedTeamCounts.set(user, count);
        if (count > 0) {
            calculatedCount++;
        }
    }
    
    console.log(`   计算了 ${calculatedTeamCounts.size} 个用户的 teamCount，其中 ${calculatedCount} 个 > 0`);
    
    return { referrerMap, calculatedTeamCounts };
}

async function verifyAllUsersTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 验证所有用户的团队人数（teamCount）是否符合预期");
    console.log("=".repeat(80));
    console.log(`新合约: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`旧合约: ${OLD_PROTOCOL_ADDRESS}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 1. 获取所有用户
        console.log("1️⃣ 获取所有用户地址...");
        console.log("-".repeat(80));
        const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`   ✅ 找到 ${allUsers.length} 个用户地址`);
        console.log("");

        // 2. 构建推荐关系图并计算正确的 teamCount
        console.log("2️⃣ 构建推荐关系图并计算正确的 teamCount...");
        console.log("-".repeat(80));
        const { calculatedTeamCounts } = await buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider);
        console.log(`   ✅ 已计算 ${calculatedTeamCounts.size} 个用户的 teamCount`);
        console.log("");

        // 3. 检查每个用户的 teamCount
        console.log("3️⃣ 检查每个用户的 teamCount...");
        console.log("-".repeat(80));
        
        const errors = [];
        const correctUsers = [];
        let checkedCount = 0;
        
        for (const userAddress of allUsers) {
            try {
                const userInfo = await newProtocol.userInfo(userAddress);
                const contractTeamCount = Number(userInfo.teamCount);
                const calculatedTeamCount = calculatedTeamCounts.get(userAddress) || 0;
                
                if (contractTeamCount !== calculatedTeamCount) {
                    const diff = contractTeamCount - calculatedTeamCount;
                    const severity = Math.abs(diff) > 100 ? "严重" : Math.abs(diff) > 10 ? "中等" : "轻微";
                    
                    errors.push({
                        address: userAddress,
                        contractValue: contractTeamCount,
                        calculatedValue: calculatedTeamCount,
                        difference: diff,
                        severity,
                        activeDirects: Number(userInfo.activeDirects),
                    });
                } else {
                    correctUsers.push({
                        address: userAddress,
                        teamCount: contractTeamCount,
                    });
                }
                
                checkedCount++;
                if (checkedCount % 100 === 0) {
                    console.log(`   进度: ${checkedCount}/${allUsers.length} - 已发现 ${errors.length} 个错误`);
                }
            } catch (error) {
                // 用户可能在新合约中不存在，跳过
            }
        }
        
        console.log(`   ✅ 检查完成！`);
        console.log("");

        // 4. 统计结果
        console.log("4️⃣ 统计结果:");
        console.log("-".repeat(80));
        console.log(`   检查的用户数: ${checkedCount}`);
        console.log(`   ✅ teamCount 正确的用户: ${correctUsers.length}`);
        console.log(`   ❌ teamCount 错误的用户: ${errors.length}`);
        console.log("");

        // 按严重程度分类
        const severeErrors = errors.filter(e => e.severity === "严重");
        const mediumErrors = errors.filter(e => e.severity === "中等");
        const minorErrors = errors.filter(e => e.severity === "轻微");
        
        console.log("   错误分类:");
        console.log(`   - 严重错误（差异 > 100）: ${severeErrors.length}`);
        console.log(`   - 中等错误（差异 10-100）: ${mediumErrors.length}`);
        console.log(`   - 轻微错误（差异 < 10）: ${minorErrors.length}`);
        console.log("");

        // 5. 显示错误详情
        if (errors.length > 0) {
            console.log("5️⃣ teamCount 错误的用户详情:");
            console.log("-".repeat(80));
            
            // 按严重程度排序
            errors.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
            
            errors.slice(0, 20).forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.address}`);
                console.log(`      合约值: ${error.contractValue.toLocaleString()}`);
                console.log(`      计算值: ${error.calculatedValue.toLocaleString()}`);
                console.log(`      差异: ${error.difference > 0 ? '+' : ''}${error.difference.toLocaleString()} (${error.severity})`);
                console.log(`      直推数: ${error.activeDirects}`);
                console.log("");
            });
            
            if (errors.length > 20) {
                console.log(`   ... 还有 ${errors.length - 20} 个错误用户未显示`);
            }
        }

        // 6. 保存结果
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFile = path.join(outputDir, `team-count-verification-${timestamp}.json`);
        fs.writeFileSync(outputFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalUsers: allUsers.length,
            checkedUsers: checkedCount,
            correctUsers: correctUsers.length,
            errorUsers: errors.length,
            errors: errors,
            correctUsersList: correctUsers.slice(0, 100), // 只保存前100个正确的用户作为示例
        }, null, 2));
        
        console.log("6️⃣ 结果已保存:");
        console.log("-".repeat(80));
        console.log(`   ${outputFile}`);
        console.log("");

        // 7. 总结
        console.log("=".repeat(80));
        console.log("📊 总结");
        console.log("=".repeat(80));
        console.log(`总用户数: ${allUsers.length}`);
        console.log(`检查用户数: ${checkedCount}`);
        console.log(`✅ 正确: ${correctUsers.length} (${((correctUsers.length / checkedCount) * 100).toFixed(2)}%)`);
        console.log(`❌ 错误: ${errors.length} (${((errors.length / checkedCount) * 100).toFixed(2)}%)`);
        console.log(`   严重: ${severeErrors.length}`);
        console.log(`   中等: ${mediumErrors.length}`);
        console.log(`   轻微: ${minorErrors.length}`);
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 验证失败:", error);
        throw error;
    }
}

if (require.main === module) {
    verifyAllUsersTeamCount().catch(console.error);
}

module.exports = { verifyAllUsersTeamCount };
