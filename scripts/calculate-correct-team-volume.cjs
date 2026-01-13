const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

// 递归计算用户及其所有下级的门票购买总额
async function calculateTeamTotalVolume(protocolContract, provider, userAddress, visited = new Set(), depth = 0) {
    const indent = "  ".repeat(depth);
    if (visited.has(userAddress.toLowerCase())) {
        return 0;
    }
    visited.add(userAddress.toLowerCase());

    let totalVolume = 0;

    try {
        // 1. 获取用户自己的门票购买金额
        const ticket = await protocolContract.userTicket(userAddress);
        const userTicketAmount = parseFloat(ethers.formatEther(ticket.amount || 0n));
        totalVolume += userTicketAmount;
        
        if (userTicketAmount > 0) {
            console.log(`${indent}${userAddress.substring(0, 10)}...${userAddress.substring(34)}: ${userTicketAmount.toFixed(4)} MC (自己)`);
        }

        // 2. 递归计算所有下级的团队总业绩
        const directRefs = await protocolContract.getDirectReferrals(userAddress);
        
        for (const ref of directRefs) {
            const refVolume = await calculateTeamTotalVolume(protocolContract, provider, ref, visited, depth + 1);
            totalVolume += refVolume;
        }

    } catch (error) {
        console.error(`${indent}查询 ${userAddress} 失败:`, error.message);
    }

    return totalVolume;
}

async function compareAndReport(address1, address2) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 计算正确的团队总业绩\n");
    console.log("=".repeat(80));
    console.log(`地址1: ${address1}`);
    console.log(`地址2: ${address2}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 获取合约中的值
        const userInfo1 = await protocol.userInfo(address1);
        const contractVolume1 = parseFloat(ethers.formatEther(userInfo1.teamTotalVolume));
        
        const userInfo2 = await protocol.userInfo(address2);
        const contractVolume2 = parseFloat(ethers.formatEther(userInfo2.teamTotalVolume));

        console.log("📊 地址1的团队总业绩计算:");
        console.log("-".repeat(80));
        const calculatedVolume1 = await calculateTeamTotalVolume(protocol, provider, address1);
        
        console.log("\n📊 地址2的团队总业绩计算:");
        console.log("-".repeat(80));
        const visited = new Set();
        const calculatedVolume2 = await calculateTeamTotalVolume(protocol, provider, address2, visited);

        console.log("\n" + "=".repeat(80));
        console.log("📈 计算结果对比:");
        console.log("=".repeat(80));
        console.log(`地址1:`);
        console.log(`  合约值: ${contractVolume1.toFixed(4)} MC`);
        console.log(`  计算值: ${calculatedVolume1.toFixed(4)} MC`);
        console.log(`  差额: ${(calculatedVolume1 - contractVolume1).toFixed(4)} MC`);
        console.log("");
        console.log(`地址2:`);
        console.log(`  合约值: ${contractVolume2.toFixed(4)} MC`);
        console.log(`  计算值: ${calculatedVolume2.toFixed(4)} MC`);
        console.log(`  差额: ${(calculatedVolume2 - contractVolume2).toFixed(4)} MC`);
        console.log("");
        console.log("=".repeat(80));
        console.log("🔍 逻辑验证:");
        console.log("=".repeat(80));
        
        // 检查推荐关系
        const referrer2 = userInfo2.referrer.toLowerCase();
        const address1Lower = address1.toLowerCase();
        
        if (referrer2 === address1Lower) {
            console.log("✅ 确认：地址1推荐地址2");
            console.log(`\n逻辑要求：地址1的团队总业绩应该 >= 地址2的团队总业绩`);
            console.log(`  因为地址1的团队包含地址2及其所有下级`);
            
            if (calculatedVolume1 >= calculatedVolume2) {
                console.log(`\n✅ 计算值符合逻辑：${calculatedVolume1.toFixed(4)} >= ${calculatedVolume2.toFixed(4)}`);
            } else {
                console.log(`\n❌ 计算值不符合逻辑：${calculatedVolume1.toFixed(4)} < ${calculatedVolume2.toFixed(4)}`);
                console.log(`  这可能表示数据计算有问题`);
            }
            
            if (contractVolume1 >= contractVolume2) {
                console.log(`\n✅ 合约值符合逻辑：${contractVolume1.toFixed(4)} >= ${contractVolume2.toFixed(4)}`);
            } else {
                console.log(`\n❌ 合约值不符合逻辑：${contractVolume1.toFixed(4)} < ${contractVolume2.toFixed(4)}`);
                console.log(`  需要修复：地址1的 teamTotalVolume 应该设置为至少 ${calculatedVolume1.toFixed(4)} MC`);
            }
        } else {
            console.log(`⚠️  地址2的推荐人不是地址1，而是: ${referrer2}`);
        }

    } catch (error) {
        console.error("❌ 计算失败:", error);
    }
}

// 运行脚本
const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

compareAndReport(address1, address2).catch(console.error);
