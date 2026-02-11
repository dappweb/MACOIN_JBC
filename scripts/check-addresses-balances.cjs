/**
 * 查询多个地址的币余额和资产情况
 * 包括: MC余额、JBC余额、门票、流动性质押、团队信息
 * 以及下面团队成员的总余额
 * 
 * 用法: node scripts/check-addresses-balances.cjs
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const JBC_ADDRESS = "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";

// 要查询的地址
const TARGET_ADDRESS = "0x293ba423b0a4bf19805aD25fb0425aA168753737";
const OTHER_ADDRESSES = [
    "0x7B1A4Cf4bA1ABF46cBEF6c52D7f7aABf3a677bc",
    "0x64668F492589A10127A46A7Ee26152932A73Cd8e",
    "0x9CCA61f1dF31BC07BA814f956204cfaDB46c1Ba2",
    "0x4429aE0804A583940685AbB0AAb926d64D041105",
    "0xEEC24A4C2ecbAf678243Bd0efd72656fB40A1993",
];

const ALL_ADDRESSES = [TARGET_ADDRESS, ...OTHER_ADDRESSES];

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function userStakes(address, uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)",
    "function getDirectReferrals(address) view returns (address[])",
    "function getUserLevel(address) view returns (uint256 level, uint256 percent, uint256 teamCount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

const JBC_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

async function getTeamMembersRecursive(address, protocol, provider, referrerToUsers, visited = new Set()) {
    const addr = address.toLowerCase();
    if (visited.has(addr)) return [];
    visited.add(addr);
    
    const directReferrals = referrerToUsers.get(addr) || [];
    let allMembers = [...directReferrals];
    
    for (const member of directReferrals) {
        const subMembers = await getTeamMembersRecursive(member, protocol, provider, referrerToUsers, visited);
        allMembers = allMembers.concat(subMembers);
    }
    
    return allMembers;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const jbcToken = new ethers.Contract(JBC_ADDRESS, JBC_ABI, provider);

    console.log("\n" + "═".repeat(80));
    console.log("  查询地址余额和团队资产报告");
    console.log("  查询时间:", new Date().toLocaleString('zh-CN'));
    console.log("═".repeat(80));

    // ====== 第1部分：查询每个地址的个人资产 ======
    console.log("\n" + "━".repeat(80));
    console.log("  第1部分：各地址个人资产");
    console.log("━".repeat(80));

    for (const addr of ALL_ADDRESSES) {
        console.log(`\n${"─".repeat(70)}`);
        console.log(`  地址: ${addr}`);
        console.log(`${"─".repeat(70)}`);

        try {
            // MC 余额
            const mcBalance = await provider.getBalance(addr);
            console.log(`  MC 余额:  ${ethers.formatEther(mcBalance)} MC`);

            // JBC 余额
            const jbcBalance = await jbcToken.balanceOf(addr);
            console.log(`  JBC 余额: ${ethers.formatEther(jbcBalance)} JBC`);

            // 用户信息
            const info = await protocol.userInfo(addr);
            console.log(`  推荐人:   ${info.referrer}`);
            console.log(`  是否激活: ${info.isActive}`);
            console.log(`  直推数:   ${info.activeDirects.toString()}`);
            console.log(`  团队人数: ${info.teamCount.toString()}`);
            console.log(`  总收益:   ${ethers.formatEther(info.totalRevenue)} MC`);
            console.log(`  收益上限: ${ethers.formatEther(info.currentCap)} MC`);
            console.log(`  剩余额度: ${ethers.formatEther(info.currentCap - info.totalRevenue)} MC`);
            console.log(`  团队总交易量: ${ethers.formatEther(info.teamTotalVolume)} MC`);

            // 等级
            try {
                const levelInfo = await protocol.getUserLevel(addr);
                const levelNames = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5'];
                console.log(`  等级:     ${levelNames[Number(levelInfo.level)] || `V${levelInfo.level}`} (奖励 ${Number(levelInfo.percent) / 100}%)`);
            } catch (e) {
                console.log(`  等级:     (不可用)`);
            }

            // 门票
            const ticket = await protocol.userTicket(addr);
            const ticketAmount = ticket.amount ?? 0n;
            if (ticket.ticketId > 0n || ticketAmount > 0n) {
                console.log(`  门票:     ${ethers.formatEther(ticketAmount)} MC (ID:${ticket.ticketId}, 退出:${ticket.exited})`);
            } else {
                console.log(`  门票:     无`);
            }

            // 流动性质押
            let totalStaked = 0n;
            let activeStakeCount = 0;
            for (let i = 0; i < 100; i++) {
                try {
                    const s = await protocol.userStakes(addr, i);
                    if (Number(s.id ?? 0) === 0) break;
                    if (s.active) {
                        totalStaked += s.amount;
                        activeStakeCount++;
                    }
                } catch (_) {
                    break;
                }
            }
            console.log(`  流动性质押: ${ethers.formatEther(totalStaked)} MC (${activeStakeCount} 笔活跃)`);

        } catch (e) {
            console.log(`  ❌ 查询失败: ${e.message}`);
        }
    }

    // ====== 第2部分：查询目标地址下面团队的总资产 ======
    console.log("\n\n" + "━".repeat(80));
    console.log("  第2部分：查询地址下面团队成员的总币量");
    console.log("━".repeat(80));

    // 从事件获取所有推荐关系
    console.log("\n  正在从链上获取推荐关系...");
    const referrerToUsers = new Map();
    const allUsers = new Set();

    for (const proto of [protocol, oldProtocol]) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const events = await proto.queryFilter(
                proto.filters.BoundReferrer(),
                0,
                currentBlock
            );
            events.forEach(event => {
                if (event.args && event.args.referrer && event.args.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    allUsers.add(user);
                    allUsers.add(referrer);
                    if (!referrerToUsers.has(referrer)) {
                        referrerToUsers.set(referrer, []);
                    }
                    // 避免重复
                    if (!referrerToUsers.get(referrer).includes(user)) {
                        referrerToUsers.get(referrer).push(user);
                    }
                }
            });
        } catch (error) {
            console.warn(`  ⚠ 获取事件失败: ${error.message}`);
        }
    }
    console.log(`  ✅ 总用户数: ${allUsers.size}`);

    // 查询目标地址和其他地址下面的团队资产
    for (const checkAddr of ALL_ADDRESSES) {
        const addrLower = checkAddr.toLowerCase();
        const directReferrals = referrerToUsers.get(addrLower) || [];
        
        // 递归获取所有团队成员
        const allTeamMembers = [];
        const visited = new Set();
        
        function collectTeam(addr) {
            if (visited.has(addr)) return;
            visited.add(addr);
            const referrals = referrerToUsers.get(addr) || [];
            for (const r of referrals) {
                allTeamMembers.push(r);
                collectTeam(r);
            }
        }
        collectTeam(addrLower);
        
        console.log(`\n${"─".repeat(70)}`);
        console.log(`  地址: ${checkAddr}`);
        console.log(`  直推人数: ${directReferrals.length}`);
        console.log(`  团队总人数(链上事件): ${allTeamMembers.length}`);
        console.log(`${"─".repeat(70)}`);

        if (allTeamMembers.length === 0) {
            console.log(`  该地址下面没有团队成员`);
            continue;
        }

        // 查询团队所有成员的余额
        let teamTotalMC = 0n;
        let teamTotalJBC = 0n;
        let teamTotalTicket = 0n;
        let teamTotalStake = 0n;
        let memberDetails = [];

        for (const member of allTeamMembers) {
            try {
                const mcBal = await provider.getBalance(member);
                const jbcBal = await jbcToken.balanceOf(member);
                
                // 门票
                let ticketAmt = 0n;
                try {
                    const ticket = await protocol.userTicket(member);
                    if (!ticket.exited) {
                        ticketAmt = ticket.amount ?? 0n;
                    }
                } catch (_) {}

                // 活跃质押
                let stakeAmt = 0n;
                for (let i = 0; i < 50; i++) {
                    try {
                        const s = await protocol.userStakes(member, i);
                        if (Number(s.id ?? 0) === 0) break;
                        if (s.active) stakeAmt += s.amount;
                    } catch (_) { break; }
                }

                teamTotalMC += mcBal;
                teamTotalJBC += jbcBal;
                teamTotalTicket += ticketAmt;
                teamTotalStake += stakeAmt;

                const totalAssets = mcBal + jbcBal + ticketAmt + stakeAmt;
                if (totalAssets > 0n) {
                    memberDetails.push({
                        address: member,
                        mc: mcBal,
                        jbc: jbcBal,
                        ticket: ticketAmt,
                        stake: stakeAmt,
                        total: totalAssets,
                    });
                }
            } catch (e) {
                // console.log(`  ⚠ 查询 ${member} 失败: ${e.message}`);
            }
        }

        // 排序按总资产从高到低
        memberDetails.sort((a, b) => (b.total > a.total ? 1 : -1));

        console.log(`\n  📊 团队资产汇总 (${allTeamMembers.length} 人):`);
        console.log(`  ├─ MC 总余额:     ${ethers.formatEther(teamTotalMC)} MC`);
        console.log(`  ├─ JBC 总余额:    ${ethers.formatEther(teamTotalJBC)} JBC`);
        console.log(`  ├─ 门票总金额:    ${ethers.formatEther(teamTotalTicket)} MC`);
        console.log(`  ├─ 活跃质押总额:  ${ethers.formatEther(teamTotalStake)} MC`);
        console.log(`  └─ 总资产合计:    ${ethers.formatEther(teamTotalMC + teamTotalJBC + teamTotalTicket + teamTotalStake)} (MC+JBC)`);

        // 显示前20个有资产的成员
        if (memberDetails.length > 0) {
            console.log(`\n  有资产的成员 (共 ${memberDetails.length} 人, 显示前20):`);
            memberDetails.slice(0, 20).forEach((m, i) => {
                console.log(`    ${i + 1}. ${m.address}`);
                console.log(`       MC=${ethers.formatEther(m.mc)} JBC=${ethers.formatEther(m.jbc)} 门票=${ethers.formatEther(m.ticket)} 质押=${ethers.formatEther(m.stake)}`);
            });
        }
    }

    console.log("\n\n" + "═".repeat(80));
    console.log("  ✅ 查询完成");
    console.log("═".repeat(80) + "\n");
}

main().catch((e) => {
    console.error("❌ 错误:", e);
    process.exit(1);
});
