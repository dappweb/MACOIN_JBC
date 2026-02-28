/**
 * 查询合约的SECONDS_IN_UNIT参数
 * 这个参数决定了时间单位，影响质押奖励计算
 */

const { ethers } = require("ethers");

const RPC_URL = "https://chain.mcerscan.com/";
const PROTOCOL_ADDRESS = "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 尝试读取合约的public常数SECONDS_IN_UNIT
  // 方法1：通过低级call获取
  console.log("🔍 查询合约配置参数\n");
  console.log("合约地址:", PROTOCOL_ADDRESS);
  console.log("=".repeat(60) + "\n");

  try {
    // 方法：获取合约的runtime bytecode
    const code = await provider.getCode(PROTOCOL_ADDRESS);
    console.log("✓ 合约已部署");
    console.log("  代码长度:", (code.length - 2) / 2, "字节");
    
    // 尝试call一个获取SECONDS_IN_UNIT的函数
    // 如果没有public函数，我们可以通过其他方式推断
    const PROTOCOL_ABI = [
      // 尝试常见的函数签名
      "function SECONDS_IN_UNIT() public view returns (uint256)",
      "function SECONDS_IN_UNIT() external view returns (uint256)",
      "function getSecondsInUnit() public view returns (uint256)",
      "function getUserStakes(address user) public view returns (tuple(uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)[])",
    ];

    const contract = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
    
    try {
      const secondsInUnit = await contract.SECONDS_IN_UNIT();
      console.log("\n🎯 SECONDS_IN_UNIT =", secondsInUnit.toString());
      console.log("   (这是时间单位秒数)");
      
      if (secondsInUnit.toString() === "60") {
        console.log("\n❌ 警告：SECONDS_IN_UNIT = 60 秒");
        console.log("   这意味着：");
        console.log("   - 7天质押 = 7 * 60 = 420秒 = 7分钟就到期");
        console.log("   - 15天质押 = 15 * 60 = 900秒 = 15分钟就到期");
        console.log("   - 30天质押 = 30 * 60 = 1800秒 = 30分钟就到期");
        console.log("\n   这是导致无奖励的根本原因！");
      } else if (secondsInUnit.toString() === "86400") {
        console.log("\n✓ 正常：SECONDS_IN_UNIT = 86400 秒 (1天)");
        console.log("   时间计算是正确的");
      } else {
        console.log("\n⚠️  未知的 SECONDS_IN_UNIT 值");
      }
    } catch (e) {
      console.log("⚠️  无法通过SECONDS_IN_UNIT()函数读取");
      console.log("   尝试其他方式...\n");
      
      // 方法2：通过创建一个stake来推断时间单位
      console.log("📊 通过分析stakeLiquidity结构来推断：\n");
      console.log("合约可能使用的SECONDS_IN_UNIT值：");
      console.log("  - 60秒 (测试环境或BUG)");
      console.log("  - 86400秒 = 1天 (生产环境标准)");
      console.log("  - 其他值？\n");
      
      // 方法3：获取一个已存在的stake并检查
      console.log("🔍 扫描最近的LiquidityStaked事件来推断...\n");
      
      const fromBlock = Math.max(0, (await provider.getBlockNumber()) - 500000);
      const EVENTS_ABI = [
        "event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId)",
      ];
      
      const contract2 = new ethers.Contract(PROTOCOL_ADDRESS, EVENTS_ABI, provider);
      const events = await contract2.queryFilter(
        contract2.filters.LiquidityStaked(),
        fromBlock,
        "latest"
      );
      
      if (events.length > 0) {
        const e = events[0];
        const eventTime = (await provider.getBlock(e.blockNumber))?.timestamp || 0;
        const cycleDays = Number(e.args?.cycleDays || 0);
        
        console.log("最早的LiquidityStaked事件：");
        console.log(`  用户: ${e.args?.user}`);
        console.log(`  金额: ${ethers.formatEther(e.args?.amount || 0n)} MC`);
        console.log(`  周期: ${cycleDays}天`);
        console.log(`  时间戳: ${eventTime} (${new Date(eventTime * 1000).toISOString()})`);
        console.log(`\n如果这个stake已经过期（用户能赎回了），那么SECONDS_IN_UNIT = 60秒`);
      }
    }
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

main().catch(console.error);
