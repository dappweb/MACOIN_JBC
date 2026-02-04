const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ 错误: 未设置 PRIVATE_KEY 环境变量");
    process.exit(1);
}

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
];

const USER_ADDRESS = "0x4544c0cf9d62d3bb441c04a5f31c1ba0e432d37e";
const CORRECT_TEAM_COUNT = 975; // 从检查结果得出

async function fixRootUserTeamCount() {
    console.log("🔧 修复根用户的 teamCount\n");
    console.log("=".repeat(60));
    console.log(`用户地址: ${USER_ADDRESS}`);
    console.log(`正确 teamCount: ${CORRECT_TEAM_COUNT}`);
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    try {
        // 验证权限
        const owner = await protocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ 错误: 私钥对应的地址 ${wallet.address} 不是合约的 owner`);
            console.error(`   合约 owner: ${owner}`);
            process.exit(1);
        }
        console.log(`✅ 权限验证通过: ${wallet.address}\n`);

        // 获取当前数据
        const userInfo = await protocol.userInfo(USER_ADDRESS);
        const currentTeamCount = Number(userInfo.teamCount);
        
        console.log("📋 当前数据:");
        console.log(`  当前 teamCount: ${currentTeamCount}`);
        console.log(`  正确 teamCount: ${CORRECT_TEAM_COUNT}`);
        console.log(`  差异: ${CORRECT_TEAM_COUNT - currentTeamCount}\n`);

        if (currentTeamCount === CORRECT_TEAM_COUNT) {
            console.log("✅ teamCount 已正确，无需修复");
            return;
        }

        // 发送修复交易
        console.log("📝 发送修复交易...");
        const tx = await protocol.adminSetTeamCount(USER_ADDRESS, CORRECT_TEAM_COUNT);
        console.log(`⏳ 交易已发送: ${tx.hash}`);
        console.log(`⏳ 等待确认...`);

        const receipt = await tx.wait();
        console.log(`✅ 交易已确认: 区块 ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);

        // 验证修复结果
        const updatedUserInfo = await protocol.userInfo(USER_ADDRESS);
        const updatedTeamCount = Number(updatedUserInfo.teamCount);

        if (updatedTeamCount === CORRECT_TEAM_COUNT) {
            console.log(`\n✅ 修复成功: ${currentTeamCount} -> ${updatedTeamCount}`);
            console.log(`\n交易哈希: ${tx.hash}`);
            console.log(`区块号: ${receipt.blockNumber}`);
        } else {
            console.log(`\n⚠️  修复后验证失败: 期望 ${CORRECT_TEAM_COUNT}, 实际 ${updatedTeamCount}`);
        }

    } catch (error) {
        console.error("❌ 修复失败:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

fixRootUserTeamCount().catch(console.error);
