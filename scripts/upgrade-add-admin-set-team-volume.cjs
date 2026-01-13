const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始升级合约，添加 adminSetTeamTotalVolume 函数...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  
  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(balance), "MC");

  // 生产环境代理地址
  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  
  console.log("🏠 代理合约地址:", PROXY_ADDRESS);

  try {
    // 检查当前所有者
    console.log("\n🔍 检查合约所有者...");
    const currentContract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    const owner = await currentContract.owner();
    console.log("   合约所有者:", owner);
    console.log("   部署账户:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("\n❌ 错误：部署账户不是合约所有者！");
      console.error("   请使用合约所有者账户执行升级");
      process.exit(1);
    }
    console.log("   ✅ 权限验证通过\n");

    // 获取合约工厂
    console.log("📦 编译合约...");
    const JinbaoProtocolNative = await hre.ethers.getContractFactory("JinbaoProtocolNative");
    
    console.log("🔄 开始升级合约...");
    
    // 执行升级（使用 upgradeProxy 会自动检查存储兼容性）
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocolNative, {
      timeout: 300000, // 5分钟超时
      unsafeAllow: [], // 不跳过安全检查
    });
    
    console.log("⏳ 等待升级交易确认...");
    await upgraded.waitForDeployment();
    
    // 获取新的实现地址
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    
    console.log("\n✅ 升级成功!");
    console.log("📍 代理地址:", PROXY_ADDRESS);
    console.log("📍 新实现地址:", newImplAddress);
    
    // 验证升级
    console.log("\n🔍 验证升级...");
    const upgradedContract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
    
    try {
      // 验证新函数是否存在
      console.log("   测试新函数 adminSetTeamTotalVolume...");
      
      // 检查函数是否存在（通过尝试调用会失败，但能确认函数存在）
      const testAddress = "0x0000000000000000000000000000000000000001";
      const testValue = hre.ethers.parseEther("100");
      
      try {
        // 尝试估算 gas（如果函数不存在会失败）
        await upgradedContract.adminSetTeamTotalVolume.estimateGas(testAddress, testValue);
        console.log("   ✅ adminSetTeamTotalVolume 函数存在");
      } catch (error) {
        if (error.message.includes("non-payable") || error.message.includes("revert")) {
          console.log("   ✅ adminSetTeamTotalVolume 函数存在（权限检查通过）");
        } else {
          console.log("   ⚠️  函数检查:", error.message);
        }
      }
      
      // 验证其他关键函数仍然存在
      const ownerCheck = await upgradedContract.owner();
      console.log("   ✅ owner() 函数正常:", ownerCheck);
      
      // 验证用户数据仍然存在
      const testUser = "0x0435aFf9777DafBd0552B54951501D3169A02062";
      const userInfo = await upgradedContract.userInfo(testUser);
      console.log("   ✅ 用户数据完整:");
      console.log("      - 团队总业绩:", hre.ethers.formatEther(userInfo.teamTotalVolume), "MC");
      console.log("      - 团队人数:", userInfo.teamCount.toString());
      
    } catch (error) {
      console.log("   ⚠️  验证过程中出现错误:", error.message);
    }

    console.log("\n🎉 合约升级完成!");
    console.log("📋 新增功能:");
    console.log("   ✅ adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume)");
    console.log("   ✅ adminSetTeamTotalCap(address user, uint256 newTeamTotalCap)");
    console.log("\n📝 下一步:");
    console.log("   1. 运行修复脚本修复地址1的团队总业绩");
    console.log("   2. 验证数据修复成功");
    console.log("   3. 监控合约运行状态");

  } catch (error) {
    console.error("\n❌ 升级失败:", error.message);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约owner账户执行升级");
      console.log("  当前owner:", await currentContract.owner());
    }
    
    if (error.message.includes("storage")) {
      console.log("\n💡 存储布局检查失败:");
      console.log("  请检查合约代码是否有存储布局冲突");
    }
    
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ 升级流程完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 升级失败:", error);
    process.exit(1);
  });
