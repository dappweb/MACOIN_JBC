const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external",
    "function adminSetCurrentCap(address user, uint256 newCurrentCap) external",
    "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
    "function adminSetTeamTotalCap(address user, uint256 newTeamTotalCap) external",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

// 干运行模式
const DRY_RUN = process.env.DRY_RUN === "true" || process.argv.includes("--dry-run");

/**
 * 比较新旧合约数据，找出需要同步的用户
 */
async function findUsersNeedingSync(newProtocol, oldProtocol, allUsers) {
    const usersToSync = [];

    console.log("📊 比较新旧合约数据...\n");

    for (let i = 0; i < allUsers.length; i++) {
        const userAddress = allUsers[i];
        
        try {
            const newUserInfo = await newProtocol.userInfo(userAddress);
            const oldUserInfo = await oldProtocol.userInfo(userAddress);

            const needsSync = {
                address: userAddress,
                differences: []
            };

            // 比较各个字段
            if (newUserInfo.activeDirects.toString() !== oldUserInfo.activeDirects.toString()) {
                needsSync.differences.push({
                    field: "activeDirects",
                    new: newUserInfo.activeDirects.toString(),
                    old: oldUserInfo.activeDirects.toString()
                });
            }

            if (newUserInfo.teamCount.toString() !== oldUserInfo.teamCount.toString()) {
                needsSync.differences.push({
                    field: "teamCount",
                    new: newUserInfo.teamCount.toString(),
                    old: oldUserInfo.teamCount.toString()
                });
            }

            if (newUserInfo.totalRevenue.toString() !== oldUserInfo.totalRevenue.toString()) {
                needsSync.differences.push({
                    field: "totalRevenue",
                    new: newUserInfo.totalRevenue.toString(),
                    old: oldUserInfo.totalRevenue.toString()
                });
            }

            if (newUserInfo.currentCap.toString() !== oldUserInfo.currentCap.toString()) {
                needsSync.differences.push({
                    field: "currentCap",
                    new: newUserInfo.currentCap.toString(),
                    old: oldUserInfo.currentCap.toString()
                });
            }

            if (newUserInfo.teamTotalVolume.toString() !== oldUserInfo.teamTotalVolume.toString()) {
                needsSync.differences.push({
                    field: "teamTotalVolume",
                    new: newUserInfo.teamTotalVolume.toString(),
                    old: oldUserInfo.teamTotalVolume.toString()
                });
            }

            if (newUserInfo.teamTotalCap.toString() !== oldUserInfo.teamTotalCap.toString()) {
                needsSync.differences.push({
                    field: "teamTotalCap",
                    new: newUserInfo.teamTotalCap.toString(),
                    old: oldUserInfo.teamTotalCap.toString()
                });
            }

            if (needsSync.differences.length > 0) {
                usersToSync.push(needsSync);
            }
        } catch (error) {
            // 如果新合约中不存在，跳过（这些用户需要迁移，不是同步）
            continue;
        }

        if ((i + 1) % 50 === 0) {
            console.log(`   已检查 ${i + 1}/${allUsers.length} 个用户...`);
        }
    }

    return usersToSync;
}

/**
 * 同步单个用户数据
 */
