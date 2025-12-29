// 激活极差奖励的部署脚本
import pkg from "hardhat";
const { ethers, upgrades } = pkg;

async function main() {
  console.log("🚀 开始激活极差奖励功能...\n");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("📝 部署者地址:", deployer.address);
  console.log("💰 部署者余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // 合约地址（MC Chain上的代理合约地址）
  const PROXY_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";

  try {
    // 获取合约工厂
    const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
    
    console.log("🔄 升级合约以激活极差奖励...");
    
    // 升级合约
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol);
    await upgraded.waitForDeployment();
    
    console.log("✅ 合约升级成功!");
    console.log("📍 代理合约地址:", PROXY_ADDRESS);
    console.log("📍 新实现合约地址:", await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS));
    
    // 验证极差奖励功能
    console.log("\n🔍 验证极差奖励功能...");
    
    const contract = await ethers.getContractAt("JinbaoProtocol", PROXY_ADDRESS);
    
    // 测试等级计算函数
    const testCounts = [10, 100, 1000, 10000];
    for (const count of testCounts) {
      const level = await contract.calculateLevel(count);
      console.log(`✅ 团队${count}人 → V${level[0]} (${level[1]}% 极差收益)`);
    }
    
    console.log("\n🎉 极差奖励功能激活完成!");
    console.log("\n📋 激活内容:");
    console.log("  ✅ 质押时计算极差奖励");
    console.log("  ✅ 领取奖励时发放极差奖励");
    console.log("  ✅ 赎回时发放极差奖励");
    console.log("  ✅ V等级体系完整支持");
    
    console.log("\n💡 下一步:");
    console.log("  1. 用户进行新的质押操作");
    console.log("  2. 系统将自动计算极差奖励");
    console.log("  3. 质押周期结束时发放奖励");
    console.log("  4. 前端将显示极差奖励记录");

  } catch (error) {
    console.error("❌ 升级失败:", error);
    
    if (error.message.includes("not the owner")) {
      console.log("\n💡 解决方案:");
      console.log("  请确保使用合约所有者账户进行部署");
    } else if (error.message.includes("network")) {
      console.log("\n💡 解决方案:");
      console.log("  请检查网络连接和RPC配置");
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