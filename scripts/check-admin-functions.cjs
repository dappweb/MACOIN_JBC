const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 完整的 ABI，包括所有可能的管理员函数
const PROTOCOL_ABI = [
    "function adminSetTeamTotalVolume(address user, uint256 newTeamTotalVolume) external",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function adminSetActiveDirects(address user, uint256 newActiveDirects) external",
    "function adminSetTotalRevenue(address user, uint256 newTotalRevenue) external",
    "function adminSetCurrentCap(address user, uint256 newCurrentCap) external",
    "function owner() view returns (address)",
];

async function checkFunctions() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 检查合约中的管理员函数\n");
    console.log("=".repeat(80));
    console.log(`合约地址: ${PROTOCOL_ADDRESS}`);
    console.log("=".repeat(80) + "\n");

    const functions = [
        "adminSetTeamTotalVolume",
        "adminSetTeamCount",
        "adminSetActiveDirects",
        "adminSetTotalRevenue",
        "adminSetCurrentCap"
    ];

    for (const funcName of functions) {
        try {
            // 尝试获取函数接口
            const func = protocol[funcName];
            if (func) {
                // 尝试静态调用（不发送交易）
                console.log(`✅ ${funcName}: 函数存在`);
            } else {
                console.log(`❌ ${funcName}: 函数不存在`);
            }
        } catch (error) {
            console.log(`❌ ${funcName}: ${error.message}`);
        }
    }

    // 检查合约所有者
    try {
        const owner = await protocol.owner();
        console.log(`\n📋 合约所有者: ${owner}`);
    } catch (error) {
        console.log(`\n❌ 无法获取合约所有者: ${error.message}`);
    }
}

checkFunctions().catch(console.error);
