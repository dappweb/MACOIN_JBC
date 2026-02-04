const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

const ROOT_USER = "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e";

async function calculateRootToAllUsersTeamCount() {
    console.log("🧮 计算根用户到所有网体用户的 teamCount\n");
    console.log("=".repeat(80));
    console.log(`根用户地址: ${ROOT_USER}`);
    console.log("=".repeat(80) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    try {
        // 1. 获取所有用户
        console.log("📊 获取所有用户...");
        const allUsers = await getAllUsersFromEvents(newProtocol, oldProtocol, provider);
        console.log(`  总用户数: ${allUsers.length}\n`);

        // 2. 构建推荐关系图
        console.log("🔗 构建推荐关系图...");
        const referrerMap = new Map();
        const referrerToUsers = new Map();
        const rootUsers = [];
        
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
            } else {
                rootUsers.push(userAddress.toLowerCase());
            }
        }
        
        console.log(`  推荐关系数: ${referrerMap.size}`);
        console.log(`  根用户数: ${rootUsers.length}\n`);

        // 3. 验证根用户
        const rootUserLower = ROOT_USER.toLowerCase();
        console.log("🔍 验证根用户...");
        const rootUserInfo = await newProtocol.userInfo(ROOT_USER);
        console.log(`  推荐人: ${rootUserInfo.referrer}`);
        console.log(`  当前 teamCount: ${rootUserInfo.teamCount.toString()}`);
        console.log(`  活跃直推数: ${rootUserInfo.activeDirects.toString()}`);
        console.log("");

        // 4. 计算根用户到所有网体用户的 teamCount
        console.log("🧮 计算根用户的 teamCount（递归计算所有下级用户）...");
        
        const teamCountCache = new Map();
        const visited = new Set();
        
        function calculateTeamCount(user) {
            if (teamCountCache.has(user)) {
                return teamCountCache.get(user);
            }
            
            if (visited.has(user)) {
                return 0; // 防止循环
            }
            visited.add(user);
            
            const directReferrals = referrerToUsers.get(user) || [];
            let count = directReferrals.length;
            
            for (const referral of directReferrals) {
                count += calculateTeamCount(referral);
            }
            
            visited.delete(user);
            teamCountCache.set(user, count);
            return count;
        }
        
        const calculatedTeamCount = calculateTeamCount(rootUserLower);
        const contractTeamCount = Number(rootUserInfo.teamCount);
        
        console.log(`  计算的 teamCount: ${calculatedTeamCount}`);
        console.log(`  合约中的 teamCount: ${contractTeamCount}`);
        console.log(`  差异: ${calculatedTeamCount - contractTeamCount}`);
        console.log("");

        // 5. 统计根用户团队中的所有用户
        console.log("📈 统计根用户团队中的所有用户...");
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

        // 6. 检查不在根用户团队中的用户
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
                    console.log(`  ${i + 1}. ${user} (推荐人: ${userInfo.referrer || '无'}, teamCount: ${userInfo.teamCount})`);
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

        // 7. 验证计算结果的正确性
        console.log("✅ 验证计算结果...");
        if (calculatedTeamCount === rootTeamMembers.size) {
            console.log(`  ✅ 计算结果正确: teamCount (${calculatedTeamCount}) = 团队用户数 (${rootTeamMembers.size})`);
        } else {
            console.log(`  ⚠️  计算结果不一致: teamCount (${calculatedTeamCount}) ≠ 团队用户数 (${rootTeamMembers.size})`);
            console.log(`  差异: ${Math.abs(calculatedTeamCount - rootTeamMembers.size)}`);
        }
        console.log("");

        // 8. 总结
        console.log("=".repeat(80));
        console.log("📊 总结");
        console.log("=".repeat(80));
        console.log(`根用户地址: ${ROOT_USER}`);
        console.log(`计算的 teamCount: ${calculatedTeamCount}`);
        console.log(`合约中的 teamCount: ${contractTeamCount}`);
        console.log(`团队覆盖用户数: ${rootTeamMembers.size}/${allUsers.length} (${((rootTeamMembers.size / allUsers.length) * 100).toFixed(2)}%)`);
        console.log(`不在团队中的用户: ${usersNotInRootTeam.length}`);
        
        if (calculatedTeamCount !== contractTeamCount) {
            console.log(`\n⚠️  建议: teamCount 需要修复`);
            console.log(`   应该设置为: ${calculatedTeamCount}`);
        } else {
            console.log(`\n✅ teamCount 正确`);
        }
        
        console.log("=".repeat(80));

        // 9. 如果需要修复，提供修复选项
        if (calculatedTeamCount !== contractTeamCount && process.env.AUTO_FIX === "true") {
            console.log("\n🔧 自动修复模式已启用，开始修复...");
            const PRIVATE_KEY = process.env.PRIVATE_KEY;
            if (!PRIVATE_KEY) {
                console.log("⚠️  未设置 PRIVATE_KEY，跳过自动修复");
                return;
            }
            
            const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            const protocolWithSigner = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);
            
            // 验证权限
            const owner = await protocolWithSigner.owner();
            if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
                console.log("⚠️  无权限修复，跳过");
                return;
            }
            
            console.log(`📝 发送修复交易...`);
            const tx = await protocolWithSigner.adminSetTeamCount(ROOT_USER, calculatedTeamCount);
            console.log(`⏳ 交易已发送: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`✅ 修复完成: 区块 ${receipt.blockNumber}`);
        }

    } catch (error) {
        console.error("❌ 计算失败:", error.message);
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

calculateRootToAllUsersTeamCount().catch(console.error);
