const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

/**
 * 获取所有用户地址
 */
async function getAllUsers(protocol, provider) {
    console.log("🔍 正在获取所有用户地址...\n");
    
    const users = new Set();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000000);
    
    try {
        // 从 BoundReferrer 事件获取用户
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock
        );
        
        boundEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer) {
                users.add(event.args.referrer.toLowerCase());
            }
        });
        
        // 从 TicketPurchased 事件获取用户
        const ticketEvents = await protocol.queryFilter(
            protocol.filters.TicketPurchased(),
            fromBlock
        );
        
        ticketEvents.forEach(event => {
            if (event.args && event.args.user) {
                users.add(event.args.user.toLowerCase());
            }
        });
        
        console.log(`✅ 找到 ${users.size} 个用户地址\n`);
        return Array.from(users);
    } catch (error) {
        console.error("❌ 获取用户地址失败:", error.message);
        return [];
    }
}

/**
 * 检查用户数据是否异常
 */
async function checkUserData(protocol, userAddress, allUsersData) {
    try {
        const userInfo = await protocol.userInfo(userAddress);
        const referrer = userInfo.referrer;
        const teamCount = Number(userInfo.teamCount);
        const activeDirects = Number(userInfo.activeDirects);
        
        // 如果没有推荐人，跳过
        if (!referrer || referrer === ethers.ZeroAddress) {
            return null;
        }
        
        // 获取推荐人的数据
        const referrerInfo = allUsersData.get(referrer.toLowerCase());
        if (!referrerInfo) {
            return null;
        }
        
        const referrerTeamCount = referrerInfo.teamCount;
        const referrerActiveDirects = referrerInfo.activeDirects;
        
        // 检查异常情况
        const issues = [];
        
        // 1. 上级的 teamCount < 下级的 teamCount + 1（至少应该包括下级自己）
        const expectedMinTeamCount = teamCount + 1;
        if (referrerTeamCount < expectedMinTeamCount) {
            issues.push({
                type: "teamCount",
                message: `上级团队人数(${referrerTeamCount}) < 下级团队人数+1(${expectedMinTeamCount})`,
                severity: "high"
            });
        }
        
        // 2. 上级的 teamCount < 下级的 teamCount（绝对异常）
        if (referrerTeamCount < teamCount) {
            issues.push({
                type: "teamCount_absolute",
                message: `上级团队人数(${referrerTeamCount}) < 下级团队人数(${teamCount})`,
                severity: "critical"
            });
        }
        
        // 3. 上级的 activeDirects < 下级的 teamCount（如果下级有团队，上级的直推应该至少包括下级）
        if (teamCount > 0 && referrerActiveDirects < 1) {
            issues.push({
                type: "activeDirects",
                message: `上级直推人数(${referrerActiveDirects}) = 0，但下级有团队(${teamCount})`,
                severity: "medium"
            });
        }
        
        // 4. 逻辑错误：teamCount < activeDirects
        if (teamCount < activeDirects) {
            issues.push({
                type: "logic_error",
                message: `团队人数(${teamCount}) < 直推人数(${activeDirects})`,
                severity: "high"
            });
        }
        
        if (issues.length > 0) {
            return {
                user: userAddress,
                referrer: referrer,
                userData: {
                    teamCount,
                    activeDirects,
                    isActive: userInfo.isActive
                },
                referrerData: {
                    teamCount: referrerTeamCount,
                    activeDirects: referrerActiveDirects,
                    isActive: referrerInfo.isActive
                },
                issues
            };
        }
        
        return null;
    } catch (error) {
        console.warn(`⚠️  检查用户 ${userAddress} 失败:`, error.message);
        return null;
    }
}

/**
 * 批量获取用户数据
 */
