const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件获取所有用户
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    const allUsers = new Set();
    
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock,
                currentBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    allUsers.add(event.args.user.toLowerCase());
                    allUsers.add(event.args.referrer.toLowerCase());
                }
            });
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    return allUsers;
}

/**
 * 从合约中获取所有用户的推荐关系
 */
async function getAllReferrersFromContract(newProtocol, oldProtocol, allUsers) {
    const referrerMap = new Map();
    
    console.log("📋 从合约中查询所有用户的推荐关系...");
    let count = 0;
    for (const user of allUsers) {
        if (++count % 100 === 0) {
            process.stdout.write(`\r  ⏳ 已处理: ${count}/${allUsers.size}`);
        }
        
        try {
            const userInfo = await newProtocol.userInfo(user);
            const referrer = userInfo.referrer.toLowerCase();
            if (referrer && referrer !== ethers.ZeroAddress.toLowerCase()) {
                referrerMap.set(user, referrer);
            }
        } catch (error) {
            try {
                const userInfo = await oldProtocol.userInfo(user);
                const referrer = userInfo.referrer.toLowerCase();
                if (referrer && referrer !== ethers.ZeroAddress.toLowerCase()) {
                    referrerMap.set(user, referrer);
                }
            } catch (oldError) {
                // 忽略错误
            }
        }
    }
    process.stdout.write(`\r  ✅ 已查询 ${allUsers.size} 个用户的推荐关系\n\n`);
    
    return referrerMap;
}

/**
 * 检测循环推荐关系
 */
function detectCycles(referrerMap, allUsers) {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    
    function dfs(user, path = []) {
        if (recStack.has(user)) {
            // 发现循环
            const cycleStart = path.indexOf(user);
            if (cycleStart !== -1) {
                const cycle = path.slice(cycleStart);
                cycle.push(user); // 闭合循环
                cycles.push(cycle);
            }
            return;
        }
        
        if (visited.has(user)) {
            return;
        }
        
        visited.add(user);
        recStack.add(user);
        path.push(user);
        
        const referrer = referrerMap.get(user);
        if (referrer && referrer !== ethers.ZeroAddress.toLowerCase() && allUsers.has(referrer)) {
            dfs(referrer, [...path]);
        }
        
        recStack.delete(user);
    }
    
    for (const user of allUsers) {
        if (!visited.has(user)) {
            dfs(user, []);
        }
    }
    
    return cycles;
}

/**
 * 检查推荐关系是否形成循环
 */
async function checkReferralCycles() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 检查推荐关系是否形成循环");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 从事件获取所有用户...");
    const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 找到 ${allUsers.size} 个用户\n`);

    // 步骤 2: 从合约中获取推荐关系
    const referrerMap = await getAllReferrersFromContract(newProtocol, oldProtocol, allUsers);
    console.log(`  ✅ 获取了 ${referrerMap.size} 个推荐关系\n`);

    // 步骤 3: 找出根用户（没有推荐人的用户）
    console.log("📋 步骤 2: 分析推荐关系结构...");
    const rootUsers = [];
    referrerMap.forEach((referrer, user) => {
        if (referrer === ethers.ZeroAddress.toLowerCase() || !referrer) {
            rootUsers.push(user);
        }
    });
    
    // 也检查那些没有推荐关系的用户
    for (const user of allUsers) {
        if (!referrerMap.has(user)) {
            rootUsers.push(user);
        }
    }
    
    console.log(`  ✅ 根用户数（没有推荐人）: ${rootUsers.length}`);
    console.log(`  ✅ 有推荐人的用户数: ${referrerMap.size}`);
    console.log(`  ✅ 总用户数: ${allUsers.size}`);
    
    if (rootUsers.length > 0) {
        console.log(`\n  根用户列表（前10个）:`);
        rootUsers.slice(0, 10).forEach((user, index) => {
            console.log(`    ${index + 1}. ${user}`);
        });
    }
    console.log("");

    // 步骤 4: 检测循环
    console.log("📋 步骤 3: 检测循环推荐关系...");
    const cycles = detectCycles(referrerMap, allUsers);
    
    console.log(`  ✅ 发现 ${cycles.length} 个循环\n`);
    
    if (cycles.length > 0) {
        console.log("⚠️  发现循环推荐关系！这是不正常的！\n");
        
        // 去重循环（相同的循环只显示一次）
        const uniqueCycles = [];
        const cycleStrings = new Set();
        
        for (const cycle of cycles) {
            // 找到循环的起点（最小的地址）
            const minIndex = cycle.indexOf(cycle.reduce((min, addr) => addr < min ? addr : min));
            const normalizedCycle = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
            const cycleStr = normalizedCycle.join(' -> ');
            
            if (!cycleStrings.has(cycleStr)) {
                cycleStrings.add(cycleStr);
                uniqueCycles.push(normalizedCycle);
            }
        }
        
        console.log(`  去重后的循环数: ${uniqueCycles.length}\n`);
        
        if (uniqueCycles.length > 0) {
            console.log("  循环列表（前5个）:");
            uniqueCycles.slice(0, 5).forEach((cycle, index) => {
                console.log(`\n  循环 ${index + 1} (${cycle.length} 个用户):`);
                const displayCycle = cycle.length > 10 ? cycle.slice(0, 10) : cycle;
                displayCycle.forEach((user, i) => {
                    console.log(`    ${i + 1}. ${user}`);
                });
                if (cycle.length > 10) {
                    console.log(`    ... 还有 ${cycle.length - 10} 个用户`);
                }
            });
        }
        
        // 统计参与循环的用户
        const usersInCycles = new Set();
        cycles.forEach(cycle => {
            cycle.forEach(user => usersInCycles.add(user));
        });
        
        console.log(`\n  📊 统计:`);
        console.log(`    参与循环的用户数: ${usersInCycles.size}`);
        console.log(`    未参与循环的用户数: ${allUsers.size - usersInCycles.size}`);
        
    } else {
        console.log("✅ 未发现循环推荐关系！推荐关系结构正常。\n");
    }

    // 步骤 5: 检查推荐关系链的长度
    console.log("📋 步骤 4: 检查推荐关系链的长度...");
    const chainLengths = new Map();
    
    function getChainLength(user, visited = new Set()) {
        if (visited.has(user)) {
            return -1; // 循环
        }
        visited.add(user);
        
        const referrer = referrerMap.get(user);
        if (!referrer || referrer === ethers.ZeroAddress.toLowerCase()) {
            return 0; // 根用户
        }
        
        if (!allUsers.has(referrer)) {
            return 0; // 推荐人不在用户列表中
        }
        
        const length = getChainLength(referrer, new Set(visited));
        if (length === -1) {
            return -1; // 循环
        }
        return length + 1;
    }
    
    for (const user of allUsers) {
        const length = getChainLength(user);
        if (length >= 0) {
            chainLengths.set(user, length);
        }
    }
    
    const maxLength = Math.max(...Array.from(chainLengths.values()), 0);
    console.log(`  ✅ 最长推荐关系链: ${maxLength} 层`);
    console.log(`  ✅ 有循环的用户数: ${allUsers.size - chainLengths.size}`);
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ 检查完成");
    console.log("=".repeat(80));
    
    if (cycles.length > 0) {
        console.log("\n⚠️  警告: 发现循环推荐关系！这会导致 teamCount 计算错误！");
        console.log("建议: 需要修复推荐关系数据，消除循环。");
    }
}

if (require.main === module) {
    checkReferralCycles().catch(console.error);
}
