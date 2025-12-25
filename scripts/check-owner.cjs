const hre = require("hardhat");

async function main() {
  const protocolAddress = "0x51577047B8dc22C53b31F986441656B3AEAc2263";
  const protocol = await hre.ethers.getContractAt("JinbaoProtocol", protocolAddress);
  
  try {
    const owner = await protocol.owner();
    console.log(`Contract Owner: ${owner}`);
    
    const expectedOwner = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
    if (owner.toLowerCase() === expectedOwner.toLowerCase()) {
        console.log("MATCH: Owner matches expected address.");
    } else {
        console.log("MISMATCH: Owner DOES NOT match expected address!");
    }
  } catch (error) {
    console.error("Error fetching owner:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
