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
async function calculateTeamTotalVolume(protocolContract, provider, userAddress, visited = new Set(), fromBlock = 0) {
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
        console.log(`  ${userAddress}: 自己购买 ${userTicketAmount.toFixed(4)} MC`);

        // 2. 查询用户购买门票的事件（历史记录）
        const currentBlock = await provider.getBlockNumber();
        const searchFromBlock = fromBlock || Math.max(0, currentBlock - 500000);
        
        const ticketEvents = await protocolContract.queryFilter(
            protocolContract.filters.TicketPurchased(userAddress),
            searchFromBlock
        );
        
        let eventTotal = 0;
        for (const event of ticketEvents) {
            if (event.args && event.args.amount) {
                eventTotal += parseFloat(ethers.formatEther(event.args.amount));
            }
        }
        
        if (eventTotal > userTicketAmount) {
            // 如果事件累计大于当前门票金额，说明用户可能已经赎回，使用事件累计
            totalVolume = eventTotal;
            console.log(`  ${userAddress}: 事件累计 ${eventTotal.toFixed(4)} MC (已赎回)`);
        }

        // 3. 递归计算所有下级的团队总业绩
        const directRefs = await protocolContract.getDirectReferrals(userAddress);
        console.log(`  ${userAddress}: 有 ${directRefs.length} 个直推`);
        
        for (const ref of directRefs) {
            const refVolume = await calculateTeamTotalVolume(protocolContract, provider, ref, visited, searchFromBlock);
            totalVolume += refVolume;
        }

    } catch (error) {
        console.error(`  查询 ${userAddress} 失败:`, error.message);
    }

    return totalVolume;
}

async function verifyTeamVolume(userAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 验证用户团队总业绩计算\n");
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 获取合约中的 teamTotalVolume
        const userInfo = await protocol.userInfo(userAddress);
        const contractTeamVolume = parseFloat(ethers.formatEther(userInfo.teamTotalVolume));
        
        console.log("📊 合约中的团队总业绩:");
        console.log(`  ${contractTeamVolume.toFixed(4)} MC\n`);

        // 计算正确的团队总业绩
        console.log("📊 计算正确的团队总业绩（递归计算所有下级）:");
        console.log("-".repeat(80));
        const calculatedVolume = await calculateTeamTotalVolume(protocol, provider, userAddress);
        
        console.log("-".repeat(80));
        console.log(`\n计算结果: ${calculatedVolume.toFixed(4)} MC`);
        console.log(`合约值: ${contractTeamVolume.toFixed(4)} MC`);
        console.log(`差额: ${(calculatedVolume - contractTeamVolume).toFixed(4)} MC`);
        
        if (Math.abs(calculatedVolume - contractTeamVolume) < 0.01) {
            console.log("✅ 数据一致");
        } else {
            console.log("⚠️  数据不一致，可能需要修复");
        }

    } catch (error) {
        console.error("❌ 验证失败:", error);
    }
}

// 运行脚本
const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

console.log("=".repeat(80));
console.log("验证地址1的团队总业绩");
console.log("=".repeat(80));
verifyTeamVolume(address1).then(() => {
    console.log("\n");
    console.log("=".repeat(80));
    console.log("验证地址2的团队总业绩");
    console.log("=".repeat(80));
    return verifyTeamVolume(address2);
}).catch(console.error);
