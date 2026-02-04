const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.MC_RPC_URL || "https://chain.mcerscan.com/";
const NEW_PROTOCOL_ADDRESS = process.env.PROTOCOL_CONTRACT_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

const PROTOCOL_ABI = [
    "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount)",
    "event BoundReferrer(address indexed user, address indexed referrer)",
];

async function findRootUser() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const protocol = new ethers.Contract(NEW_PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);

    console.log("🔍 查找根用户（没有推荐人的用户）...\n");

    // 获取所有用户
    const fromBlock = 0;
    const currentBlock = await provider.getBlockNumber();
    const allUsers = new Set();
    
    const events = await protocol.queryFilter(
        protocol.filters.BoundReferrer(),
        fromBlock,
        currentBlock
    );
    
    events.forEach(event => {
        if (event.args && event.args.referrer && event.args.user) {
            allUsers.add(event.args.user.toLowerCase());
            allUsers.add(event.args.referrer.toLowerCase());
        }
    });

    console.log(`总用户数: ${allUsers.size}\n`);

    // 找出没有推荐人的用户（根用户）
    const rootUsers = [];
    let checked = 0;
    
    for (const user of allUsers) {
        checked++;
        if (checked % 100 === 0) {
            process.stdout.write(`\r检查进度: ${checked}/${allUsers.size}...`);
        }
        
        try {
            const userInfo = await protocol.userInfo(user);
            const referrer = userInfo.referrer.toLowerCase();
            
            if (!referrer || referrer === ethers.ZeroAddress.toLowerCase()) {
                rootUsers.push({
                    address: user,
                    teamCount: userInfo.teamCount.toString()
                });
            }
        } catch (error) {
            // 忽略错误
        }
    }
    
    console.log(`\n\n✅ 找到 ${rootUsers.length} 个根用户:\n`);
    
    if (rootUsers.length > 0) {
        // 按 teamCount 排序，选择 teamCount 最大的
        rootUsers.sort((a, b) => BigInt(b.teamCount) - BigInt(a.teamCount));
        
        console.log("推荐使用的根用户（按 teamCount 排序）:");
        rootUsers.slice(0, 10).forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.address}`);
            console.log(`     teamCount: ${user.teamCount}`);
        });
        
        return rootUsers[0].address;
    } else {
        // 如果没有根用户，找一个不在循环中的用户
        console.log("⚠️  没有找到根用户，查找不在循环中的用户...\n");
        
        // 这里需要知道循环中的用户，暂时返回 null
        return null;
    }
}

if (require.main === module) {
    findRootUser().then(rootUser => {
        if (rootUser) {
            console.log(`\n✅ 建议使用的根用户: ${rootUser}`);
        } else {
            console.log("\n❌ 未找到合适的根用户");
        }
    }).catch(console.error);
}
