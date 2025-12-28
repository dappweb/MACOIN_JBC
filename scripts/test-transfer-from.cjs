const { ethers } = require("ethers");
require('dotenv').config();

const ADDRESSES = {
    MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF"
};

const ERC20_ABI = [
    "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const mcContract = new ethers.Contract(ADDRESSES.MC_TOKEN, ERC20_ABI, wallet);

    console.log("Wallet:", wallet.address);
    const amount = ethers.parseEther("1");

    try {
        // Approve myself
        console.log("Approving self...");
        const txApprove = await mcContract.approve(wallet.address, amount);
        await txApprove.wait();
        console.log("Approved.");

        // TransferFrom self to self
        console.log("Calling transferFrom(self, self, 1)...");
        const tx = await mcContract.transferFrom(wallet.address, wallet.address, amount, { gasLimit: 200000 });
        console.log("Tx Hash:", tx.hash);
        await tx.wait();
        console.log("TransferFrom successful!");
    } catch (error) {
        console.error("TransferFrom failed:", error);
    }
}

main();