async function syncUserData(newProtocol, deployer, userAddress, oldUserInfo) {
    const results = {
        address: userAddress,
        steps: []
    };

    try {
        // 1. 同步活跃直推数
        if (oldUserInfo.activeDirects.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetActiveDirects(userAddress, oldUserInfo.activeDirects);
                    await tx.wait();
                }
                results.steps.push({ step: "activeDirects", status: "success", value: oldUserInfo.activeDirects.toString() });
            } catch (error) {
                results.steps.push({ step: "activeDirects", status: "failed", error: error.message });
            }
        }

        // 2. 同步团队人数
        if (oldUserInfo.teamCount.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamCount(userAddress, oldUserInfo.teamCount);
                    await tx.wait();
                }
                results.steps.push({ step: "teamCount", status: "success", value: oldUserInfo.teamCount.toString() });
            } catch (error) {
                results.steps.push({ step: "teamCount", status: "failed", error: error.message });
            }
        }

        // 3. 同步总收益
        if (oldUserInfo.totalRevenue.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTotalRevenue(userAddress, oldUserInfo.totalRevenue);
                    await tx.wait();
                }
                results.steps.push({ step: "totalRevenue", status: "success", value: oldUserInfo.totalRevenue.toString() });
            } catch (error) {
                results.steps.push({ step: "totalRevenue", status: "failed", error: error.message });
            }
        }

        // 4. 同步收益上限
        if (oldUserInfo.currentCap.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetCurrentCap(userAddress, oldUserInfo.currentCap);
                    await tx.wait();
                }
                results.steps.push({ step: "currentCap", status: "success", value: oldUserInfo.currentCap.toString() });
            } catch (error) {
                results.steps.push({ step: "currentCap", status: "failed", error: error.message });
            }
        }

        // 5. 同步团队总交易量
        if (oldUserInfo.teamTotalVolume.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamTotalVolume(userAddress, oldUserInfo.teamTotalVolume);
                    await tx.wait();
                }
                results.steps.push({ step: "teamTotalVolume", status: "success", value: oldUserInfo.teamTotalVolume.toString() });
            } catch (error) {
                results.steps.push({ step: "teamTotalVolume", status: "failed", error: error.message });
            }
        }

        // 6. 同步团队总上限
        if (oldUserInfo.teamTotalCap.toString() !== "0") {
            try {
                if (!DRY_RUN) {
                    const tx = await newProtocol.adminSetTeamTotalCap(userAddress, oldUserInfo.teamTotalCap);
                    await tx.wait();
                }
                results.steps.push({ step: "teamTotalCap", status: "success", value: oldUserInfo.teamTotalCap.toString() });
            } catch (error) {
                results.steps.push({ step: "teamTotalCap", status: "failed", error: error.message });
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
 * 从事件获取所有用户地址
 */
async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const allUsers = new Set();
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    // 查询新旧合约的所有事件
    const boundReferrerFilter = { topics: [ethers.id("BoundReferrer(address,address)")] };
    const ticketPurchasedFilter = { topics: [ethers.id("TicketPurchased(address,uint256,uint256)")] };
    
    const [newBoundEvents, newTicketEvents, oldBoundEvents, oldTicketEvents] = await Promise.all([
        newProtocol.queryFilter(boundReferrerFilter, fromBlock, currentBlock).catch(() => []),
        newProtocol.queryFilter(ticketPurchasedFilter, fromBlock, currentBlock).catch(() => []),
        oldProtocol.queryFilter(boundReferrerFilter, fromBlock, currentBlock).catch(() => []),
        oldProtocol.queryFilter(ticketPurchasedFilter, fromBlock, currentBlock).catch(() => [])
    ]);

    newBoundEvents.forEach(event => {
        allUsers.add(event.args.user.toLowerCase());
        if (event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
            allUsers.add(event.args.referrer.toLowerCase());
        }
    });

    newTicketEvents.forEach(event => allUsers.add(event.args.user.toLowerCase()));
    oldBoundEvents.forEach(event => {
        allUsers.add(event.args.user.toLowerCase());
        if (event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
            allUsers.add(event.args.referrer.toLowerCase());
        }
    });
    oldTicketEvents.forEach(event => allUsers.add(event.args.user.toLowerCase()));

    return Array.from(allUsers);
}

async function main() {
    console.log("🚀 开始同步新旧合约用户数据\n");
    console.log("=".repeat(80));
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行同步\n");
    }

    // 1. 连接合约
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!PRIVATE_KEY) {
        throw new Error("请设置 PRIVATE_KEY 环境变量");
    }
    
    const deployer = new ethers.Wallet(PRIVATE_KEY, provider);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, deployer);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log(`部署者地址: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    const owner = await newProtocol.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(`部署者不是合约 Owner`);
    }
    console.log(`✅ Owner 验证通过\n`);

    // 2. 获取所有用户（使用已知地址或从事件获取）
    console.log("📋 步骤 1: 获取用户地址");
    console.log("=".repeat(80));
    
    // 优先使用已知需要同步的地址列表
    const KNOWN_USERS = [
        "0x25a5bC4Ecbaf2BF42E1cA89D08e98D800fb939dC",
        "0xdD1A5471d8f8B70500BAE23CC28BC34C7c9ef3b6",
        "0x468F8C39Ef1Db73fe6ecc311B10e1828875273f3",
        "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5"
    ];
    
    let allUsers;
    if (process.argv.includes("--use-known")) {
        allUsers = KNOWN_USERS.map(addr => addr.toLowerCase());
        console.log(`使用已知地址列表: ${allUsers.length} 个用户\n`);
    } else {
        allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`从事件获取: ${allUsers.length} 个用户\n`);
    }

    // 3. 找出需要同步的用户
    console.log("📋 步骤 2: 找出需要同步的用户");
    console.log("=".repeat(80));
    const usersToSync = await findUsersNeedingSync(newProtocol, oldProtocol, allUsers);
    console.log(`\n需要同步的用户数: ${usersToSync.length}\n`);

    if (usersToSync.length === 0) {
        console.log("✅ 所有用户数据都已同步，无需操作！\n");
        return;
    }

    // 显示需要同步的用户（前10个）
    console.log("需要同步的用户（前10个）:");
    usersToSync.slice(0, 10).forEach((user, i) => {
        console.log(`\n${i + 1}. ${user.address}`);
        user.differences.forEach(diff => {
            console.log(`   ${diff.field}: 新=${diff.new}, 旧=${diff.old}`);
        });
    });

    // 4. 执行同步
    console.log("\n📋 步骤 3: 执行数据同步");
    console.log("=".repeat(80));
    
    const syncResults = {
        timestamp: new Date().toISOString(),
        totalUsers: usersToSync.length,
        synced: [],
        failed: []
    };

    for (let i = 0; i < usersToSync.length; i++) {
        const user = usersToSync[i];
        console.log(`\n[${i + 1}/${usersToSync.length}] 同步用户: ${user.address}`);
        
        try {
            const oldUserInfo = await oldProtocol.userInfo(user.address);
            const result = await syncUserData(newProtocol, deployer, user.address, oldUserInfo);
            
            if (result.status === "success") {
                syncResults.synced.push(result);
                console.log(`   ✅ 同步成功 (${result.steps.length} 个字段)`);
            } else {
                syncResults.failed.push(result);
                console.log(`   ❌ 同步失败: ${result.error}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`   ❌ 同步异常: ${error.message}`);
            syncResults.failed.push({
                address: user.address,
                status: "failed",
                error: error.message
            });
        }
    }

    // 5. 保存结果
    console.log("\n📊 同步结果");
    console.log("=".repeat(80));
    console.log(`成功同步: ${syncResults.synced.length}`);
    console.log(`同步失败: ${syncResults.failed.length}`);

    const resultsFile = path.join(__dirname, "../output", `sync-results-${Date.now()}.json`);
    const outputDir = path.dirname(resultsFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(resultsFile, JSON.stringify(syncResults, null, 2));
    console.log(`\n📄 同步结果已保存: ${resultsFile}\n`);
}

if (require.main === module) {
    main()
        .then(() => {
            console.log("✅ 同步完成");
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ 同步失败:", error);
            process.exit(1);
        });
}

module.exports = { main };
