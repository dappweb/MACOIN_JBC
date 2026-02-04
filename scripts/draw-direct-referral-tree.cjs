const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function drawDirectReferralTree() {
    console.log("🌳 直推网络树状图\n");
    console.log("=".repeat(100));

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取所有用户
        console.log("📊 获取所有用户...");
        const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`  总用户数: ${allUsers.length}\n`);

        // 2. 构建推荐关系图
        console.log("🔗 构建推荐关系图...");
        const referrerMap = new Map();
        const referrerToUsers = new Map();
        const rootUsers = [];
        const userInfoCache = new Map();
        
        // 获取所有用户信息
        console.log("  获取用户信息...");
        for (const userAddress of allUsers) {
            try {
                const userInfo = await newProtocol.userInfo(userAddress);
                userInfoCache.set(userAddress.toLowerCase(), {
                    referrer: userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress ? userInfo.referrer.toLowerCase() : null,
                    activeDirects: Number(userInfo.activeDirects),
                    teamCount: Number(userInfo.teamCount),
                    isActive: userInfo.isActive,
                    totalRevenue: userInfo.totalRevenue.toString()
                });
                
                const referrer = userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress ? userInfo.referrer.toLowerCase() : null;
                
                if (referrer) {
                    referrerMap.set(userAddress.toLowerCase(), referrer);
                    if (!referrerToUsers.has(referrer)) {
                        referrerToUsers.set(referrer, []);
                    }
                    referrerToUsers.get(referrer).push(userAddress.toLowerCase());
                } else {
                    rootUsers.push(userAddress.toLowerCase());
                }
            } catch (error) {
                // 用户不在新合约中
            }
        }
        
        console.log(`  推荐关系数: ${referrerMap.size}`);
        console.log(`  根用户数: ${rootUsers.length}\n`);

        // 3. 找到团队最大的用户作为根节点
        console.log("🔍 查找团队最大的用户...");
        let mainRoot = null;
        let maxTeamCount = 0;
        
        for (const user of allUsers) {
            const info = userInfoCache.get(user.toLowerCase());
            if (info && info.teamCount > maxTeamCount) {
                maxTeamCount = info.teamCount;
                mainRoot = user.toLowerCase();
            }
        }
        
        if (!mainRoot && rootUsers.length > 0) {
            mainRoot = rootUsers[0];
        }
        
        if (!mainRoot) {
            console.error("❌ 无法找到根用户");
            return;
        }
        
        const rootInfo = userInfoCache.get(mainRoot);
        console.log(`  根用户: ${mainRoot}`);
        console.log(`  团队人数: ${rootInfo ? rootInfo.teamCount : '?'}`);
        console.log(`  直推数: ${rootInfo ? rootInfo.activeDirects : '?'}\n`);

        // 4. 绘制直推网络树状图
        console.log("=".repeat(100));
        console.log("🌳 直推网络树状图");
        console.log("=".repeat(100));
        console.log();
        
        function formatAddress(addr) {
            return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        }
        
        async function drawTree(root, level = 0, maxLevel = 10, prefix = "", isLast = true, visited = new Set()) {
            if (level > maxLevel) return;
            if (visited.has(root)) {
                console.log(`${prefix}${isLast ? "└── " : "├── "}⚠️ 循环引用: ${formatAddress(root)}`);
                return;
            }
            visited.add(root);
            
            const connector = isLast ? "└── " : "├── ";
            const address = formatAddress(root);
            
            const info = userInfoCache.get(root);
            if (!info) {
                console.log(`${prefix}${connector}❓ ${address} (信息不可用)`);
                return;
            }
            
            const status = info.isActive ? "✅" : "⚪";
            const levelLabel = level === 0 ? "[根]" : `[L${level}]`;
            const teamInfo = info.teamCount > 0 ? `团队:${info.teamCount}` : "";
            const directInfo = info.activeDirects > 0 ? `直推:${info.activeDirects}` : "";
            const infoStr = [teamInfo, directInfo].filter(Boolean).join(", ");
            
            console.log(`${prefix}${connector}${status} ${levelLabel} ${address}${infoStr ? ` (${infoStr})` : ""}`);
            
            if (level < maxLevel) {
                const children = referrerToUsers.get(root) || [];
                
                // 按团队人数排序（团队大的在前）
                const sortedChildren = children.sort((a, b) => {
                    const infoA = userInfoCache.get(a) || { teamCount: 0 };
                    const infoB = userInfoCache.get(b) || { teamCount: 0 };
                    return infoB.teamCount - infoA.teamCount;
                });
                
                // 限制每层最多显示30个，避免输出过长
                const displayChildren = sortedChildren.slice(0, 30);
                const remaining = sortedChildren.length - 30;
                
                for (let i = 0; i < displayChildren.length; i++) {
                    const child = displayChildren[i];
                    const isLastChild = i === displayChildren.length - 1 && remaining === 0;
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    await drawTree(child, level + 1, maxLevel, newPrefix, isLastChild, new Set(visited));
                }
                
                if (remaining > 0) {
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    const remainingInfo = sortedChildren.slice(30).map(addr => {
                        const info = userInfoCache.get(addr);
                        return info ? `${formatAddress(addr)}(${info.teamCount})` : formatAddress(addr);
                    }).slice(0, 5).join(", ");
                    console.log(`${newPrefix}└── ... (还有 ${remaining} 个用户: ${remainingInfo}${remaining > 5 ? '...' : ''})`);
                }
            } else if (level === maxLevel) {
                const children = referrerToUsers.get(root) || [];
                if (children.length > 0) {
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    console.log(`${newPrefix}└── ... (还有 ${children.length} 个用户在第${maxLevel + 1}层及以下)`);
                }
            }
        }
        
        await drawTree(mainRoot, 0, 10);
        
        console.log();
        console.log("=".repeat(100));
        console.log("📊 统计信息");
        console.log("=".repeat(100));
        
        // 统计各层用户数
        const layerCounts = new Array(11).fill(0);
        const layerActiveCounts = new Array(11).fill(0);
        const layerTeamCounts = new Array(11).fill(0);
        
        function countLayers(root, level = 0, visited = new Set()) {
            if (level < 11 && !visited.has(root)) {
                visited.add(root);
                layerCounts[level]++;
                
                const info = userInfoCache.get(root);
                if (info) {
                    if (info.isActive) layerActiveCounts[level]++;
                    layerTeamCounts[level] += info.teamCount;
                }
                
                if (level < 10) {
                    const children = referrerToUsers.get(root) || [];
                    for (const child of children) {
                        countLayers(child, level + 1, visited);
                    }
                }
            }
        }
        
        countLayers(mainRoot);
        
        console.log("\n各层用户统计:");
        for (let i = 0; i < 11; i++) {
            if (layerCounts[i] > 0) {
                const avgTeam = layerCounts[i] > 0 ? (layerTeamCounts[i] / layerCounts[i]).toFixed(1) : 0;
                console.log(`  第${i === 0 ? '1' : i + 1}层: ${layerCounts[i]} 个用户 (激活: ${layerActiveCounts[i]}, 平均团队: ${avgTeam})`);
            }
        }
        
        const total = layerCounts.reduce((a, b) => a + b, 0);
        const totalActive = layerActiveCounts.reduce((a, b) => a + b, 0);
        console.log(`\n总计: ${total} 个用户 (激活: ${totalActive}, 未激活: ${total - totalActive})`);
        
        // 统计直推分布
        console.log("\n直推分布:");
        const directCounts = {};
        for (const [user, info] of userInfoCache.entries()) {
            const count = info.activeDirects;
            directCounts[count] = (directCounts[count] || 0) + 1;
        }
        
        const sortedDirects = Object.keys(directCounts).map(Number).sort((a, b) => b - a);
        for (const count of sortedDirects.slice(0, 10)) {
            console.log(`  ${count} 个直推: ${directCounts[count]} 个用户`);
        }
        
        console.log("=".repeat(100));

    } catch (error) {
        console.error("❌ 绘制失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    const allUsers = new Set();

    // 从新合约获取
    try {
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

        [...newBoundEvents, ...newTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 新合约事件查询失败: ${error.message}`);
    }

    // 从旧合约获取
    try {
        const oldBoundEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        const oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );

        [...oldBoundEvents, ...oldTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 旧合约事件查询失败: ${error.message}`);
    }

    return Array.from(allUsers);
}

drawDirectReferralTree().catch(console.error);
