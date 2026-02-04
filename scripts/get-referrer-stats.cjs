const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

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
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            // 从BoundReferrer事件获取推荐关系
            const boundEvents = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock,
                currentBlock
            );
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
            
            // 从TicketPurchased事件获取所有用户
            const ticketEvents = await protocol.queryFilter(
                protocol.filters.TicketPurchased(),
                fromBlock,
                currentBlock
            );
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
    
    // 2. 从合约的userInfo中获取推荐关系
    const usersFromEvents = Array.from(allUsers);
    
    for (const user of usersFromEvents) {
        try {
            const userInfo = await newProtocol.userInfo(user);
            const referrer = userInfo.referrer.toLowerCase();
            if (referrer !== ethers.ZeroAddress.toLowerCase()) {
                const existing = referrerMap.get(user);
                if (!existing || referrer !== existing.referrer) {
                    referrerMap.set(user, { referrer, blockNumber: currentBlock });
                }
                allUsers.add(referrer);
            }
        } catch (error) {
            try {
                const userInfo = await oldProtocol.userInfo(user);
                const referrer = userInfo.referrer.toLowerCase();
                if (referrer !== ethers.ZeroAddress.toLowerCase()) {
                    const existing = referrerMap.get(user);
                    if (!existing || referrer !== existing.referrer) {
                        referrerMap.set(user, { referrer, blockNumber: currentBlock });
                    }
                    allUsers.add(referrer);
                }
            } catch (e) {
                // 忽略错误
            }
        }
    }
    
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
 * 递归计算用户的团队人数（包括所有下级）
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

async function getReferrerStats() {
    console.log("📊 获取推荐人统计信息（直推人数、推荐网体人数）\n");
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

        // 2. 计算所有用户的团队人数
        console.log("🧮 计算所有用户的团队人数...");
        const teamCountCache = new Map();
        const teamCountMap = new Map();
        
        for (const user of allUsers) {
            const calculated = calculateTeamCount(user, referrerToUsers, teamCountCache);
            teamCountMap.set(user, calculated);
        }
        console.log(`  计算完成: ${teamCountMap.size} 个用户\n`);

        // 3. 获取合约中的teamCount和activeDirects
        console.log("📥 获取合约中的teamCount和activeDirects...");
        const contractDataMap = new Map();
        let successCount = 0;
        
        for (const user of allUsers) {
            try {
                const userInfo = await newProtocol.userInfo(user);
                contractDataMap.set(user, {
                    activeDirects: Number(userInfo.activeDirects),
                    teamCount: Number(userInfo.teamCount),
                    isActive: userInfo.isActive
                });
                successCount++;
            } catch (error) {
                try {
                    const userInfo = await oldProtocol.userInfo(user);
                    contractDataMap.set(user, {
                        activeDirects: Number(userInfo.activeDirects),
                        teamCount: Number(userInfo.teamCount),
                        isActive: userInfo.isActive
                    });
                    successCount++;
                } catch (e) {
                    contractDataMap.set(user, {
                        activeDirects: 0,
                        teamCount: 0,
                        isActive: false
                    });
                }
            }
        }
        console.log(`  成功获取: ${successCount}/${allUsers.length}\n`);

        // 4. 生成报告
        console.log("📝 生成推荐人统计报告...");
        const reportLines = [];
        reportLines.push("# 推荐人统计报告（直推人数、推荐网体人数）");
        reportLines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        reportLines.push(`总用户数: ${allUsers.length}`);
        reportLines.push("");
        reportLines.push("=".repeat(80));
        reportLines.push("");

        // 5. 生成统计表格
        reportLines.push("## 所有推荐人统计表");
        reportLines.push("");
        reportLines.push("| 推荐人地址 | 直推人数（计算） | 直推人数（合约） | 推荐网体人数（计算） | 推荐网体人数（合约） | 差异 | 是否活跃 |");
        reportLines.push("|-----------|----------------|----------------|-------------------|-------------------|------|---------|");
        
        // 获取所有有直推的推荐人
        const referrers = Array.from(referrerToUsers.keys())
            .filter(ref => (referrerToUsers.get(ref) || []).length > 0)
            .sort((a, b) => {
                const directA = (referrerToUsers.get(a) || []).length;
                const directB = (referrerToUsers.get(b) || []).length;
                if (directB !== directA) {
                    return directB - directA; // 按直推数降序
                }
                const teamA = teamCountMap.get(a) || 0;
                const teamB = teamCountMap.get(b) || 0;
                return teamB - teamA; // 再按团队人数降序
            });
        
        for (const referrer of referrers) {
            const directCount = (referrerToUsers.get(referrer) || []).length;
            const calculatedTeamCount = teamCountMap.get(referrer) || 0;
            const contractData = contractDataMap.get(referrer) || { activeDirects: 0, teamCount: 0, isActive: false };
            const contractDirects = contractData.activeDirects;
            const contractTeamCount = contractData.teamCount;
            const isActive = contractData.isActive ? "是" : "否";
            
            const diff = calculatedTeamCount - contractTeamCount;
            const diffText = diff === 0 ? "✅" : diff > 0 ? `+${diff}` : `${diff}`;
            
            reportLines.push(`| ${referrer} | ${directCount} | ${contractDirects} | ${calculatedTeamCount} | ${contractTeamCount} | ${diffText} | ${isActive} |`);
        }
        reportLines.push("");

        // 6. 统计信息
        reportLines.push("## 统计信息");
        reportLines.push("");
        
        // 按直推数范围统计
        reportLines.push("### 按直推数范围统计");
        reportLines.push("");
        reportLines.push("| 直推数范围 | 推荐人数 |");
        reportLines.push("|----------|---------|");
        
        const directCountMap = new Map();
        for (const referrer of referrers) {
            const directCount = (referrerToUsers.get(referrer) || []).length;
            const range = directCount === 0 ? "0" :
                         directCount <= 5 ? "1-5" :
                         directCount <= 10 ? "6-10" :
                         directCount <= 20 ? "11-20" :
                         directCount <= 50 ? "21-50" :
                         "50+";
            directCountMap.set(range, (directCountMap.get(range) || 0) + 1);
        }
        
        const sortedRanges = ["0", "1-5", "6-10", "11-20", "21-50", "50+"];
        for (const range of sortedRanges) {
            const count = directCountMap.get(range) || 0;
            if (count > 0) {
                reportLines.push(`| ${range} | ${count} |`);
            }
        }
        reportLines.push("");

        // 按团队人数范围统计
        reportLines.push("### 按推荐网体人数范围统计");
        reportLines.push("");
        reportLines.push("| 团队人数范围 | 推荐人数 |");
        reportLines.push("|------------|---------|");
        
        const teamCountRangeMap = new Map();
        for (const referrer of referrers) {
            const teamCount = teamCountMap.get(referrer) || 0;
            const range = teamCount === 0 ? "0" :
                         teamCount <= 10 ? "1-10" :
                         teamCount <= 50 ? "11-50" :
                         teamCount <= 100 ? "51-100" :
                         teamCount <= 200 ? "101-200" :
                         teamCount <= 500 ? "201-500" :
                         teamCount <= 1000 ? "501-1000" :
                         "1000+";
            teamCountRangeMap.set(range, (teamCountRangeMap.get(range) || 0) + 1);
        }
        
        const sortedTeamRanges = ["0", "1-10", "11-50", "51-100", "101-200", "201-500", "501-1000", "1000+"];
        for (const range of sortedTeamRanges) {
            const count = teamCountRangeMap.get(range) || 0;
            if (count > 0) {
                reportLines.push(`| ${range} | ${count} |`);
            }
        }
        reportLines.push("");

        // 7. 差异分析
        reportLines.push("## 差异分析");
        reportLines.push("");
        
        let matchCount = 0;
        let diffCount = 0;
        const largeDiffs = [];
        
        for (const referrer of referrers) {
            const calculatedTeamCount = teamCountMap.get(referrer) || 0;
            const contractData = contractDataMap.get(referrer) || { teamCount: 0 };
            const contractTeamCount = contractData.teamCount;
            
            if (calculatedTeamCount === contractTeamCount) {
                matchCount++;
            } else {
                diffCount++;
                const diff = Math.abs(calculatedTeamCount - contractTeamCount);
                if (diff >= 10) {
                    largeDiffs.push({
                        referrer,
                        calculated: calculatedTeamCount,
                        contract: contractTeamCount,
                        diff: calculatedTeamCount - contractTeamCount
                    });
                }
            }
        }
        
        reportLines.push(`- 计算值与合约值匹配: ${matchCount}/${referrers.length} (${((matchCount / referrers.length) * 100).toFixed(2)}%)`);
        reportLines.push(`- 计算值与合约值不匹配: ${diffCount}/${referrers.length} (${((diffCount / referrers.length) * 100).toFixed(2)}%)`);
        reportLines.push("");
        
        if (largeDiffs.length > 0) {
            reportLines.push("### 差异较大的推荐人（差异≥10）");
            reportLines.push("");
            reportLines.push("| 推荐人地址 | 计算团队人数 | 合约团队人数 | 差异 |");
            reportLines.push("|-----------|------------|------------|------|");
            
            largeDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
            for (const item of largeDiffs.slice(0, 50)) {
                reportLines.push(`| ${item.referrer} | ${item.calculated} | ${item.contract} | ${item.diff > 0 ? '+' : ''}${item.diff} |`);
            }
            reportLines.push("");
        }

        // 8. 保存报告
        const reportContent = reportLines.join("\n");
        const reportFile = `推荐人统计报告-${new Date().toISOString().split('T')[0]}.md`;
        const fs = require('fs');
        fs.writeFileSync(reportFile, reportContent, 'utf8');
        console.log(`✅ 报告已保存到: ${reportFile}\n`);

        // 9. 生成CSV文件
        const csvLines = [];
        csvLines.push("推荐人地址,直推人数（计算）,直推人数（合约）,推荐网体人数（计算）,推荐网体人数（合约）,差异,是否活跃");
        
        for (const referrer of referrers) {
            const directCount = (referrerToUsers.get(referrer) || []).length;
            const calculatedTeamCount = teamCountMap.get(referrer) || 0;
            const contractData = contractDataMap.get(referrer) || { activeDirects: 0, teamCount: 0, isActive: false };
            const contractDirects = contractData.activeDirects;
            const contractTeamCount = contractData.teamCount;
            const isActive = contractData.isActive ? "是" : "否";
            const diff = calculatedTeamCount - contractTeamCount;
            
            csvLines.push(`${referrer},${directCount},${contractDirects},${calculatedTeamCount},${contractTeamCount},${diff},${isActive}`);
        }
        
        const csvFile = `推荐人统计-${new Date().toISOString().split('T')[0]}.csv`;
        fs.writeFileSync(csvFile, csvLines.join("\n"), 'utf8');
        console.log(`✅ CSV文件已保存到: ${csvFile}\n`);

        // 10. 控制台输出摘要
        console.log("=".repeat(80));
        console.log("📊 摘要");
        console.log("=".repeat(80));
        console.log(`总用户数: ${allUsers.length}`);
        console.log(`有直推的推荐人数: ${referrers.length}`);
        
        const maxDirects = Math.max(...referrers.map(r => (referrerToUsers.get(r) || []).length));
        const maxDirectsReferrer = referrers.find(r => (referrerToUsers.get(r) || []).length === maxDirects);
        console.log(`最大直推数: ${maxDirects} (推荐人: ${maxDirectsReferrer})`);
        
        const maxTeam = Math.max(...referrers.map(r => teamCountMap.get(r) || 0));
        const maxTeamReferrer = referrers.find(r => (teamCountMap.get(r) || 0) === maxTeam);
        console.log(`最大推荐网体人数: ${maxTeam} (推荐人: ${maxTeamReferrer})`);
        
        console.log(`\n计算值与合约值匹配: ${matchCount}/${referrers.length} (${((matchCount / referrers.length) * 100).toFixed(2)}%)`);
        console.log(`计算值与合约值不匹配: ${diffCount}/${referrers.length} (${((diffCount / referrers.length) * 100).toFixed(2)}%)`);
        
        console.log("\n" + "=".repeat(80));
        console.log(`✅ 完整报告已保存到: ${reportFile}`);
        console.log(`✅ CSV文件已保存到: ${csvFile}`);
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 获取失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

getReferrerStats().catch(console.error);
