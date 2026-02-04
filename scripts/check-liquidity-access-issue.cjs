/**
 * 检查用户无法获取流动性的问题
 * 诊断两个地址：0x8995D09f38b1739428BE6708217A4C4Aa77D7db1 和 0xE58e95B4Be4aF2355FeF66Cea73AA36F595F0473
 */

const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_TOKEN_ADDRESS = process.env.JBC_TOKEN_ADDRESS || "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function swapReserveMC() view returns (uint256)",
    "function swapReserveJBC() view returns (uint256)",
    "function paused() view returns (bool)",
    "function MIN_LIQUIDITY() view returns (uint256)",
    "function MAX_PRICE_IMPACT() view returns (uint256)",
    "function stakeLiquidity(uint256 amount, uint256 cycleDays)",
];

// JBC Token ABI
const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
];

async function checkUserLiquidityAccess(userAddress) {
    console.log("\n" + "=".repeat(80));
    console.log(`🔍 检查用户流动性访问问题`);
    console.log("=".repeat(80));
    console.log(`用户地址: ${userAddress}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
        const jbcContract = new ethers.Contract(JBC_TOKEN_ADDRESS, JBC_ABI, provider);

        // 1. 检查合约状态
        console.log("1️⃣ 检查合约状态...");
        try {
            const isPaused = await protocol.paused();
            console.log(`   合约暂停状态: ${isPaused ? '❌ 已暂停' : '✅ 正常运行'}`);
            if (isPaused) {
                console.log(`   ⚠️  合约已暂停，无法进行任何操作`);
            }
        } catch (e) {
            console.log(`   ⚠️  无法检查暂停状态: ${e.message}`);
        }

        // 2. 检查流动性池状态
        console.log("\n2️⃣ 检查流动性池状态...");
        try {
            const reserveMC = await protocol.swapReserveMC();
            const reserveJBC = await protocol.swapReserveJBC();
            const minLiquidity = await protocol.MIN_LIQUIDITY();
            
            console.log(`   MC储备: ${ethers.formatEther(reserveMC)} MC`);
            console.log(`   JBC储备: ${ethers.formatEther(reserveJBC)} JBC`);
            console.log(`   最小流动性要求: ${ethers.formatEther(minLiquidity)} MC`);
            
            const hasEnoughLiquidity = reserveMC >= minLiquidity && reserveJBC >= minLiquidity;
            console.log(`   流动性充足: ${hasEnoughLiquidity ? '✅ 是' : '❌ 否'}`);
            
            if (!hasEnoughLiquidity) {
                console.log(`   ⚠️  流动性池储备不足，无法进行swap操作`);
            }
        } catch (e) {
            console.log(`   ❌ 查询流动性池失败: ${e.message}`);
        }

        // 3. 检查用户余额
        console.log("\n3️⃣ 检查用户余额...");
        try {
            const mcBalance = await provider.getBalance(userAddress);
            const jbcBalance = await jbcContract.balanceOf(userAddress);
            
            console.log(`   MC余额: ${ethers.formatEther(mcBalance)} MC`);
            console.log(`   JBC余额: ${ethers.formatEther(jbcBalance)} JBC`);
            
            if (mcBalance === 0n) {
                console.log(`   ⚠️  MC余额为0，无法支付Gas费用或进行MC兑换JBC`);
            }
            if (jbcBalance === 0n) {
                console.log(`   ⚠️  JBC余额为0，无法进行JBC兑换MC`);
            }
        } catch (e) {
            console.log(`   ❌ 查询余额失败: ${e.message}`);
        }

        // 4. 检查JBC授权状态
        console.log("\n4️⃣ 检查JBC授权状态...");
        try {
            const allowance = await jbcContract.allowance(userAddress, PROTOCOL_ADDRESS);
            console.log(`   授权额度: ${ethers.formatEther(allowance)} JBC`);
            
            if (allowance === 0n) {
                console.log(`   ⚠️  JBC未授权，无法进行JBC兑换MC操作`);
            } else {
                console.log(`   ✅ JBC已授权`);
            }
        } catch (e) {
            console.log(`   ❌ 查询授权失败: ${e.message}`);
        }

        // 5. 检查用户门票状态
        console.log("\n5️⃣ 检查用户门票状态...");
        try {
            const ticket = await protocol.userTicket(userAddress);
            const ticketId = Number(ticket.ticketId || 0);
            const ticketAmount = ethers.formatEther(ticket.amount || 0);
            const purchaseTime = Number(ticket.purchaseTime || 0);
            const exited = ticket.exited || false;
            
            console.log(`   门票ID: ${ticketId}`);
            console.log(`   门票金额: ${ticketAmount} MC`);
            console.log(`   购买时间: ${purchaseTime > 0 ? new Date(purchaseTime * 1000).toLocaleString('zh-CN') : '无'}`);
            console.log(`   是否退出: ${exited ? '❌ 是' : '✅ 否'}`);
            
            if (ticketId === 0 || parseFloat(ticketAmount) === 0) {
                console.log(`   ⚠️  用户没有有效门票`);
            } else if (exited) {
                console.log(`   ⚠️  用户门票已退出（3倍出局），无法进行流动性质押`);
            } else {
                console.log(`   ✅ 用户有有效门票`);
            }
        } catch (e) {
            console.log(`   ❌ 查询门票失败: ${e.message}`);
        }

        // 6. 检查用户信息
        console.log("\n6️⃣ 检查用户信息...");
        try {
            const userInfo = await protocol.userInfo(userAddress);
            const referrer = userInfo.referrer || ethers.ZeroAddress;
            const isActive = userInfo.isActive || false;
            const maxSingleTicketAmount = ethers.formatEther(userInfo.maxSingleTicketAmount || 0);
            
            console.log(`   推荐人: ${referrer}`);
            console.log(`   是否激活: ${isActive ? '✅ 是' : '❌ 否'}`);
            console.log(`   单张最高门票: ${maxSingleTicketAmount} MC`);
            
            if (referrer === ethers.ZeroAddress) {
                console.log(`   ⚠️  用户没有推荐人`);
            }
            if (!isActive) {
                console.log(`   ⚠️  用户未激活`);
            }
        } catch (e) {
            console.log(`   ❌ 查询用户信息失败: ${e.message}`);
        }

        // 7. 检查流动性质押条件
        console.log("\n7️⃣ 检查流动性质押条件...");
        try {
            const ticket = await protocol.userTicket(userAddress);
            const userInfo = await protocol.userInfo(userAddress);
            
            const ticketAmount = ticket.amount || 0n;
            const exited = ticket.exited || false;
            const maxSingleTicketAmount = userInfo.maxSingleTicketAmount || 0n;
            
            if (ticketAmount === 0n) {
                console.log(`   ❌ 无法质押：没有门票`);
            } else if (exited) {
                console.log(`   ❌ 无法质押：已3倍出局`);
            } else {
                const baseAmount = maxSingleTicketAmount > 0n ? maxSingleTicketAmount : ticketAmount;
                const requiredAmount = (baseAmount * 150n) / 100n;
                console.log(`   ✅ 可以质押`);
                console.log(`   需要质押金额: ${ethers.formatEther(requiredAmount)} MC (1.5倍门票)`);
                
                // 检查用户是否有足够的MC
                const mcBalance = await provider.getBalance(userAddress);
                if (mcBalance < requiredAmount) {
                    console.log(`   ⚠️  MC余额不足，需要 ${ethers.formatEther(requiredAmount)} MC，当前余额 ${ethers.formatEther(mcBalance)} MC`);
                }
            }
        } catch (e) {
            console.log(`   ❌ 检查质押条件失败: ${e.message}`);
        }

        // 8. 测试swap条件
        console.log("\n8️⃣ 测试Swap条件...");
        try {
            const reserveMC = await protocol.swapReserveMC();
            const reserveJBC = await protocol.swapReserveJBC();
            const minLiquidity = await protocol.MIN_LIQUIDITY();
            const maxPriceImpact = await protocol.MAX_PRICE_IMPACT();
            
            const mcBalance = await provider.getBalance(userAddress);
            const jbcBalance = await jbcContract.balanceOf(userAddress);
            const allowance = await jbcContract.allowance(userAddress, PROTOCOL_ADDRESS);
            
            // 测试MC兑换JBC
            console.log(`   MC → JBC 兑换条件:`);
            if (reserveMC < minLiquidity || reserveJBC < minLiquidity) {
                console.log(`      ❌ 流动性池储备不足`);
            } else if (mcBalance === 0n) {
                console.log(`      ❌ MC余额为0`);
            } else {
                console.log(`      ✅ 可以兑换（需要足够的MC余额和Gas费）`);
            }
            
            // 测试JBC兑换MC
            console.log(`   JBC → MC 兑换条件:`);
            if (reserveMC < minLiquidity || reserveJBC < minLiquidity) {
                console.log(`      ❌ 流动性池储备不足`);
            } else if (jbcBalance === 0n) {
                console.log(`      ❌ JBC余额为0`);
            } else if (allowance === 0n) {
                console.log(`      ❌ JBC未授权`);
            } else if (allowance < jbcBalance) {
                console.log(`      ⚠️  JBC授权额度不足（授权: ${ethers.formatEther(allowance)} JBC, 余额: ${ethers.formatEther(jbcBalance)} JBC）`);
            } else {
                console.log(`      ✅ 可以兑换`);
            }
        } catch (e) {
            console.log(`   ❌ 测试swap条件失败: ${e.message}`);
        }

        // 9. 诊断总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 诊断总结");
        console.log("=".repeat(80));
        
        const issues = [];
        
        try {
            const isPaused = await protocol.paused();
            if (isPaused) {
                issues.push("❌ 合约已暂停");
            }
        } catch (e) {}
        
        try {
            const reserveMC = await protocol.swapReserveMC();
            const reserveJBC = await protocol.swapReserveJBC();
            const minLiquidity = await protocol.MIN_LIQUIDITY();
            if (reserveMC < minLiquidity || reserveJBC < minLiquidity) {
                issues.push("❌ 流动性池储备不足");
            }
        } catch (e) {}
        
        try {
            const mcBalance = await provider.getBalance(userAddress);
            if (mcBalance === 0n) {
                issues.push("❌ MC余额为0（无法支付Gas费）");
            }
        } catch (e) {}
        
        try {
            const jbcBalance = await jbcContract.balanceOf(userAddress);
            const allowance = await jbcContract.allowance(userAddress, PROTOCOL_ADDRESS);
            if (jbcBalance > 0n && allowance === 0n) {
                issues.push("❌ JBC未授权（无法进行JBC兑换MC）");
            }
        } catch (e) {}
        
        try {
            const ticket = await protocol.userTicket(userAddress);
            if (ticket.exited) {
                issues.push("❌ 门票已退出（3倍出局，无法进行流动性质押）");
            }
        } catch (e) {}
        
        if (issues.length === 0) {
            console.log("✅ 未发现明显问题，用户应该可以正常使用流动性功能");
            console.log("\n如果仍然无法使用，可能的原因：");
            console.log("  1. 前端UI显示问题（灰色状态可能是前端逻辑判断）");
            console.log("  2. 网络连接问题");
            console.log("  3. 前端缓存问题");
            console.log("  4. 价格影响过大（超过MAX_PRICE_IMPACT限制）");
        } else {
            console.log("⚠️  发现以下问题：\n");
            issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
    } catch (error) {
        console.error("❌ 检查失败:", error.message);
        console.error(error.stack);
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            console.error("\n⚠️  RPC连接超时，可能是网络问题");
        }
    }
}

// 主函数
async function main() {
    const addresses = [
        "0x8995D09f38b1739428BE6708217A4C4Aa77D7db1",
        "0xE58e95B4Be4aF2355FeF66Cea73AA36F595F0473"
    ];
    
    for (const address of addresses) {
        if (!ethers.isAddress(address)) {
            console.error(`❌ 无效的地址格式: ${address}`);
            continue;
        }
        
        await checkUserLiquidityAccess(address);
        console.log("\n\n");
    }
}

main().catch(error => {
    console.error("❌ 执行失败:", error);
    process.exit(1);
});
