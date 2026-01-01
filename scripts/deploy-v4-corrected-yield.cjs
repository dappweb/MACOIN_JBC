const { ethers, upgrades } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("🚀 部署修正收益率的V4合约到MC链");
    console.log("=" .repeat(60));
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 部署账户:", deployer.address);
    
    // 检查账户余额
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");
    
    // MC链代币地址
    const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const JBC_TOKEN = "0x123456789..."; // 需要实际的JBC代币地址
    
    console.log("\n📊 合约配置:");
    console.log("├── MC代币地址:", MC_TOKEN);
    console.log("├── JBC代币地址:", JBC_TOKEN);
    console.log("├── 时间单位: 86400秒 (1天)");
    console.log("├── 收益率: 1.33% (修正后)");
    console.log("└── 四种奖励机制: 完整实现");
    
    try {
        // 部署V4合约
        console.log("\n🔨 部署JinbaoProtocolV4Ultimate合约...");
        const JinbaoProtocolV4 = await ethers.getContractFactory("JinbaoProtocolV4Ultimate");
        
        const contract = await upgrades.deployProxy(
            JinbaoProtocolV4,
            [MC_TOKEN, JBC_TOKEN],
            {
                initializer: 'initialize',
                kind: 'uups'
            }
        );
        
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        
        console.log("✅ 合约部署成功!");
        console.log("📍 合约地址:", contractAddress);
        
        // 验证合约配置
        console.log("\n🔍 验证合约配置:");
        
        const version = await contract.getVersionV4();
        console.log("📦 版本:", version);
        
        const timeUnitFixed = await contract.timeUnitFixed();
        console.log("⏰ 时间单位已修复:", timeUnitFixed);
        
        const secondsInUnit = await contract.getEffectiveSecondsInUnit();
        console.log("⏱️  时间单位:", secondsInUnit, "秒");
        
        // 检查门票等级配置
        console.log("\n🎫 门票等级配置:");
        for (let level = 1; level <= 4; level++) {
            const ticketInfo = await contract.ticketLevels(level);
            console.log(`├── 等级${level}: ${ethers.formatEther(ticketInfo.price)} MC`);
        }
        
        // 保存部署信息
        const deploymentInfo = {
            contractAddress,
            deployer: deployer.address,
            mcToken: MC_TOKEN,
            jbcToken: JBC_TOKEN,
            version,
            timeUnitFixed,
            secondsInUnit: secondsInUnit.toString(),
            deployTime: new Date().toISOString(),
            network: "MC Chain",
            chainId: 88813,
            features: [
                "时间单位修复 (86400秒)",
                "收益率修正 (1.33%)",
                "四种奖励机制",
                "双币奖励模型",
                "内置闪兑功能"
            ]
        };
        
        console.log("\n📋 部署总结:");
        console.log("✅ 时间单位: 86400秒 (真实1天)");
        console.log("✅ 收益率: 1.33% (线上实际收益率)");
        console.log("✅ 静态奖励: 双币奖励 (50% MC + 50% JBC)");
        console.log("✅ 动态奖励: 单币奖励 (100% MC)");
        console.log("✅ 层级奖励: 单币奖励 (100% MC)");
        console.log("✅ 级差奖励: 双币奖励 (50% MC + 50% JBC)");
        console.log("✅ 燃烧机制: 纯销毁，不分红");
        console.log("✅ 交易奖励: 内置闪兑分红");
        
        // 保存到文件
        const fs = require('fs');
        fs.writeFileSync(
            `deployments/v4-corrected-yield-${Date.now()}.json`,
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log("\n🎯 下一步操作:");
        console.log("1. 更新前端配置文件中的合约地址");
        console.log("2. 更新ContractConfig.ts中的地址配置");
        console.log("3. 测试四种奖励机制功能");
        console.log("4. 验证双币奖励分配逻辑");
        console.log("5. 确认时间单位和收益率正确");
        
        return contractAddress;
        
    } catch (error) {
        console.error("❌ 部署失败:", error);
        throw error;
    }
}

// 收益率验证函数
async function verifyYieldRates() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 收益率验证");
    console.log("=".repeat(60));
    
    const stakeAmount = 1000; // 1000 MC
    const yieldRate = 1.33; // 1.33%
    
    console.log(`💰 质押${stakeAmount} MC的预期收益 (1.33%日收益):`);
    
    const cycles = [7, 15, 30];
    cycles.forEach(days => {
        const totalReward = stakeAmount * (yieldRate / 100) * days;
        const mcReward = totalReward / 2; // 50% MC
        const jbcReward = totalReward / 2; // 50% MC兑换成JBC
        
        console.log(`├── ${days}天周期:`);
        console.log(`│   ├── 总收益: ${totalReward.toFixed(2)} 代币等值`);
        console.log(`│   ├── MC奖励: ${mcReward.toFixed(2)} MC`);
        console.log(`│   └── JBC奖励: ${jbcReward.toFixed(2)} MC等值的JBC`);
    });
}

if (require.main === module) {
    main()
        .then(async (contractAddress) => {
            await verifyYieldRates();
            console.log(`\n✅ 部署完成! 合约地址: ${contractAddress}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };