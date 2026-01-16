const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新协议合约地址
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A"; // 旧协议合约地址

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getDirectReferrals(address) view returns (address[])",
    "function adminSetReferrer(address user, address newReferrer) external",
    "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external",
    "function adminSetCurrentCap(address user, uint256 newCurrentCap) external",
    "function adminSetRefundFeeAmount(address user, uint256 newRefundFeeAmount) external",
    "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
    "function adminSetTeamTotalCap(address user, uint256 newTeamTotalCap) external",
    "function adminSetMaxTicketAmounts(address user, uint256 newMaxTicketAmount, uint256 newMaxSingleTicketAmount) external",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

// 干运行模式（不实际执行迁移）
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");

/**
 * 从事件获取所有用户地址（新旧合约）
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const allUsers = new Set();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    console.log("📊 从事件获取所有用户地址...");
    console.log(`   区块范围: ${fromBlock} - ${currentBlock}\n`);

    // 查询新合约的 BoundReferrer 和 TicketPurchased 事件
    try {
        const newBoundEvents = await newProtocol.queryFilter(newProtocol.filters.BoundReferrer(), fromBlock, currentBlock);
        newBoundEvents.forEach(event => {
            allUsers.add(event.args.user.toLowerCase());
            if (event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
        console.log(`   ✅ 新合约 BoundReferrer: ${newBoundEvents.length} 个事件`);
    } catch (error) {
        console.log(`   ⚠️  新合约 BoundReferrer 查询失败: ${error.message}`);
    }

    try {
        const newTicketEvents = await newProtocol.queryFilter(newProtocol.filters.TicketPurchased(), fromBlock, currentBlock);
        newTicketEvents.forEach(event => {
            allUsers.add(event.args.user.toLowerCase());
        });
        console.log(`   ✅ 新合约 TicketPurchased: ${newTicketEvents.length} 个事件`);
    } catch (error) {
        console.log(`   ⚠️  新合约 TicketPurchased 查询失败: ${error.message}`);
    }

    // 查询旧合约的 BoundReferrer 和 TicketPurchased 事件
    try {
        const oldBoundEvents = await oldProtocol.queryFilter(oldProtocol.filters.BoundReferrer(), fromBlock, currentBlock);
        oldBoundEvents.forEach(event => {
            allUsers.add(event.args.user.toLowerCase());
            if (event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
        console.log(`   ✅ 旧合约 BoundReferrer: ${oldBoundEvents.length} 个事件`);
    } catch (error) {
        console.log(`   ⚠️  旧合约 BoundReferrer 查询失败: ${error.message}`);
    }

    try {
        const oldTicketEvents = await oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), fromBlock, currentBlock);
        oldTicketEvents.forEach(event => {
            allUsers.add(event.args.user.toLowerCase());
        });
        console.log(`   ✅ 旧合约 TicketPurchased: ${oldTicketEvents.length} 个事件`);
    } catch (error) {
        console.log(`   ⚠️  旧合约 TicketPurchased 查询失败: ${error.message}`);
    }

    console.log(`\n   📊 总共找到 ${allUsers.size} 个唯一用户地址\n`);
    return Array.from(allUsers);
}

/**
 * 检查用户是否在新合约中存在
 */
async function checkUserInNewContract(newProtocol, userAddress) {
    try {
        const userInfo = await newProtocol.userInfo(userAddress);
        // 如果用户存在，至少有以下任一条件：
        // 1. referrer 不是零地址
        // 2. isActive 为 true
        // 3. activeDirects > 0
        // 4. teamCount > 0
        // 5. totalRevenue > 0
        // 6. currentCap > 0
        const hasData = userInfo.referrer !== ethers.ZeroAddress ||
                       userInfo.isActive ||
                       userInfo.activeDirects > 0n ||
                       userInfo.teamCount > 0n ||
                       userInfo.totalRevenue > 0n ||
                       userInfo.currentCap > 0n;
        return hasData;
    } catch (error) {
        // 如果查询失败（CALL_EXCEPTION），说明用户不存在
        return false;
    }
}

/**
 * 从旧合约读取用户完整数据
 */
async function readUserDataFromOldContract(oldProtocol, userAddress) {
    try {
        const userInfo = await oldProtocol.userInfo(userAddress);
        const userTicket = await oldProtocol.userTicket(userAddress);

        // 读取直推列表
        let directReferrals = [];
        try {
            directReferrals = await oldProtocol.getDirectReferrals(userAddress);
        } catch (error) {
            // 旧合约可能不支持 getDirectReferrals
        }

        // 读取质押数据（最多读取10个）
        const stakes = [];
        for (let i = 0; i < 10; i++) {
            try {
                const stake = await oldProtocol.userStakes(userAddress, i);
                if (stake.id.toString() === "0" && stake.amount.toString() === "0") {
                    break; // 没有更多质押
                }
                stakes.push({
                    id: stake.id.toString(),
                    amount: stake.amount.toString(),
                    startTime: stake.startTime.toString(),
                    cycleDays: stake.cycleDays.toString(),
                    active: stake.active,
                    paid: stake.paid.toString()
                });
            } catch (error) {
                break;
            }
        }

        return {
            address: userAddress,
            userInfo: {
                referrer: userInfo.referrer.toLowerCase(),
                activeDirects: userInfo.activeDirects.toString(),
                teamCount: userInfo.teamCount.toString(),
                totalRevenue: userInfo.totalRevenue.toString(),
                currentCap: userInfo.currentCap.toString(),
                isActive: userInfo.isActive,
                refundFeeAmount: userInfo.refundFeeAmount.toString(),
                teamTotalVolume: userInfo.teamTotalVolume.toString(),
                teamTotalCap: userInfo.teamTotalCap.toString(),
                maxTicketAmount: userInfo.maxTicketAmount.toString(),
                maxSingleTicketAmount: userInfo.maxSingleTicketAmount.toString()
            },
            userTicket: {
                ticketId: userTicket.ticketId.toString(),
                amount: userTicket.amount.toString(),
                purchaseTime: userTicket.purchaseTime.toString(),
                exited: userTicket.exited
            },
            userStakes: stakes,
            directReferrals: directReferrals.map(addr => addr.toLowerCase())
        };
    } catch (error) {
        throw new Error(`读取用户数据失败: ${error.message}`);
    }
}

/**
 * 迁移单个用户数据到新合约
 */
async function migrateUserToNewContract(newProtocol, deployer, userData) {
    const results = {
        address: userData.address,
        steps: []
    };

    try {
        // 1. 迁移推荐关系
        if (userData.userInfo.referrer !== ethers.ZeroAddress.toLowerCase()) {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetReferrer(userData.address, userData.userInfo.referrer);
                    await tx.wait();
                }
                results.steps.push({ step: "referrer", status: "success" });
            } catch (error) {
                results.steps.push({ step: "referrer", status: "failed", error: error.message });
            }
        }

        // 2. 迁移活跃直推数
        if (userData.userInfo.activeDirects !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetActiveDirects(userData.address, userData.userInfo.activeDirects);
                    await tx.wait();
                }
                results.steps.push({ step: "activeDirects", status: "success" });
            } catch (error) {
                results.steps.push({ step: "activeDirects", status: "failed", error: error.message });
            }
        }

        // 3. 迁移团队人数
        if (userData.userInfo.teamCount !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamCount(userData.address, userData.userInfo.teamCount);
                    await tx.wait();
                }
                results.steps.push({ step: "teamCount", status: "success" });
            } catch (error) {
                results.steps.push({ step: "teamCount", status: "failed", error: error.message });
            }
        }

        // 4. 迁移总收益
        if (userData.userInfo.totalRevenue !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTotalRevenue(userData.address, userData.userInfo.totalRevenue);
                    await tx.wait();
                }
                results.steps.push({ step: "totalRevenue", status: "success" });
            } catch (error) {
                results.steps.push({ step: "totalRevenue", status: "failed", error: error.message });
            }
        }

        // 5. 迁移收益上限
        if (userData.userInfo.currentCap !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetCurrentCap(userData.address, userData.userInfo.currentCap);
                    await tx.wait();
                }
                results.steps.push({ step: "currentCap", status: "success" });
            } catch (error) {
                results.steps.push({ step: "currentCap", status: "failed", error: error.message });
            }
        }

        // 6. 迁移团队总交易量
        if (userData.userInfo.teamTotalVolume !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamTotalVolume(userData.address, userData.userInfo.teamTotalVolume);
                    await tx.wait();
                }
                results.steps.push({ step: "teamTotalVolume", status: "success" });
            } catch (error) {
                results.steps.push({ step: "teamTotalVolume", status: "failed", error: error.message });
            }
        }

        // 7. 迁移团队总上限
        if (userData.userInfo.teamTotalCap !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamTotalCap(userData.address, userData.userInfo.teamTotalCap);
                    await tx.wait();
                }
                results.steps.push({ step: "teamTotalCap", status: "success" });
            } catch (error) {
                results.steps.push({ step: "teamTotalCap", status: "failed", error: error.message });
            }
        }

        // 8. 迁移最大门票金额
        if (userData.userInfo.maxTicketAmount !== "0" || userData.userInfo.maxSingleTicketAmount !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetMaxTicketAmounts(
                        userData.address,
                        userData.userInfo.maxTicketAmount,
                        userData.userInfo.maxSingleTicketAmount
                    );
                    await tx.wait();
                }
                results.steps.push({ step: "maxTicketAmounts", status: "success" });
            } catch (error) {
                results.steps.push({ step: "maxTicketAmounts", status: "failed", error: error.message });
            }
        }

        results.status = "success";
    } catch (error) {
        results.status = "failed";
        results.error = error.message;
    }

    return results;
}

/**
 * 主函数
 */
