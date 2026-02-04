const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false"; // 默认为干运行

const PROTOCOL_ABI = [
    "function owner() view returns (address)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
];

async function fixSpecificUserTeamCount(userAddress, targetTeamCount) {
    if (!PRIVATE_KEY) {
        console.error("❌ 错误: 请设置 PRIVATE_KEY 环境变量");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔧 修复用户 teamCount");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    if (DRY_RUN) {
        console.log("⚠️  干运行模式 - 不会实际执行修复\n");
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocolContract = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    console.log(`部署者地址: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`部署者余额: ${ethers.formatEther(balance)} MC`);

    // 验证 Owner
    const owner = await protocolContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 部署者不是合约 Owner: 当前 Owner = ${owner}, 部署者 = ${wallet.address}`);
        process.exit(1);
    }
    console.log(`✅ Owner 验证通过\n`);

    // 获取当前 teamCount
    const userInfo = await protocolContract.userInfo(userAddress);
    const currentTeamCount = Number(userInfo.teamCount);
    
    console.log(`📋 用户信息:`);
    console.log(`  地址: ${userAddress}`);
    console.log(`  当前 teamCount: ${currentTeamCount.toLocaleString()}`);
    console.log(`  目标 teamCount: ${targetTeamCount.toLocaleString()}`);
    console.log(`  差异: ${targetTeamCount - currentTeamCount > 0 ? '+' : ''}${(targetTeamCount - currentTeamCount).toLocaleString()}\n`);

    if (currentTeamCount === targetTeamCount) {
        console.log("✅ 用户的 teamCount 已经是目标值，无需修复！");
        return;
    }

    if (DRY_RUN) {
        console.log("⚠️  干运行模式，跳过实际修复");
        console.log(`   如果执行，将调用: adminSetTeamCount(${userAddress}, ${targetTeamCount})`);
        return;
    }

    // 执行修复
    console.log("📝 开始修复...");
    try {
        const tx = await protocolContract.adminSetTeamCount(userAddress, targetTeamCount);
        console.log(`  ✅ 交易已发送: ${tx.hash}`);
        console.log(`  ⏳ 等待确认...`);
        
        const receipt = await tx.wait();
        console.log(`  ✅ 交易已确认！`);
        console.log(`     区块号: ${receipt.blockNumber}`);
        console.log(`     Gas 使用: ${receipt.gasUsed.toLocaleString()}`);
        
        // 验证修复结果
        const updatedUserInfo = await protocolContract.userInfo(userAddress);
        const updatedTeamCount = Number(updatedUserInfo.teamCount);
        
        if (updatedTeamCount === targetTeamCount) {
            console.log(`\n✅ 修复成功！teamCount 已更新为 ${updatedTeamCount.toLocaleString()}`);
        } else {
            console.log(`\n⚠️  警告: teamCount 更新为 ${updatedTeamCount.toLocaleString()}，但目标值是 ${targetTeamCount.toLocaleString()}`);
        }
    } catch (error) {
        console.error(`\n❌ 修复失败: ${error.message}`);
        if (error.reason) {
            console.error(`   原因: ${error.reason}`);
        }
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ 修复完成");
    console.log("=".repeat(80));
}

if (require.main === module) {
    const userAddress = process.argv[2] || "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";
    const targetTeamCount = parseInt(process.argv[3]) || 953;
    
    if (!userAddress || !ethers.isAddress(userAddress)) {
        console.error("❌ 错误: 无效的用户地址");
        process.exit(1);
    }
    
    fixSpecificUserTeamCount(userAddress, targetTeamCount).catch(console.error);
}
