const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
    "event RewardPaid(address indexed user, uint256 amount, uint8 rewardType)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

/**
 * 从事件和合约获取所有用户及其推荐关系
 */
async function getAllUsersAndReferrers(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    
    const referrerMap = new Map(); // user -> referrer
    const referrerToUsers = new Map(); // referrer -> [users]
    const allUsers = new Set();
    
    // 1. 从事件获取用户和推荐关系
    let totalBoundEvents = 0;
    let totalTicketEvents = 0;
    let totalStakeEvents = 0;
    
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            // 从BoundReferrer事件获取推荐关系
            const boundEvents = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock,
                currentBlock
            );
            totalBoundEvents += boundEvents.length;
            boundEvents.forEach(event => {
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
            
            // 从TicketPurchased事件获取所有用户（包括没有推荐人的用户）
            const ticketEvents = await protocol.queryFilter(
                protocol.filters.TicketPurchased(),
                fromBlock,
                currentBlock
            );
            totalTicketEvents += ticketEvents.length;
            ticketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    allUsers.add(event.args.user.toLowerCase());
                }
            });
            
            // 从LiquidityStaked事件获取所有用户
            const stakeEvents = await protocol.queryFilter(
                protocol.filters.LiquidityStaked(),
                fromBlock,
                currentBlock
            );
            totalStakeEvents += stakeEvents.length;
            stakeEvents.forEach(event => {
                if (event.args && event.args.user) {
                    allUsers.add(event.args.user.toLowerCase());
                }
            });
            
            // 从RewardPaid事件获取所有用户
            try {
                const rewardEvents = await protocol.queryFilter(
                    protocol.filters.RewardPaid(),
                    fromBlock,
                    currentBlock
                );
                rewardEvents.forEach(event => {
                    if (event.args && event.args.user) {
                        allUsers.add(event.args.user.toLowerCase());
                    }
                });
            } catch (e) {
                // 忽略错误
            }
            
            // 从ReferralRewardPaid事件获取所有用户
            try {
                const referralRewardEvents = await protocol.queryFilter(
                    protocol.filters.ReferralRewardPaid(),
                    fromBlock,
                    currentBlock
                );
                referralRewardEvents.forEach(event => {
                    if (event.args && event.args.user) {
                        allUsers.add(event.args.user.toLowerCase());
                    }
                    if (event.args && event.args.from) {
                        allUsers.add(event.args.from.toLowerCase());
                    }
                });
            } catch (e) {
                // 忽略错误
            }
        } catch (error) {
            console.warn(`⚠️ 无法从合约事件获取用户: ${error.message}`);
        }
    }
    
    console.log(`  事件统计: BoundReferrer=${totalBoundEvents}, TicketPurchased=${totalTicketEvents}, LiquidityStaked=${totalStakeEvents}`);
    
    // 2. 从合约的userInfo中获取推荐关系（补充事件中可能缺失的数据）
    console.log("  从合约中获取推荐关系...");
    const usersFromEvents = Array.from(allUsers);
    let contractReferrerCount = 0;
    
    for (const user of usersFromEvents) {
        // 先尝试新合约
        try {
            const userInfo = await newProtocol.userInfo(user);
            const referrer = userInfo.referrer.toLowerCase();
            if (referrer !== ethers.ZeroAddress.toLowerCase()) {
                const existing = referrerMap.get(user);
                // 如果事件中没有，或者合约中的更准确（因为合约是当前状态）
                if (!existing || referrer !== existing.referrer) {
                    referrerMap.set(user, { referrer, blockNumber: currentBlock });
                    contractReferrerCount++;
                }
                allUsers.add(referrer);
            }
        } catch (error) {
            // 如果新合约中没有，尝试旧合约
            try {
                const userInfo = await oldProtocol.userInfo(user);
                const referrer = userInfo.referrer.toLowerCase();
                if (referrer !== ethers.ZeroAddress.toLowerCase()) {
                    const existing = referrerMap.get(user);
                    if (!existing || referrer !== existing.referrer) {
                        referrerMap.set(user, { referrer, blockNumber: currentBlock });
                        contractReferrerCount++;
                    }
                    allUsers.add(referrer);
                }
            } catch (e) {
                // 用户不在合约中，忽略
            }
        }
    }
    
    console.log(`  从合约补充了 ${contractReferrerCount} 个推荐关系`);
    
    // 3. 构建反向映射：referrer -> [users]
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (referrer !== ethers.ZeroAddress.toLowerCase()) {
            if (!referrerToUsers.has(referrer)) {
                referrerToUsers.set(referrer, []);
            }
            referrerToUsers.get(referrer).push(user);
        }
    });
    
    return { referrerMap, referrerToUsers, allUsers: Array.from(allUsers) };
}

/**
 * 递归计算用户的真实 teamCount
 */
function calculateTeamCount(user, referrerToUsers, cache = new Map(), visited = new Set()) {
    if (cache.has(user)) {
        return cache.get(user);
    }
    
    if (visited.has(user)) {
        return 0; // 防止循环
    }
    visited.add(user);
    
    const directReferrals = referrerToUsers.get(user) || [];
    let count = directReferrals.length;
    
    for (const referral of directReferrals) {
        count += calculateTeamCount(referral, referrerToUsers, cache, visited);
    }
    
    visited.delete(user);
    cache.set(user, count);
    return count;
}

/**
 * 打印推荐关系树（带teamCount）
 */
function printReferralTree(user, referrerToUsers, teamCountMap, contractTeamCountMap, level = 0, maxDepth = 10, visited = new Set()) {
    if (level > maxDepth || visited.has(user)) {
        return;
    }
    visited.add(user);
    
    const indent = "  ".repeat(level);
    const calculatedTeamCount = teamCountMap.get(user) || 0;
    const contractTeamCount = contractTeamCountMap.get(user) || 0;
    const status = calculatedTeamCount === contractTeamCount ? "✅" : "⚠️";
    const diff = calculatedTeamCount !== contractTeamCount ? ` (差异: ${calculatedTeamCount - contractTeamCount})` : "";
    
    console.log(`${indent}${status} ${user}`);
    console.log(`${indent}   计算teamCount: ${calculatedTeamCount}, 合约teamCount: ${contractTeamCount}${diff}`);
    
    const directReferrals = referrerToUsers.get(user) || [];
    if (directReferrals.length > 0) {
        console.log(`${indent}   直推数: ${directReferrals.length}`);
        for (const referral of directReferrals) {
            printReferralTree(referral, referrerToUsers, teamCountMap, contractTeamCountMap, level + 1, maxDepth, visited);
        }
    }
}

