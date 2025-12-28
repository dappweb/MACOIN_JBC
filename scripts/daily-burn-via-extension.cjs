const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔥 通过扩展合约执行每日燃烧");
    console.log("==============================");
    
    const [signer] = await ethers.getSigners();
    console.log("👤 执行者:", signer.address);
    
    try {
        // 读取扩展合约地址
        let extensionAddress;
        try {
            const deploymentInfo = JSON.parse(fs.readFileSync('deployments/daily-burn-extension.json', 'utf8'));
            extensionAddress = deploymentInfo.extensionAddress;
            console.log("📋 扩展合约地址:", extensionAddress);
        } catch (e) {
            console.error("❌ 未找到扩展合约部署信息");
            console.log("💡 请先运行: node scripts/add-daily-burn-to-protocol.cjs");
            return;
        }
        
        // 连接扩展合约
        const extensionAbi = [
            "function dailyBurn() external",
            "function canBurn() external view returns (bool)",
            "function nextBurnTime() external view returns (uint256)",
            "function getBurnAmount() external view returns (uint256)",
            "event DailyBurnExecuted(uint256 burnAmount, uint256 timestamp)"
        ];
        
        const extension = new ethers.Contract(extensionAddress, extensionAbi, signer);
        
        // 检查燃烧条件
        console.log("\n🔍 检查燃烧条件...");
        
        const canBurn = await extension.canBurn();
        console.log("   可以燃烧:", canBurn);
        
        if (!canBurn) {
            const nextBurnTime = await extension.nextBurnTime();
            const nextBurnDate = new Date(Number(nextBurnTime) * 1000);
            const now = new Date();
            const waitHours = (nextBurnTime * 1000 - now.getTime()) / (1000 * 60 * 60);
            
            console.log("   下次燃烧时间:", nextBurnDate.toISOString());
            console.log("   还需等待:", waitHours.toFixed(2), "小时");
            return;
        }
        
        const burnAmount = await extension.getBurnAmount();
        console.log("   将燃烧数量:", ethers.formatEther(burnAmount), "JBC");
        
        if (burnAmount === 0n) {
            console.log("❌ 没有JBC可燃烧");
            return;
        }
        
        // 执行燃烧
        console.log("\n🔥 执行每日燃烧...");
        
        try {
            const tx = await extension.dailyBurn();
            console.log("📝 交易哈希:", tx.hash);
            
            console.log("⏳ 等待交易确认...");
            const receipt = await tx.wait();
            
            console.log("✅ 燃烧成功!");
            console.log("   区块号:", receipt.blockNumber);
            console.log("   Gas 使用:", receipt.gasUsed.toString());
            
            // 解析事件
            const events = receipt.logs.filter(log => {
                try {
                    return extension.interface.parseLog(log);
                } catch {
                    return false;
                }
            });
            
            for (const event of events) {
                const parsed = extension.interface.parseLog(event);
                if (parsed.name === 'DailyBurnExecuted') {
                    console.log("🔥 燃烧事件:");
                    console.log("   燃烧数量:", ethers.formatEther(parsed.args.burnAmount), "JBC");
                    console.log("   时间戳:", new Date(Number(parsed.args.timestamp) * 1000).toISOString());
                }
            }
            
        } catch (error) {
            console.error("❌ 燃烧失败:", error.message);
            
            if (error.message.includes("Early")) {
                console.log("💡 原因: 距离上次燃烧不足24小时");
            } else if (error.message.includes("No JBC")) {
                console.log("💡 原因: 池子中没有JBC代币");
            } else {
                console.log("💡 详细错误:", error);
            }
        }
        
    } catch (error) {
        console.error("❌ 脚本执行失败:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });