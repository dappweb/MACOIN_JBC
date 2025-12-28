const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🔍 深入分析流动性赎回报错问题结构...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("分析账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MC\n");

    // 合约地址
    const PROXY_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
    const MC_TOKEN_ADDRESS = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    
    // 连接合约
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const contract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    const MCToken = await ethers.getContractFactory("MockMC");
    const mcToken = MCToken.attach(MC_TOKEN_ADDRESS);
    
    console.log("📋 1. 基础状态检查");
    console.log("=".repeat(50));
    
    try {
        // 检查合约基础状态
        const redeemEnabled = await contract.redeemEnabled();
        const emergencyPaused = await contract.emergencyPaused();
        const redemptionFeePercent = await contract.redemptionFeePercent();
        const secondsInUnit = await contract.SECONDS_IN_UNIT();
        
        console.log("✅ 赎回功能启用:", redeemEnabled);
        console.log("✅ 紧急暂停状态:", emergencyPaused);
        console.log("✅ 赎回费用百分比:", redemptionFeePercent.toString() + "%");
        console.log("✅ 时间单位(秒):", secondsInUnit.toString());
        
        // 检查用户状态
        const userInfo = await contract.userInfo(deployer.address);
        const userTicket = await contract.userTicket(deployer.address);
        
        console.log("\n📊 2. 用户状态分析");
        console.log("=".repeat(50));
        console.log("推荐人:", userInfo[0]);
        console.log("活跃直推:", userInfo[1].toString());
        console.log("团队人数:", userInfo[2].toString());
        console.log("总收益:", ethers.formatEther(userInfo[3]), "MC");
        console.log("当前上限:", ethers.formatEther(userInfo[4]), "MC");
        console.log("是否活跃:", userInfo[5]);
        console.log("退款费用:", ethers.formatEther(userInfo[6]), "MC");
        console.log("最大门票金额:", ethers.formatEther(userInfo[9]), "MC");
        console.log("最大单张门票:", ethers.formatEther(userInfo[10]), "MC");
        
        console.log("\n门票信息:");
        console.log("门票ID:", userTicket[0].toString());
        console.log("门票金额:", ethers.formatEther(userTicket[1]), "MC");
        console.log("购买时间:", new Date(Number(userTicket[2]) * 1000).toLocaleString());
        console.log("是否出局:", userTicket[3]);
        
        // 检查流动性质押
        console.log("\n💰 3. 流动性质押分析");
        console.log("=".repeat(50));
        
        const stakes = [];
        let index = 0;
        
        while (index < 10) { // 最多检查10个质押
            try {
                const stakeData = await contract.userStakes(deployer.address, index);
                const stake = {
                    id: stakeData[0].toString(),
                    amount: stakeData[1],
                    startTime: Number(stakeData[2]),
                    cycleDays: Number(stakeData[3]),
                    active: stakeData[4],
                    paid: stakeData[5]
                };
                stakes.push(stake);
                
                console.log(`\n质押 #${index}:`);
                console.log("  ID:", stake.id);
                console.log("  金额:", ethers.formatEther(stake.amount), "MC");
                console.log("  开始时间:", new Date(stake.startTime * 1000).toLocaleString());
                console.log("  周期天数:", stake.cycleDays);
                console.log("  是否活跃:", stake.active);
                console.log("  已支付:", ethers.formatEther(stake.paid), "MC");
                
                // 计算到期时间和状态
                const endTime = stake.startTime + (stake.cycleDays * Number(secondsInUnit));
                const currentTime = Math.floor(Date.now() / 1000);
                const isExpired = currentTime >= endTime;
                
                console.log("  到期时间:", new Date(endTime * 1000).toLocaleString());
                console.log("  是否到期:", isExpired);
                console.log("  剩余时间:", isExpired ? "已到期" : `${Math.floor((endTime - currentTime) / 3600)}小时`);
                
                // 计算应得收益
                if (stake.active) {
                    let ratePerBillion = 0;
                    if (stake.cycleDays === 7) ratePerBillion = 13333334;
                    else if (stake.cycleDays === 15) ratePerBillion = 16666667;
                    else if (stake.cycleDays === 30) ratePerBillion = 20000000;
                    
                    const unitsPassed = Math.min(stake.cycleDays, Math.floor((currentTime - stake.startTime) / Number(secondsInUnit)));
                    const totalStaticShouldBe = (stake.amount * BigInt(ratePerBillion) * BigInt(unitsPassed)) / 1000000000n;
                    const pending = totalStaticShouldBe > stake.paid ? totalStaticShouldBe - stake.paid : 0n;
                    
                    console.log("  已过单位:", unitsPassed);
                    console.log("  应得总收益:", ethers.formatEther(totalStaticShouldBe), "MC");
                    console.log("  待领取收益:", ethers.formatEther(pending), "MC");
                    
                    // 如果到期，分析赎回条件
                    if (isExpired) {
                        console.log("\n  🔍 赎回条件分析:");
                        
                        // 计算费用
                        const feeBase = userInfo[9] > 0n ? userInfo[9] : userTicket[1]; // maxTicketAmount or ticket amount
                        const fee = (feeBase * redemptionFeePercent) / 100n;
                        console.log("    费用基数:", ethers.formatEther(feeBase), "MC");
                        console.log("    预期费用:", ethers.formatEther(fee), "MC");
                        
                        // 检查用户MC余额
                        const mcBalance = await mcToken.balanceOf(deployer.address);
                        console.log("    用户MC余额:", ethers.formatEther(mcBalance), "MC");
                        console.log("    余额是否足够:", mcBalance >= fee);
                        
                        // 检查授权
                        const allowance = await mcToken.allowance(deployer.address, PROXY_ADDRESS);
                        console.log("    当前授权:", ethers.formatEther(allowance), "MC");
                        console.log("    授权是否足够:", allowance >= fee);
                        
                        // 检查合约MC余额（用于返还本金）
                        const contractMcBalance = await mcToken.balanceOf(PROXY_ADDRESS);
                        console.log("    合约MC余额:", ethers.formatEther(contractMcBalance), "MC");
                        console.log("    合约余额是否足够返还本金:", contractMcBalance >= stake.amount);
                    }
                }
                
                index++;
            } catch (e) {
                break;
            }
        }
        
        console.log(`\n总共找到 ${stakes.length} 个质押记录`);
        
        // 分析可能的错误原因
        console.log("\n🚨 4. 潜在错误分析");
        console.log("=".repeat(50));
        
        const activeStakes = stakes.filter(s => s.active);
        const expiredStakes = stakes.filter(s => {
            const endTime = s.startTime + (s.cycleDays * Number(secondsInUnit));
            const currentTime = Math.floor(Date.now() / 1000);
            return s.active && currentTime >= endTime;
        });
        
        console.log("活跃质押数量:", activeStakes.length);
        console.log("已到期质押数量:", expiredStakes.length);
        
        if (expiredStakes.length === 0) {
            console.log("⚠️  没有可赎回的质押");
        }
        
        if (!redeemEnabled) {
            console.log("❌ 赎回功能被禁用");
        }
        
        if (emergencyPaused) {
            console.log("❌ 合约处于紧急暂停状态");
        }
        
        // 模拟赎回调用
        if (expiredStakes.length > 0 && redeemEnabled && !emergencyPaused) {
            console.log("\n🧪 5. 模拟赎回调用");
            console.log("=".repeat(50));
            
            const stakeToRedeem = expiredStakes[0];
            const stakeIndex = stakes.findIndex(s => s.id === stakeToRedeem.id);
            
            console.log(`尝试模拟赎回质押 #${stakeIndex} (ID: ${stakeToRedeem.id})`);
            
            try {
                // 使用 callStatic 模拟调用，不实际执行
                await contract.redeemStake.staticCall(stakeIndex);
                console.log("✅ 模拟赎回调用成功");
            } catch (error) {
                console.log("❌ 模拟赎回调用失败:");
                console.log("错误信息:", error.message);
                
                // 分析具体错误
                if (error.message.includes("Disabled")) {
                    console.log("🔍 错误原因: 赎回功能被禁用");
                } else if (error.message.includes("Invalid stake")) {
                    console.log("🔍 错误原因: 无效的质押ID或质押不活跃");
                } else if (error.message.includes("Not expired")) {
                    console.log("🔍 错误原因: 质押尚未到期");
                } else if (error.message.includes("Transfer failed")) {
                    console.log("🔍 错误原因: 转账失败（可能是余额不足或授权不足）");
                } else {
                    console.log("🔍 未知错误，需要进一步调试");
                }
            }
        }
        
        // 检查RedemptionLib库
        console.log("\n📚 6. RedemptionLib库分析");
        console.log("=".repeat(50));
        
        if (expiredStakes.length > 0) {
            const stake = expiredStakes[0];
            
            // 手动计算赎回参数
            const params = {
                amount: stake.amount,
                startTime: stake.startTime,
                cycleDays: stake.cycleDays,
                paid: stake.paid,
                maxTicketAmount: userInfo[9],
                fallbackAmount: userTicket[1],
                redemptionFeePercent: redemptionFeePercent,
                secondsInUnit: secondsInUnit
            };
            
            console.log("赎回参数:");
            console.log("  质押金额:", ethers.formatEther(params.amount), "MC");
            console.log("  开始时间:", new Date(params.startTime * 1000).toLocaleString());
            console.log("  周期天数:", params.cycleDays);
            console.log("  已支付:", ethers.formatEther(params.paid), "MC");
            console.log("  最大门票金额:", ethers.formatEther(params.maxTicketAmount), "MC");
            console.log("  备用金额:", ethers.formatEther(params.fallbackAmount), "MC");
            console.log("  赎回费用百分比:", params.redemptionFeePercent.toString() + "%");
            console.log("  时间单位:", params.secondsInUnit.toString(), "秒");
            
            // 手动计算结果
            const endTime = params.startTime + (params.cycleDays * Number(params.secondsInUnit));
            const currentTime = Math.floor(Date.now() / 1000);
            const canRedeem = currentTime >= endTime;
            
            console.log("\n计算结果:");
            console.log("  到期时间:", new Date(endTime * 1000).toLocaleString());
            console.log("  当前时间:", new Date(currentTime * 1000).toLocaleString());
            console.log("  可以赎回:", canRedeem);
            
            if (canRedeem) {
                let ratePerBillion = 0;
                if (params.cycleDays === 7) ratePerBillion = 13333334;
                else if (params.cycleDays === 15) ratePerBillion = 16666667;
                else if (params.cycleDays === 30) ratePerBillion = 20000000;
                
                const totalStaticShouldBe = (params.amount * BigInt(ratePerBillion) * BigInt(params.cycleDays)) / 1000000000n;
                const pending = totalStaticShouldBe > params.paid ? totalStaticShouldBe - params.paid : 0n;
                
                const feeBase = params.maxTicketAmount > 0n ? params.maxTicketAmount : params.fallbackAmount;
                const fee = (feeBase * params.redemptionFeePercent) / 100n;
                
                console.log("  待领取收益:", ethers.formatEther(pending), "MC");
                console.log("  费用基数:", ethers.formatEther(feeBase), "MC");
                console.log("  计算费用:", ethers.formatEther(fee), "MC");
            }
        }
        
    } catch (error) {
        console.error("❌ 分析过程中出现错误:", error.message);
        console.error("完整错误:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });