const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置 - 使用新合约（前端实际使用）
const RPC_URL = "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新合约
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A"; // 旧合约

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId)",
];

/**
 * 从事件获取所有用户地址（包括新旧合约）
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = 0; // 从创世区块开始查询
        
        console.log(`   查询区块范围: ${fromBlock} - ${currentBlock}`);
        
        const users = new Set();
        
        // 1. 查询新合约的 TicketPurchased 事件
        console.log(`   查询新合约 TicketPurchased 事件...`);
        try {
            const newTicketEvents = await newProtocol.queryFilter(
                newProtocol.filters.TicketPurchased(),
                fromBlock
            );
            newTicketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ 新合约 TicketPurchased: ${newTicketEvents.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ 新合约 TicketPurchased 查询失败: ${error.message}`);
        }
        
        // 2. 查询新合约的 BoundReferrer 事件
        console.log(`   查询新合约 BoundReferrer 事件...`);
        try {
            const newBoundEvents = await newProtocol.queryFilter(
                newProtocol.filters.BoundReferrer(),
                fromBlock
            );
            newBoundEvents.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    users.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ 新合约 BoundReferrer: ${newBoundEvents.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ 新合约 BoundReferrer 查询失败: ${error.message}`);
        }
        
        // 3. 查询旧合约的 TicketPurchased 事件
        console.log(`   查询旧合约 TicketPurchased 事件...`);
        try {
            const oldTicketEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.TicketPurchased(),
                fromBlock
            );
            oldTicketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ 旧合约 TicketPurchased: ${oldTicketEvents.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ 旧合约 TicketPurchased 查询失败: ${error.message}`);
        }
        
        // 4. 查询旧合约的 BoundReferrer 事件
        console.log(`   查询旧合约 BoundReferrer 事件...`);
        try {
            const oldBoundEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.BoundReferrer(),
                fromBlock
            );
            oldBoundEvents.forEach(event => {
                if (event.args && event.args.user) {
                    users.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    users.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ 旧合约 BoundReferrer: ${oldBoundEvents.length} 个事件`);
        } catch (error) {
            console.error(`   ❌ 旧合约 BoundReferrer 查询失败: ${error.message}`);
        }
        
        const userList = Array.from(users).filter(addr => addr !== ethers.ZeroAddress.toLowerCase());
        console.log(`   ✅ 合并后总用户数: ${userList.length}`);
        
        return userList;
    } catch (error) {
        console.error(`获取用户列表失败: ${error.message}`);
        return [];
    }
}

/**
 * 计算正确的 teamCount
 */
async function calculateCorrectTeamCount(protocol, userAddress) {
    try {
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        let totalSubTeamCount = 0n;
        
        for (const ref of directReferrals) {
            try {
                const refInfo = await protocol.userInfo(ref);
                totalSubTeamCount += refInfo.teamCount;
            } catch (e) {
                // 忽略错误
            }
        }
        
        return BigInt(directReferrals.length) + totalSubTeamCount;
    } catch (error) {
        return null;
    }
}

