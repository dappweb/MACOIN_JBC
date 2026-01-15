const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ 错误: 未设置 PRIVATE_KEY 环境变量");
    process.exit(1);
}

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "function adminSetTeamCount(address user, uint256 newTeamCount) external",
    "function owner() view returns (address)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件统计正确的 teamCount
 * teamCount = 所有直接或间接推荐的用户总数
 */
async function calculateTeamCountFromEvents(protocol, provider, userAddress) {
    try {
        const currentBlock = await provider.getBlockNumber();
        // 扩大查询范围，尽可能获取所有历史事件
        const fromBlock = Math.max(0, currentBlock - 2000000);
        
        console.log(`   📊 查询事件范围: 区块 ${fromBlock} 到 ${currentBlock}`);
        
        // 获取所有 BoundReferrer 事件
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock
        );
        
        console.log(`   📊 找到 ${boundEvents.length} 个 BoundReferrer 事件`);
        
        // 构建推荐关系图
        const referrerMap = new Map();
        const allUsers = new Set();
        
        boundEvents.forEach(event => {
            if (event.args && event.args.referrer && event.args.user) {
                const user = event.args.user.toLowerCase();
                const referrer = event.args.referrer.toLowerCase();
                referrerMap.set(user, referrer);
                allUsers.add(user);
                allUsers.add(referrer);
            }
        });
        
        // 递归统计所有下级用户
        const visited = new Set();
        function countRecursive(referrer) {
            if (visited.has(referrer)) {
                return 0; // 防止循环
            }
            visited.add(referrer);
            
            let count = 0;
            for (const [user, ref] of referrerMap) {
                if (ref === referrer) {
                    count += 1; // 直接推荐
                    count += countRecursive(user); // 间接推荐（递归）
                }
            }
            return count;
        }
        
        const targetAddress = userAddress.toLowerCase();
        const teamCount = countRecursive(targetAddress);
        
        console.log(`   ✅ 统计完成: teamCount = ${teamCount}`);
        return teamCount;
    } catch (error) {
        console.error(`   ❌ 统计失败:`, error.message);
        return null;
    }
}

/**
 * 使用递归方式计算 teamCount（备用方案）
 * 注意：不累加下级的 teamCount，只累加下级的直接下级数
 */
async function calculateTeamCountRecursive(protocol, userAddress, visited = new Set(), depth = 0) {
    // 防止循环引用和过深递归
    if (visited.has(userAddress.toLowerCase()) || depth > 30) {
        return 0;
    }
    visited.add(userAddress.toLowerCase());
    
    try {
        // 获取直推列表
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        
        if (directReferrals.length === 0) {
            return 0;
        }
        
        // teamCount = 直推数 + 每个直推的 teamCount（递归计算，不累加下级的 teamCount）
        let totalTeamCount = directReferrals.length;
        
        // 递归计算每个直推的 teamCount
        for (const referral of directReferrals) {
            try {
                // 递归计算直推的 teamCount
                const referralTeamCount = await calculateTeamCountRecursive(
                    protocol, 
                    referral, 
                    new Set(visited), 
                    depth + 1
                );
                
                totalTeamCount += referralTeamCount;
            } catch (e) {
                console.warn(`  ⚠️  查询直推 ${referral} 失败: ${e.message}`);
            }
        }
        
        return totalTeamCount;
    } catch (error) {
        console.error(`❌ 计算 ${userAddress} 团队人数失败:`, error.message);
        return 0;
    }
}

/**
 * 修复用户的 teamCount
 */
