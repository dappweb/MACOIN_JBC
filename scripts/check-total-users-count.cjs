const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

async function checkTotalUsersCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 检查实际用户总数");
    console.log("=".repeat(80));
    console.log(`合约地址: ${NEW_PROTOCOL_ADDRESS}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        const currentBlock = await provider.getBlockNumber();
        console.log(`当前区块高度: ${currentBlock}`);
        console.log("");

        // 方法1: 从 TicketPurchased 事件获取
        console.log("1️⃣ 从 TicketPurchased 事件获取用户...");
        const fromBlock = Math.max(0, currentBlock - 5000000); // 扩大查询范围
        console.log(`   查询区块范围: ${fromBlock} - ${currentBlock}`);
        
        let ticketUsers = new Set();
        try {
            const ticketEvents = await protocol.queryFilter(
                protocol.filters.TicketPurchased(),
                fromBlock
            );
            ticketEvents.forEach(event => {
                if (event.args && event.args.user) {
                    ticketUsers.add(event.args.user.toLowerCase());
                }
            });
            console.log(`   ✅ 找到 ${ticketUsers.size} 个购买过门票的用户`);
        } catch (error) {
            console.error(`   ❌ 查询失败: ${error.message}`);
        }
        console.log("");

        // 方法2: 从 BoundReferrer 事件获取
        console.log("2️⃣ 从 BoundReferrer 事件获取用户...");
        let boundUsers = new Set();
        try {
            const boundEvents = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock
            );
            boundEvents.forEach(event => {
                if (event.args && event.args.user) {
                    boundUsers.add(event.args.user.toLowerCase());
                }
                if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                    boundUsers.add(event.args.referrer.toLowerCase());
                }
            });
            console.log(`   ✅ 找到 ${boundUsers.size} 个绑定过推荐关系的用户`);
        } catch (error) {
            console.error(`   ❌ 查询失败: ${error.message}`);
        }
        console.log("");

        // 合并所有用户
        const allUsers = new Set([...ticketUsers, ...boundUsers]);
        console.log("3️⃣ 合并结果:");
        console.log("-".repeat(80));
        console.log(`   TicketPurchased 用户数: ${ticketUsers.size}`);
        console.log(`   BoundReferrer 用户数: ${boundUsers.size}`);
        console.log(`   合并后总用户数: ${allUsers.size}`);
        console.log("");

        // 方法3: 检查实际活跃用户（有门票且未退出）
        console.log("4️⃣ 检查实际活跃用户（有门票且未退出）...");
        console.log("-".repeat(80));
        let activeUsers = 0;
        let usersWithTicket = 0;
        let sampleSize = Math.min(Array.from(allUsers).length, 1000); // 采样检查前1000个
        
        console.log(`   采样检查前 ${sampleSize} 个用户...`);
        
        const usersArray = Array.from(allUsers);
        for (let i = 0; i < sampleSize; i++) {
            try {
                const userInfo = await protocol.userInfo(usersArray[i]);
                const userTicket = await protocol.userTicket(usersArray[i]);
                
                if (userTicket.amount > 0n) {
                    usersWithTicket++;
                    if (!userTicket.exited && userInfo.isActive) {
                        activeUsers++;
                    }
                }
            } catch (e) {
                // 忽略错误
            }
            
            if ((i + 1) % 100 === 0) {
                console.log(`   进度: ${i + 1}/${sampleSize} - 活跃用户: ${activeUsers}, 有门票: ${usersWithTicket}`);
            }
        }
        
        console.log("");
        console.log("5️⃣ 统计结果:");
        console.log("-".repeat(80));
        console.log(`   总用户数（事件统计）: ${allUsers.size}`);
        console.log(`   采样检查用户数: ${sampleSize}`);
        console.log(`   有门票用户数（采样）: ${usersWithTicket}`);
        console.log(`   活跃用户数（采样）: ${activeUsers}`);
        console.log("");

        // 估算总活跃用户数
        if (sampleSize > 0) {
            const activeRate = activeUsers / sampleSize;
            const estimatedActive = Math.floor(allUsers.size * activeRate);
            console.log(`   估算总活跃用户数: ~${estimatedActive} (基于 ${(activeRate * 100).toFixed(2)}% 活跃率)`);
        }

        console.log("");
        console.log("=".repeat(80));
        console.log("📊 总结");
        console.log("=".repeat(80));
        console.log(`事件统计总用户数: ${allUsers.size}`);
        console.log(`实际活跃用户数（采样估算）: ~${activeUsers} - ~${Math.floor(allUsers.size * (activeUsers / sampleSize))}`);
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 检查失败:", error);
        throw error;
    }
}

if (require.main === module) {
    checkTotalUsersCount().catch(console.error);
}

module.exports = { checkTotalUsersCount };