async function checkAllUsersMissingRewards() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 检查所有用户：缺失推荐奖励和数据错误");
    console.log("=".repeat(80));
    console.log(`新合约: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 1. 获取所有用户
        console.log("1️⃣ 获取所有用户地址（包括新旧合约）...");
        console.log("-".repeat(80));
        const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`   找到 ${allUsers.length} 个用户地址`);
        console.log("");

        // 2. 检查用户数据
        console.log("2️⃣ 检查用户数据（这可能需要一些时间）...");
        console.log("-".repeat(80));
        
        const results = {
            total: 0,
            missingReferralReward: [],
            dataErrors: [],
            processed: 0
        };

        const sampleSize = allUsers.length; // 检查全部用户
        console.log(`   将检查全部 ${sampleSize} 个用户`);
        console.log("");

        for (let i = 0; i < sampleSize; i++) {
            const userAddress = allUsers[i];
            results.total++;
            results.processed++;

            if (i % 50 === 0 && i > 0) {
                console.log(`   进度: ${i}/${sampleSize} (${((i / sampleSize) * 100).toFixed(1)}%) - 已发现 ${results.missingReferralReward.length} 个缺失奖励, ${results.dataErrors.length} 个数据错误`);
            }

            try {
                const userInfo = await newProtocol.userInfo(userAddress);
                const userTicket = await newProtocol.userTicket(userAddress);
                
                // 跳过没有门票的用户
                if (userTicket.amount === 0n) {
                    continue;
                }

                // 检查是否有推荐人
                if (userInfo.referrer === ethers.ZeroAddress) {
                    continue;
                }

                // 检查推荐奖励
                const currentBlock = await provider.getBlockNumber();
                const fromBlock = Math.max(0, currentBlock - 2000000);
                
                try {
                    const receivedRewards = await newProtocol.queryFilter(
                        newProtocol.filters.ReferralRewardPaid(userInfo.referrer),
                        fromBlock
                    );
                    
                    // 检查推荐人是否收到来自该用户的推荐奖励（类型1）
                    let hasDirectReward = false;
                    for (const event of receivedRewards) {
                        if (event.args.from.toLowerCase() === userAddress.toLowerCase() && 
                            event.args.rewardType === 1) { // REWARD_DIRECT
                            hasDirectReward = true;
                            break;
                        }
                    }
                    
                    // 检查旧合约是否有购买记录
                    let purchasedInOldContract = false;
                    try {
                        const oldTicketEvents = await oldProtocol.queryFilter(
                            oldProtocol.filters.TicketPurchased(userAddress),
                            0
                        );
                        purchasedInOldContract = oldTicketEvents.length > 0;
                    } catch (e) {
                        // 忽略错误
                    }
                    
                    // 检查新合约是否有购买记录
                    let purchasedInNewContract = false;
                    try {
                        const newTicketEvents = await newProtocol.queryFilter(
                            newProtocol.filters.TicketPurchased(userAddress),
                            fromBlock
                        );
                        purchasedInNewContract = newTicketEvents.length > 0;
                    } catch (e) {
                        // 忽略错误
                    }
                    
                    // 如果用户在旧合约购买但新合约没有购买记录，且推荐人没有收到推荐奖励
                    if (purchasedInOldContract && !purchasedInNewContract && !hasDirectReward) {
                        const expectedReward = (userTicket.amount * 25n) / 100n;
                        results.missingReferralReward.push({
                            buyer: userAddress,
                            referrer: userInfo.referrer,
                            ticketAmount: ethers.formatEther(userTicket.amount),
                            expectedReward: ethers.formatEther(expectedReward),
                            ticketId: userTicket.ticketId.toString(),
                            purchaseTime: userTicket.purchaseTime > 0n ? new Date(Number(userTicket.purchaseTime) * 1000).toLocaleString('zh-CN') : '未知',
                        });
                    }
                } catch (e) {
                    // 忽略查询错误
                }

                // 检查 teamCount 数据错误
                const directReferrals = await newProtocol.getDirectReferrals(userAddress);
                if (directReferrals.length > 0) {
                    const correctTeamCount = await calculateCorrectTeamCount(newProtocol, userAddress);
                    if (correctTeamCount !== null) {
                        const contractTeamCount = userInfo.teamCount;
                        if (contractTeamCount.toString() !== correctTeamCount.toString()) {
                            const diff = BigInt(contractTeamCount) - correctTeamCount;
                            const diffPercent = contractTeamCount > 0n 
                                ? ((Number(diff) / Number(contractTeamCount)) * 100).toFixed(2)
                                : "0";
                            
                            results.dataErrors.push({
                                address: userAddress,
                                contractTeamCount: contractTeamCount.toString(),
                                correctTeamCount: correctTeamCount.toString(),
                                diff: diff.toString(),
                                diffPercent: diffPercent,
                                directReferrals: directReferrals.length,
                            });
                        }
                    }
                }
            } catch (e) {
                // 忽略错误
            }
        }

        console.log(`\n   检查完成！`);
        console.log("");

        // 3. 统计结果
        console.log("3️⃣ 统计结果:");
        console.log("-".repeat(80));
        console.log(`   检查的用户数: ${results.processed}`);
        console.log(`   缺失推荐奖励的用户: ${results.missingReferralReward.length} ❌`);
        console.log(`   数据错误的用户: ${results.dataErrors.length} ❌`);
        console.log("");

        // 4. 显示缺失推荐奖励的用户
        if (results.missingReferralReward.length > 0) {
            console.log("4️⃣ 缺失推荐奖励的用户详情:");
            console.log("-".repeat(80));
            
            results.missingReferralReward.forEach((item, idx) => {
                console.log(`   ${idx + 1}. 购买者: ${item.buyer}`);
                console.log(`      推荐人: ${item.referrer}`);
                console.log(`      门票金额: ${item.ticketAmount} MC`);
                console.log(`      应得推荐奖励: ${item.expectedReward} MC (25%)`);
                console.log(`      门票ID: ${item.ticketId}`);
                console.log(`      购买时间: ${item.purchaseTime}`);
                console.log(`      原因: 在旧合约购买，迁移到新合约时未触发推荐奖励`);
                console.log("");
            });
        } else {
            console.log("4️⃣ 缺失推荐奖励的用户:");
            console.log("-".repeat(80));
            console.log(`   ✅ 未发现缺失推荐奖励的用户`);
            console.log("");
        }

        // 5. 显示数据错误的用户
        if (results.dataErrors.length > 0) {
            console.log("5️⃣ 数据错误的用户详情（前20个）:");
            console.log("-".repeat(80));
            
            // 按差异大小排序
            results.dataErrors.sort((a, b) => {
                const diffA = Math.abs(Number(a.diff));
                const diffB = Math.abs(Number(b.diff));
                return diffB - diffA;
            });

            results.dataErrors.slice(0, 20).forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.address}`);
                console.log(`      合约值: ${item.contractTeamCount}`);
                console.log(`      正确值: ${item.correctTeamCount}`);
                console.log(`      差异: ${item.diff} (${item.diffPercent}%)`);
                console.log(`      直推数: ${item.directReferrals}`);
                console.log("");
            });

            if (results.dataErrors.length > 20) {
                console.log(`   ... 还有 ${results.dataErrors.length - 20} 个数据错误的用户`);
                console.log("");
            }
        } else {
            console.log("5️⃣ 数据错误的用户:");
            console.log("-".repeat(80));
            console.log(`   ✅ 未发现数据错误的用户`);
            console.log("");
        }

        // 6. 保存详细报告
        const reportData = {
            queryTime: new Date().toISOString(),
            contractAddress: NEW_PROTOCOL_ADDRESS,
            statistics: {
                totalChecked: results.processed,
                missingReferralReward: results.missingReferralReward.length,
                dataErrors: results.dataErrors.length,
            },
            missingReferralReward: results.missingReferralReward,
            dataErrors: results.dataErrors, // 保存所有数据错误
        };

        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `missing-rewards-and-errors-${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2), 'utf8');
        console.log(`✅ 详细报告已保存到: ${filepath}`);
        console.log("");

        // 7. 总结
        console.log("=".repeat(80));
        console.log("📊 总结");
        console.log("=".repeat(80));
        console.log(`检查用户数: ${results.processed}`);
        console.log(`缺失推荐奖励: ${results.missingReferralReward.length} 个`);
        console.log(`数据错误: ${results.dataErrors.length} 个`);
        console.log("");
        
        if (results.missingReferralReward.length > 0 || results.dataErrors.length > 0) {
            console.log(`⚠️  发现 ${results.missingReferralReward.length + results.dataErrors.length} 个问题需要处理`);
        } else {
            console.log(`✅ 未发现问题`);
        }
        
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 检查失败:", error);
        throw error;
    }
}

// 主函数
async function main() {
    try {
        await checkAllUsersMissingRewards();
    } catch (error) {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkAllUsersMissingRewards };
