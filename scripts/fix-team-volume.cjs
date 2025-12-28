const { ethers } = require("ethers");
require('dotenv').config();

// Contract addresses
const ADDRESSES = {
    PROTOCOL: "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19"
};

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function batchUpdateUserStats(address[] users, uint256[] counts, uint256[] volumes) external",
    "function owner() view returns (address)"
];

async function calculateCorrectTeamVolume(protocolContract, userAddress, visited = new Set()) {
    // 防止循环引用
    if (visited.has(userAddress)) {
        return 0n;
    }
    visited.add(userAddress);
    
    try {
        // 获取直推用户
        const directReferrals = await protocolContract.getDirectReferrals(userAddress);
        let totalVolume = 0n;
        
        for (const directAddr of directReferrals) {
            // 获取直推用户的门票金额
            const directTicket = await protocolContract.userTicket(directAddr);
            totalVolume += directTicket[1]; // 门票金额
            
            // 递归计算直推用户的团队业绩
            const subTeamVolume = await calculateCorrectTeamVolume(protocolContract, directAddr, new Set(visited));
            totalVolume += subTeamVolume;
        }
        
        return totalVolume;
    } catch (error) {
        console.error(`计算 ${userAddress} 的团队业绩时出错:`, error.message);
        return 0n;
    }
}

async function calculateCorrectTeamCount(protocolContract, userAddress, visited = new Set()) {
    // 防止循环引用
    if (visited.has(userAddress)) {
        return 0;
    }
    visited.add(userAddress);
    
    try {
        // 获取直推用户
        const directReferrals = await protocolContract.getDirectReferrals(userAddress);
        let totalCount = directReferrals.length; // 直推人数
        
        for (const directAddr of directReferrals) {
            // 递归计算直推用户的团队人数
            const subTeamCount = await calculateCorrectTeamCount(protocolContract, directAddr, new Set(visited));
            totalCount += subTeamCount;
        }
        
        return totalCount;
    } catch (error) {
        console.error(`计算 ${userAddress} 的团队人数时出错:`, error.message);
        return 0;
    }
}

async function fixTeamVolumeForUser(userAddress, dryRun = true) {
    console.log(`🔧 ${dryRun ? '模拟' : '执行'}修复用户 ${userAddress} 的团队统计数据\n`);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const protocolContract = new ethers.Contract(ADDRESSES.PROTOCOL, PROTOCOL_ABI, wallet);

    try {
        // 检查权限
        const owner = await protocolContract.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error("❌ 只有合约所有者可以执行此操作");
            console.error(`   合约所有者: ${owner}`);
            console.error(`   当前钱包: ${wallet.address}`);
            return;
        }
        
        // 获取当前数据
        const currentUserInfo = await protocolContract.userInfo(userAddress);
        const currentTeamCount = Number(currentUserInfo[2]);
        const currentTeamVolume = currentUserInfo[7];
        
        console.log("📊 当前数据:");
        console.log(`   团队人数: ${currentTeamCount}`);
        console.log(`   团队总业绩: ${ethers.formatEther(currentTeamVolume)} MC`);
        
        // 计算正确的数据
        console.log("\n🧮 计算正确数据...");
        const correctTeamCount = await calculateCorrectTeamCount(protocolContract, userAddress);
        const correctTeamVolume = await calculateCorrectTeamVolume(protocolContract, userAddress);
        
        console.log("✅ 计算完成:");
        console.log(`   正确团队人数: ${correctTeamCount}`);
        console.log(`   正确团队总业绩: ${ethers.formatEther(correctTeamVolume)} MC`);
        
        // 检查是否需要更新
        const needsUpdate = currentTeamCount !== correctTeamCount || currentTeamVolume !== correctTeamVolume;
        
        if (!needsUpdate) {
            console.log("\n✅ 数据已经正确，无需更新");
            return;
        }
        
        console.log("\n📝 需要更新的数据:");
        if (currentTeamCount !== correctTeamCount) {
            console.log(`   团队人数: ${currentTeamCount} → ${correctTeamCount}`);
        }
        if (currentTeamVolume !== correctTeamVolume) {
            console.log(`   团队总业绩: ${ethers.formatEther(currentTeamVolume)} → ${ethers.formatEther(correctTeamVolume)} MC`);
        }
        
        if (dryRun) {
            console.log("\n🔍 这是模拟运行，实际数据未被修改");
            console.log("💡 要执行实际修复，请使用 --execute 参数");
            return;
        }
        
        // 执行更新
        console.log("\n🚀 执行更新...");
        const tx = await protocolContract.batchUpdateUserStats(
            [userAddress],
            [correctTeamCount],
            [correctTeamVolume]
        );
        
        console.log(`   交易哈希: ${tx.hash}`);
        console.log("   等待确认...");
        
        const receipt = await tx.wait();
        console.log(`   ✅ 交易确认! Gas使用: ${receipt.gasUsed}`);
        
        // 验证更新结果
        const updatedUserInfo = await protocolContract.userInfo(userAddress);
        const updatedTeamCount = Number(updatedUserInfo[2]);
        const updatedTeamVolume = updatedUserInfo[7];
        
        console.log("\n🎉 更新完成!");
        console.log(`   新团队人数: ${updatedTeamCount}`);
        console.log(`   新团队总业绩: ${ethers.formatEther(updatedTeamVolume)} MC`);
        
    } catch (error) {
        console.error("❌ 修复过程中出现错误:", error.message);
        if (error.message.includes("Ownable")) {
            console.error("💡 提示: 只有合约所有者可以执行此操作");
        }
    }
}

async function main() {
    const userAddress = process.argv[2];
    const executeFlag = process.argv[3];
    
    if (!userAddress) {
        console.log("使用方法: node scripts/fix-team-volume.cjs <用户地址> [--execute]");
        console.log("示例:");
        console.log("  模拟运行: node scripts/fix-team-volume.cjs 0x1234567890123456789012345678901234567890");
        console.log("  实际执行: node scripts/fix-team-volume.cjs 0x1234567890123456789012345678901234567890 --execute");
        return;
    }
    
    if (!ethers.isAddress(userAddress)) {
        console.error("❌ 无效的以太坊地址");
        return;
    }
    
    const dryRun = executeFlag !== '--execute';
    await fixTeamVolumeForUser(userAddress, dryRun);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { fixTeamVolumeForUser, calculateCorrectTeamVolume, calculateCorrectTeamCount };