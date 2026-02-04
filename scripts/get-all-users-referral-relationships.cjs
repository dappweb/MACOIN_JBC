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
            
            // 从TicketPurchased事件获取所有用户
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

async function getAllUsersReferralRelationships() {
    console.log("📊 获取所有用户的推荐关系\n");
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
        console.log(`  根用户数: ${rootUsers.length}\n`);

        // 3. 生成推荐关系报告
        console.log("📝 生成推荐关系报告...");
        const reportLines = [];
        reportLines.push("# 所有用户推荐关系报告");
        reportLines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        reportLines.push(`总用户数: ${allUsers.length}`);
        reportLines.push(`推荐关系数: ${referrerMap.size}`);
        reportLines.push(`根用户数: ${rootUsers.length}`);
        reportLines.push("");
        reportLines.push("=".repeat(80));
        reportLines.push("");

        // 4. 按推荐关系列表输出
        reportLines.push("## 所有用户推荐关系列表");
        reportLines.push("");
        reportLines.push("| 用户地址 | 推荐人地址 | 直推数 |");
        reportLines.push("|---------|-----------|--------|");
        
        // 先输出根用户
        for (const rootUser of rootUsers) {
            const directCount = (referrerToUsers.get(rootUser) || []).length;
            reportLines.push(`| ${rootUser} | 无（根用户） | ${directCount} |`);
        }
        
        // 然后输出有推荐人的用户（按推荐人分组）
        const sortedUsers = allUsers
            .filter(user => {
                const data = referrerMap.get(user);
                return data && data.referrer !== ethers.ZeroAddress.toLowerCase();
            })
            .sort((a, b) => {
                const dataA = referrerMap.get(a);
                const dataB = referrerMap.get(b);
                // 先按推荐人排序，再按用户地址排序
                if (dataA.referrer !== dataB.referrer) {
                    return dataA.referrer.localeCompare(dataB.referrer);
                }
                return a.localeCompare(b);
            });
        
        for (const user of sortedUsers) {
            const data = referrerMap.get(user);
            const directCount = (referrerToUsers.get(user) || []).length;
            reportLines.push(`| ${user} | ${data.referrer} | ${directCount} |`);
        }
        reportLines.push("");

        // 5. 按推荐人分组输出
        reportLines.push("## 按推荐人分组");
        reportLines.push("");
        
        // 先输出根用户及其下级
        for (const rootUser of rootUsers) {
            const directReferrals = referrerToUsers.get(rootUser) || [];
            if (directReferrals.length > 0) {
                reportLines.push(`### 根用户: ${rootUser}`);
                reportLines.push(`直推数: ${directReferrals.length}`);
                reportLines.push("");
                reportLines.push("直推用户:");
                directReferrals.forEach((referral, index) => {
                    reportLines.push(`  ${index + 1}. ${referral}`);
                });
                reportLines.push("");
            }
        }
        
        // 然后输出其他推荐人及其下级
        const referrers = Array.from(referrerToUsers.keys())
            .filter(ref => !rootUsers.includes(ref))
            .sort();
        
        for (const referrer of referrers) {
            const directReferrals = referrerToUsers.get(referrer) || [];
            if (directReferrals.length > 0) {
                const referrerData = referrerMap.get(referrer);
                const referrerReferrer = referrerData ? referrerData.referrer : "无";
                reportLines.push(`### 推荐人: ${referrer}`);
                reportLines.push(`上级推荐人: ${referrerReferrer}`);
                reportLines.push(`直推数: ${directReferrals.length}`);
                reportLines.push("");
                reportLines.push("直推用户:");
                directReferrals.forEach((referral, index) => {
                    reportLines.push(`  ${index + 1}. ${referral}`);
                });
                reportLines.push("");
            }
        }

        // 6. 统计信息
        reportLines.push("## 统计信息");
        reportLines.push("");
        reportLines.push("### 按直推数统计");
        reportLines.push("");
        reportLines.push("| 直推数范围 | 用户数 |");
        reportLines.push("|----------|--------|");
        
        const directCountMap = new Map();
        for (const user of allUsers) {
            const directCount = (referrerToUsers.get(user) || []).length;
            directCountMap.set(directCount, (directCountMap.get(directCount) || 0) + 1);
        }
        
        const sortedCounts = Array.from(directCountMap.keys()).sort((a, b) => b - a);
        for (const count of sortedCounts) {
            const userCount = directCountMap.get(count);
            reportLines.push(`| ${count} | ${userCount} |`);
        }
        reportLines.push("");

        // 7. 保存报告
        const reportContent = reportLines.join("\n");
        const reportFile = `所有用户推荐关系报告-${new Date().toISOString().split('T')[0]}.md`;
        const fs = require('fs');
        fs.writeFileSync(reportFile, reportContent, 'utf8');
        console.log(`✅ 报告已保存到: ${reportFile}\n`);

        // 8. 生成CSV格式（便于导入Excel）
        const csvLines = [];
        csvLines.push("用户地址,推荐人地址,直推数");
        for (const rootUser of rootUsers) {
            const directCount = (referrerToUsers.get(rootUser) || []).length;
            csvLines.push(`${rootUser},,${directCount}`);
        }
        for (const user of sortedUsers) {
            const data = referrerMap.get(user);
            const directCount = (referrerToUsers.get(user) || []).length;
            csvLines.push(`${user},${data.referrer},${directCount}`);
        }
        const csvFile = `所有用户推荐关系-${new Date().toISOString().split('T')[0]}.csv`;
        fs.writeFileSync(csvFile, csvLines.join("\n"), 'utf8');
        console.log(`✅ CSV文件已保存到: ${csvFile}\n`);

        // 9. 控制台输出摘要
        console.log("=".repeat(80));
        console.log("📊 摘要");
        console.log("=".repeat(80));
        console.log(`总用户数: ${allUsers.length}`);
        console.log(`推荐关系数: ${referrerMap.size}`);
        console.log(`根用户数: ${rootUsers.length}`);
        console.log(`有推荐人的用户数: ${sortedUsers.length}`);
        
        const maxDirects = Math.max(...Array.from(allUsers).map(user => (referrerToUsers.get(user) || []).length));
        const maxDirectsUser = Array.from(allUsers).find(user => (referrerToUsers.get(user) || []).length === maxDirects);
        console.log(`最大直推数: ${maxDirects} (用户: ${maxDirectsUser})`);
        
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

getAllUsersReferralRelationships().catch(console.error);
