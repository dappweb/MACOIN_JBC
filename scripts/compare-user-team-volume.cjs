const { ethers } = require("ethers");

// MC Chain 配置
const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

// 协议合约 ABI
const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getDirectReferrals(address) view returns (address[])",
    "event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId)",
];

async function compareUserTeamVolume(address1, address2) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 比较用户社区门票总业绩\n");
    console.log("=".repeat(80));
    console.log(`地址1: ${address1}`);
    console.log(`地址2: ${address2}`);
    console.log("=".repeat(80) + "\n");

    try {
        // 查询地址1的信息
        console.log("📊 地址1信息:");
        console.log("-".repeat(80));
        const userInfo1 = await protocol.userInfo(address1);
        const teamTotalVolume1 = parseFloat(ethers.formatEther(userInfo1.teamTotalVolume));
        const teamCount1 = Number(userInfo1.teamCount);
        const activeDirects1 = Number(userInfo1.activeDirects);
        const referrer1 = userInfo1.referrer;
        
        console.log(`  推荐人: ${referrer1}`);
        console.log(`  团队人数: ${teamCount1}`);
        console.log(`  活跃直推数: ${activeDirects1}`);
        console.log(`  社区门票总业绩: ${teamTotalVolume1.toFixed(4)} MC`);
        console.log(`  团队总上限: ${parseFloat(ethers.formatEther(userInfo1.teamTotalCap)).toFixed(4)} MC`);
        console.log("");

        // 查询地址2的信息
        console.log("📊 地址2信息:");
        console.log("-".repeat(80));
        const userInfo2 = await protocol.userInfo(address2);
        const teamTotalVolume2 = parseFloat(ethers.formatEther(userInfo2.teamTotalVolume));
        const teamCount2 = Number(userInfo2.teamCount);
        const activeDirects2 = Number(userInfo2.activeDirects);
        const referrer2 = userInfo2.referrer;
        
        console.log(`  推荐人: ${referrer2}`);
        console.log(`  团队人数: ${teamCount2}`);
        console.log(`  活跃直推数: ${activeDirects2}`);
        console.log(`  社区门票总业绩: ${teamTotalVolume2.toFixed(4)} MC`);
        console.log(`  团队总上限: ${parseFloat(ethers.formatEther(userInfo2.teamTotalCap)).toFixed(4)} MC`);
        console.log("");

        // 检查推荐关系
        console.log("🔗 推荐关系检查:");
        console.log("-".repeat(80));
        const directRefs1 = await protocol.getDirectReferrals(address1);
        const directRefs2 = await protocol.getDirectReferrals(address2);
        
        const address1Lower = address1.toLowerCase();
        const address2Lower = address2.toLowerCase();
        
        const isAddress2ReferredBy1 = referrer2.toLowerCase() === address1Lower;
        const isAddress1ReferredBy2 = referrer1.toLowerCase() === address2Lower;
        const isAddress2InDirectRefs1 = directRefs1.some(addr => addr.toLowerCase() === address2Lower);
        const isAddress1InDirectRefs2 = directRefs2.some(addr => addr.toLowerCase() === address1Lower);
        
        console.log(`  地址1的推荐人: ${referrer1}`);
        console.log(`  地址2的推荐人: ${referrer2}`);
        console.log(`  地址1的直推列表包含地址2: ${isAddress2InDirectRefs1 ? '✅ 是' : '❌ 否'}`);
        console.log(`  地址2的直推列表包含地址1: ${isAddress1InDirectRefs2 ? '✅ 是' : '❌ 否'}`);
        console.log(`  地址2是否被地址1推荐: ${isAddress2ReferredBy1 ? '✅ 是' : '❌ 否'}`);
        console.log(`  地址1是否被地址2推荐: ${isAddress1ReferredBy2 ? '✅ 是' : '❌ 否'}`);
        console.log("");

        // 比较结果
        console.log("📈 比较结果:");
        console.log("=".repeat(80));
        const difference = teamTotalVolume1 - teamTotalVolume2;
        const ratio = teamTotalVolume2 > 0 ? (teamTotalVolume1 / teamTotalVolume2).toFixed(2) : 'N/A';
        
        console.log(`  地址1社区门票总业绩: ${teamTotalVolume1.toFixed(4)} MC`);
        console.log(`  地址2社区门票总业绩: ${teamTotalVolume2.toFixed(4)} MC`);
        console.log(`  差额: ${difference.toFixed(4)} MC`);
        console.log(`  比例: 地址1是地址2的 ${ratio} 倍`);
        
        if (teamTotalVolume1 > teamTotalVolume2) {
            console.log(`  ✅ 地址1的社区门票总业绩大于地址2`);
        } else if (teamTotalVolume1 < teamTotalVolume2) {
            console.log(`  ❌ 地址1的社区门票总业绩小于地址2`);
        } else {
            console.log(`  ⚖️  两个地址的社区门票总业绩相等`);
        }
        
        if (isAddress2ReferredBy1) {
            console.log(`  ✅ 确认：地址1推荐地址2`);
        } else {
            console.log(`  ⚠️  注意：地址2的推荐人不是地址1`);
        }
        
        console.log("=".repeat(80));

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 运行脚本
const address1 = process.argv[2] || "0x0435aFf9777DafBd0552B54951501D3169A02062de";
const address2 = process.argv[3] || "0x4544c0CF9d62D3bB441c04A5F31C1ba0E432d37e";

// 标准化地址格式（去除末尾可能的 'de'）
const normalizeAddress = (addr) => {
    if (addr.length === 44 && addr.endsWith('de')) {
        return addr.slice(0, 42);
    }
    return addr;
};

compareUserTeamVolume(normalizeAddress(address1), normalizeAddress(address2)).catch(console.error);
