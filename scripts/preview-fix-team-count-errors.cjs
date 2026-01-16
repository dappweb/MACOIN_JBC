const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件构建推荐关系图并计算正确的 teamCount
 */
async function buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider) {
    const fromBlock = 0;
    
    const referrerMap = new Map();
    const allUsers = new Set();
    
    for (const protocol of [newProtocol, oldProtocol]) {
        try {
            const events = await protocol.queryFilter(
                protocol.filters.BoundReferrer(),
                fromBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    const blockNumber = event.blockNumber || (event.log && event.log.blockNumber) || 0;
                    const existing = referrerMap.get(user);
                    if (!existing || blockNumber > (existing.blockNumber || 0)) {
                        referrerMap.set(user, { referrer, blockNumber });
                    }
                    allUsers.add(user);
                    allUsers.add(referrer);
                }
            });
        } catch (error) {
            // 忽略错误
        }
    }
    
    const referrerToUsers = new Map();
    referrerMap.forEach((data, user) => {
        const referrer = data.referrer;
        if (!referrerToUsers.has(referrer)) {
            referrerToUsers.set(referrer, []);
        }
        referrerToUsers.get(referrer).push(user);
    });
    
    const teamCountCache = new Map();
    const visited = new Set();
    
    function calculateTeamCount(user) {
        if (teamCountCache.has(user)) {
            return teamCountCache.get(user);
        }
        
        if (visited.has(user)) {
            return 0;
        }
        visited.add(user);
        
        const directReferrals = referrerToUsers.get(user) || [];
        let count = directReferrals.length;
        
        for (const referral of directReferrals) {
            count += calculateTeamCount(referral);
        }
        
        visited.delete(user);
        teamCountCache.set(user, count);
        return count;
    }
    
    const calculatedTeamCounts = new Map();
    for (const user of allUsers) {
        calculatedTeamCounts.set(user, calculateTeamCount(user));
    }
    
    return calculatedTeamCounts;
}

async function previewFixTeamCountErrors(verificationFile) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const newProtocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 预览：将要修复的 teamCount 错误用户");
    console.log("=".repeat(80));
    console.log(`验证结果文件: ${verificationFile}`);
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log("=".repeat(80) + "\n");

    try {
        const verificationData = JSON.parse(fs.readFileSync(verificationFile, 'utf8'));
        const errorUsers = verificationData.errors || [];
        
        if (errorUsers.length === 0) {
            console.log("✅ 没有需要修复的用户");
            return;
        }

        console.log(`📋 从验证结果文件读取到 ${errorUsers.length} 个错误用户`);
        console.log("");

        // 构建推荐关系图并计算正确的 teamCount
        console.log("🔍 构建推荐关系图并计算正确的 teamCount...");
        const calculatedTeamCounts = await buildReferralMapAndCalculateTeamCount(newProtocol, oldProtocol, provider);
        console.log(`✅ 已计算 ${calculatedTeamCounts.size} 个用户的 teamCount`);
        console.log("");

        // 按严重程度分类
        const severeErrors = errorUsers.filter(e => e.severity === "严重");
        const mediumErrors = errorUsers.filter(e => e.severity === "中等");
        const minorErrors = errorUsers.filter(e => e.severity === "轻微");

        console.log("📊 错误分类:");
        console.log("-".repeat(80));
        console.log(`   严重错误（差异 > 100）: ${severeErrors.length} 个`);
        console.log(`   中等错误（差异 10-100）: ${mediumErrors.length} 个`);
        console.log(`   轻微错误（差异 < 10）: ${minorErrors.length} 个`);
        console.log("");

        // 显示将要修复的用户
        const willFix = [];
        const willSkip = [];

        for (const error of errorUsers) {
            const userAddress = error.address.toLowerCase();
            const calculatedTeamCount = calculatedTeamCounts.get(userAddress) || 0;
            const contractTeamCount = error.contractValue;

            if (calculatedTeamCount === 0 && contractTeamCount > 0) {
                willSkip.push({ ...error, calculatedTeamCount, reason: "计算值为0但合约值>0，需要进一步检查" });
            } else if (contractTeamCount === calculatedTeamCount) {
                willSkip.push({ ...error, calculatedTeamCount, reason: "数据已正确" });
            } else {
                willFix.push({ ...error, calculatedTeamCount });
            }
        }

        console.log("=".repeat(80));
        console.log("📋 修复预览");
        console.log("=".repeat(80));
        console.log(`将修复: ${willFix.length} 个用户`);
        console.log(`将跳过: ${willSkip.length} 个用户`);
        console.log("");

        // 显示前20个将要修复的用户
        console.log("🔧 将要修复的用户（前20个）:");
        console.log("-".repeat(80));
        willFix.slice(0, 20).forEach((item, idx) => {
            console.log(`   ${idx + 1}. ${item.address} (${item.severity})`);
            console.log(`      当前值: ${item.contractValue.toLocaleString()}`);
            console.log(`      正确值: ${item.calculatedTeamCount.toLocaleString()}`);
            console.log(`      差异: ${(item.contractValue - item.calculatedTeamCount).toLocaleString()}`);
            console.log(`      直推数: ${item.activeDirects}`);
            console.log("");
        });

        if (willFix.length > 20) {
            console.log(`   ... 还有 ${willFix.length - 20} 个用户`);
            console.log("");
        }

        // 显示跳过的用户
        if (willSkip.length > 0) {
            console.log("⏭️  将跳过的用户:");
            console.log("-".repeat(80));
            willSkip.slice(0, 10).forEach((item, idx) => {
                console.log(`   ${idx + 1}. ${item.address}: ${item.reason}`);
            });
            if (willSkip.length > 10) {
                console.log(`   ... 还有 ${willSkip.length - 10} 个用户`);
            }
            console.log("");
        }

        // 统计
        const severeToFix = willFix.filter(e => e.severity === "严重").length;
        const mediumToFix = willFix.filter(e => e.severity === "中等").length;
        const minorToFix = willFix.filter(e => e.severity === "轻微").length;

        console.log("=".repeat(80));
        console.log("📊 修复统计");
        console.log("=".repeat(80));
        console.log(`总错误用户: ${errorUsers.length}`);
        console.log(`将修复: ${willFix.length}`);
        console.log(`   严重: ${severeToFix}`);
        console.log(`   中等: ${mediumToFix}`);
        console.log(`   轻微: ${minorToFix}`);
        console.log(`将跳过: ${willSkip.length}`);
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("❌ 预览失败:", error);
        throw error;
    }
}

// 主函数
async function main() {
    const verificationFile = process.argv[2] || "output/team-count-verification-2026-01-16T02-43-51-657Z.json";
    
    if (!fs.existsSync(verificationFile)) {
        console.error(`❌ 错误: 文件不存在: ${verificationFile}`);
        console.error("   用法: node scripts/preview-fix-team-count-errors.cjs [verification-file.json]");
        process.exit(1);
    }

    try {
        await previewFixTeamCountErrors(verificationFile);
    } catch (error) {
        console.error("❌ 执行失败:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { previewFixTeamCountErrors };
