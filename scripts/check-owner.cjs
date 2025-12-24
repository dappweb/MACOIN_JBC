const hre = require("hardhat");

async function main() {
  const protocolAddress = "0x6ca5Bf30BC2C43Fc172A4B81C246eb351E94480B"; // MC Chain Address
  const Protocol = await hre.ethers.getContractFactory("JinbaoProtocol");
  const protocol = Protocol.attach(protocolAddress);

  const owner = await protocol.owner();
  console.log("Protocol Owner:", owner);
  
  const targetAdmin = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
  if (owner.toLowerCase() === targetAdmin.toLowerCase()) {
      console.log("✅ YES, 0x4C10... is the Admin.");
  } else {
      console.log("❌ NO, 0x4C10... is NOT the Admin.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