async function getAllUsersTeamCountByReferral() {
    console.log("📊 按照推荐关系计算网体所有人的 teamCount\n");
    console.log("=".repeat(80));

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取所有用户和推荐关系
        console.log("📋 获取所有用户和推荐关系...");
        const { referrerMap, referrerToUsers, allUsers } = await getAllUsersAndReferrers(newProtocol, oldProtocol, provider);
        console.log(`  总用户数: ${allUsers.length}`);
        console.log(`  推荐关系数: ${referrerMap.size}\n`);

        // 2. 识别根用户（没有推荐人的用户）
        console.log("🔍 识别根用户...");
        const rootUsers = allUsers.filter(user => {
            const data = referrerMap.get(user);
            return !data || data.referrer === ethers.ZeroAddress.toLowerCase();
        });
        console.log(`  根用户数: ${rootUsers.length}`);
        rootUsers.forEach((root, index) => {
            console.log(`    ${index + 1}. ${root}`);
        });
        console.log("");

        // 3. 获取所有用户的合约teamCount
        console.log("📥 获取所有用户的合约 teamCount...");
        const contractTeamCountMap = new Map();
        let successCount = 0;
        let failCount = 0;
        
        for (const user of allUsers) {
            try {
                const userInfo = await newProtocol.userInfo(user);
                contractTeamCountMap.set(user, Number(userInfo.teamCount));
                successCount++;
            } catch (error) {
                try {
                    const userInfo = await oldProtocol.userInfo(user);
                    contractTeamCountMap.set(user, Number(userInfo.teamCount));
                    successCount++;
                } catch (e) {
                    contractTeamCountMap.set(user, 0);
                    failCount++;
                }
            }
        }
        console.log(`  成功获取: ${successCount}, 失败: ${failCount}\n`);

        // 4. 计算所有用户的真实teamCount
        console.log("🧮 计算所有用户的真实 teamCount...");
        const teamCountMap = new Map();
        const teamCountCache = new Map();
        
        // 从根用户开始，递归计算
        for (const rootUser of rootUsers) {
            calculateTeamCount(rootUser, referrerToUsers, teamCountCache);
        }
        
        // 对于所有用户，计算其teamCount
        for (const user of allUsers) {
            const calculated = calculateTeamCount(user, referrerToUsers, teamCountCache);
            teamCountMap.set(user, calculated);
        }
        
        console.log(`  计算完成: ${teamCountMap.size} 个用户\n`);

        // 5. 对比计算值和合约值
        console.log("📊 对比计算值和合约值...");
        const discrepancies = [];
        let matchCount = 0;
        
        for (const user of allUsers) {
            const calculated = teamCountMap.get(user) || 0;
            const contract = contractTeamCountMap.get(user) || 0;
            
            if (calculated !== contract) {
                discrepancies.push({
                    user,
                    calculated,
                    contract,
                    diff: calculated - contract
                });
            } else {
                matchCount++;
            }
        }
        
        console.log(`  匹配: ${matchCount}/${allUsers.length} (${((matchCount / allUsers.length) * 100).toFixed(2)}%)`);
        console.log(`  不匹配: ${discrepancies.length}/${allUsers.length} (${((discrepancies.length / allUsers.length) * 100).toFixed(2)}%)\n`);

        // 6. 生成报告文件
        console.log("📝 生成报告文件...");
        const reportLines = [];
        reportLines.push("# 网体所有人 teamCount 报告");
        reportLines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        reportLines.push(`总用户数: ${allUsers.length}`);
        reportLines.push(`根用户数: ${rootUsers.length}`);
        reportLines.push(`teamCount 匹配: ${matchCount}/${allUsers.length}`);
        reportLines.push(`teamCount 不匹配: ${discrepancies.length}/${allUsers.length}`);
        reportLines.push("");
        reportLines.push("=".repeat(80));
        reportLines.push("");

        // 7. 按推荐关系树状输出（从每个根用户开始）
        reportLines.push("## 推荐关系树状图（带 teamCount）");
        reportLines.push("");
        
        for (let i = 0; i < rootUsers.length; i++) {
            const rootUser = rootUsers[i];
            reportLines.push(`### 根用户 ${i + 1}: ${rootUser}`);
            reportLines.push("");
            
            const calculatedTeamCount = teamCountMap.get(rootUser) || 0;
            const contractTeamCount = contractTeamCountMap.get(rootUser) || 0;
            const status = calculatedTeamCount === contractTeamCount ? "✅" : "⚠️";
            const diff = calculatedTeamCount !== contractTeamCount ? ` (差异: ${calculatedTeamCount - contractTeamCount})` : "";
            
            reportLines.push(`- ${status} **${rootUser}**`);
            reportLines.push(`  - 计算teamCount: ${calculatedTeamCount}`);
            reportLines.push(`  - 合约teamCount: ${contractTeamCount}${diff}`);
            reportLines.push("");
            
            // 递归输出子树（限制深度）
            function addTreeToReport(user, level = 1, maxLevel = 5, visited = new Set()) {
                if (level > maxLevel || visited.has(user)) {
                    return;
                }
                visited.add(user);
                
                const directReferrals = referrerToUsers.get(user) || [];
                if (directReferrals.length > 0) {
                    for (const referral of directReferrals) {
                        const calc = teamCountMap.get(referral) || 0;
                        const contract = contractTeamCountMap.get(referral) || 0;
                        const stat = calc === contract ? "✅" : "⚠️";
                        const diffText = calc !== contract ? ` (差异: ${calc - contract})` : "";
                        
                        const indent = "  ".repeat(level);
                        reportLines.push(`${indent}- ${stat} **${referral}**`);
                        reportLines.push(`${indent}  - 计算teamCount: ${calc}, 合约teamCount: ${contract}${diffText}`);
                        
                        addTreeToReport(referral, level + 1, maxLevel, visited);
                    }
                }
            }
            
            addTreeToReport(rootUser, 1, 5, new Set());
            reportLines.push("");
        }

        // 8. 列出所有不匹配的用户
        if (discrepancies.length > 0) {
            reportLines.push("## ⚠️ teamCount 不匹配的用户");
            reportLines.push("");
            reportLines.push("| 用户地址 | 计算teamCount | 合约teamCount | 差异 |");
            reportLines.push("|---------|--------------|--------------|------|");
            
            discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
            
            for (const disc of discrepancies) {
                reportLines.push(`| ${disc.user} | ${disc.calculated} | ${disc.contract} | ${disc.diff > 0 ? '+' : ''}${disc.diff} |`);
            }
            reportLines.push("");
        }

        // 9. 统计信息
        reportLines.push("## 统计信息");
        reportLines.push("");
        reportLines.push("### 按 teamCount 范围统计");
        reportLines.push("");
        reportLines.push("| teamCount 范围 | 用户数 |");
        reportLines.push("|--------------|--------|");
        
        const ranges = [
            { min: 0, max: 0, label: "0" },
            { min: 1, max: 10, label: "1-10" },
            { min: 11, max: 50, label: "11-50" },
            { min: 51, max: 100, label: "51-100" },
            { min: 101, max: 200, label: "101-200" },
            { min: 201, max: 500, label: "201-500" },
            { min: 501, max: 1000, label: "501-1000" },
            { min: 1001, max: Infinity, label: "1001+" }
        ];
        
        for (const range of ranges) {
            const count = Array.from(teamCountMap.values()).filter(tc => 
                tc >= range.min && tc <= range.max
            ).length;
            reportLines.push(`| ${range.label} | ${count} |`);
        }
        reportLines.push("");

        // 10. 保存报告
        const reportContent = reportLines.join("\n");
        const reportFile = `网体所有人teamCount报告-${new Date().toISOString().split('T')[0]}.md`;
        const fs = require('fs');
        fs.writeFileSync(reportFile, reportContent, 'utf8');
        console.log(`✅ 报告已保存到: ${reportFile}\n`);

        // 11. 控制台输出摘要
        console.log("=".repeat(80));
        console.log("📊 摘要");
        console.log("=".repeat(80));
        console.log(`总用户数: ${allUsers.length}`);
        console.log(`根用户数: ${rootUsers.length}`);
        console.log(`teamCount 匹配: ${matchCount}/${allUsers.length} (${((matchCount / allUsers.length) * 100).toFixed(2)}%)`);
        console.log(`teamCount 不匹配: ${discrepancies.length}/${allUsers.length} (${((discrepancies.length / allUsers.length) * 100).toFixed(2)}%)`);
        
        if (discrepancies.length > 0) {
            console.log(`\n⚠️  前10个差异最大的用户:`);
            discrepancies.slice(0, 10).forEach((disc, index) => {
                console.log(`  ${index + 1}. ${disc.user}: 计算=${disc.calculated}, 合约=${disc.contract}, 差异=${disc.diff > 0 ? '+' : ''}${disc.diff}`);
            });
        }
        
        console.log("\n" + "=".repeat(80));
        console.log(`✅ 完整报告已保存到: ${reportFile}`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 计算失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

getAllUsersTeamCountByReferral().catch(console.error);