async function main() {
    console.log("🚀 开始自动发现并迁移所有旧合约用户到新合约\n");
    console.log("=".repeat(80));
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行迁移\n");
    }

    // 1. 连接合约
    console.log("📋 步骤 1: 连接到合约");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
        throw new Error("请设置 PRIVATE_KEY 环境变量");
    }
    
    const deployer = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log(`    部署者地址: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`    部署者余额: ${ethers.formatEther(balance)} MC`);

    // 验证 Owner
    const owner = await newProtocol.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(`部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${deployer.address}`);
    }
    console.log(`    ✅ Owner 验证通过`);
    console.log(`    新合约地址: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`    旧合约地址: ${OLD_PROTOCOL_ADDRESS}\n`);

    // 2. 获取所有用户地址
    console.log("📋 步骤 2: 获取所有用户地址（新旧合约）");
    console.log("=".repeat(80));
    const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);

    // 3. 找出只在旧合约中的用户
    console.log("📋 步骤 3: 检查哪些用户只存在于旧合约");
    console.log("=".repeat(80));
    const usersOnlyInOldContract = [];
    
    for (let i = 0; i < allUsers.length; i++) {
        const userAddress = allUsers[i];
        const existsInNew = await checkUserInNewContract(newProtocol, userAddress);
        
        if (!existsInNew) {
            usersOnlyInOldContract.push(userAddress);
        }
        
        if ((i + 1) % 50 === 0) {
            console.log(`   已检查 ${i + 1}/${allUsers.length} 个用户...`);
        }
    }

    console.log(`\n   📊 只在旧合约中的用户数: ${usersOnlyInOldContract.length}\n`);

    if (usersOnlyInOldContract.length === 0) {
        console.log("✅ 所有用户都已在新合约中，无需迁移！\n");
        return;
    }

    // 4. 从旧合约读取用户数据
    console.log("📋 步骤 4: 从旧合约读取用户数据");
    console.log("=".repeat(80));
    const userDataList = [];

    for (let i = 0; i < usersOnlyInOldContract.length; i++) {
        const userAddress = usersOnlyInOldContract[i];
        console.log(`\n[${i + 1}/${usersOnlyInOldContract.length}] 读取用户: ${userAddress}`);
        
        try {
            const userData = await readUserDataFromOldContract(oldProtocol, userAddress);
            userDataList.push(userData);
            console.log(`    ✅ 数据读取成功`);
            console.log(`       推荐人: ${userData.userInfo.referrer}`);
            console.log(`       直推数: ${userData.userInfo.activeDirects}`);
            console.log(`       团队数: ${userData.userInfo.teamCount}`);
            console.log(`       是否激活: ${userData.userInfo.isActive}`);
        } catch (error) {
            console.log(`    ❌ 数据读取失败: ${error.message}`);
        }
    }

    console.log(`\n✅ 数据读取完成，共 ${userDataList.length} 个用户\n`);

    // 5. 迁移数据到新合约
    console.log("📋 步骤 5: 迁移数据到新合约");
    console.log("=".repeat(80));
    
    const migrationResults = {
        timestamp: new Date().toISOString(),
        newProtocolAddress: NEW_PROTOCOL_ADDRESS,
        oldProtocolAddress: OLD_PROTOCOL_ADDRESS,
        totalUsers: userDataList.length,
        migrated: [],
        failed: []
    };

    for (let i = 0; i < userDataList.length; i++) {
        const userData = userDataList[i];
        console.log(`\n[${i + 1}/${userDataList.length}] 迁移用户: ${userData.address}`);
        
        try {
            const result = await migrateUserToNewContract(newProtocol, deployer, userData);
            
            if (result.status === "success") {
                migrationResults.migrated.push(result);
                console.log(`    ✅ 迁移成功`);
            } else {
                migrationResults.failed.push(result);
                console.log(`    ❌ 迁移失败: ${result.error}`);
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`    ❌ 迁移异常: ${error.message}`);
            migrationResults.failed.push({
                address: userData.address,
                status: "failed",
                error: error.message
            });
        }
    }

    // 6. 保存迁移结果
    console.log("\n📊 迁移结果");
    console.log("=".repeat(80));
    console.log(`成功迁移: ${migrationResults.migrated.length}`);
    console.log(`迁移失败: ${migrationResults.failed.length}`);

    const resultsFile = path.join(__dirname, "../output", `migration-results-${Date.now()}.json`);
    const outputDir = path.dirname(resultsFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(resultsFile, JSON.stringify(migrationResults, null, 2));
    console.log(`\n📄 迁移结果已保存: ${resultsFile}\n`);

    if (migrationResults.migrated.length > 0) {
        console.log(`\n✅ 成功迁移的用户 (前10个):`);
        migrationResults.migrated.slice(0, 10).forEach((user, i) => {
            console.log(`   ${i + 1}. ${user.address}`);
        });
    }

    if (migrationResults.failed.length > 0) {
        console.log(`\n❌ 迁移失败的用户 (前10个):`);
        migrationResults.failed.slice(0, 10).forEach((user, i) => {
            console.log(`   ${i + 1}. ${user.address}: ${user.error || "未知错误"}`);
        });
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log("\n✅ 迁移完成");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ 迁移失败:", error);
            process.exit(1);
        });
}

module.exports = { main };
