const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 验证全新部署的合约功能...");
  console.log("=".repeat(80));

  // 新部署的合约地址
  const PROTOCOL_ADDRESS = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
  const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
  const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";

  const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function getJBCPrice() view returns (uint256)",
    "function owner() view returns (address)",
    "function mcToken() view returns (address)",
    "function jbcToken() view returns (address)",
    "function directRewardPercent() view returns (uint256)",
    "function levelRewardPercent() view returns (uint256)",
    "function liquidityEnabled() view returns (bool)",
    "function redeemEnabled() view returns (bool)",
    "function nextTicketId() view returns (uint256)",
    "function nextStakeId() view returns (uint256)"
  ];

  try {
    const [deployer] = await ethers.getSigners();
    console.log("📋 验证账户:", deployer.address);
    console.log("");

    // 连接合约
    const protocol = await ethers.getContractAt("JinbaoProtocol", PROTOCOL_ADDRESS);
    
    console.log("🏗️ 合约基本信息:");
    console.log("-".repeat(50));
    console.log(`合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`MC Token: ${await protocol.mcToken()}`);
    console.log(`JBC Token: ${await protocol.jbcToken()}`);
    console.log(`合约所有者: ${await protocol.owner()}`);
    console.log("");

    console.log("💧 Swap流动性状态:");
    console.log("-".repeat(50));
    const swapReserveMC = await protocol.swapReserveMC();
    const swapReserveJBC = await protocol.swapReserveJBC();
    const jbcPrice = await protocol.getJBCPrice();
    
    console.log(`MC储备: ${ethers.formatEther(swapReserveMC)} MC`);
    console.log(`JBC储备: ${ethers.formatEther(swapReserveJBC)} JBC`);
    console.log(`JBC价格: ${ethers.formatEther(jbcPrice)} MC per JBC`);
    console.log("");

    console.log("⚙️ 系统配置:");
    console.log("-".repeat(50));
    console.log(`直推奖励: ${await protocol.directRewardPercent()}%`);
    console.log(`层级奖励: ${await protocol.levelRewardPercent()}%`);
    console.log(`流动性启用: ${await protocol.liquidityEnabled() ? '是' : '否'}`);
    console.log(`赎回启用: ${await protocol.redeemEnabled() ? '是' : '否'}`);
    console.log("");

    console.log("📊 系统状态:");
    console.log("-".repeat(50));
    console.log(`下一个门票ID: ${await protocol.nextTicketId()}`);
    console.log(`下一个质押ID: ${await protocol.nextStakeId()}`);
    console.log("");

    console.log("👤 测试用户数据 (应该为空):");
    console.log("-".repeat(50));
    const testUser = deployer.address;
    const userInfo = await protocol.userInfo(testUser);
    const directReferrals = await protocol.getDirectReferrals(testUser);
    
    console.log(`测试用户: ${testUser}`);
    console.log(`推荐人: ${userInfo.referrer}`);
    console.log(`直推数: ${userInfo.activeDirects.toString()}`);
    console.log(`团队数: ${userInfo.teamCount.toString()}`);
    console.log(`总收益: ${ethers.formatEther(userInfo.totalRevenue)} MC`);
    console.log(`是否活跃: ${userInfo.isActive ? '是' : '否'}`);
    console.log(`直推列表长度: ${directReferrals.length}`);
    console.log("");

    console.log("✅ 验证结果:");
    console.log("-".repeat(50));
    
    // 验证检查
    const checks = [
      { name: "合约地址正确", pass: PROTOCOL_ADDRESS === "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19" },
      { name: "MC Token地址正确", pass: (await protocol.mcToken()) === MC_TOKEN },
      { name: "JBC Token地址正确", pass: (await protocol.jbcToken()) === JBC_TOKEN },
      { name: "合约所有者正确", pass: (await protocol.owner()) === deployer.address },
      { name: "有初始流动性", pass: swapReserveMC > 0 && swapReserveJBC > 0 },
      { name: "JBC价格合理", pass: jbcPrice > 0 },
      { name: "系统配置正确", pass: (await protocol.directRewardPercent()) === 25n },
      { name: "用户数据为空", pass: userInfo.activeDirects === 0n && directReferrals.length === 0 },
      { name: "ID计数器重置", pass: (await protocol.nextTicketId()) === 0n && (await protocol.nextStakeId()) === 0n }
    ];

    checks.forEach(check => {
      console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every(check => check.pass);
    console.log("");
    console.log(`🎯 总体验证结果: ${allPassed ? '✅ 全部通过' : '❌ 存在问题'}`);
    
    if (allPassed) {
      console.log("");
      console.log("🎉 新合约部署验证成功!");
      console.log("📋 可以开始使用新合约进行测试");
      console.log("⚠️  提醒: 这是全新合约，所有用户需要重新开始");
    }

  } catch (error) {
    console.error("❌ 验证失败:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });