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
async function calculateCorrectTeamVolume(protocolContract, provider, userAddress, visited = new Set(), depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
        console.log(`  [深度${depth}] ${userAddress.substring(0, 10)}... 达到最大深度，跳过`);
        return 0; // 限制递归深度，避免超时
    }
    
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

        // 2. 查询用户购买门票的历史事件（如果已赎回，事件数据更准确）
        const currentBlock = await provider.getBlockNumber();
        const searchFromBlock = Math.max(0, currentBlock - 500000);
        
        try {
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
            
            // 如果事件累计大于当前门票金额，说明用户可能已经赎回，使用事件累计
            if (eventTotal > userTicketAmount) {
                totalVolume = eventTotal; // 使用历史累计
            }
        } catch (e) {
            // 如果查询事件失败，使用当前门票金额
        }

        // 3. 递归计算所有下级的团队总业绩
        const directRefs = await protocolContract.getDirectReferrals(userAddress);
        
        if (directRefs.length > 0 && depth < 3) {
            console.log(`  [深度${depth}] ${userAddress.substring(0, 10)}... 有 ${directRefs.length} 个直推，继续递归...`);
        }
        
        for (const ref of directRefs) {
            const refVolume = await calculateCorrectTeamVolume(protocolContract, provider, ref, visited, depth + 1, maxDepth);
            totalVolume += refVolume;
        }
        
        if (depth === 0) {
            console.log(`  [深度0] ${userAddress.substring(0, 10)}... 自己购买: ${userTicketAmount.toFixed(4)} MC, 下级总计: ${(totalVolume - userTicketAmount).toFixed(4)} MC`);
        }

    } catch (error) {
        console.error(`  查询 ${userAddress} 失败:`, error.message);
    }

    return totalVolume;
}

async function getCorrectData(address) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`地址: ${address}`);
    console.log("=".repeat(80));

    try {
        // 获取合约中的当前数据
        const userInfo = await protocol.userInfo(address);
        const ticket = await protocol.userTicket(address);
        const directRefs = await protocol.getDirectReferrals(address);

        const contractTeamVolume = parseFloat(ethers.formatEther(userInfo.teamTotalVolume));
        const selfPurchase = parseFloat(ethers.formatEther(ticket.amount || 0n));
        const teamCount = Number(userInfo.teamCount);
        const activeDirects = Number(userInfo.activeDirects);

        console.log("\n📊 当前合约中的数据:");
        console.log(`  推荐人: ${userInfo.referrer}`);
        console.log(`  团队人数: ${teamCount}`);
        console.log(`  活跃直推数: ${activeDirects}`);
        console.log(`  自己购买: ${selfPurchase.toFixed(4)} MC`);
        console.log(`  团队总业绩(合约值): ${contractTeamVolume.toFixed(4)} MC`);
        console.log(`  直推数量: ${directRefs.length}`);

        // 计算正确的团队总业绩
        console.log("\n🧮 计算正确的团队总业绩（递归计算所有下级）...");
        console.log("  注意：这可能需要一些时间...");
        
        const visited = new Set();
        const correctTeamVolume = await calculateCorrectTeamVolume(protocol, provider, address, visited, 0, 5);

        console.log("\n📈 计算结果:");
        console.log(`  正确的团队总业绩: ${correctTeamVolume.toFixed(4)} MC`);
        console.log(`  合约中的值: ${contractTeamVolume.toFixed(4)} MC`);
        console.log(`  差额: ${(correctTeamVolume - contractTeamVolume).toFixed(4)} MC`);

        if (Math.abs(correctTeamVolume - contractTeamVolume) < 0.01) {
            console.log("  ✅ 数据一致");
        } else {
            console.log("  ⚠️  数据不一致，需要修复");
            console.log(`  💡 建议修复值: ${correctTeamVolume.toFixed(4)} MC`);
        }

        return {
            address,
            referrer: userInfo.referrer,
            teamCount,
            activeDirects,
            selfPurchase,
            contractTeamVolume,
            correctTeamVolume,
            directRefsCount: directRefs.length
        };

    } catch (error) {
        console.error("❌ 查询失败:", error.message);
        return null;
    }
}

async function main() {
    const address1 = "0x0435aFf9777DafBd0552B54951501D3169A02062";
    const address2 = "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

    console.log("🔍 计算地址1和地址2的正确数据");
    console.log("=".repeat(80));

    const data1 = await getCorrectData(address1);
    const data2 = await getCorrectData(address2);

    if (data1 && data2) {
        console.log("\n" + "=".repeat(80));
        console.log("📊 数据对比总结");
        console.log("=".repeat(80));
        
        console.log("\n地址1:");
        console.log(`  当前合约值: ${data1.contractTeamVolume.toFixed(4)} MC`);
        console.log(`  正确值: ${data1.correctTeamVolume.toFixed(4)} MC`);
        console.log(`  修复值: ${data1.correctTeamVolume.toFixed(4)} MC`);
        
        console.log("\n地址2:");
        console.log(`  当前合约值: ${data2.contractTeamVolume.toFixed(4)} MC`);
        console.log(`  正确值: ${data2.correctTeamVolume.toFixed(4)} MC`);
        console.log(`  修复值: ${data2.correctTeamVolume.toFixed(4)} MC`);

        console.log("\n" + "=".repeat(80));
        console.log("🔍 逻辑验证");
        console.log("=".repeat(80));
        
        const referrer2 = data2.referrer.toLowerCase();
        const address1Lower = address1.toLowerCase();
        
        if (referrer2 === address1Lower) {
            console.log("✅ 确认：地址1推荐地址2");
            console.log(`\n逻辑要求：地址1的团队总业绩应该 >= 地址2的团队总业绩`);
            
            if (data1.correctTeamVolume >= data2.correctTeamVolume) {
                console.log(`✅ 正确值符合逻辑：${data1.correctTeamVolume.toFixed(4)} >= ${data2.correctTeamVolume.toFixed(4)}`);
            } else {
                console.log(`❌ 正确值不符合逻辑：${data1.correctTeamVolume.toFixed(4)} < ${data2.correctTeamVolume.toFixed(4)}`);
                console.log(`  这可能表示地址2的推荐关系有问题，或者需要重新计算`);
            }
            
            if (data1.contractTeamVolume >= data2.contractTeamVolume) {
                console.log(`✅ 合约值符合逻辑：${data1.contractTeamVolume.toFixed(4)} >= ${data2.contractTeamVolume.toFixed(4)}`);
            } else {
                console.log(`❌ 合约值不符合逻辑：${data1.contractTeamVolume.toFixed(4)} < ${data2.contractTeamVolume.toFixed(4)}`);
                console.log(`  需要修复：地址1的 teamTotalVolume 应该至少设置为 ${Math.max(data1.correctTeamVolume, data2.correctTeamVolume).toFixed(4)} MC`);
            }
        } else {
            console.log(`⚠️  地址2的推荐人不是地址1，而是: ${data2.referrer}`);
        }

        console.log("\n" + "=".repeat(80));
        console.log("💡 修复建议");
        console.log("=".repeat(80));
        console.log(`地址1: adminSetTeamTotalVolume("${address1}", ${ethers.parseEther(data1.correctTeamVolume.toString()).toString()})`);
        console.log(`地址2: adminSetTeamTotalVolume("${address2}", ${ethers.parseEther(data2.correctTeamVolume.toString()).toString()})`);
    }
}

main().catch(console.error);
