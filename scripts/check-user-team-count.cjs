const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E"; // 新协议合约地址
const OLD_PROTOCOL_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A"; // 旧协议合约地址

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)",
    "function getLevel(address) view returns (uint256)",
    "function getTeamMembers(address) view returns (address[] memory)",
];

// 要检查的用户地址
const USER_ADDRESSES = [
    "0x5B7E080Daa6A6437B50eb881d84b66158Bb10fE5"
];

async function checkUserTeamCount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocolContract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    const oldProtocolContract = new ethers.Contract(OLD_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("\n" + "=".repeat(80));
    console.log("📊 检查用户团队人数");
    console.log("=".repeat(80));
    console.log(`查询时间: ${new Date().toLocaleString('zh-CN')}\n`);

    for (const userAddress of USER_ADDRESSES) {
        console.log("-".repeat(80));
        console.log(`用户地址: ${userAddress}`);
        console.log("-".repeat(80));

        // 先尝试查询新合约
        let newUserInfo = null;
        let newLevel = null;
        try {
            newUserInfo = await protocolContract.userInfo(userAddress);
            newLevel = await protocolContract.getLevel(userAddress);
            console.log("\n📊 新合约数据:");
            console.log(`  推荐人: ${newUserInfo.referrer}`);
            console.log(`  直推人数 (activeDirects): ${newUserInfo.activeDirects}`);
            console.log(`  团队人数 (teamCount): ${newUserInfo.teamCount}`);
            console.log(`  等级 (level): V${newLevel}`);
            console.log(`  是否激活 (isActive): ${newUserInfo.isActive}`);
            console.log(`  累计收益 (totalRevenue): ${ethers.formatEther(newUserInfo.totalRevenue)} MC`);
            console.log(`  收益上限 (currentCap): ${ethers.formatEther(newUserInfo.currentCap)} MC`);
        } catch (error) {
            console.log("\n📊 新合约数据: 未找到或查询失败");
            console.log(`  错误: ${error.message}`);
        }

        // 再尝试查询旧合约
        let oldUserInfo = null;
        try {
            oldUserInfo = await oldProtocolContract.userInfo(userAddress);
            console.log("\n📊 旧合约数据:");
            console.log(`  推荐人: ${oldUserInfo.referrer}`);
            console.log(`  直推人数 (activeDirects): ${oldUserInfo.activeDirects}`);
            console.log(`  团队人数 (teamCount): ${oldUserInfo.teamCount}`);
            console.log(`  是否激活 (isActive): ${oldUserInfo.isActive}`);
        } catch (error) {
            console.log("\n📊 旧合约数据: 未找到或查询失败");
            console.log(`  错误: ${error.message}`);
        }

        // 使用新合约数据（如果存在），否则使用旧合约数据
        const userInfo = newUserInfo || oldUserInfo;
        const level = newLevel || 0;

        if (!userInfo) {
            console.log("\n❌ 该地址在新旧合约中都不存在！");
            console.log("\n");
            continue;
        }

        // 尝试获取团队成员列表（如果合约支持）
        if (newUserInfo) {
            try {
                const teamMembers = await protocolContract.getTeamMembers(userAddress);
                console.log(`\n👥 新合约团队成员数量 (getTeamMembers): ${teamMembers.length}`);
                if (teamMembers.length > 0 && teamMembers.length <= 20) {
                    console.log(`  前${Math.min(teamMembers.length, 10)}个成员:`);
                    teamMembers.slice(0, 10).forEach((member, index) => {
                        console.log(`    ${index + 1}. ${member}`);
                    });
                }
            } catch (error) {
                console.log(`\n👥 新合约团队成员列表: 合约不支持 getTeamMembers 方法或查询失败`);
            }
        }

        // 分析问题
        console.log("\n🔍 数据分析:");
        if (userInfo.teamCount < userInfo.activeDirects) {
            console.log(`  ⚠️  警告: 团队人数(${userInfo.teamCount}) < 直推人数(${userInfo.activeDirects})`);
            console.log(`     这是不正常的，团队人数应该 >= 直推人数`);
        } else {
            console.log(`  ✅ 团队人数 >= 直推人数 (正常)`);
        }

        // 根据等级要求检查
        const levelRequirements = {
            0: 0,
            1: 10,
            2: 30,
            3: 100,
            4: 300,
            5: 1000
        };
        const requiredAddresses = levelRequirements[Number(level)] || 0;
        console.log(`\n📈 等级要求:`);
        console.log(`  当前等级: V${level}`);
        console.log(`  需要社区有效地址数: ${requiredAddresses}`);
        console.log(`  实际团队人数: ${userInfo.teamCount}`);
        if (userInfo.teamCount >= requiredAddresses) {
            console.log(`  ✅ 满足等级要求`);
        } else {
            console.log(`  ⚠️  不满足等级要求 (差 ${requiredAddresses - userInfo.teamCount} 个)`);
        }

        console.log("\n");
    }

    console.log("=".repeat(80));
    console.log("✅ 检查完成");
    console.log("=".repeat(80) + "\n");
}

if (require.main === module) {
    checkUserTeamCount().catch(console.error);
}

module.exports = { checkUserTeamCount };
