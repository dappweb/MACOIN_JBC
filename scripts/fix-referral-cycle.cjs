const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认为干运行

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetReferrer(address user, address newReferrer) external",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件获取每个用户最初的推荐人（最早的 BoundReferrer 事件）
 */
async function getOriginalReferrersFromEvents(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    const originalReferrers = new Map(); // user -> { referrer, blockNumber }
    
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
                    
                    const existing = originalReferrers.get(user);
                    if (!existing || blockNumber < existing.blockNumber) {
                        // 保存最早的推荐人
                        originalReferrers.set(user, { referrer, blockNumber });
                    }
                }
            });
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    return originalReferrers;
}

/**
 * 从合约中获取当前的推荐关系
 */
async function getCurrentReferrersFromContract(newProtocol, oldProtocol, allUsers) {
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

/**
 * 检测循环
 */
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

/**
 * 修复循环推荐关系
 */
async function fixReferralCycle() {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔧 修复循环推荐关系");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行修复\n");
    }

    console.log(`部署者地址: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    // 验证 Owner
    const owner = await newProtocol.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${wallet.address}`);
        process.exit(1);
    }
    console.log(`✅ Owner 验证通过\n`);

    // 步骤 1: 获取所有用户
    console.log("📋 步骤 1: 获取所有用户...");
    const allUsers = new Set();
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
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
    console.log(`  ✅ 找到 ${allUsers.size} 个用户\n`);

    // 步骤 2: 获取当前的推荐关系
    console.log("📋 步骤 2: 获取当前的推荐关系...");
    const currentReferrers = await getCurrentReferrersFromContract(newProtocol, oldProtocol, allUsers);
    console.log(`  ✅ 获取了 ${currentReferrers.size} 个推荐关系\n`);

    // 步骤 3: 获取最初的推荐关系（从事件中）
    console.log("📋 步骤 3: 获取最初的推荐关系（从事件中）...");
    const originalReferrers = await getOriginalReferrersFromEvents(newProtocol, oldProtocol, provider);
    console.log(`  ✅ 获取了 ${originalReferrers.size} 个最初的推荐关系\n`);

    // 步骤 4: 检测循环
    console.log("📋 步骤 4: 检测循环...");
    const cycles = detectCycles(currentReferrers, allUsers);
    console.log(`  ✅ 发现 ${cycles.length} 个循环\n`);

    if (cycles.length === 0) {
        console.log("✅ 未发现循环推荐关系，无需修复！");
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

    console.log(`  去重后的循环数: ${uniqueCycles.length}\n`);

    // 步骤 5: 找出需要修复的用户
    const usersInCycles = new Set();
    cycles.forEach(cycle => {
        cycle.forEach(user => usersInCycles.add(user));
    });

    console.log(`📋 步骤 5: 分析需要修复的用户...`);
    console.log(`  参与循环的用户数: ${usersInCycles.size}\n`);

    // 步骤 6: 为每个循环中的用户找到正确的推荐人
    const fixes = [];
    
    // 找出不在循环中的用户
    const usersNotInCycles = [];
    for (const user of allUsers) {
        if (!usersInCycles.has(user)) {
            usersNotInCycles.push(user);
        }
    }
    
    console.log(`  不在循环中的用户数: ${usersNotInCycles.length}\n`);
    
    // 找一个不在循环中的用户作为"虚拟根"
    // 优先选择 teamCount 较大的用户（更可能是早期用户）
    let virtualRoot = null;
    if (usersNotInCycles.length > 0) {
        // 获取这些用户的 teamCount 并排序
        const usersWithTeamCount = [];
        for (const user of usersNotInCycles.slice(0, 50)) { // 只检查前50个，避免太多请求
            try {
                const userInfo = await newProtocol.userInfo(user);
                usersWithTeamCount.push({
                    address: user,
                    teamCount: userInfo.teamCount
                });
            } catch (error) {
                // 忽略错误
            }
        }
        
        if (usersWithTeamCount.length > 0) {
            // 按 teamCount 降序排序，选择最大的
            usersWithTeamCount.sort((a, b) => {
                const aCount = BigInt(a.teamCount.toString());
                const bCount = BigInt(b.teamCount.toString());
                return aCount > bCount ? -1 : aCount < bCount ? 1 : 0;
            });
            
            virtualRoot = usersWithTeamCount[0].address;
            console.log(`  ✅ 选择虚拟根用户: ${virtualRoot}`);
            console.log(`     teamCount: ${usersWithTeamCount[0].teamCount.toString()}\n`);
        } else {
            virtualRoot = usersNotInCycles[0];
            console.log(`  ✅ 选择虚拟根用户: ${virtualRoot}\n`);
        }
    }
    
    for (const cycle of uniqueCycles) {
        console.log(`  分析循环 (${cycle.length} 个用户):`);
        
        // 策略：只修复循环中的一个用户，打破循环
        // 选择：使用原始推荐人不在循环中的用户，或者选择循环中最早加入的用户
        
        let bestUserToFix = null;
        let bestNewReferrer = null;
        let bestReason = null;
        
        // 优先选择：原始推荐人不在循环中的用户
        for (const user of cycle) {
            const originalReferrer = originalReferrers.get(user);
            if (originalReferrer && !usersInCycles.has(originalReferrer.referrer)) {
                bestUserToFix = user;
                bestNewReferrer = originalReferrer.referrer;
                bestReason = "原始推荐人不在循环中";
                break;
            }
        }
        
        // 如果没有找到，选择循环中最早加入的用户（blockNumber 最小）
        if (!bestUserToFix) {
            let earliestUser = null;
            let earliestBlock = Infinity;
            
            for (const user of cycle) {
                const originalReferrer = originalReferrers.get(user);
                if (originalReferrer && originalReferrer.blockNumber < earliestBlock) {
                    earliestUser = user;
                    earliestBlock = originalReferrer.blockNumber;
                }
            }
            
            if (earliestUser && virtualRoot) {
                bestUserToFix = earliestUser;
                bestNewReferrer = virtualRoot;
                bestReason = "最早加入的用户，指向虚拟根";
            }
        }
        
        // 如果还是没找到，选择循环中的第一个用户
        if (!bestUserToFix && virtualRoot) {
            bestUserToFix = cycle[0];
            bestNewReferrer = virtualRoot;
            bestReason = "循环中的第一个用户，指向虚拟根";
        }
        
        if (bestUserToFix && bestNewReferrer) {
            // 验证新推荐人的推荐链中不包含目标用户
            let isValid = true;
            let current = bestNewReferrer;
            let depth = 0;
            const visited = new Set();
            
            while (current && current !== ethers.ZeroAddress.toLowerCase() && depth < 50) {
                if (visited.has(current)) {
                    // 发现循环，但这不是问题，只要不包含目标用户即可
                    break;
                }
                visited.add(current);
                
                if (current === bestUserToFix) {
                    isValid = false;
                    console.log(`    ⚠️  新推荐人 ${bestNewReferrer} 的推荐链包含目标用户 ${bestUserToFix}`);
                    break;
                }
                
                const referrer = currentReferrers.get(current);
                if (!referrer || referrer === ethers.ZeroAddress.toLowerCase()) {
                    break;
                }
                current = referrer;
                depth++;
            }
            
            if (!isValid) {
                console.log(`    ⚠️  尝试寻找其他新推荐人...`);
                // 尝试使用另一个不在循环中的用户
                let foundAlternative = false;
                for (const candidate of usersNotInCycles) {
                    if (candidate === bestUserToFix || candidate === bestNewReferrer) {
                        continue;
                    }
                    
                    // 快速验证：检查候选推荐人的推荐链中是否包含目标用户
                    let candidateValid = true;
                    let candidateCurrent = candidate;
                    let candidateDepth = 0;
                    const candidateVisited = new Set();
                    
                    while (candidateCurrent && candidateCurrent !== ethers.ZeroAddress.toLowerCase() && candidateDepth < 50) {
                        if (candidateVisited.has(candidateCurrent)) {
                            break; // 发现循环，但继续检查
                        }
                        candidateVisited.add(candidateCurrent);
                        
                        if (candidateCurrent === bestUserToFix) {
                            candidateValid = false;
                            break;
                        }
                        
                        const candidateReferrer = currentReferrers.get(candidateCurrent);
                        if (!candidateReferrer || candidateReferrer === ethers.ZeroAddress.toLowerCase()) {
                            break;
                        }
                        candidateCurrent = candidateReferrer;
                        candidateDepth++;
                    }
                    
                    if (candidateValid) {
                        bestNewReferrer = candidate;
                        isValid = true;
                        foundAlternative = true;
                        console.log(`    ✅ 改用新推荐人: ${bestNewReferrer}`);
                        break;
                    }
                }
                
                if (!foundAlternative) {
                    console.log(`    ❌ 无法找到合适的新推荐人`);
                }
            }
            
            const currentReferrer = currentReferrers.get(bestUserToFix);
            if (bestNewReferrer !== currentReferrer && isValid) {
                fixes.push({
                    user: bestUserToFix,
                    currentReferrer,
                    newReferrer: bestNewReferrer,
                    reason: bestReason
                });
                console.log(`    ✅ 将修复用户 ${bestUserToFix}`);
                console.log(`       原因: ${bestReason}`);
                console.log(`       当前推荐人: ${currentReferrer}`);
                console.log(`       新推荐人: ${bestNewReferrer}`);
            }
        }
    }

    console.log(`\n  ✅ 找到 ${fixes.length} 个需要修复的用户\n`);

    if (fixes.length === 0) {
        console.log("✅ 没有需要修复的用户！");
        return;
    }

    // 输出修复计划
    console.log("=".repeat(80));
    console.log("📋 修复计划");
    console.log("=".repeat(80));
    fixes.forEach((fix, index) => {
        console.log(`\n${index + 1}. 用户: ${fix.user}`);
        console.log(`   当前推荐人: ${fix.currentReferrer}`);
        console.log(`   新推荐人: ${fix.newReferrer}`);
        console.log(`   原始推荐人: ${fix.originalReferrer || '未知'}`);
    });
    console.log("\n" + "=".repeat(80));

    if (DRY_RUN) {
        console.log("⚠️  干运行模式，跳过实际修复");
        console.log(`   如果执行，将修复 ${fixes.length} 个用户的推荐关系`);
        return;
    }

    // 执行修复
    console.log("\n📝 开始修复...");
    console.log("=".repeat(80));

    const fixResults = {
        timestamp: new Date().toISOString(),
        totalFixes: fixes.length,
        fixed: [],
        failed: []
    };

    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        console.log(`\n[${i + 1}/${fixes.length}] 修复用户: ${fix.user}`);
        console.log(`  当前推荐人: ${fix.currentReferrer}`);
        console.log(`  新推荐人: ${fix.newReferrer}`);

        try {
            const tx = await newProtocol.adminSetReferrer(fix.user, fix.newReferrer);
            console.log(`  ✅ 交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  ✅ 交易已确认！区块号: ${receipt.blockNumber}`);
            
            // 验证修复结果
            const updatedInfo = await newProtocol.userInfo(fix.user);
            const updatedReferrer = updatedInfo.referrer.toLowerCase();
            
            if (updatedReferrer === fix.newReferrer.toLowerCase()) {
                console.log(`  ✅ 修复成功！推荐人已更新为 ${updatedReferrer}`);
                fixResults.fixed.push({
                    user: fix.user,
                    oldReferrer: fix.currentReferrer,
                    newReferrer: updatedReferrer,
                    txHash: tx.hash
                });
            } else {
                console.log(`  ⚠️  警告: 推荐人更新为 ${updatedReferrer}，但目标值是 ${fix.newReferrer}`);
            }
        } catch (error) {
            console.error(`  ❌ 修复失败: ${error.message}`);
            if (error.reason) {
                console.error(`   原因: ${error.reason}`);
            }
            fixResults.failed.push({
                user: fix.user,
                error: error.message
            });
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 修复结果");
    console.log("=".repeat(80));
    console.log(`成功修复: ${fixResults.fixed.length} 个用户`);
    console.log(`修复失败: ${fixResults.failed.length} 个用户`);
    console.log("=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    fixReferralCycle().catch(console.error);
}