async function fixUserTeamCount(protocol, wallet, userAddress, useEventMethod = true) {
    console.log(`\n🔧 修复用户: ${userAddress}`);
    
    try {
        // 获取当前数据
        const userInfo = await protocol.userInfo(userAddress);
        const currentTeamCount = Number(userInfo.teamCount);
        const activeDirects = Number(userInfo.activeDirects);
        
        console.log(`   当前数据: teamCount=${currentTeamCount}, activeDirects=${activeDirects}`);
        
        // 计算正确的 teamCount
        let correctTeamCount;
        
        if (useEventMethod) {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            correctTeamCount = await calculateTeamCountFromEvents(protocol, provider, userAddress);
            
            if (correctTeamCount === null) {
                console.log(`   ⚠️  事件统计失败，使用递归方法...`);
                correctTeamCount = await calculateTeamCountRecursive(protocol, userAddress);
            }
        } else {
            correctTeamCount = await calculateTeamCountRecursive(protocol, userAddress);
        }
        
        if (correctTeamCount === null || correctTeamCount === undefined) {
            console.log(`   ❌ 无法计算正确的 teamCount`);
            return { success: false, reason: "calculation_failed" };
        }
        
        console.log(`   计算出的正确 teamCount: ${correctTeamCount}`);
        
        // 如果差异小于 10，认为不需要修复
        if (Math.abs(correctTeamCount - currentTeamCount) < 10) {
            console.log(`   ✅ teamCount 已正确，无需修复`);
            return { 
                success: true, 
                fixed: false, 
                reason: "already_correct",
                currentTeamCount,
                correctTeamCount
            };
        }
        
        // 执行修复
        console.log(`   🔨 执行修复: ${currentTeamCount} -> ${correctTeamCount}...`);
        const tx = await protocol.adminSetTeamCount(userAddress, correctTeamCount);
        console.log(`   📝 交易已发送: ${tx.hash}`);
        
        console.log(`   ⏳ 等待交易确认...`);
        const receipt = await tx.wait();
        console.log(`   ✅ 交易已确认: 区块 ${receipt.blockNumber}`);
        
        // 验证修复结果
        const updatedInfo = await protocol.userInfo(userAddress);
        const updatedTeamCount = Number(updatedInfo.teamCount);
        
        console.log(`   ✅ 修复后 teamCount: ${updatedTeamCount}`);
        
        return { 
            success: true, 
            fixed: true, 
            oldTeamCount: currentTeamCount, 
            newTeamCount: updatedTeamCount,
            correctTeamCount,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        };
    } catch (error) {
        console.error(`   ❌ 修复失败:`, error.message);
        return { 
            success: false, 
            fixed: false, 
            error: error.message 
        };
    }
}

async function main() {
    console.log("🔧 开始使用正确方法修复 teamCount...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, wallet);

    // 检查 owner
    const owner = await protocol.owner();
    console.log(`👤 合约 Owner: ${owner}`);
    console.log(`👤 当前钱包: ${wallet.address}`);
    
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`❌ 错误: 当前钱包不是合约 Owner！`);
        process.exit(1);
    }
    
    console.log(`✅ Owner 验证通过\n`);

    // 需要修复的用户列表（之前修复过的推荐人）
    const usersToFix = [
        {
            address: "0x3E436e9ef8A44cb65b00FcEFe4Ac1952384Ed21e",
            name: "推荐人1",
            previousValue: 52113
        },
        {
            address: "0xC26731f7b6521B9ddF58B2Ef3F70658Dc28A5513",
            name: "推荐人2",
            previousValue: 101708
        },
        {
            address: "0x7aA68892F013d981DFfAc7AE403fAA886938552b",
            name: "推荐人3",
            previousValue: 393
        }
    ];

    const results = [];
    
    for (let i = 0; i < usersToFix.length; i++) {
        const user = usersToFix[i];
        console.log(`\n${"=".repeat(80)}`);
        console.log(`处理 ${i + 1}/${usersToFix.length}: ${user.name} (${user.address})`);
        console.log(`之前修复的值: ${user.previousValue}`);
        console.log("=".repeat(80));
        
        const result = await fixUserTeamCount(protocol, wallet, user.address, true);
        results.push({
            user: user.address,
            name: user.name,
            previousValue: user.previousValue,
            ...result
        });
        
        // 等待一段时间再处理下一个，避免 RPC 限流
        if (i < usersToFix.length - 1) {
            console.log(`\n⏸️  等待 5 秒后处理下一个账户...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // 输出结果
    console.log(`\n\n${"=".repeat(80)}`);
    console.log("📊 修复结果汇总");
    console.log("=".repeat(80));
    
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.name}: ${result.user}`);
        if (result.success) {
            if (result.fixed) {
                console.log(`   ✅ 修复成功`);
                console.log(`   之前的值: ${result.previousValue}`);
                console.log(`   旧值: ${result.oldTeamCount}`);
                console.log(`   新值: ${result.newTeamCount}`);
                console.log(`   正确值: ${result.correctTeamCount}`);
                console.log(`   交易哈希: ${result.txHash}`);
                console.log(`   区块号: ${result.blockNumber}`);
            } else {
                console.log(`   ℹ️  无需修复: ${result.reason}`);
                console.log(`   当前值: ${result.currentTeamCount}`);
                console.log(`   正确值: ${result.correctTeamCount}`);
            }
        } else {
            console.log(`   ❌ 修复失败: ${result.error || result.reason}`);
        }
    });

    // 保存结果
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `${outputDir}/fix-team-count-correct-result-${timestamp}.json`;
    
    const output = {
        timestamp: new Date().toISOString(),
        method: "event_based_calculation",
        results: results,
        summary: {
            total: results.length,
            fixed: results.filter(r => r.fixed).length,
            skipped: results.filter(r => !r.fixed && r.success).length,
            failed: results.filter(r => !r.success).length
        }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 结果已保存到: ${outputFile}`);
}

main().catch(error => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
});
