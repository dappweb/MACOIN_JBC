const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function countAllContractUsers() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 统计新旧合约账户总数");
    console.log("=".repeat(80));
    console.log(`新合约地址: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`旧合约地址: ${OLD_PROTOCOL_ADDRESS}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        const currentBlock = await provider.getBlockNumber();
        console.log(`当前区块高度: ${currentBlock}\n`);

        // 统计新合约用户
        console.log("1️⃣ 统计新合约用户...");
        console.log("-".repeat(80));
        const newUsers = new Set();
        
        // 从 TicketPurchased 事件获取
        try {
            const newTicketEvents = await newProtocol.queryFilter(
                newProtocol.filters.TicketPurchased(),
                0
            );
            newTicketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    newUsers.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ TicketPurchased 事件: ${newTicketEvents.length} 个，用户: ${newTicketEvents.length} 个`);
        } catch (error) {
            console.error(`   ❌ TicketPurchased 查询失败: ${error.message}`);
        }

        // 从 BoundReferrer 事件获取
        try {
            const newBoundEvents = await newProtocol.queryFilter(
                newProtocol.filters.BoundReferrer(),
                0
            );
            newBoundEvents.forEach(event => {
                if (event.args && event.args.user) {
                    newUsers.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    newUsers.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ BoundReferrer 事件: ${newBoundEvents.length} 个，用户: ${newBoundEvents.length} 个`);
        } catch (error) {
            console.error(`   ❌ BoundReferrer 查询失败: ${error.message}`);
        }

        console.log(`   📊 新合约总用户数: ${newUsers.size}`);
        console.log("");

        // 统计旧合约用户
        console.log("2️⃣ 统计旧合约用户...");
        console.log("-".repeat(80));
        const oldUsers = new Set();
        
        // 从 TicketPurchased 事件获取
        try {
            const oldTicketEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.TicketPurchased(),
                0
            );
            oldTicketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    oldUsers.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ TicketPurchased 事件: ${oldTicketEvents.length} 个，用户: ${oldTicketEvents.length} 个`);
        } catch (error) {
            console.error(`   ❌ TicketPurchased 查询失败: ${error.message}`);
        }

        // 从 BoundReferrer 事件获取
        try {
            const oldBoundEvents = await oldProtocol.queryFilter(
                oldProtocol.filters.BoundReferrer(),
                0
            );
            oldBoundEvents.forEach(event => {
                if (event.args && event.args.user) {
                    oldUsers.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    oldUsers.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ BoundReferrer 事件: ${oldBoundEvents.length} 个，用户: ${oldBoundEvents.length} 个`);
        } catch (error) {
            console.error(`   ❌ BoundReferrer 查询失败: ${error.message}`);
        }

        console.log(`   📊 旧合约总用户数: ${oldUsers.size}`);
        console.log("");

        // 合并统计（去重）
        console.log("3️⃣ 合并统计（去重）...");
        console.log("-".repeat(80));
        const allUsers = new Set([...newUsers, ...oldUsers]);
        const onlyNewUsers = new Set([...newUsers].filter(u => !oldUsers.has(u)));
        const onlyOldUsers = new Set([...oldUsers].filter(u => !newUsers.has(u)));
        const bothContractsUsers = new Set([...newUsers].filter(u => oldUsers.has(u)));

        console.log(`   📊 新合约用户数: ${newUsers.size}`);
        console.log(`   📊 旧合约用户数: ${oldUsers.size}`);
        console.log(`   📊 仅在新合约的用户: ${onlyNewUsers.size}`);
        console.log(`   📊 仅在旧合约的用户: ${onlyOldUsers.size}`);
        console.log(`   📊 新旧合约都有的用户: ${bothContractsUsers.size}`);
        console.log(`   📊 合并后总用户数（去重）: ${allUsers.size}`);
        console.log("");

        // 详细统计
        console.log("4️⃣ 详细统计...");
        console.log("-".repeat(80));
        console.log(`   新合约:`);
        console.log(`     - 总账户数: ${newUsers.size}`);
        console.log(`     - 仅在新合约: ${onlyNewUsers.size}`);
        console.log(`     - 也在旧合约: ${bothContractsUsers.size}`);
        console.log("");
        console.log(`   旧合约:`);
        console.log(`     - 总账户数: ${oldUsers.size}`);
        console.log(`     - 仅在旧合约: ${onlyOldUsers.size}`);
        console.log(`     - 也在新合约: ${bothContractsUsers.size}`);
        console.log("");
        console.log(`   总计:`);
        console.log(`     - 唯一账户总数: ${allUsers.size}`);
        console.log(`     - 新合约账户数: ${newUsers.size}`);
        console.log(`     - 旧合约账户数: ${oldUsers.size}`);
        console.log("");

        // 输出总结
        console.log("=".repeat(80));
        console.log("📊 统计总结");
        console.log("=".repeat(80));
        console.log(`新合约账户总数: ${newUsers.size}`);
        console.log(`旧合约账户总数: ${oldUsers.size}`);
        console.log(`合并后唯一账户总数: ${allUsers.size}`);
        console.log(`仅在新合约: ${onlyNewUsers.size}`);
        console.log(`仅在旧合约: ${onlyOldUsers.size}`);
        console.log(`新旧合约都有: ${bothContractsUsers.size}`);
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 统计失败:", error);
        throw error;
    }
}

if (require.main === module) {
    countAllContractUsers().catch(console.error);
}

module.exports = { countAllContractUsers };
