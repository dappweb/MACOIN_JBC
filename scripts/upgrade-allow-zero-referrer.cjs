const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("余额:", hre.ethers.formatEther(balance), "MC");

  const PROXY_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
  console.log("代理地址:", PROXY_ADDRESS);

  // 获取升级前的实现地址
  const oldImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("当前实现:", oldImpl);

  const JinbaoProtocol = await hre.ethers.getContractFactory("JinbaoProtocolNative");
  
  console.log("\n开始升级合约...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, JinbaoProtocol, {
    unsafeAllow: ["external-library-linking", "struct-definition", "enum-definition"],
  });
  await upgraded.waitForDeployment();
  
  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("✅ 升级成功!");
  console.log("旧实现:", oldImpl);
  console.log("新实现:", newImpl);

  // 验证
  const contract = await hre.ethers.getContractAt("JinbaoProtocolNative", PROXY_ADDRESS);
  const owner = await contract.owner();
  console.log("\n验证 - owner:", owner);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("升级失败:", error);
    process.exit(1);
  });
