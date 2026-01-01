require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          viaIR: true, // Enable IR-based code generation to avoid "Stack too deep" errors
        },
      },
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          viaIR: true, // Enable IR-based code generation to avoid "Stack too deep" errors
        },
      },
    ],
  },
  paths: {
    root: path.resolve(__dirname, ".."),
    sources: path.resolve(__dirname, "../contracts"),
    tests: path.resolve(__dirname, "../test"),
    cache: path.resolve(__dirname, "../cache"),
    artifacts: path.resolve(__dirname, "../artifacts")
  },
  networks: {
    hardhat: {
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/1a10a13df2cc454ead9480743d1c09e1",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60000, // Increase timeout to 60 seconds
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    mc: {
      url: "https://chain.mcerscan.com/",
      chainId: 88813,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 300000,
    },
  },
};
