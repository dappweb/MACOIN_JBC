const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = "https://chain.mcerscan.com/";
const NEW_ADDR = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_ADDR = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const ABI = [
    "event BoundReferrer(address indexed user, address indexed referrer)",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
];

const BATCH = 20;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const oldC = new ethers.Contract(OLD_ADDR, ABI, provider);
    const newC = new ethers.Contract(NEW_ADDR, ABI, provider);
    const block = await provider.getBlockNumber();

    console.log("\n" + "═".repeat(70));
    console.log("  新旧合约数据完整性对比");
    console.log("  当前区块:", block);
    console.log("═".repeat(70));

    // 1. 事件级别用户集合
    console.log("\n  [1] 获取事件用户列表...");
    const oldUsers = new Set();
    const newUsers = new Set();

    const oldEvents = await oldC.queryFilter(oldC.filters.BoundReferrer(), 0, block);
    oldEvents.forEach(e => {
        oldUsers.add(e.args.user.toLowerCase());
        oldUsers.add(e.args.referrer.toLowerCase());
    });

    const newEvents = await newC.queryFilter(newC.filters.BoundReferrer(), 0, block);
    newEvents.forEach(e => {
        newUsers.add(e.args.user.toLowerCase());
        newUsers.add(e.args.referrer.toLowerCase());
    });

    console.log("  旧合约用户(事件):", oldUsers.size);
    console.log("  新合约用户(事件):", newUsers.size);

    const onlyInOld = [...oldUsers].filter(u => !newUsers.has(u));
    const onlyInNew = [...newUsers].filter(u => !oldUsers.has(u));
    const inBoth = [...oldUsers].filter(u => newUsers.has(u));
    console.log("  两者都有:", inBoth.length);
    console.log("  仅旧合约:", onlyInOld.length);
    console.log("  仅新合约:", onlyInNew.length);

    if (onlyInOld.length > 0) {
        console.log("\n  仅在旧合约中的用户:");
        for (const addr of onlyInOld) {
            console.log("    " + addr);
        }
    }

    // 2. 逐用户对比：推荐关系 + 门票
    console.log("\n  [2] 逐用户对比推荐关系和门票...");
    const allOld = [...oldUsers];
    const missing = [];
    let refOk = 0, refMissing = 0;
    let ticketOk = 0, ticketMissing = 0, ticketDiff = 0;
    let oldActiveTickets = 0;

    for (let i = 0; i < allOld.length; i += BATCH) {
        const batch = allOld.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (addr) => {
            try {
                const [oldInfo, oldTicket, newInfo, newTicket] = await Promise.all([
                    oldC.userInfo(addr),
                    oldC.userTicket(addr),
                    newC.userInfo(addr),
                    newC.userTicket(addr),
                ]);
                return { addr, oldInfo, oldTicket, newInfo, newTicket };
            } catch (e) {
                return { addr, error: e.message };
            }
        }));

        for (const r of results) {
            if (r.error) continue;
            const zero = ethers.ZeroAddress.toLowerCase();
            const oldRef = r.oldInfo.referrer.toLowerCase();
            const newRef = r.newInfo.referrer.toLowerCase();

            // 推荐关系检查
            if (oldRef !== zero) {
                if (newRef !== zero) {
                    refOk++;
                    if (oldRef !== newRef) {
                        missing.push({ addr: r.addr, issue: `推荐人变更: 旧=${oldRef.slice(0,10)}... 新=${newRef.slice(0,10)}...` });
                    }
                } else {
                    refMissing++;
                    missing.push({ addr: r.addr, issue: `旧有推荐人(${oldRef.slice(0,10)}...)但新合约无` });
                }
            }

            // 门票检查
            if (r.oldTicket.amount > 0n && !r.oldTicket.exited) {
                oldActiveTickets++;
                if (r.newTicket.amount > 0n && !r.newTicket.exited) {
                    if (r.oldTicket.amount === r.newTicket.amount) {
                        ticketOk++;
                    } else {
                        ticketDiff++;
                        missing.push({
                            addr: r.addr,
                            issue: `门票金额不同: 旧=${ethers.formatEther(r.oldTicket.amount)} 新=${ethers.formatEther(r.newTicket.amount)}`
                        });
                    }
                } else {
                    ticketMissing++;
                    missing.push({
                        addr: r.addr,
                        issue: `旧有活跃门票(${ethers.formatEther(r.oldTicket.amount)} MC) 新合约无`
                    });
                }
            }
        }
        process.stdout.write(`\r  已检查 ${Math.min(i + BATCH, allOld.length)}/${allOld.length} ...`);
    }

    // 3. 输出结果
    console.log("\n\n" + "━".repeat(70));
    console.log("  一、推荐关系");
    console.log("━".repeat(70));
    console.log("  旧合约有推荐人 → 新合约也有:", refOk);
    console.log("  旧合约有推荐人 → 新合约缺失:", refMissing);

    console.log("\n" + "━".repeat(70));
    console.log("  二、门票数据");
    console.log("━".repeat(70));
    console.log("  旧合约活跃门票:", oldActiveTickets);
    console.log("  已迁移且金额一致:", ticketOk);
    console.log("  已迁移但金额不同:", ticketDiff);
    console.log("  未迁移:", ticketMissing);

    if (missing.length > 0) {
        console.log("\n" + "━".repeat(70));
        console.log("  三、差异详情 (" + missing.length + " 项)");
        console.log("━".repeat(70));
        missing.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.addr}`);
            console.log(`     ${m.issue}`);
        });
    }

    // 4. 总结
    console.log("\n" + "═".repeat(70));
    if (refMissing === 0 && ticketMissing === 0 && onlyInOld.length === 0) {
        console.log("  ✅ 结论：新合约包含旧合约的所有用户、推荐关系和门票数据");
    } else {
        console.log("  ⚠ 结论：存在数据差异，请检查上方详情");
    }
    console.log("═".repeat(70) + "\n");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
