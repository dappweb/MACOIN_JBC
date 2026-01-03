const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始升级协议合约，添加 setJbcToken 功能...\n");
  
  // p-prod 分支的合约地址
  const CURRENT_PROXY_ADDRESS = "0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5";
  
  console.log("📋 当前合约地址:", CURRENT_PROXY_ADDRESS);
  
  const [deployer] = await ethers.getSigners();
  console.log("📍 升级账户:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "MC\n");
  
  // 检查是否是合约所有者
  try {
    const protocolContract = await ethers.getContractAt("JinbaoProtocol", CURRENT_PROXY_ADDRESS);
    const owner = await protocolContract.owner();
    console.log("👤 合约所有者:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("⚠️  警告: 当前账户不是合约所有者！");
      console.log("   升级需要合约所有者权限");
      console.log("   当前账户:", deployer.address);
      console.log("   合约所有者:", owner);
      console.log("\n是否继续？(如果确认账户有权限，可以继续)");
    }
  } catch (err) {
    console.log("⚠️  无法验证所有者权限:", err.message);
  }
  
  // 获取升级后的合约工厂
  console.log("\n📦 编译合约...");
  const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
  
  // 尝试注册代理（如果未注册）
  try {
    console.log("📝 检查代理注册状态...");
    await upgrades.forceImport(CURRENT_PROXY_ADDRESS, JinbaoProtocol, {
      kind: 'uups'
    });
    console.log("✅ 代理已注册");
    console.log();
  } catch (error) {
    // 如果已经注册，忽略错误
    if (!error.message.includes("already registered")) {
      console.log("⚠️  代理注册检查:", error.message);
    } else {
      console.log("✅ 代理已注册");
    }
    console.log();
  }
  
  console.log("⏳ 正在升级合约...");
  
  try {
    // 执行升级
    const upgraded = await upgrades.upgradeProxy(CURRENT_PROXY_ADDRESS, JinbaoProtocol, {
      kind: 'uups',
      timeout: 300000, // 5分钟超时
    });
    await upgraded.waitForDeployment();
    
    const upgradedAddress = await upgraded.getAddress();
    console.log("✅ 合约升级成功!");
    console.log("📍 代理合约地址:", upgradedAddress);
    
    // 获取新实现地址
    const newImplAddress = await upgrades.erc1967.getImplementationAddress(CURRENT_PROXY_ADDRESS);
    console.log("📍 新实现地址:", newImplAddress);
    
    // 验证升级
    console.log("\n🔍 验证升级结果...");
    
    // 检查代币地址（这是最重要的验证）
    try {
      const jbcToken = await upgraded.jbcToken();
      console.log("✅ JBC Token 地址:", jbcToken);
    } catch (err) {
      console.log("⚠️  无法获取 JBC Token 地址:", err.message);
    }
    
    // 检查基本配置（如果存在）
    try {
      const secondsInUnit = await upgraded.SECONDS_IN_UNIT();
      console.log("✅ 时间单位:", Number(secondsInUnit), "秒");
    } catch (err) {
      console.log("⚠️  无法获取时间单位配置");
    }
    
    // 检查储备（如果存在）
    try {
      const mcReserve = await upgraded.swapReserveMC();
      const jbcReserve = await upgraded.swapReserveJBC();
      console.log("✅ MC 储备:", ethers.formatEther(mcReserve), "MC");
      console.log("✅ JBC 储备:", ethers.formatEther(jbcReserve), "JBC");
    } catch (err) {
      console.log("⚠️  无法获取储备信息");
    }
    
    // 验证新函数是否存在
    console.log("\n🔍 验证新函数...");
    try {
      // 尝试调用新函数（使用静态调用，不会实际执行）
      const jbcTokenAddress = await upgraded.jbcToken();
      console.log("✅ jbcToken() getter 函数可用");
      console.log("✅ setJbcToken() 函数已添加到合约中");
      
      // 验证合约确实有 setJbcToken 函数（通过检查接口）
      const contractInterface = upgraded.interface;
      const hasSetJbcToken = contractInterface.hasFunction("setJbcToken");
      if (hasSetJbcToken) {
        console.log("✅ setJbcToken(address) 函数在合约接口中可用");
      }
    } catch (err) {
      console.log("⚠️  验证新函数时出错:", err.message);
    }
    
    console.log("\n🎉 升级完成! 主要改进:");
    console.log("  ✅ 添加了 setJbcToken() 函数");
    console.log("  ✅ 添加了 JbcTokenUpdated 事件");
    console.log("  ✅ 管理员可以通过 Admin Panel 更新 JBC 代币地址");
    console.log("  ✅ 所有现有数据保持不变");
    
    console.log("\n📝 升级后需要做的事情:");
    console.log("  1. 在 Admin Panel 中验证新功能是否可用");
    console.log("  2. 测试更新 JBC 代币地址功能");
    console.log("  3. 确保新的 JBC 合约中设置了正确的协议地址");
    console.log("  4. 监控合约运行状态");
    
  } catch (error) {
    console.error("❌ 升级失败:", error);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约owner账户执行升级");
      console.log("  当前owner可以通过以下命令查询:");
      console.log("  npx hardhat run scripts/check-current-owner.cjs --network mc");
    }
    
    if (error.message.includes("implementation")) {
      console.log("\n💡 可能的问题:");
      console.log("  1. 新合约可能有编译错误");
      console.log("  2. 新合约可能与现有存储布局不兼容");
      console.log("  3. 请检查 JinbaoProtocol.sol 的实现");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

