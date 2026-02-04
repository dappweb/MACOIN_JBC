const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

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

async function getAllReferrersFromContract(newProtocol, oldProtocol, allUsers) {
    const referrerMap = new Map();
    
    for (const user of allUsers) {
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
    
    return referrerMap;
}

function detectCycles(referrerMap, allUsers) {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    
    function dfs(user, path = []) {
        if (recStack.has(user)) {
            const cycleStart = path.indexOf(user);
            if (cycleStart !== -1) {
                const cycle = path.slice(cycleStart);
                cycle.push(user);
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

async function getFullCycleList() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📋 获取完整的循环推荐关系列表");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
    const referrerMap = await getAllReferrersFromContract(newProtocol, oldProtocol, allUsers);
    const cycles = detectCycles(referrerMap, allUsers);

    if (cycles.length === 0) {
        console.log("✅ 未发现循环推荐关系");
        return;
    }

    // 去重循环
    const uniqueCycles = [];
    const cycleStrings = new Set();
    
    for (const cycle of cycles) {
        const minIndex = cycle.indexOf(cycle.reduce((min, addr) => addr < min ? addr : min));
        const normalizedCycle = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
        const cycleStr = normalizedCycle.join(' -> ');
        
        if (!cycleStrings.has(cycleStr)) {
            cycleStrings.add(cycleStr);
            uniqueCycles.push(normalizedCycle);
        }
    }

    console.log(`发现 ${uniqueCycles.length} 个循环\n`);

    for (let i = 0; i < uniqueCycles.length; i++) {
        const cycle = uniqueCycles[i];
        console.log(`循环 ${i + 1} (${cycle.length} 个用户):`);
        console.log("=".repeat(80));
        
        for (let j = 0; j < cycle.length; j++) {
            const user = cycle[j];
            const nextUser = cycle[(j + 1) % cycle.length];
            console.log(`  ${(j + 1).toString().padStart(2, '0')}. ${user}`);
            console.log(`     推荐人: ${nextUser}`);
            
            // 获取合约中的 teamCount
            try {
                const userInfo = await newProtocol.userInfo(user);
                console.log(`     合约 teamCount: ${userInfo.teamCount.toString()}`);
            } catch (error) {
                try {
                    const userInfo = await oldProtocol.userInfo(user);
                    console.log(`     合约 teamCount: ${userInfo.teamCount.toString()}`);
                } catch (oldError) {
                    console.log(`     合约 teamCount: 无法查询`);
                }
            }
            console.log("");
        }
    }

    // 统计参与循环的用户
    const usersInCycles = new Set();
    cycles.forEach(cycle => {
        cycle.forEach(user => usersInCycles.add(user));
    });

    console.log("=".repeat(80));
    console.log("📊 统计");
    console.log("=".repeat(80));
    console.log(`总用户数: ${allUsers.size}`);
    console.log(`参与循环的用户数: ${usersInCycles.size}`);
    console.log(`未参与循环的用户数: ${allUsers.size - usersInCycles.size}`);
    console.log("=".repeat(80));
}

if (require.main === module) {
    getFullCycleList().catch(console.error);
}
