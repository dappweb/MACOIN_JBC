#!/usr/bin/env node
/**
 * 平台财务数据：用户统计、收票额度、累计收益、已售出门票总额、可能盈利额等。
 * 已售出门票总额从 TicketPurchased 事件汇总（新+旧合约）；可能盈利额 = 已售出门票总额 - 平台总累计收益。
 *
 * 使用方法:
 *   node scripts/get-platform-financial-data.cjs
 *   node scripts/get-platform-financial-data.cjs --usd --mc-usd 0.5   # 以美元为单位输出已售出门票总额与可能盈利额
 *   MC_USD=0.5 node scripts/get-platform-financial-data.cjs --usd
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// MC Chain 配置
const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

function parseMcUsd() {
    const i = process.argv.indexOf("--mc-usd");
    if (i >= 0 && process.argv[i + 1]) {
        const v = parseFloat(process.argv[i + 1]);
        if (!Number.isNaN(v) && v > 0) return v;
    }
    const env = process.env.MC_USD;
    if (env) {
        const v = parseFloat(env);
        if (!Number.isNaN(v) && v > 0) return v;
    }
    return null;
}

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "function nextTicketId() view returns (uint256)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

async function getAllUsers() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 查询所有用户地址...\n");

    // 获取当前区块号
    const currentBlock = await provider.getBlockNumber();
    // 从合约部署开始查询（合约部署在区块约 2000000 左右）
    const fromBlock = Math.max(0, currentBlock - 1000000); // 查询最近100万个区块，确保覆盖所有用户

    console.log(`  查询区块范围: ${fromBlock} 到 ${currentBlock} (共 ${currentBlock - fromBlock} 个区块)\n`);

    // 提取所有唯一的用户地址
    const userSet = new Set();

    // 1. 查询 BoundReferrer 事件（绑定推荐人时触发，包括所有注册用户）
    console.log("  查询 BoundReferrer 事件...");
    try {
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock
        );
        console.log(`    找到 ${boundEvents.length} 个 BoundReferrer 事件`);
        
        boundEvents.forEach(event => {
            if (event.args && event.args.user) {
                userSet.add(event.args.user.toLowerCase());
            }
            if (event.args && event.args.referrer && event.args.referrer !== ethers.ZeroAddress) {
                userSet.add(event.args.referrer.toLowerCase());
            }
        });
    } catch (error) {
        console.error(`    查询 BoundReferrer 事件失败: ${error.message}`);
    }

    // 2. 查询 TicketPurchased 事件（购买门票时触发）
    console.log("  查询 TicketPurchased 事件...");
    try {
        const ticketEvents = await protocol.queryFilter(
            protocol.filters.TicketPurchased(),
            fromBlock
        );
        console.log(`    找到 ${ticketEvents.length} 个 TicketPurchased 事件`);
        
        ticketEvents.forEach(event => {
            if (event.args && event.args.user) {
                userSet.add(event.args.user.toLowerCase());
            }
        });
    } catch (error) {
        console.error(`    查询 TicketPurchased 事件失败: ${error.message}`);
    }

    const users = Array.from(userSet);
    console.log(`\n✅ 找到 ${users.length} 个唯一用户地址\n`);
    return users;
}

async function getPlatformFinancialData() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const useUsd = process.argv.includes("--usd");
    const mcUsd = useUsd ? parseMcUsd() : null;

    console.log("📊 查询平台财务数据\n");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`协议地址: ${PROTOCOL_ADDRESS}`);
    if (useUsd && mcUsd) {
        console.log(`单位: 美元(USD)，MC/USD 汇率: ${mcUsd}`);
    } else if (useUsd && !mcUsd) {
        console.log("⚠️  已指定 --usd 但未提供 MC/USD 汇率。可设置 MC_USD 或 --mc-usd <汇率>");
    }
    console.log("=".repeat(80) + "\n");

    try {
        // 查询已售出门票总额（新+旧合约 TicketPurchased）
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 2_000_000);
        console.log("📌 查询已售出门票总额（新+旧合约 TicketPurchased）...");
        const [newTicketEvents, oldTicketEvents] = await Promise.all([
            protocol.queryFilter(protocol.filters.TicketPurchased(), fromBlock),
            oldProtocol.queryFilter(oldProtocol.filters.TicketPurchased(), fromBlock),
        ]);
        let totalTicketSoldWei = 0n;
        for (const e of newTicketEvents) {
            if (e.args?.amount) totalTicketSoldWei += BigInt(e.args.amount.toString());
        }
        for (const e of oldTicketEvents) {
            if (e.args?.amount) totalTicketSoldWei += BigInt(e.args.amount.toString());
        }
        console.log(`   新合约: ${newTicketEvents.length} 条，旧合约: ${oldTicketEvents.length} 条，已售出门票总额: ${ethers.formatEther(totalTicketSoldWei)} MC\n`);

        // 获取所有用户
        const users = await getAllUsers();

        if (users.length === 0) {
            console.log("❌ 未找到任何用户");
            return;
        }

        console.log("📋 开始查询用户财务数据...\n");

        let totalCurrentCap = 0n;        // 总收票额度（所有用户的 currentCap 总和）
        let totalRevenue = 0n;            // 总累计收益（所有用户的 totalRevenue 总和）
        let totalRemainingCap = 0n;       // 总剩余可用额度
        let activeUsers = 0;              // 活跃用户数
        let usersWithTicket = 0;          // 有门票的用户数
        let totalTeamCount = 0n;          // 总团队人数
        let totalTeamTotalCap = 0n;       // 总团队上限
        let totalTeamTotalVolume = 0n;    // 总团队交易量
        let totalMaxTicketAmount = 0n;    // 总最大门票金额
        let totalRefundFeeAmount = 0n;    // 总退款费用

        const userData = [];
        let processed = 0;
        let errors = 0;

        // 批量查询用户数据
        const batchSize = 50;
        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (userAddress) => {
                try {
                    const userInfo = await protocol.userInfo(userAddress);
                    const userTicket = await protocol.userTicket(userAddress);

                    const currentCap = userInfo.currentCap || 0n;
                    const totalRevenueUser = userInfo.totalRevenue || 0n;
                    const remainingCap = currentCap > totalRevenueUser ? currentCap - totalRevenueUser : 0n;

                    // 累计统计
                    totalCurrentCap += currentCap;
                    totalRevenue += totalRevenueUser;
                    totalRemainingCap += remainingCap;
                    totalTeamCount += userInfo.teamCount || 0n;
                    totalTeamTotalCap += userInfo.teamTotalCap || 0n;
                    totalTeamTotalVolume += userInfo.teamTotalVolume || 0n;
                    totalMaxTicketAmount += userInfo.maxTicketAmount || 0n;
                    totalRefundFeeAmount += userInfo.refundFeeAmount || 0n;

                    if (userInfo.isActive) activeUsers++;
                    if (userTicket && userTicket.ticketId > 0n) usersWithTicket++;

                    return {
                        address: userAddress,
                        isActive: userInfo.isActive,
                        hasTicket: userTicket && userTicket.ticketId > 0n,
                        currentCap: ethers.formatEther(currentCap),
                        totalRevenue: ethers.formatEther(totalRevenueUser),
                        remainingCap: ethers.formatEther(remainingCap),
                        teamCount: userInfo.teamCount.toString(),
                        ticketAmount: userTicket ? ethers.formatEther(userTicket.amount) : '0'
                    };
                } catch (error) {
                    console.error(`  查询用户 ${userAddress} 失败:`, error.message);
                    return null;
                }
            });

            const results = await Promise.all(batchPromises);
            const validResults = results.filter(r => r !== null);
            userData.push(...validResults);
            processed += validResults.length;
            errors += results.length - validResults.length;

            // 显示进度
            const progress = ((i + batch.length) / users.length * 100).toFixed(1);
            process.stdout.write(`\r📊 进度: ${processed}/${users.length} (${progress}%) - 错误: ${errors}`);
        }

        console.log("\n");

        // 计算平均值
        const avgCurrentCap = processed > 0 ? totalCurrentCap / BigInt(processed) : 0n;
        const avgRevenue = processed > 0 ? totalRevenue / BigInt(processed) : 0n;
        const avgRemainingCap = processed > 0 ? totalRemainingCap / BigInt(processed) : 0n;

        // 输出统计结果
        console.log("\n" + "=".repeat(80));
        console.log("📊 平台财务数据汇总");
        console.log("=".repeat(80));
        console.log("");
        
        console.log("👥 用户统计:");
        console.log(`  总用户数: ${users.length}`);
        console.log(`  已处理用户: ${processed}`);
        console.log(`  查询错误: ${errors}`);
        console.log(`  活跃用户: ${activeUsers}`);
        console.log(`  有门票用户: ${usersWithTicket}`);
        console.log(`  总团队人数: ${totalTeamCount.toString()}`);
        console.log("");

        const totalTicketSoldMC = Number(ethers.formatEther(totalTicketSoldWei));
        const totalTicketSoldUSD = mcUsd ? totalTicketSoldMC * mcUsd : null;
        const possibleProfitWei = totalTicketSoldWei > totalRevenue ? totalTicketSoldWei - totalRevenue : 0n;
        const possibleProfitMC = Number(ethers.formatEther(possibleProfitWei));
        const possibleProfitUSD = mcUsd ? possibleProfitMC * mcUsd : null;

        console.log("🎫 已售出门票总额（单位: 美金 USD / MC）:");
        if (useUsd && totalTicketSoldUSD != null) {
            console.log(`  已售出门票总额: ${totalTicketSoldUSD.toFixed(2)} USD（${totalTicketSoldMC.toFixed(4)} MC）`);
        } else {
            console.log(`  已售出门票总额: ${totalTicketSoldMC.toFixed(4)} MC`);
        }
        console.log("");

        console.log("📊 可能盈利额（估算 = 已售出门票总额 - 平台总累计收益）:");
        if (useUsd && possibleProfitUSD != null) {
            console.log(`  可能盈利额: ${possibleProfitUSD.toFixed(2)} USD（${possibleProfitMC.toFixed(4)} MC）`);
        } else {
            console.log(`  可能盈利额: ${possibleProfitMC.toFixed(4)} MC`);
        }
        console.log("");

        console.log("💰 收票额度统计:");
        console.log(`  平台总收票额度 (总 currentCap): ${ethers.formatEther(totalCurrentCap)} MC`);
        console.log(`  平均每用户收票额度: ${ethers.formatEther(avgCurrentCap)} MC`);
        console.log("");

        console.log("💵 累计收益统计:");
        console.log(`  平台总累计收益 (总 totalRevenue): ${ethers.formatEther(totalRevenue)} MC`);
        console.log(`  平均每用户累计收益: ${ethers.formatEther(avgRevenue)} MC`);
        console.log("");

        console.log("📈 剩余可用额度统计:");
        console.log(`  平台总剩余可用额度: ${ethers.formatEther(totalRemainingCap)} MC`);
        console.log(`  平均每用户剩余额度: ${ethers.formatEther(avgRemainingCap)} MC`);
        console.log("");

        console.log("📊 其他财务数据:");
        console.log(`  总团队上限 (teamTotalCap): ${ethers.formatEther(totalTeamTotalCap)} MC`);
        console.log(`  总团队交易量 (teamTotalVolume): ${ethers.formatEther(totalTeamTotalVolume)} MC`);
        console.log(`  总最大门票金额 (maxTicketAmount): ${ethers.formatEther(totalMaxTicketAmount)} MC`);
        console.log(`  总退款费用 (refundFeeAmount): ${ethers.formatEther(totalRefundFeeAmount)} MC`);
        console.log("");

        // 计算使用率
        const utilizationRate = totalCurrentCap > 0n 
            ? (Number(totalRevenue * 10000n / totalCurrentCap) / 100).toFixed(2)
            : '0.00';
        
        console.log("📉 使用率分析:");
        console.log(`  收票额度使用率: ${utilizationRate}%`);
        console.log(`  已使用额度: ${ethers.formatEther(totalRevenue)} MC`);
        console.log(`  剩余可用额度: ${ethers.formatEther(totalRemainingCap)} MC`);
        console.log("");

        // 保存详细数据到文件
        const outputDir = path.join(__dirname, '../output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const jsonFile = path.join(outputDir, `platform-financial-data-${timestamp}.json`);
        const csvFile = path.join(outputDir, `platform-financial-data-${timestamp}.csv`);

        // 保存 JSON
        const outputData = {
            queryTime: new Date().toISOString(),
            protocolAddress: PROTOCOL_ADDRESS,
            summary: {
                totalUsers: users.length,
                processedUsers: processed,
                errors: errors,
                activeUsers: activeUsers,
                usersWithTicket: usersWithTicket,
                totalTeamCount: totalTeamCount.toString(),
                totalTicketSoldMC: totalTicketSoldMC.toFixed(4),
                totalTicketSoldUSD: totalTicketSoldUSD != null ? totalTicketSoldUSD.toFixed(2) : null,
                possibleProfitMC: possibleProfitMC.toFixed(4),
                possibleProfitUSD: possibleProfitUSD != null ? possibleProfitUSD.toFixed(2) : null,
                totalCurrentCap: ethers.formatEther(totalCurrentCap),
                totalRevenue: ethers.formatEther(totalRevenue),
                totalRemainingCap: ethers.formatEther(totalRemainingCap),
                totalTeamTotalCap: ethers.formatEther(totalTeamTotalCap),
                totalTeamTotalVolume: ethers.formatEther(totalTeamTotalVolume),
                totalMaxTicketAmount: ethers.formatEther(totalMaxTicketAmount),
                totalRefundFeeAmount: ethers.formatEther(totalRefundFeeAmount),
                utilizationRate: utilizationRate + '%',
                avgCurrentCap: ethers.formatEther(avgCurrentCap),
                avgRevenue: ethers.formatEther(avgRevenue),
                avgRemainingCap: ethers.formatEther(avgRemainingCap)
            },
            userData: userData
        };

        fs.writeFileSync(jsonFile, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`✅ 详细数据已保存到: ${jsonFile}`);

        // 保存 CSV
        const csvHeader = '地址,是否活跃,有门票,收票额度(MC),累计收益(MC),剩余额度(MC),团队人数,门票金额(MC)\n';
        const csvRows = userData.map(u => 
            `${u.address},${u.isActive},${u.hasTicket},${u.currentCap},${u.totalRevenue},${u.remainingCap},${u.teamCount},${u.ticketAmount}`
        ).join('\n');
        fs.writeFileSync(csvFile, csvHeader + csvRows, 'utf8');
        console.log(`✅ CSV数据已保存到: ${csvFile}`);

        console.log("\n" + "=".repeat(80));
        console.log("✅ 查询完成");
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
        process.exit(1);
    }
}

// 运行脚本
getPlatformFinancialData().catch(console.error);
