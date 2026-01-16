const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
];

// 测试地址（已知只存在于旧合约的地址）
const TEST_ADDRESSES = [
    "0x25a5bC4Ecbaf2BF42E1cA89D08e98D800fb939dC",
    "0xdD1A5471d8f8B70500BAE23CC28BC34C7c9ef3b6",
    "0x468F8C39Ef1Db73fe6ecc311B10e1828875273f3",
    "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5"
];

async function checkUserInNewContract(newProtocol, userAddress) {
    try {
        const userInfo = await newProtocol.userInfo(userAddress);
        const hasData = userInfo.referrer !== ethers.ZeroAddress ||
                       userInfo.isActive ||
                       userInfo.activeDirects > 0n ||
                       userInfo.teamCount > 0n ||
                       userInfo.totalRevenue > 0n ||
                       userInfo.currentCap > 0n;
        return { exists: hasData, userInfo };
    } catch (error) {
        return { exists: false, error: error.message };
    }
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 测试检查逻辑\n");
    console.log("=".repeat(80));

    for (const address of TEST_ADDRESSES) {
        console.log(`\n地址: ${address}`);
        console.log("-".repeat(80));
        
        // 检查新合约
        const newResult = await checkUserInNewContract(newProtocol, address);
        console.log(`新合约: ${newResult.exists ? "✅ 存在" : "❌ 不存在"}`);
        if (newResult.error) {
            console.log(`  错误: ${newResult.error}`);
        }
        if (newResult.userInfo) {
            console.log(`  推荐人: ${newResult.userInfo.referrer}`);
            console.log(`  是否激活: ${newResult.userInfo.isActive}`);
            console.log(`  团队人数: ${newResult.userInfo.teamCount}`);
        }

        // 检查旧合约
        try {
            const oldUserInfo = await oldProtocol.userInfo(address);
            console.log(`旧合约: ✅ 存在`);
            console.log(`  推荐人: ${oldUserInfo.referrer}`);
            console.log(`  是否激活: ${oldUserInfo.isActive}`);
            console.log(`  团队人数: ${oldUserInfo.teamCount}`);
        } catch (error) {
            console.log(`旧合约: ❌ 不存在`);
        }
    }

    console.log("\n" + "=".repeat(80));
}

main().catch(console.error);
