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
];

/**
 * 递归计算用户的正确团队人数
 * teamCount = activeDirects + 所有直推用户的 teamCount 之和
 */
async function calculateCorrectTeamCount(protocol, userAddress, visited = new Set(), depth = 0) {
    // 防止循环引用和过深递归
    if (visited.has(userAddress.toLowerCase()) || depth > 20) {
        return 0;
    }
    visited.add(userAddress.toLowerCase());
    
    try {
        // 获取直推列表
        const directReferrals = await protocol.getDirectReferrals(userAddress);
        
        if (directReferrals.length === 0) {
            return 0;
        }
        
        // 团队人数 = 直推人数 + 每个直推的团队人数
        let totalTeamCount = directReferrals.length;
        
        // 递归计算每个直推的团队人数
        for (const referral of directReferrals) {
            try {
                const referralInfo = await protocol.userInfo(referral);
                const referralTeamCount = Number(referralInfo.teamCount || 0);
                
                // 递归计算直推的团队人数（使用合约中的值或计算出的值，取较大者）
                const referralCalculatedCount = await calculateCorrectTeamCount(
                    protocol, 
                    referral, 
                    new Set(visited), 
                    depth + 1
                );
                
                // 使用较大的值
                const referralActualCount = Math.max(referralTeamCount, referralCalculatedCount);
                totalTeamCount += referralActualCount;
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
 * 修复异常账户
 */
async function fixAbnormalAccount(protocol, wallet, accountData) {
    const userAddress = accountData.user;
    const referrerAddress = accountData.referrer;
    
    console.log(`\n🔧 修复账户: ${userAddress}`);
    console.log(`   推荐人: ${referrerAddress}`);
    console.log(`   当前数据: teamCount=${accountData.referrerData.teamCount}, activeDirects=${accountData.referrerData.activeDirects}`);
    
    try {
        // 计算推荐人的正确团队人数
        console.log(`   📊 正在计算正确的团队人数...`);
        const correctTeamCount = await calculateCorrectTeamCount(protocol, referrerAddress);
        
        // 获取当前数据
        const currentInfo = await protocol.userInfo(referrerAddress);
        const currentTeamCount = Number(currentInfo.teamCount);
        
        console.log(`   当前团队人数: ${currentTeamCount}`);
        console.log(`   计算出的正确团队人数: ${correctTeamCount}`);
        
        if (correctTeamCount <= currentTeamCount) {
            console.log(`   ✅ 团队人数已正确，无需修复`);
            return { success: true, fixed: false, reason: "already_correct" };
        }
        
        // 执行修复
        console.log(`   🔨 执行修复: 设置团队人数为 ${correctTeamCount}...`);
        const tx = await protocol.adminSetTeamCount(referrerAddress, correctTeamCount);
        console.log(`   📝 交易已发送: ${tx.hash}`);
        
        console.log(`   ⏳ 等待交易确认...`);
        const receipt = await tx.wait();
        console.log(`   ✅ 交易已确认: 区块 ${receipt.blockNumber}`);
        
        // 验证修复结果
        const updatedInfo = await protocol.userInfo(referrerAddress);
        const updatedTeamCount = Number(updatedInfo.teamCount);
        
        console.log(`   ✅ 修复后团队人数: ${updatedTeamCount}`);
        
        if (updatedTeamCount >= correctTeamCount) {
            console.log(`   ✅ 修复成功！`);
            return { 
                success: true, 
                fixed: true, 
                oldTeamCount: currentTeamCount, 
                newTeamCount: updatedTeamCount,
                txHash: tx.hash
            };
        } else {
            console.log(`   ⚠️  修复后团队人数仍不正确`);
            return { 
                success: false, 
                fixed: false, 
                reason: "update_failed",
                oldTeamCount: currentTeamCount,
                newTeamCount: updatedTeamCount
            };
        }
    } catch (error) {
        console.error(`   ❌ 修复失败:`, error.message);
        return { 
            success: false, 
            fixed: false, 
            error: error.message 
        };
    }
}

/**
 * 验证修复结果
 */
async function verifyFix(protocol, accountData) {
    const referrerAddress = accountData.referrer;
    const userAddress = accountData.user;
    
    try {
        const referrerInfo = await protocol.userInfo(referrerAddress);
        const userInfo = await protocol.userInfo(userAddress);
        
        const referrerTeamCount = Number(referrerInfo.teamCount);
        const userTeamCount = Number(userInfo.teamCount);
        
        // 检查是否还有异常
        const issues = [];
        
        if (referrerTeamCount < userTeamCount + 1) {
            issues.push({
                type: "teamCount",
                message: `上级团队人数(${referrerTeamCount}) < 下级团队人数+1(${userTeamCount + 1})`
            });
        }
        
        if (referrerTeamCount < userTeamCount) {
            issues.push({
                type: "teamCount_absolute",
                message: `上级团队人数(${referrerTeamCount}) < 下级团队人数(${userTeamCount})`
            });
        }
        
        return {
            referrerTeamCount,
            userTeamCount,
            hasIssues: issues.length > 0,
            issues
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

async function main() {
    console.log("🔧 开始修复异常账户...\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    // 读取异常账户数据
    const abnormalAccountsFile = "./output/abnormal-accounts-2026-01-13T13-16-00-086Z.json";
    if (!fs.existsSync(abnormalAccountsFile)) {
        console.error(`❌ 未找到异常账户文件: ${abnormalAccountsFile}`);
        process.exit(1);
    }
    
    const abnormalData = JSON.parse(fs.readFileSync(abnormalAccountsFile, "utf8"));
    const abnormalAccounts = abnormalData.accounts;
    
    console.log(`📋 找到 ${abnormalAccounts.length} 个异常账户\n`);

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

    const results = [];
    
    // 只修复严重异常（critical）的账户
    const criticalAccounts = abnormalAccounts.filter(acc => 
        acc.issues.some(issue => issue.severity === 'critical')
    );
    
    console.log(`🎯 将修复 ${criticalAccounts.length} 个严重异常账户\n`);
    
    for (let i = 0; i < criticalAccounts.length; i++) {
        const account = criticalAccounts[i];
        console.log(`\n${"=".repeat(80)}`);
        console.log(`处理 ${i + 1}/${criticalAccounts.length}: ${account.user}`);
        console.log("=".repeat(80));
        
        const result = await fixAbnormalAccount(protocol, wallet, account);
        results.push({
            account: account.user,
            referrer: account.referrer,
            ...result
        });
        
        // 等待一段时间再处理下一个，避免 RPC 限流
        if (i < criticalAccounts.length - 1) {
            console.log(`\n⏸️  等待 3 秒后处理下一个账户...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // 验证修复结果
    console.log(`\n\n${"=".repeat(80)}`);
    console.log("🔍 验证修复结果...");
    console.log("=".repeat(80));
    
    const verificationResults = [];
    for (const account of criticalAccounts) {
        const verifyResult = await verifyFix(protocol, account);
        verificationResults.push({
            account: account.user,
            referrer: account.referrer,
            ...verifyResult
        });
    }

    // 输出结果
    console.log(`\n\n${"=".repeat(80)}`);
    console.log("📊 修复结果汇总");
    console.log("=".repeat(80));
    
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. 账户: ${result.account}`);
        console.log(`   推荐人: ${result.referrer}`);
        if (result.success) {
            if (result.fixed) {
                console.log(`   ✅ 修复成功`);
                console.log(`   旧团队人数: ${result.oldTeamCount}`);
                console.log(`   新团队人数: ${result.newTeamCount}`);
                console.log(`   交易哈希: ${result.txHash}`);
            } else {
                console.log(`   ℹ️  无需修复: ${result.reason}`);
            }
        } else {
            console.log(`   ❌ 修复失败: ${result.error || result.reason}`);
        }
    });

    console.log(`\n\n${"=".repeat(80)}`);
    console.log("🔍 验证结果");
    console.log("=".repeat(80));
    
    verificationResults.forEach((result, index) => {
        console.log(`\n${index + 1}. 推荐人: ${result.referrer}`);
        if (result.error) {
            console.log(`   ❌ 验证失败: ${result.error}`);
        } else {
            console.log(`   推荐人团队人数: ${result.referrerTeamCount}`);
            console.log(`   下级团队人数: ${result.userTeamCount}`);
            if (result.hasIssues) {
                console.log(`   ⚠️  仍有异常:`);
                result.issues.forEach(issue => {
                    console.log(`      - ${issue.message}`);
                });
            } else {
                console.log(`   ✅ 数据正常`);
            }
        }
    });

    // 保存结果
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `${outputDir}/fix-abnormal-accounts-result-${timestamp}.json`;
    
    const output = {
        timestamp: new Date().toISOString(),
        fixedAccounts: results,
        verificationResults: verificationResults,
        summary: {
            total: criticalAccounts.length,
            fixed: results.filter(r => r.fixed).length,
            failed: results.filter(r => !r.success).length,
            stillHasIssues: verificationResults.filter(r => r.hasIssues).length
        }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 结果已保存到: ${outputFile}`);
}

main().catch(error => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
});
