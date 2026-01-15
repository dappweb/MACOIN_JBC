const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = process.env.PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

/**
 * 从事件统计正确的 teamCount
 */
async function calculateTeamCountFromEvents(protocol, provider, userAddress) {
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000000);
        
        // 获取所有 BoundReferrer 事件
        const boundEvents = await protocol.queryFilter(
            protocol.filters.BoundReferrer(),
            fromBlock
        );
        
        // 构建推荐关系图
        const referrerMap = new Map();
        boundEvents.forEach(event => {
            if (event.args && event.args.referrer && event.args.user) {
                referrerMap.set(
                    event.args.user.toLowerCase(),
                    event.args.referrer.toLowerCase()
                );
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
                    count += countRecursive(user); // 间接推荐
                }
            }
            return count;
        }
        
        return countRecursive(userAddress.toLowerCase());
    } catch (error) {
        console.error(`  统计失败:`, error.message);
        return null;
    }
}

async function main() {
    console.log("🔍 验证修复后的 teamCount 值\n");
    console.log(`📍 协议合约地址: ${PROTOCOL_ADDRESS}`);
    console.log(`🌐 RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    // 检查修复过的推荐人
    const referrers = [
        {
            address: "0x3E436e9ef8A44cb65b00FcEFe4Ac1952384Ed21e",
            name: "推荐人1",
            fixedValue: 52113
        },
        {
            address: "0xC26731f7b6521B9ddF58B2Ef3F70658Dc28A5513",
            name: "推荐人2",
            fixedValue: 101708
        },
        {
            address: "0x7aA68892F013d981DFfAc7AE403fAA886938552b",
            name: "推荐人3",
            fixedValue: 393
        }
    ];

    for (const referrer of referrers) {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`${referrer.name}: ${referrer.address}`);
        console.log("=".repeat(80));
        
        try {
            const userInfo = await protocol.userInfo(referrer.address);
            const currentTeamCount = Number(userInfo.teamCount);
            const activeDirects = Number(userInfo.activeDirects);
            
            console.log(`当前合约中的值:`);
            console.log(`  teamCount: ${currentTeamCount}`);
            console.log(`  activeDirects: ${activeDirects}`);
            console.log(`修复脚本设置的值: ${referrer.fixedValue}`);
            console.log(`差异: ${currentTeamCount - referrer.fixedValue}`);
            
            console.log(`\n从事件统计正确的值:`);
            const eventCount = await calculateTeamCountFromEvents(protocol, provider, referrer.address);
            
            if (eventCount !== null) {
                console.log(`  事件统计: ${eventCount}`);
                console.log(`  与合约值的差异: ${currentTeamCount - eventCount}`);
                console.log(`  与修复值的差异: ${referrer.fixedValue - eventCount}`);
                
                if (Math.abs(currentTeamCount - eventCount) > 100) {
                    console.log(`  ⚠️  警告: 合约值与事件统计值差异较大！`);
                }
                if (Math.abs(referrer.fixedValue - eventCount) > 100) {
                    console.log(`  ⚠️  警告: 修复值与事件统计值差异较大！`);
                }
            } else {
                console.log(`  ❌ 无法统计`);
            }
        } catch (error) {
            console.error(`❌ 检查失败:`, error.message);
        }
    }
}

main().catch(error => {
    console.error("❌ 脚本执行异常:", error);
    process.exit(1);
});
