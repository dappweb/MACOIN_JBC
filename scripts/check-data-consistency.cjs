/**
 * 检查线上数据一致性
 * 对比已有数据文件，检查数据是否一致
 */

const fs = require("fs");
const path = require("path");

/**
 * 读取已有的团队数据
 */
function loadTeamCountsData() {
    const filePath = path.join(__dirname, '../output/team-counts-results.json');
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 未找到文件: ${filePath}`);
        return null;
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`✅ 加载团队数据: ${data.totalAddresses} 个用户 (查询时间: ${data.queryTime})`);
        return data;
    } catch (e) {
        console.error(`❌ 读取文件失败: ${e.message}`);
        return null;
    }
}

/**
 * 检查数据一致性
 */
function checkConsistency(teamData) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 数据一致性检查");
    console.log("=".repeat(80));
    
    const results = teamData.results || [];
    const issues = [];
    
    // 1. 检查基本字段完整性
    console.log("\n1️⃣ 检查基本字段完整性...");
    const requiredFields = ['address', 'referrer', 'activeDirects', 'teamCount', 'level', 'percent', 'isActive'];
    let missingFields = 0;
    
    results.forEach((user, index) => {
        requiredFields.forEach(field => {
            if (user[field] === undefined || user[field] === null) {
                missingFields++;
                if (issues.length < 10) { // 只显示前10个问题
                    issues.push({
                        type: 'missing_field',
                        user: user.address,
                        field: field,
                        index: index
                    });
                }
            }
        });
    });
    
    if (missingFields === 0) {
        console.log("   ✅ 所有用户的基本字段完整");
    } else {
        console.log(`   ⚠️  发现 ${missingFields} 个缺失字段`);
        if (issues.length > 0) {
            console.log("   前10个问题:");
            issues.forEach(issue => {
                console.log(`      - ${issue.user}: 缺失字段 ${issue.field}`);
            });
        }
    }
    
    // 2. 检查推荐人关系一致性
    console.log("\n2️⃣ 检查推荐人关系一致性...");
    const userMap = new Map();
    results.forEach(user => {
        userMap.set(user.address.toLowerCase(), user);
    });
    
    let invalidReferrers = 0;
    let selfReferrers = 0;
    let zeroReferrers = 0;
    
    results.forEach(user => {
        const referrer = user.referrer?.toLowerCase();
        const address = user.address.toLowerCase();
        
        if (!referrer || referrer === '0x0000000000000000000000000000000000000000') {
            zeroReferrers++;
        } else if (referrer === address) {
            selfReferrers++;
            if (issues.length < 20) {
                issues.push({
                    type: 'self_referrer',
                    user: user.address,
                    referrer: referrer
                });
            }
        } else if (!userMap.has(referrer)) {
            invalidReferrers++;
            if (issues.length < 20) {
                issues.push({
                    type: 'invalid_referrer',
                    user: user.address,
                    referrer: referrer
                });
            }
        }
    });
    
    console.log(`   无推荐人: ${zeroReferrers} 个`);
    console.log(`   自推荐: ${selfReferrers} 个`);
    console.log(`   推荐人不在列表中: ${invalidReferrers} 个`);
    
    if (selfReferrers === 0 && invalidReferrers === 0) {
        console.log("   ✅ 推荐人关系一致");
    } else {
        console.log("   ⚠️  发现推荐人关系问题");
    }
    
    // 3. 检查等级和团队人数的一致性
    console.log("\n3️⃣ 检查等级和团队人数的一致性...");
    // 修正后的等级规则（与合约中的_getLevel函数一致）
    const levelRules = {
        0: { min: 0, max: 9 },           // V0: 0-9
        1: { min: 10, max: 29 },          // V1: 10-29
        2: { min: 30, max: 99 },          // V2: 30-99
        3: { min: 100, max: 299 },        // V3: 100-299
        4: { min: 300, max: 999 },        // V4: 300-999
        5: { min: 1000, max: 2999 },      // V5: 1000-2999
        6: { min: 3000, max: 9999 },      // V6: 3000-9999
        7: { min: 10000, max: 29999 },    // V7: 10000-29999
        8: { min: 30000, max: 99999 },    // V8: 30000-99999
        9: { min: 100000, max: Infinity } // V9: 100000+
    };
    
    let levelMismatches = 0;
    results.forEach(user => {
        const level = user.level || 0;
        const teamCount = user.teamCount || 0;
        const rule = levelRules[level] || levelRules[0];
        
        if (teamCount < rule.min || teamCount > rule.max) {
            levelMismatches++;
            if (issues.length < 30) {
                issues.push({
                    type: 'level_mismatch',
                    user: user.address,
                    level: level,
                    teamCount: teamCount,
                    expectedRange: `${rule.min}-${rule.max === Infinity ? '∞' : rule.max}`
                });
            }
        }
    });
    
    if (levelMismatches === 0) {
        console.log("   ✅ 所有用户的等级与团队人数匹配");
    } else {
        console.log(`   ⚠️  发现 ${levelMismatches} 个等级不匹配的用户`);
    }
    
    // 4. 检查直推人数和团队人数的逻辑
    console.log("\n4️⃣ 检查直推人数和团队人数的逻辑...");
    let logicIssues = 0;
    results.forEach(user => {
        const activeDirects = user.activeDirects || 0;
        const teamCount = user.teamCount || 0;
        
        // 团队人数应该 >= 直推人数
        if (teamCount < activeDirects) {
            logicIssues++;
            if (issues.length < 40) {
                issues.push({
                    type: 'logic_error',
                    user: user.address,
                    activeDirects: activeDirects,
                    teamCount: teamCount,
                    message: '团队人数小于直推人数'
                });
            }
        }
    });
    
    if (logicIssues === 0) {
        console.log("   ✅ 直推人数和团队人数逻辑正确");
    } else {
        console.log(`   ⚠️  发现 ${logicIssues} 个逻辑错误`);
    }
    
    // 5. 检查重复地址
    console.log("\n5️⃣ 检查重复地址...");
    const addressSet = new Set();
    const duplicates = [];
    
    results.forEach(user => {
        const addr = user.address.toLowerCase();
        if (addressSet.has(addr)) {
            duplicates.push(addr);
        } else {
            addressSet.add(addr);
        }
    });
    
    if (duplicates.length === 0) {
        console.log("   ✅ 没有重复地址");
    } else {
        console.log(`   ⚠️  发现 ${duplicates.length} 个重复地址`);
        duplicates.slice(0, 10).forEach(addr => {
            console.log(`      - ${addr}`);
        });
    }
    
    // 6. 统计信息验证
    console.log("\n6️⃣ 验证统计信息...");
    const stats = teamData.statistics || {};
    const calculatedTotalTeamCount = results.reduce((sum, r) => sum + (r.teamCount || 0), 0);
    const calculatedAvgTeamCount = results.length > 0 ? (calculatedTotalTeamCount / results.length).toFixed(2) : 0;
    
    console.log(`   总团队人数: 统计=${stats.totalTeamCount}, 计算=${calculatedTotalTeamCount}`);
    console.log(`   平均团队人数: 统计=${stats.avgTeamCount}, 计算=${calculatedAvgTeamCount}`);
    
    if (stats.totalTeamCount === calculatedTotalTeamCount && 
        parseFloat(stats.avgTeamCount) === parseFloat(calculatedAvgTeamCount)) {
        console.log("   ✅ 统计信息一致");
    } else {
        console.log("   ⚠️  统计信息不一致");
    }
    
    // 7. 等级分布验证
    console.log("\n7️⃣ 验证等级分布...");
    const calculatedLevelDist = {};
    results.forEach(r => {
        const level = `V${r.level || 0}`;
        calculatedLevelDist[level] = (calculatedLevelDist[level] || 0) + 1;
    });
    
    const reportedLevelDist = stats.levelDistribution || {};
    let levelDistMatch = true;
    
    Object.keys(calculatedLevelDist).forEach(level => {
        const calculated = calculatedLevelDist[level];
        const reported = reportedLevelDist[level] || 0;
        if (calculated !== reported) {
            levelDistMatch = false;
            console.log(`   ⚠️  ${level}: 统计=${reported}, 计算=${calculated}`);
        }
    });
    
    if (levelDistMatch) {
        console.log("   ✅ 等级分布一致");
    } else {
        console.log("   ⚠️  等级分布不一致");
    }
    
    // 汇总
    console.log("\n" + "=".repeat(80));
    console.log("📊 检查结果汇总");
    console.log("=".repeat(80));
    
    const totalIssues = missingFields + selfReferrers + invalidReferrers + levelMismatches + logicIssues + duplicates.length;
    
    if (totalIssues === 0) {
        console.log("\n✅ 数据一致性检查通过！所有数据都是一致的。");
    } else {
        console.log(`\n⚠️  发现 ${totalIssues} 个潜在问题:`);
        console.log(`   - 缺失字段: ${missingFields}`);
        console.log(`   - 自推荐: ${selfReferrers}`);
        console.log(`   - 无效推荐人: ${invalidReferrers}`);
        console.log(`   - 等级不匹配: ${levelMismatches}`);
        console.log(`   - 逻辑错误: ${logicIssues}`);
        console.log(`   - 重复地址: ${duplicates.length}`);
        
        if (issues.length > 0) {
            console.log("\n详细问题列表（前40个）:");
            issues.slice(0, 40).forEach((issue, index) => {
                console.log(`\n${index + 1}. ${issue.type}`);
                console.log(`   用户: ${issue.user}`);
                if (issue.field) console.log(`   字段: ${issue.field}`);
                if (issue.referrer) console.log(`   推荐人: ${issue.referrer}`);
                if (issue.level !== undefined) console.log(`   等级: V${issue.level}, 团队人数: ${issue.teamCount}`);
                if (issue.expectedRange) console.log(`   期望范围: ${issue.expectedRange}`);
                if (issue.message) console.log(`   问题: ${issue.message}`);
            });
        }
    }
    
    // 保存检查报告
    const reportFile = path.join(__dirname, '../output/data-consistency-report.json');
    const report = {
        checkTime: new Date().toISOString(),
        totalUsers: results.length,
        totalIssues: totalIssues,
        issues: {
            missingFields,
            selfReferrers,
            invalidReferrers,
            levelMismatches,
            logicIssues,
            duplicates: duplicates.length
        },
        details: issues.slice(0, 100), // 保存前100个问题
        statistics: {
            reported: stats,
            calculated: {
                totalTeamCount: calculatedTotalTeamCount,
                avgTeamCount: parseFloat(calculatedAvgTeamCount),
                levelDistribution: calculatedLevelDist
            }
        }
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 检查报告已保存到: ${reportFile}`);
}

/**
 * 主函数
 */
function main() {
    console.log("🔍 开始检查线上数据一致性...\n");
    
    const teamData = loadTeamCountsData();
    if (!teamData) {
        console.error("❌ 无法加载数据文件");
        process.exit(1);
    }
    
    checkConsistency(teamData);
    
    console.log("\n✅ 检查完成！");
}

main();
