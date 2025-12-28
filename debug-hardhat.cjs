const hre = require("hardhat");

async function main() {
  console.log("Debugging Hardhat configuration...");
  
  console.log("Hardhat config paths:", hre.config.paths);
  console.log("Sources path:", hre.config.paths.sources);
  console.log("Artifacts path:", hre.config.paths.artifacts);
  
  // Try to get source names
  try {
    const sourceNames = await hre.run("compile:solidity:get-source-names");
    console.log("Source names found:", sourceNames);
  } catch (error) {
    console.error("Error getting source names:", error.message);
  }
}

main().catch(console.error);