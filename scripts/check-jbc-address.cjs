const { ethers } = require("hardhat");

async function main() {
  const PROTOCOL = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
  const protocol = await ethers.getContractAt("JinbaoProtocolV4", PROTOCOL);
  const owner = await protocol.owner();
  const jbc = await protocol.jbcToken();
  console.log("Owner:", owner);
  console.log("Protocol.jbcToken:", jbc);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
