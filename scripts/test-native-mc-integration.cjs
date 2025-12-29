const { ethers } = require("hardhat");

/**
 * 原生MC集成测试脚本
 * 测试所有核心功能是否正常工作
 */
async function main() {
  console.log("🧪 开始原生MC集成测试...");
  
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("测试账户:");
  console.log("  部署者:", deployer.address);
  console.log("  用户1:", user1.address);
  console.log("  用户2:", user2.address);

  let protocol, jbc;

  try {
    // 1. 部署合约
    console.log("\n📄 部署测试合约...");
    
    // 部署JBC代币
    const JBCv2 = await ethers.getContractFactory("JBCv2");
    jbc = await JBCv2.deploy();
    await jbc.waitForDeployment();
    console.log("✅ JBC代币部署成功:", await jbc.getAddress());

    // 部署原生MC协议
    const JinbaoProtocolNative = await ethers.getContractFactory("JinbaoProtocolNative");
    protocol = await JinbaoProtocolNative.deploy(
      await jbc.getAddress(),
      deployer.address, // marketing
      deployer.address, // treasury
      deployer.address, // lpInjection
      deployer.address  // buyback
    );
    await protocol.waitForDeployment();
    console.log("✅ 原生MC协议部署成功:", await protocol.getAddress());

    // 设置JBC铸造权限
    await jbc.setMinter(await protocol.getAddress());
    console.log("✅ JBC铸造权限设置完成");

    // 2. 添加初始流动性
    console.log("\n💧 添加初始流动性...");
    const initialMC = ethers.parseEther("10000");
    const initialJBC = ethers.parseEther("10000");
    
    await jbc.mint(deployer.address, initialJBC);
    await jbc.approve(await protocol.getAddress(), initialJBC);
    
    await protocol.addLiquidity(initialJBC, { value: initialMC });
    console.log("✅ 初始流动性添加成功");

    // 3. 测试门票购买
    console.log("\n🎫 测试门票购买...");
    const ticketAmount = ethers.parseEther("100");
    
    // 用户1购买门票
    await protocol.connect(user1).buyTicket({ value: ticketAmount });
    const user1Ticket = await protocol.userTicket(user1.address);
    console.log("✅ 用户1门票购买成功，金额:", ethers.formatEther(user1Ticket.amount));

    // 4. 测试流动性质押
    console.log("\n⛏️ 测试流动性质押...");
    const stakeAmount = ethers.parseEther("150");
    
    await protocol.connect(user1).stakeLiquidity(7, { value: stakeAmount });
    const user1Stake = await protocol.userStakes(user1.address, 0);
    console.log("✅ 用户1质押成功，金额:", ethers.formatEther(user1Stake.amount));

    // 5. 测试AMM交换
    console.log("\n🔄 测试AMM交换...");
    const swapAmount = ethers.parseEther("10");
    
    // MC → JBC
    const initialJBCBalance = await jbc.balanceOf(user2.address);
    await protocol.connect(user2).swapMCToJBC({ value: swapAmount });
    const finalJBCBalance = await jbc.balanceOf(user2.address);
    console.log("✅ MC→JBC交换成功，获得JBC:", ethers.formatEther(finalJBCBalance - initialJBCBalance));

    // JBC → MC
    const jbcSwapAmount = finalJBCBalance / 2n; // 交换一半
    await jbc.connect(user2).approve(await protocol.getAddress(), jbcSwapAmount);
    
    const initialMCBalance = await ethers.provider.getBalance(user2.address);
    const tx = await protocol.connect(user2).swapJBCToMC(jbcSwapAmount);
    const receipt = await tx.wait();
    const finalMCBalance = await ethers.provider.getBalance(user2.address);
    
    // 计算实际获得的MC（扣除Gas费用）
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const mcReceived = finalMCBalance - initialMCBalance + gasUsed;
    console.log("✅ JBC→MC交换成功，获得MC:", ethers.formatEther(mcReceived));

    // 6. 测试赎回功能
    console.log("\n💰 测试赎回功能...");
    
    // 快进时间到质押到期
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7天
    await ethers.provider.send("evm_mine");
    
    // 获取赎回费用
    const userInfo = await protocol.userInfo(user1.address);
    const redemptionFeePercent = await protocol.redemptionFeePercent();
    const expectedFee = (userInfo.maxTicketAmount * redemptionFeePercent) / 100n;
    
    const initialUser1Balance = await ethers.provider.getBalance(user1.address);
    const redeemTx = await protocol.connect(user1).redeem({ value: expectedFee });
    const redeemReceipt = await redeemTx.wait();
    const finalUser1Balance = await ethers.provider.getBalance(user1.address);
    
    // 计算净收益（扣除Gas和费用）
    const redeemGasUsed = redeemReceipt.gasUsed * redeemReceipt.gasPrice;
    const netGain = finalUser1Balance - initialUser1Balance + redeemGasUsed + expectedFee;
    console.log("✅ 赎回成功，净收益:", ethers.formatEther(netGain));

    // 7. 测试管理员功能
    console.log("\n👑 测试管理员功能...");
    
    // 提取储备
    const reserveMC = await protocol.swapReserveMC();
    const reserveJBC = await protocol.swapReserveJBC();
    
    if (reserveMC > 0 || reserveJBC > 0) {
      await protocol.withdrawSwapReserves(
        deployer.address, reserveMC,
        deployer.address, reserveJBC
      );
      console.log("✅ 储备提取成功");
    }

    // 8. 验证合约状态
    console.log("\n🔍 验证最终状态...");
    const finalReserveMC = await protocol.swapReserveMC();
    const finalReserveJBC = await protocol.swapReserveJBC();
    const owner = await protocol.owner();
    
    console.log("  最终MC储备:", ethers.formatEther(finalReserveMC));
    console.log("  最终JBC储备:", ethers.formatEther(finalReserveJBC));
    console.log("  合约拥有者:", owner);
    console.log("  拥有者匹配:", owner === deployer.address ? "✅" : "❌");

    // 9. Gas使用统计
    console.log("\n⛽ Gas使用统计:");
    console.log("  门票购买Gas:", (await protocol.connect(user1).buyTicket.estimateGas({ value: ticketAmount })).toString());
    console.log("  流动性质押Gas:", (await protocol.connect(user1).stakeLiquidity.estimateGas(7, { value: stakeAmount })).toString());
    console.log("  MC→JBC交换Gas:", (await protocol.connect(user2).swapMCToJBC.estimateGas({ value: swapAmount })).toString());

    console.log("\n🎉 所有测试通过！原生MC集成测试成功完成！");
    
    return {
      success: true,
      contracts: {
        protocol: await protocol.getAddress(),
        jbc: await jbc.getAddress()
      },
      testResults: {
        ticketPurchase: "✅ 通过",
        liquidityStaking: "✅ 通过", 
        ammSwapping: "✅ 通过",
        redemption: "✅ 通过",
        adminFunctions: "✅ 通过"
      }
    };

  } catch (error) {
    console.error("❌ 集成测试失败:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
if (require.main === module) {
  main()
    .then((result) => {
      if (result.success) {
        console.log("\n✅ 集成测试完成，所有功能正常！");
        process.exit(0);
      } else {
        console.log("\n❌ 集成测试失败！");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 测试脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { main };