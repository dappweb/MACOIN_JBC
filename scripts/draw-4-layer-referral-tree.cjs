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

async function draw4LayerReferralTree() {
    console.log("🌳 绘制4层推荐关系图\n");
    console.log("=".repeat(80));

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
        
        for (const userAddress of allUsers) {
            let referrer = ethers.ZeroAddress;
            
            try {
                const userInfo = await newProtocol.userInfo(userAddress);
                if (userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress) {
                    referrer = userInfo.referrer.toLowerCase();
                }
            } catch (error) {
                // 用户不在新合约中
            }
            
            if (referrer !== ethers.ZeroAddress) {
                referrerMap.set(userAddress.toLowerCase(), referrer);
                if (!referrerToUsers.has(referrer)) {
                    referrerToUsers.set(referrer, []);
                }
                referrerToUsers.get(referrer).push(userAddress.toLowerCase());
            } else {
                // 根用户（没有推荐人）
                rootUsers.push(userAddress.toLowerCase());
            }
        }
        
        console.log(`  推荐关系数: ${referrerMap.size}`);
        console.log(`  根用户数: ${rootUsers.length}\n`);

        // 3. 找到团队最大的用户作为根节点
        console.log("🔍 查找团队最大的用户...");
        let mainRoot = null;
        let maxTeamCount = 0;
        
        // 先找所有根用户中团队最大的
        for (const root of rootUsers) {
            try {
                const userInfo = await newProtocol.userInfo(root);
                const teamCount = Number(userInfo.teamCount);
                if (teamCount > maxTeamCount) {
                    maxTeamCount = teamCount;
                    mainRoot = root;
                }
            } catch (e) {
                // 忽略错误
            }
        }
        
        // 如果根用户团队都不大，找所有用户中团队最大的
        if (maxTeamCount < 100) {
            console.log("  根用户团队较小，查找所有用户中团队最大的...");
            for (const user of allUsers) {
                try {
                    const userInfo = await newProtocol.userInfo(user);
                    const teamCount = Number(userInfo.teamCount);
                    if (teamCount > maxTeamCount) {
                        maxTeamCount = teamCount;
                        mainRoot = user.toLowerCase();
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
        }
        
        if (!mainRoot && rootUsers.length > 0) {
            mainRoot = rootUsers[0];
        }
        
        if (!mainRoot) {
            console.error("❌ 无法找到根用户");
            return;
        }
        
        console.log(`  主要根用户: ${mainRoot}`);
        console.log(`  团队人数: ${maxTeamCount}\n`);

        // 4. 绘制4层推荐关系树
        console.log("=".repeat(80));
        console.log("🌳 4层推荐关系图");
        console.log("=".repeat(80));
        console.log();
        
        function formatAddress(addr) {
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        
        function getTeamCount(addr) {
            try {
                // 同步获取，这里简化处理
                return "?";
            } catch (e) {
                return "?";
            }
        }
        
        async function drawTree(root, level = 0, maxLevel = 4, prefix = "", isLast = true, visited = new Set()) {
            if (level > maxLevel) return;
            if (visited.has(root)) return; // 防止循环
            visited.add(root);
            
            const connector = isLast ? "└── " : "├── ";
            const address = formatAddress(root);
            
            // 获取用户信息
            let teamCount = "?";
            let activeDirects = "?";
            let isActive = false;
            try {
                const userInfo = await newProtocol.userInfo(root);
                teamCount = userInfo.teamCount.toString();
                activeDirects = userInfo.activeDirects.toString();
                isActive = userInfo.isActive;
            } catch (e) {
                // 忽略错误
            }
            
            const status = isActive ? "✅" : "⚪";
            const levelLabel = level === 0 ? "[根]" : level === 1 ? "[L1]" : level === 2 ? "[L2]" : level === 3 ? "[L3]" : "[L4]";
            console.log(`${prefix}${connector}${status} ${levelLabel} ${address} (团队:${teamCount}, 直推:${activeDirects})`);
            
            if (level < maxLevel) {
                const children = referrerToUsers.get(root) || [];
                const sortedChildren = children.sort();
                
                // 限制每层最多显示20个，避免输出过长
                const displayChildren = sortedChildren.slice(0, 20);
                const remaining = sortedChildren.length - 20;
                
                for (let i = 0; i < displayChildren.length; i++) {
                    const child = displayChildren[i];
                    const isLastChild = i === displayChildren.length - 1 && remaining === 0;
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    await drawTree(child, level + 1, maxLevel, newPrefix, isLastChild, new Set(visited));
                }
                
                if (remaining > 0) {
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    console.log(`${newPrefix}└── ... (还有 ${remaining} 个用户未显示)`);
                }
            } else if (level === maxLevel) {
                const children = referrerToUsers.get(root) || [];
                if (children.length > 0) {
                    const newPrefix = prefix + (isLast ? "    " : "│   ");
                    console.log(`${newPrefix}└── ... (还有 ${children.length} 个用户在第5层及以下)`);
                }
            }
        }
        
        await drawTree(mainRoot, 0, 4);
        
        console.log();
        console.log("=".repeat(80));
        console.log("📊 统计信息");
        console.log("=".repeat(80));
        
        // 统计各层用户数
        const layerCounts = [0, 0, 0, 0, 0];
        
        function countLayers(root, level = 0) {
            if (level < 5) {
                layerCounts[level]++;
            }
            
            if (level < 4) {
                const children = referrerToUsers.get(root) || [];
                for (const child of children) {
                    countLayers(child, level + 1);
                }
            }
        }
        
        countLayers(mainRoot);
        
        console.log(`第1层 (根用户): ${layerCounts[0]} 个`);
        console.log(`第2层 (直推): ${layerCounts[1]} 个`);
        console.log(`第3层: ${layerCounts[2]} 个`);
        console.log(`第4层: ${layerCounts[3]} 个`);
        console.log(`第5层及以下: ${layerCounts[4]} 个`);
        console.log(`总计: ${layerCounts.reduce((a, b) => a + b, 0)} 个`);
        console.log("=".repeat(80));

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

draw4LayerReferralTree().catch(console.error);
