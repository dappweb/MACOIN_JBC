const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 从事件获取所有用户及其推荐关系
 */
async function getAllUsersAndReferrers(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    const referrerMap = new Map(); // user -> referrer
    const referrerToUsers = new Map(); // referrer -> [users]
    const allUsers = new Set();
    
    // 从新旧合约获取所有 BoundReferrer 事件
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock,
                currentBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    const blockNumber = event.blockNumber || (event.log && event.log.blockNumber) || 0;
                    const existing = referrerMap.get(user);
                    if (!existing || blockNumber > (existing.blockNumber || 0)) {
                        referrerMap.set(user, { referrer, blockNumber });
                    }
                    allUsers.add(user);
                    allUsers.add(referrer);
                }
            });
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    // 构建反向映射：referrer -> [users]
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (referrer !== ethers.ZeroAddress.toLowerCase()) {
            if (!referrerToUsers.has(referrer)) {
                referrerToUsers.set(referrer, []);
            }
            referrerToUsers.get(referrer).push(user);
        }
    });
    
    return { referrerMap, referrerToUsers, allUsers };
}

/**
 * 统计唯一团队成员数
 * 唯一团队成员数 = 总用户数 - 根用户数（没有推荐人的用户）
 * 因为每个用户（除了根用户）都是某个人的下线，所以都是团队成员
 */
async function getActualUniqueTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 统计唯一团队成员数（去重）");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户和推荐关系
    console.log("📋 步骤 1: 获取所有用户和推荐关系...");
    const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个唯一用户地址`);
    console.log(`  ✅ 构建了 ${referrerMap.size} 个推荐关系\n`);

    // 步骤 2: 识别根用户（没有推荐人的用户）
    console.log("📋 步骤 2: 识别根用户（没有推荐人的用户）...");
    const rootUsers = new Set();
    const nonRootUsers = new Set();
    
    // 从合约查询每个用户是否有推荐人
    let processedCount = 0;
    for (const userAddress of allUsers) {
        let hasReferrer = false;
        
        // 先检查事件中的推荐关系
        const referrerData = referrerMap.get(userAddress);
        if (referrerData && referrerData.referrer !== ethers.ZeroAddress.toLowerCase()) {
            hasReferrer = true;
        } else {
            // 如果事件中没有，从合约查询
            try {
                const newUserInfo = await newProtocol.userInfo(userAddress);
                if (newUserInfo.referrer && newUserInfo.referrer !== ethers.ZeroAddress) {
                    hasReferrer = true;
                }
            } catch (error) {
                try {
                    const oldUserInfo = await oldProtocol.userInfo(userAddress);
                    if (oldUserInfo.referrer && oldUserInfo.referrer !== ethers.ZeroAddress) {
                        hasReferrer = true;
                    }
                } catch (oldError) {
                    // 用户不在新旧合约中，可能是根用户
                }
            }
        }
        
        if (hasReferrer) {
            nonRootUsers.add(userAddress);
        } else {
            rootUsers.add(userAddress);
        }
        
        processedCount++;
        if (processedCount % 100 === 0) {
            console.log(`  ⏳ 已处理: ${processedCount}/${allUsers.size}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`  ✅ 根用户数: ${rootUsers.size}`);
    console.log(`  ✅ 非根用户数: ${nonRootUsers.size}\n`);

    // 步骤 3: 计算唯一团队成员数
    // 唯一团队成员数 = 所有非根用户数（因为每个非根用户都是某个人的下线）
    const uniqueTeamMembers = nonRootUsers.size;

    // 步骤 4: 统计每个根用户下的团队成员数
    console.log("📋 步骤 3: 统计每个根用户下的团队成员数...");
    const rootUserTeamCounts = new Map();
    
    for (const rootUser of rootUsers) {
        // 递归获取该根用户下的所有团队成员
        const teamMembers = new Set();
        const visited = new Set();
        
        function collectTeamMembers(userAddress) {
            if (visited.has(userAddress)) return;
            visited.add(userAddress);
            
            const directReferrals = referrerToUsers.get(userAddress) || [];
            for (const referral of directReferrals) {
                teamMembers.add(referral);
                collectTeamMembers(referral);
            }
        }
        
        collectTeamMembers(rootUser);
        rootUserTeamCounts.set(rootUser, teamMembers.size);
    }
    
    console.log(`  ✅ 已统计 ${rootUserTeamCounts.size} 个根用户的团队成员数\n`);

    // 输出结果
    console.log("📊 统计结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${allUsers.size}`);
    console.log(`根用户数（没有推荐人）: ${rootUsers.size}`);
    console.log(`非根用户数（有推荐人）: ${nonRootUsers.size}`);
    console.log(`\n唯一团队成员数（去重后）: ${uniqueTeamMembers.toLocaleString()}`);
    console.log(`\n说明:`);
    console.log(`  - 唯一团队成员数 = 总用户数 - 根用户数`);
    console.log(`  - 因为每个非根用户都是某个人的下线，所以都是团队成员`);
    console.log(`  - 这个数字是去重后的，不包含重复计算`);

    // 显示每个根用户的团队成员数
    if (rootUserTeamCounts.size > 0) {
        console.log(`\n📋 各根用户的团队成员数:`);
        const sortedRoots = Array.from(rootUserTeamCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        sortedRoots.forEach(([rootUser, count], index) => {
            console.log(`  ${index + 1}. ${rootUser}: ${count.toLocaleString()} 个成员`);
        });
        
        if (rootUserTeamCounts.size > 10) {
            console.log(`  ... 还有 ${rootUserTeamCounts.size - 10} 个根用户`);
        }
    }

    // 验证：所有根用户的团队成员数之和应该等于唯一团队成员数
    let totalFromRoots = 0;
    rootUserTeamCounts.forEach(count => {
        totalFromRoots += count;
    });
    
    console.log(`\n📊 验证:`);
    console.log(`  所有根用户的团队成员数之和: ${totalFromRoots.toLocaleString()}`);
    console.log(`  唯一团队成员数: ${uniqueTeamMembers.toLocaleString()}`);
    if (totalFromRoots === uniqueTeamMembers) {
        console.log(`  ✅ 验证通过：两者一致`);
    } else {
        console.log(`  ⚠️  差异: ${Math.abs(totalFromRoots - uniqueTeamMembers).toLocaleString()}`);
        console.log(`     可能原因：某些用户有多个推荐关系或推荐关系有变化`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 统计完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    getActualUniqueTeamCount().catch(console.error);
}
