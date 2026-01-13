const { ethers } = require("ethers");
require('dotenv').config();

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
    "function owner() view returns (address)",
];

async function fixTeamVolume(userAddress, newTeamTotalVolume, dryRun = true) {
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ 请设置 PRIVATE_KEY 环境变量");
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    console.log("🔧 修复用户团队总业绩\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`新的团队总业绩: ${newTeamTotalVolume} MC`);
    console.log(`模式: ${dryRun ? '🔍 模拟运行（不会实际修改）' : '⚡ 实际执行'}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 检查权限
        const owner = await protocol.owner();
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error("❌ 只有合约所有者可以执行此操作");
            console.error(`   合约所有者: ${owner}`);
            console.error(`   当前钱包: ${wallet.address}`);
            return;
        }

        // 获取当前数据
        const userInfo = await protocol.userInfo(userAddress);
        const currentVolume = parseFloat(ethers.formatEther(userInfo.teamTotalVolume));
        
        console.log("📊 当前数据:");
        console.log(`  团队总业绩: ${currentVolume.toFixed(4)} MC`);
        console.log(`  目标值: ${newTeamTotalVolume.toFixed(4)} MC`);
        console.log(`  差额: ${(newTeamTotalVolume - currentVolume).toFixed(4)} MC`);
        console.log("");

        if (Math.abs(currentVolume - newTeamTotalVolume) < 0.01) {
            console.log("✅ 数据已经是目标值，无需修复");
            return;
        }

        if (dryRun) {
            console.log("🔍 [模拟] 将执行以下操作:");
            console.log(`  adminSetTeamTotalVolume(${userAddress}, ${ethers.parseEther(newTeamTotalVolume.toString())})`);
            console.log("");
            console.log("⚠️  这是模拟运行，不会实际修改合约数据");
            console.log("   要实际执行，请设置 dryRun = false");
        } else {
            console.log("⚡ 执行修复...");
            const newVolumeWei = ethers.parseEther(newTeamTotalVolume.toString());
            
            try {
                // 直接发送交易，不估算 gas（让 ethers 自动处理）
                console.log("  发送交易...");
                const tx = await protocol.adminSetTeamTotalVolume(
                    userAddress,
                    newVolumeWei,
                    {
                        gasLimit: 100000 // 设置一个合理的 gas limit
                    }
                );
                console.log(`  交易哈希: ${tx.hash}`);
                console.log("  等待确认...");
                const receipt = await tx.wait();
                console.log(`  ✅ 交易已确认，区块: ${receipt.blockNumber}`);
                console.log("✅ 修复完成！");
                
                // 验证修复结果
                const updatedInfo = await protocol.userInfo(userAddress);
                const updatedVolume = parseFloat(ethers.formatEther(updatedInfo.teamTotalVolume));
                console.log(`  更新后的团队总业绩: ${updatedVolume.toFixed(4)} MC`);
                
                if (Math.abs(updatedVolume - newTeamTotalVolume) < 0.01) {
                    console.log("  ✅ 验证成功，数据已正确更新");
                } else {
                    console.log(`  ⚠️  警告：更新后的值 (${updatedVolume.toFixed(4)}) 与目标值 (${newTeamTotalVolume.toFixed(4)}) 不一致`);
                }
            } catch (error) {
                console.error("  ❌ 交易失败:", error.message);
                if (error.reason) {
                    console.error("  原因:", error.reason);
                }
                if (error.data) {
                    console.error("  错误数据:", error.data);
                }
                throw error;
            }
        }

    } catch (error) {
        console.error("❌ 修复失败:", error.message);
        if (error.reason) {
            console.error("   原因:", error.reason);
        }
    }
}

// 运行脚本
const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

// 先查询地址2的团队总业绩，作为地址1的最小值
async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    const userInfo2 = await protocol.userInfo(address2);
    const volume2 = parseFloat(ethers.formatEther(userInfo2.teamTotalVolume));
    
    console.log("📊 查询地址2的团队总业绩作为参考值...");
    console.log(`地址2的团队总业绩: ${volume2.toFixed(4)} MC\n`);
    
    // 地址1的团队总业绩应该至少等于地址2的值
    // 建议设置为地址2的值 + 地址1自己购买的金额
    const userInfo1 = await protocol.userInfo(address1);
    const ticket1 = await protocol.userTicket(address1);
    const selfVolume1 = parseFloat(ethers.formatEther(ticket1.amount || 0n));
    
    // 建议值：地址2的团队总业绩（因为地址1的团队包含地址2）
    const suggestedVolume = volume2;
    
    console.log("💡 修复建议:");
    console.log(`  地址1的团队总业绩应该至少为: ${suggestedVolume.toFixed(4)} MC`);
    console.log(`  (等于地址2的团队总业绩，因为地址1推荐了地址2)\n`);
    
    // 执行修复（默认是模拟运行）
    const dryRun = process.argv.includes('--execute') ? false : true;
    await fixTeamVolume(address1, suggestedVolume, dryRun);
}

main().catch(console.error);
