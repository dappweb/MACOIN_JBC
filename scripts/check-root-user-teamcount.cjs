const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

const ROOT_USER = "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e";

async function checkRootUserTeamCount() {
    console.log("🔍 检查根用户的团队数量\n");
    console.log("=".repeat(60));
    console.log(`根用户地址: ${ROOT_USER}`);
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取根用户的当前信息
        console.log("📋 根用户当前信息:");
        const rootUserInfo = await newProtocol.userInfo(ROOT_USER);
        console.log(`  推荐人: ${rootUserInfo.referrer}`);
        console.log(`  活跃直推数: ${rootUserInfo.activeDirects.toString()}`);
        console.log(`  当前 teamCount: ${rootUserInfo.teamCount.toString()}`);
        console.log(`  是否激活: ${rootUserInfo.isActive}`);
        console.log("");

        // 2. 检查根用户是否是真正的根（没有推荐人）
        if (rootUserInfo.referrer && rootUserInfo.referrer !== ethers.ZeroAddress) {
            console.log("⚠️  警告: 该用户有推荐人，不是根用户！");
            console.log(`  推荐人: ${rootUserInfo.referrer}\n`);
        } else {
            console.log("✅ 确认: 该用户是根用户（没有推荐人）\n");
        }

        // 3. 获取所有用户
        console.log("📊 获取所有用户...");
        const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`  总用户数: ${allUsers.length}\n`);

        // 4. 构建推荐关系图
        console.log("🔗 构建推荐关系图...");
        const referrerMap = new Map();
        const referrerToUsers = new Map();
        
        for (const userAddress of allUsers) {
            let referrer = ethers.ZeroAddress;
            
            try {
                const userInfo = await newProtocol.userInfo(userAddress);
                if (userInfo.referrer && userInfo.referrer !== ethers.ZeroAddress) {
                    referrer = userInfo.referrer.toLowerCase();
                }
            } catch (error) {
                // 用户不在新合约中
            }
            
            if (referrer !== ethers.ZeroAddress) {
                referrerMap.set(userAddress.toLowerCase(), referrer);
                if (!referrerToUsers.has(referrer)) {
                    referrerToUsers.set(referrer, []);
                }
                referrerToUsers.get(referrer).push(userAddress.toLowerCase());
            }
        }
        console.log(`  推荐关系数: ${referrerMap.size}\n`);

        // 5. 计算根用户应该有的团队数量
        console.log("🧮 计算根用户的团队数量...");
        const rootUserLower = ROOT_USER.toLowerCase();
        
        // 递归计算团队数量
        function calculateTeamCount(user, visited = new Set()) {
            if (visited.has(user)) {
                return 0; // 防止循环
            }
            visited.add(user);
            
            const directReferrals = referrerToUsers.get(user) || [];
            let count = directReferrals.length;
            
            for (const referral of directReferrals) {
                count += calculateTeamCount(referral, visited);
            }
            
            return count;
        }
        
        const calculatedTeamCount = calculateTeamCount(rootUserLower);
        const currentTeamCount = Number(rootUserInfo.teamCount);
        
        console.log(`  计算的团队数量: ${calculatedTeamCount}`);
        console.log(`  当前合约中的 teamCount: ${currentTeamCount}`);
        console.log(`  差异: ${calculatedTeamCount - currentTeamCount}`);
        console.log("");

        // 6. 统计所有用户中，有多少在根用户的团队下
        console.log("📈 统计根用户团队覆盖情况:");
        const rootTeamMembers = new Set();
        const rootTeamMembersList = [];
        
        function collectTeamMembers(user, visited = new Set()) {
            if (visited.has(user)) return;
            visited.add(user);
            
            const directReferrals = referrerToUsers.get(user) || [];
            for (const referral of directReferrals) {
                if (!rootTeamMembers.has(referral)) {
                    rootTeamMembers.add(referral);
                    rootTeamMembersList.push(referral);
                    collectTeamMembers(referral, visited);
                }
            }
        }
        
        collectTeamMembers(rootUserLower);
        
        console.log(`  根用户团队中的用户数: ${rootTeamMembers.size}`);
        console.log(`  总用户数: ${allUsers.length}`);
        console.log(`  覆盖率: ${((rootTeamMembers.size / allUsers.length) * 100).toFixed(2)}%`);
        console.log("");

        // 7. 检查是否有用户不在根用户的团队下
        const usersNotInRootTeam = allUsers.filter(user => {
            const userLower = user.toLowerCase();
            return userLower !== rootUserLower && !rootTeamMembers.has(userLower);
        });
        
        if (usersNotInRootTeam.length > 0) {
            console.log(`⚠️  发现 ${usersNotInRootTeam.length} 个用户不在根用户的团队下:`);
            for (let i = 0; i < Math.min(10, usersNotInRootTeam.length); i++) {
                const user = usersNotInRootTeam[i];
                try {
                    const userInfo = await newProtocol.userInfo(user);
                    console.log(`  ${i + 1}. ${user} (推荐人: ${userInfo.referrer || '无'})`);
                } catch (e) {
                    console.log(`  ${i + 1}. ${user}`);
                }
            }
            if (usersNotInRootTeam.length > 10) {
                console.log(`  ... 还有 ${usersNotInRootTeam.length - 10} 个用户`);
            }
            console.log("");
        } else {
            console.log("✅ 所有用户都在根用户的团队下\n");
        }

        // 8. 总结和建议
        console.log("=".repeat(60));
        console.log("📊 总结");
        console.log("=".repeat(60));
        console.log(`根用户地址: ${ROOT_USER}`);
        console.log(`当前 teamCount: ${currentTeamCount}`);
        console.log(`计算的 teamCount: ${calculatedTeamCount}`);
        console.log(`差异: ${calculatedTeamCount - currentTeamCount}`);
        console.log(`团队覆盖用户数: ${rootTeamMembers.size}/${allUsers.length}`);
        
        if (calculatedTeamCount !== currentTeamCount) {
            console.log("\n⚠️  建议: teamCount 需要修复");
            console.log(`   应该设置为: ${calculatedTeamCount}`);
        } else {
            console.log("\n✅ teamCount 正确");
        }
        
        if (usersNotInRootTeam.length > 0) {
            console.log(`\n⚠️  注意: 有 ${usersNotInRootTeam.length} 个用户不在根用户的团队下`);
            console.log("   这些用户可能是:");
            console.log("   1. 其他根用户（没有推荐人）");
            console.log("   2. 推荐关系未正确设置");
        }
        
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

async function getAllUsersFromEvents(newProtocol, oldProtocol, provider) {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0;

    const allUsers = new Set();

    // 从新合约获取
    try {
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

        [...newBoundEvents, ...newTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 新合约事件查询失败: ${error.message}`);
    }

    // 从旧合约获取
    try {
        const oldBoundEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.BoundReferrer(),
            fromBlock,
            currentBlock
        );
        const oldTicketEvents = await oldProtocol.queryFilter(
            oldProtocol.filters.TicketPurchased(),
            fromBlock,
            currentBlock
        );

        [...oldBoundEvents, ...oldTicketEvents].forEach(event => {
            if (event.args && event.args.user) {
                allUsers.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                allUsers.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.warn(`⚠️ 旧合约事件查询失败: ${error.message}`);
    }

    return Array.from(allUsers);
}

checkRootUserTeamCount().catch(console.error);
