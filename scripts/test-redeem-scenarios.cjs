const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 测试流动性赎回各种错误场景...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("测试账户:", deployer.address);
    
    // 合约地址
    const PROXY_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
    const MC_TOKEN_ADDRESS = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    
    // 连接合约
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    const contract = JinbaoProtocol.attach(PROXY_ADDRESS);
    
    const MCToken = await ethers.getContractFactory("MockMC");
    const mcToken = MCToken.attach(MC_TOKEN_ADDRESS);
    
    console.log("📋 测试场景1: 检查合约基础状态");
    console.log("=".repeat(50));
    
    try {
        const redeemEnabled = await contract.redeemEnabled();
        const emergencyPaused = await contract.emergencyPaused();
        const redemptionFeePercent = await contract.redemptionFeePercent();
        const secondsInUnit = await contract.SECONDS_IN_UNIT();
        
        console.log("✅ 赎回功能启用:", redeemEnabled);
        console.log("✅ 紧急暂停状态:", emergencyPaused);
        console.log("✅ 赎回费用百分比:", redemptionFeePercent.toString() + "%");
        console.log("✅ 时间单位(秒):", secondsInUnit.toString());
        
        if (!redeemEnabled) {
            console.log("❌ 测试终止: 赎回功能被禁用");
            return;
        }
        
        if (emergencyPaused) {
            console.log("❌ 测试终止: 合约处于紧急暂停状态");
            return;
        }
        
    } catch (error) {
        console.error("❌ 基础状态检查失败:", error.message);
        return;
    }
    
    console.log("\n📋 测试场景2: 创建测试质押");
    console.log("=".repeat(50));
    
    try {
        // 检查用户是否有门票
        const userTicket = await contract.userTicket(deployer.address);
        console.log("当前门票金额:", ethers.formatEther(userTicket[1]), "MC");
        
        if (userTicket[1] === 0n) {
            console.log("🎫 需要先购买门票...");
            
            // 检查MC余额
            const mcBalance = await mcToken.balanceOf(deployer.address);
            console.log("MC余额:", ethers.formatEther(mcBalance), "MC");
            
            if (mcBalance < ethers.parseEther("100")) {
                console.log("❌ MC余额不足，无法购买门票");
                return;
            }
            
            // 检查授权
            const allowance = await mcToken.allowance(deployer.address, PROXY_ADDRESS);
            if (allowance < ethers.parseEther("100")) {
                console.log("💰 授权MC代币...");
                const approveTx = await mcToken.approve(PROXY_ADDRESS, ethers.parseEther("1000"));
                await approveTx.wait();
                console.log("✅ 授权成功");
            }
            
            // 购买门票
            console.log("🎫 购买100 MC门票...");
            const buyTx = await contract.buyTicket(ethers.parseEther("100"));
            await buyTx.wait();
            console.log("✅ 门票购买成功");
        }
        
        // 检查是否有活跃质押
        const stakes = [];
        let index = 0;
        
        while (index < 5) {
            try {
                const stakeData = await contract.userStakes(deployer.address, index);
                if (stakeData[4]) { // active
                    stakes.push({
                        index,
                        id: stakeData[0].toString(),
                        amount: stakeData[1],
                        startTime: Number(stakeData[2]),
                        cycleDays: Number(stakeData[3]),
                        active: stakeData[4],
                        paid: stakeData[5]
                    });
                }
                index++;
            } catch (e) {
                break;
            }
        }
        
        console.log(`找到 ${stakes.length} 个活跃质押`);
        
        if (stakes.length === 0) {
            console.log("💰 创建测试质押...");
            
            // 获取用户信息计算所需质押金额
            const userInfo = await contract.userInfo(deployer.address);
            const maxSingleTicket = userInfo[10]; // maxSingleTicketAmount
            const requiredAmount = maxSingleTicket > 0n ? (maxSingleTicket * 150n) / 100n : ethers.parseEther("150");
            
            console.log("所需质押金额:", ethers.formatEther(requiredAmount), "MC");
            
            // 检查余额和授权
            const mcBalance = await mcToken.balanceOf(deployer.address);
            if (mcBalance < requiredAmount) {
                console.log("❌ MC余额不足，无法创建质押");
                return;
            }
            
            const allowance = await mcToken.allowance(deployer.address, PROXY_ADDRESS);
            if (allowance < requiredAmount) {
                console.log("💰 授权更多MC代币...");
                const approveTx = await mcToken.approve(PROXY_ADDRESS, requiredAmount * 2n);
                await approveTx.wait();
                console.log("✅ 授权成功");
            }
            
            // 创建7天质押（最短周期，便于测试）
            console.log("💰 创建7天质押...");
            const stakeTx = await contract.stakeLiquidity(requiredAmount, 7);
            await stakeTx.wait();
            console.log("✅ 质押创建成功");
            
            // 重新获取质押信息
            const newStakeData = await contract.userStakes(deployer.address, 0);
            stakes.push({
                index: 0,
                id: newStakeData[0].toString(),
                amount: newStakeData[1],
                startTime: Number(newStakeData[2]),
                cycleDays: Number(newStakeData[3]),
                active: newStakeData[4],
                paid: newStakeData[5]
            });
        }
        
        console.log("\n📋 测试场景3: 赎回错误场景测试");
        console.log("=".repeat(50));
        
        const testStake = stakes[0];
        const secondsInUnit = await contract.SECONDS_IN_UNIT();
        const endTime = testStake.startTime + (testStake.cycleDays * Number(secondsInUnit));
        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = currentTime >= endTime;
        
        console.log("测试质押信息:");
        console.log("  索引:", testStake.index);
        console.log("  ID:", testStake.id);
        console.log("  金额:", ethers.formatEther(testStake.amount), "MC");
        console.log("  开始时间:", new Date(testStake.startTime * 1000).toLocaleString());
        console.log("  到期时间:", new Date(endTime * 1000).toLocaleString());
        console.log("  是否到期:", isExpired);
        console.log("  剩余时间:", isExpired ? "已到期" : `${Math.floor((endTime - currentTime) / 60)}分钟`);
        
        // 测试场景3.1: 质押未到期时尝试赎回
        if (!isExpired) {
            console.log("\n🧪 测试场景3.1: 质押未到期赎回");
            try {
                await contract.redeemStake.staticCall(testStake.index);
                console.log("❌ 意外成功: 应该失败但成功了");
            } catch (error) {
                if (error.message.includes("Not expired")) {
                    console.log("✅ 正确失败: Not expired");
                } else {
                    console.log("❓ 其他错误:", error.message);
                }
            }
        }
        
        // 测试场景3.2: 无效质押ID
        console.log("\n🧪 测试场景3.2: 无效质押ID");
        try {
            await contract.redeemStake.staticCall(999); // 不存在的索引
            console.log("❌ 意外成功: 应该失败但成功了");
        } catch (error) {
            if (error.message.includes("Invalid stake")) {
                console.log("✅ 正确失败: Invalid stake");
            } else {
                console.log("❓ 其他错误:", error.message);
            }
        }
        
        // 测试场景3.3: 费用计算验证
        console.log("\n🧪 测试场景3.3: 费用计算验证");
        const userInfo = await contract.userInfo(deployer.address);
        const userTicketInfo = await contract.userTicket(deployer.address);
        const redemptionFeePercent = await contract.redemptionFeePercent();
        
        // 使用正确的费用基数计算
        const feeBase = userInfo[9] > 0n ? userInfo[9] : userTicketInfo[1]; // maxTicketAmount or ticket amount
        const expectedFee = (feeBase * redemptionFeePercent) / 100n;
        
        console.log("费用计算:");
        console.log("  最大门票金额:", ethers.formatEther(userInfo[9]), "MC");
        console.log("  当前门票金额:", ethers.formatEther(userTicketInfo[1]), "MC");
        console.log("  费用基数:", ethers.formatEther(feeBase), "MC");
        console.log("  费用百分比:", redemptionFeePercent.toString() + "%");
        console.log("  预期费用:", ethers.formatEther(expectedFee), "MC");
        
        // 检查用户余额和授权
        const mcBalance = await mcToken.balanceOf(deployer.address);
        const allowance = await mcToken.allowance(deployer.address, PROXY_ADDRESS);
        
        console.log("用户状态:");
        console.log("  MC余额:", ethers.formatEther(mcBalance), "MC");
        console.log("  授权额度:", ethers.formatEther(allowance), "MC");
        console.log("  余额足够:", mcBalance >= expectedFee);
        console.log("  授权足够:", allowance >= expectedFee);
        
        // 测试场景3.4: 余额不足场景（如果需要）
        if (expectedFee > 0n && mcBalance < expectedFee) {
            console.log("\n🧪 测试场景3.4: 余额不足");
            try {
                await contract.redeemStake.staticCall(testStake.index);
                console.log("❌ 意外成功: 应该因余额不足失败");
            } catch (error) {
                console.log("✅ 正确失败:", error.message);
            }
        }
        
        // 测试场景3.5: 授权不足场景（如果需要）
        if (expectedFee > 0n && allowance < expectedFee) {
            console.log("\n🧪 测试场景3.5: 授权不足");
            try {
                await contract.redeemStake.staticCall(testStake.index);
                console.log("❌ 意外成功: 应该因授权不足失败");
            } catch (error) {
                console.log("✅ 正确失败:", error.message);
            }
        }
        
        // 如果质押已到期且条件满足，测试正常赎回
        if (isExpired && mcBalance >= expectedFee && allowance >= expectedFee) {
            console.log("\n🧪 测试场景3.6: 正常赎回流程");
            try {
                await contract.redeemStake.staticCall(testStake.index);
                console.log("✅ 模拟赎回成功");
                
                // 询问是否执行实际赎回
                console.log("\n❓ 是否执行实际赎回? (需要手动确认)");
                console.log("   如需执行，请运行: await contract.redeemStake(" + testStake.index + ")");
                
            } catch (error) {
                console.log("❌ 模拟赎回失败:", error.message);
            }
        }
        
        console.log("\n📋 测试场景4: 前端错误处理验证");
        console.log("=".repeat(50));
        
        // 模拟前端错误处理逻辑
        const simulateError = (errorMessage) => {
            console.log(`模拟错误: ${errorMessage}`);
            
            if (errorMessage.includes("Invalid stake")) {
                console.log("  -> 前端提示: 质押无效，请刷新页面重试");
            } else if (errorMessage.includes("Not expired")) {
                console.log("  -> 前端提示: 质押尚未到期，请等待到期后再试");
            } else if (errorMessage.includes("Disabled")) {
                console.log("  -> 前端提示: 赎回功能暂时禁用，请联系管理员");
            } else if (errorMessage.includes("Transfer failed")) {
                console.log("  -> 前端提示: 转账失败，请检查余额和授权");
            } else {
                console.log("  -> 前端提示: 通用错误处理");
            }
        };
        
        simulateError("execution reverted: Invalid stake");
        simulateError("execution reverted: Not expired");
        simulateError("execution reverted: Disabled");
        simulateError("execution reverted: Transfer failed");
        
    } catch (error) {
        console.error("❌ 测试过程中出现错误:", error.message);
        console.error("完整错误:", error);
    }
    
    console.log("\n✅ 测试完成");
    console.log("📝 建议检查项目:");
    console.log("1. 前端费用基数计算是否正确");
    console.log("2. 时间单位理解是否正确 (60秒 vs 86400秒)");
    console.log("3. 质押ID与数组索引映射是否正确");
    console.log("4. 错误处理是否提供有用信息");
    console.log("5. 用户余额和授权检查是否充分");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });