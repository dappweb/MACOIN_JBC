const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

// 递归获取所有团队成员（去重）
async function getAllTeamMembers(protocol, userAddress, visited = new Set(), depth = 0) {
    if (visited.has(userAddress.toLowerCase())) {
        return visited; // 防止循环
    }
    if (depth > 100) {
        return visited; // 防止过深递归
    }
    
    visited.add(userAddress.toLowerCase());
    
    try {
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        for (const referral of directReferrals) {
            await getAllTeamMembers(protocol, referral, visited, depth + 1);
        }
    } catch (error) {
        // 如果合约不支持 getDirectReferrals 或查询失败，跳过
    }
    
    return visited;
}

async function getUniqueTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 统计唯一团队总人数（去重）");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 获取所有用户地址
    console.log("📋 步骤 1: 获取所有用户地址...");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    const newBoundEvents = await newProtocol.queryFilter(
        newProtocol.filters.BoundReferrer(),
        fromBlock,
        currentBlock
    );
    const newTicketEvents = await newProtocol.queryFilter(
        newProtocol.filters.TicketPurchased(),
        fromBlock,
        currentBlock
    );

    let oldBoundEvents = [];
    let oldTicketEvents = [];
    try {
        oldBoundEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );
    } catch (error) {
        console.warn(`  ⚠️ 旧合约查询失败: ${error.message}`);
    }

    const allUsers = new Set();
    [...newBoundEvents, ...oldBoundEvents].forEach(event => {
        if (event.args && event.args.user) {
            allUsers.add(event.args.user.toLowerCase());
        }
    });
    [...newTicketEvents, ...oldTicketEvents].forEach(event => {
        if (event.args && event.args.user) {
            allUsers.add(event.args.user.toLowerCase());
        }
    });

    console.log(`  ✅ 找到 ${allUsers.size} 个唯一用户地址\n`);

    // 统计每个用户的团队人数（从合约读取）
    console.log("📋 步骤 2: 查询每个用户的团队人数（从合约）...");
    const userTeamCounts = new Map();
    const userArray = Array.from(allUsers);
    let processedCount = 0;

    for (let i = 0; i < userArray.length; i += 50) {
        const batch = userArray.slice(i, i + 50);
        const promises = batch.map(async (userAddress) => {
            let maxTeamCount = 0n;
            
            try {
                const newUserInfo = await newProtocol.userInfo(userAddress);
                maxTeamCount = newUserInfo.teamCount;
            } catch (error) {
                // 用户不在新合约中
            }
            
            try {
                const oldUserInfo = await oldProtocol.userInfo(userAddress);
                if (oldUserInfo.teamCount > maxTeamCount) {
                    maxTeamCount = oldUserInfo.teamCount;
                }
            } catch (error) {
                // 用户不在旧合约中
            }
            
            return { address: userAddress, teamCount: Number(maxTeamCount) };
        });

        const results = await Promise.all(promises);
        results.forEach(result => {
            userTeamCounts.set(result.address, result.teamCount);
        });
        
        processedCount += results.length;
        if (processedCount % 100 === 0 || processedCount === userArray.length) {
            console.log(`  ⏳ 已处理: ${processedCount}/${userArray.length} (${((processedCount / userArray.length) * 100).toFixed(1)}%)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 统计根用户（没有推荐人的用户）
    console.log("\n📋 步骤 3: 识别根用户（没有推荐人的用户）...");
    const rootUsers = [];
    for (const userAddress of userArray) {
        let hasReferrer = false;
        
        try {
            const newUserInfo = await newProtocol.userInfo(userAddress);
            if (newUserInfo.referrer && newUserInfo.referrer !== ethers.ZeroAddress) {
                hasReferrer = true;
            }
        } catch (error) {
            // 用户不在新合约中
        }
        
        if (!hasReferrer) {
            try {
                const oldUserInfo = await oldProtocol.userInfo(userAddress);
                if (oldUserInfo.referrer && oldUserInfo.referrer !== ethers.ZeroAddress) {
                    hasReferrer = true;
                }
            } catch (error) {
                // 用户不在旧合约中
            }
        }
        
        if (!hasReferrer) {
            rootUsers.push(userAddress);
        }
    }
    
    console.log(`  ✅ 找到 ${rootUsers.length} 个根用户\n`);

    // 计算总团队人数（所有用户的团队人数总和）
    let totalTeamCount = 0;
    let maxTeamCount = 0;
    let maxTeamCountUser = null;
    
    for (const [address, teamCount] of userTeamCounts.entries()) {
        totalTeamCount += teamCount;
        if (teamCount > maxTeamCount) {
            maxTeamCount = teamCount;
            maxTeamCountUser = address;
        }
    }

    console.log("📊 统计结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${allUsers.size}`);
    console.log(`根用户数: ${rootUsers.length}`);
    console.log(`\n团队人数统计（从合约读取）:`);
    console.log(`  所有用户团队人数总和: ${totalTeamCount.toLocaleString()}`);
    console.log(`  平均团队人数: ${(totalTeamCount / allUsers.size).toFixed(2)}`);
    console.log(`  最大团队人数: ${maxTeamCount.toLocaleString()}`);
    if (maxTeamCountUser) {
        console.log(`  最大团队人数用户: ${maxTeamCountUser}`);
    }
    
    console.log(`\n⚠️  说明:`);
    console.log(`  - 团队人数总和包含重复计算（因为每个用户的团队人数包括其所有下线）`);
    console.log(`  - 如果要统计实际的唯一团队成员数，需要构建推荐关系树并去重`);
    console.log(`  - 当前统计的是所有用户的 teamCount 字段的总和\n`);

    console.log("=".repeat(80));
    console.log("✅ 统计完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    getUniqueTeamCount().catch(console.error);
}
