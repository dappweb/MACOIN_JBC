const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = process.env.OLD_PROTOCOL_ADDRESS || "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function getTotalTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 统计团队总人数");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    // 获取所有用户地址（从事件中）
    console.log("📋 步骤 1: 获取所有用户地址...");
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    // 从新合约获取所有用户
    console.log("  查询新合约事件...");
    const newBoundEvents = await newProtocol.queryFilter(
        newProtocol.filters.BoundReferrer(),
        fromBlock,
        currentBlock
    );
    const newTicketEvents = await newProtocol.queryFilter(
        newProtocol.filters.TicketPurchased(),
        fromBlock,
        currentBlock
    );

    // 从旧合约获取所有用户
    console.log("  查询旧合约事件...");
    let oldBoundEvents = [];
    let oldTicketEvents = [];
    try {
        oldBoundEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );
    } catch (error) {
        console.warn(`  ⚠️ 旧合约查询失败: ${error.message}`);
    }

    // 合并所有用户地址
    const allUsers = new Set();
    [...newBoundEvents, ...oldBoundEvents].forEach(event => {
        if (event.args && event.args.user) {
            allUsers.add(event.args.user.toLowerCase());
        }
    });
    [...newTicketEvents, ...oldTicketEvents].forEach(event => {
        if (event.args && event.args.user) {
            allUsers.add(event.args.user.toLowerCase());
        }
    });

    console.log(`  ✅ 找到 ${allUsers.size} 个唯一用户地址\n`);

    // 查询每个用户的团队人数
    console.log("📋 步骤 2: 查询每个用户的团队人数...");
    console.log("  (这可能需要一些时间，请耐心等待...)\n");

    let totalTeamCount = 0n;
    let processedCount = 0;
    let newContractUsers = 0;
    let oldContractUsers = 0;
    let bothContractUsers = 0;
    let maxTeamCount = 0n;
    let maxTeamCountUser = null;

    const userArray = Array.from(allUsers);
    const batchSize = 50; // 每批处理50个用户

    for (let i = 0; i < userArray.length; i += batchSize) {
        const batch = userArray.slice(i, i + batchSize);
        const promises = batch.map(async (userAddress) => {
            let newTeamCount = 0n;
            let oldTeamCount = 0n;
            let existsInNew = false;
            let existsInOld = false;

            // 查询新合约
            try {
                const newUserInfo = await newProtocol.userInfo(userAddress);
                newTeamCount = newUserInfo.teamCount;
                existsInNew = true;
            } catch (error) {
                // 用户不在新合约中
            }

            // 查询旧合约
            try {
                const oldUserInfo = await oldProtocol.userInfo(userAddress);
                oldTeamCount = oldUserInfo.teamCount;
                existsInOld = true;
            } catch (error) {
                // 用户不在旧合约中
            }

            // 取最大值
            const maxTeamCountForUser = newTeamCount > oldTeamCount ? newTeamCount : oldTeamCount;

            // 统计
            if (existsInNew && existsInOld) {
                bothContractUsers++;
            } else if (existsInNew) {
                newContractUsers++;
            } else if (existsInOld) {
                oldContractUsers++;
            }

            // 累加团队人数（每个用户的团队人数代表其下线的数量）
            // 注意：这里我们统计的是所有用户的团队人数总和
            // 但实际上，团队人数是递归的，所以总和会重复计算
            // 我们需要统计的是根用户的团队人数，或者所有用户的团队人数总和
            totalTeamCount += maxTeamCountForUser;

            if (maxTeamCountForUser > maxTeamCount) {
                maxTeamCount = maxTeamCountForUser;
                maxTeamCountUser = userAddress;
            }

            return {
                address: userAddress,
                newTeamCount: Number(newTeamCount),
                oldTeamCount: Number(oldTeamCount),
                maxTeamCount: Number(maxTeamCountForUser),
                existsInNew,
                existsInOld
            };
        });

        const results = await Promise.all(promises);
        processedCount += results.length;

        // 显示进度
        if (processedCount % 100 === 0 || processedCount === userArray.length) {
            console.log(`  ⏳ 已处理: ${processedCount}/${userArray.length} (${((processedCount / userArray.length) * 100).toFixed(1)}%)`);
        }

        // 避免RPC请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("\n📊 统计结果");
    console.log("=".repeat(80));
    console.log(`总用户数: ${allUsers.size}`);
    console.log(`  新合约用户: ${newContractUsers}`);
    console.log(`  旧合约用户: ${oldContractUsers}`);
    console.log(`  新旧合约都有: ${bothContractUsers}`);
    console.log(`\n团队人数统计:`);
    console.log(`  所有用户团队人数总和: ${totalTeamCount.toString()}`);
    console.log(`  平均团队人数: ${(Number(totalTeamCount) / allUsers.size).toFixed(2)}`);
    console.log(`  最大团队人数: ${maxTeamCount.toString()}`);
    if (maxTeamCountUser) {
        console.log(`  最大团队人数用户: ${maxTeamCountUser}`);
    }

    // 注意：团队人数总和可能包含重复计算，因为每个用户的团队人数包括其所有下线
    // 如果要统计实际的唯一团队成员数，需要去重
    console.log(`\n⚠️  注意: 团队人数总和可能包含重复计算，因为每个用户的团队人数包括其所有下线`);
    console.log(`   如果要统计实际的唯一团队成员数，需要构建推荐关系树并去重\n`);

    console.log("=".repeat(80));
    console.log("✅ 统计完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    getTotalTeamCount().catch(console.error);
}
