const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(__dirname, "../deployments/latest-mc.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ 找不到部署文件:", deploymentPath);
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const protocolAddress = deployment.protocolProxy || deployment.protocol;
  
  console.log(`Checking Protocol at: ${protocolAddress}`);
  const protocol = await hre.ethers.getContractAt("JinbaoProtocol", protocolAddress);
  
  try {
    const owner = await protocol.owner();
    console.log(`Contract Owner: ${owner}`);
    
    const [signer] = await hre.ethers.getSigners();
    console.log(`Your Address:   ${signer.address}`);

    if (owner.toLowerCase() === signer.address.toLowerCase()) {
        console.log("✅ MATCH: You are the owner.");
    } else {
        console.log("❌ MISMATCH: You are NOT the owner!");
    }
  } catch (error) {
    console.error("Error fetching owner:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
