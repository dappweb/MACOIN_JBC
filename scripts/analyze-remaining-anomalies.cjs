/**
 * 分析修复后仍存在异常的2个地址的推荐关系结构
 */
const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocol = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 异常对1: 0x2d68 (推荐人) < 0x4c10 (被推荐人)
    // 异常对2: 0x9666 (推荐人) < 0x4acb (被推荐人)
    
    const pairs = [
        { referrer: "0x2d68a5850a4805c6fe6648e5870b68456e2a7c82", user: "0x4c10831cbcf9884ba72051b5287b6c87e4f74a48" },
        { referrer: "0x96665cfb0624bd4a5aaf60fea544c8ae22d3f55e", user: "0x4acbd4864503ed3dc968e680dbc0580b483dbc76" },
    ];

    // 获取所有推荐关系
    const referrerMap = new Map();
    const referrerToUsers = new Map();
    
    for (const proto of [protocol, oldProtocol]) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const events = await proto.queryFilter(proto.filters.BoundReferrer(), 0, currentBlock);
            events.forEach(event => {
                if (event.args?.referrer && event.args?.user) {
                    const user = event.args.user.toLowerCase();
                    const referrer = event.args.referrer.toLowerCase();
                    referrerMap.set(user, referrer);
                    if (!referrerToUsers.has(referrer)) referrerToUsers.set(referrer, []);
                    const list = referrerToUsers.get(referrer);
                    if (!list.includes(user)) list.push(user);
                }
            });
        } catch (e) {}
    }

    for (const { referrer, user } of pairs) {
        console.log("\n" + "═".repeat(80));
        console.log(`  推荐人: ${referrer}`);
        console.log(`  被推荐人: ${user}`);
        console.log("═".repeat(80));

        // 验证推荐关系: user 的推荐人真的是 referrer 吗？
        const actualReferrer = referrerMap.get(user);
        console.log(`\n  事件记录的推荐关系: ${user} -> 推荐人 = ${actualReferrer}`);
        
        const userInfo = await protocol.userInfo(user);
        console.log(`  合约记录的推荐关系: ${user} -> 推荐人 = ${userInfo.referrer.toLowerCase()}`);
        
        // 检查 referrer 的直推列表是否包含 user
        const directRefs = referrerToUsers.get(referrer) || [];
        console.log(`\n  推荐人 ${referrer} 的直推列表 (${directRefs.length} 人):`);
        for (const d of directRefs) {
            const ticket = await protocol.userTicket(d);
            console.log(`    ${d}  门票: ${ethers.formatEther(ticket.amount || 0n)} MC`);
        }
        
        // 检查 user 是否在 referrer 的下级链条中
        const isUnder = actualReferrer === referrer;
        console.log(`\n  ${user} 的推荐人是否是 ${referrer}? ${isUnder ? '是' : '否! 推荐人是 ' + actualReferrer}`);
        
        // 追踪 user 的推荐链
        console.log(`\n  ${user} 的向上推荐链:`);
        let current = user;
        for (let i = 0; i < 10; i++) {
            const ref = referrerMap.get(current);
            if (!ref || ref === ethers.ZeroAddress.toLowerCase()) break;
            const info = await protocol.userInfo(current);
            console.log(`    [${i}] ${current} -> 推荐人: ${ref} (合约记录: ${info.referrer.toLowerCase()})`);
            current = ref;
        }

        // 追踪 referrer 的推荐链
        console.log(`\n  ${referrer} 的向上推荐链:`);
        current = referrer;
        for (let i = 0; i < 10; i++) {
            const ref = referrerMap.get(current);
            if (!ref || ref === ethers.ZeroAddress.toLowerCase()) break;
            const info = await protocol.userInfo(current);
            console.log(`    [${i}] ${current} -> 推荐人: ${ref} (合约记录: ${info.referrer.toLowerCase()})`);
            current = ref;
        }
    }
}

main().catch(console.error);
