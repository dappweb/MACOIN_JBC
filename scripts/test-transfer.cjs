const { ethers } = require("ethers");
require('dotenv').config();

const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
    PROTOCOL: process.env.PROXY_ADDRESS || "0x515871E9eADbF976b546113BbD48964383f86E61"
};

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, ERC20_ABI, wallet);

    console.log("Wallet:", wallet.address);
    console.log("Target:", ADDRESSES.PROTOCOL);

    const amount = ethers.parseEther("1");
    console.log("Transferring 1 MC...");

    try {
        const tx = await mcContract.transfer(ADDRESSES.PROTOCOL, amount, { gasLimit: 100000 });
        console.log("Tx Hash:", tx.hash);
        await tx.wait();
        console.log("Transfer successful!");
    } catch (error) {
        console.error("Transfer failed:", error);
    }
}

main();