async function batchFetchUserData(protocol, userAddresses) {
    console.log(`📊 正在批量获取 ${userAddresses.length} 个用户的数据...\n`);
    
    const userDataMap = new Map();
    const batchSize = 50;
    
    for (let i = 0; i < userAddresses.length; i += batchSize) {
        const batch = userAddresses.slice(i, i + batchSize);
        const promises = batch.map(async (address) => {
            try {
                const userInfo = await protocol.userInfo(address);
                return {
                    address: address.toLowerCase(),
                    referrer: userInfo.referrer,
                    activeDirects: Number(userInfo.activeDirects),
                    teamCount: Number(userInfo.teamCount),
                    isActive: userInfo.isActive
                };
            } catch (error) {
                console.warn(`⚠️  获取用户 ${address} 数据失败:`, error.message);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        results.forEach(data => {
            if (data) {
                userDataMap.set(data.address, data);
            }
        });
        
        process.stdout.write(`\r进度: ${Math.min(i + batchSize, userAddresses.length)}/${userAddresses.length}`);
    }
    
    console.log(`\n✅ 成功获取 ${userDataMap.size} 个用户的数据\n`);
    return userDataMap;
}

async function main() {
    console.log("🔍 开始查找异常账户...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取所有用户
        const allUsers = await getAllUsers(protocol, provider);
        if (allUsers.length === 0) {
            console.log("❌ 未找到任何用户");
            return;
        }

        // 2. 批量获取用户数据
        const allUsersData = await batchFetchUserData(protocol, allUsers);

        // 3. 检查每个用户的数据
        console.log("🔍 正在检查数据异常...\n");
        const abnormalAccounts = [];
        let checked = 0;

        for (const userAddress of allUsers) {
            const result = await checkUserData(protocol, userAddress, allUsersData);
            if (result) {
                abnormalAccounts.push(result);
            }
            checked++;
            if (checked % 50 === 0) {
                process.stdout.write(`\r检查进度: ${checked}/${allUsers.length}`);
            }
        }

        console.log(`\n\n📊 检查完成！\n`);

        // 4. 输出结果
        if (abnormalAccounts.length === 0) {
            console.log("✅ 未发现异常账户\n");
        } else {
            console.log(`❌ 发现 ${abnormalAccounts.length} 个异常账户:\n`);
            console.log("=".repeat(100));

            // 按严重程度排序
            abnormalAccounts.sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                const aMax = Math.min(...a.issues.map(i => severityOrder[i.severity]));
                const bMax = Math.min(...b.issues.map(i => severityOrder[i.severity]));
                return aMax - bMax;
            });

            abnormalAccounts.forEach((account, index) => {
                console.log(`\n${index + 1}. 异常账户: ${account.user}`);
                console.log(`   推荐人: ${account.referrer}`);
                console.log(`   用户数据: teamCount=${account.userData.teamCount}, activeDirects=${account.userData.activeDirects}, isActive=${account.userData.isActive}`);
                console.log(`   推荐人数据: teamCount=${account.referrerData.teamCount}, activeDirects=${account.referrerData.activeDirects}, isActive=${account.referrerData.isActive}`);
                console.log(`   异常类型:`);
                account.issues.forEach(issue => {
                    const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : '🟡';
                    console.log(`     ${icon} [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
                });
                console.log("-".repeat(100));
            });

            // 5. 统计信息
            console.log("\n📊 统计信息:\n");
            const criticalCount = abnormalAccounts.filter(a => a.issues.some(i => i.severity === 'critical')).length;
            const highCount = abnormalAccounts.filter(a => a.issues.some(i => i.severity === 'high')).length;
            const mediumCount = abnormalAccounts.filter(a => a.issues.some(i => i.severity === 'medium')).length;
            
            console.log(`严重异常 (critical): ${criticalCount} 个账户`);
            console.log(`高级异常 (high): ${highCount} 个账户`);
            console.log(`中级异常 (medium): ${mediumCount} 个账户`);

            // 6. 保存到文件
            const fs = require('fs');
            const outputDir = './output';
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = `${outputDir}/abnormal-accounts-${timestamp}.json`;
            
            const output = {
                timestamp: new Date().toISOString(),
                totalUsers: allUsers.length,
                abnormalCount: abnormalAccounts.length,
                statistics: {
                    critical: criticalCount,
                    high: highCount,
                    medium: mediumCount
                },
                accounts: abnormalAccounts
            };
            
            fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
            console.log(`\n💾 结果已保存到: ${outputFile}`);
        }

    } catch (error) {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
});
