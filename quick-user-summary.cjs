const {ethers} = require("ethers");
const RPC = "https://chain.mcerscan.com/";
const USER = "0xE3B5EF7F753371eDFfb91b804181b26b86397BEd";
const ABI = ["function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)","function userTicket(address) view returns (uint256 ticketId, uint256 amount, uint256 purchaseTime, bool exited)","function userStakes(address,uint256) view returns (uint256 id, uint256 amount, uint256 startTime, uint256 cycleDays, bool active, uint256 paid)"];

(async ()=>{
  const p = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract("0x0897Cee05E43B2eCf331cd80f881c211eb86844E", ABI, p);
  const ui = await c.userInfo(USER);
  const ut = await c.userTicket(USER);
  
  console.log("📋 用户信息汇总:");
  console.log("═".repeat(50));
  console.log("\n👤 基本信息:");
  console.log("  推荐人: " + ui.referrer);
  console.log("  状态: " + (ui.isActive ? "✅ 活跃" : "❌ 未激活"));
  console.log("  级别: 团队" + ui.teamCount + "人");
  
  console.log("\n🎫 门票信息:");
  console.log("  购票金额: " + ethers.formatEther(ut.amount) + " MC");
  console.log("  购票时间: " + new Date(Number(ut.purchaseTime)*1000).toLocaleString("zh-CN"));
  console.log("  已出局: " + (ut.exited ? "是" : "否"));
  
  const totalRevenue = BigInt(ui.totalRevenue);
  const currentCap = BigInt(ui.currentCap);
  const remaining = currentCap - totalRevenue;
  
  console.log("\n💰 收益情况:");
  console.log("  累计收益: " + ethers.formatEther(totalRevenue) + " MC");
  console.log("  出局上限: " + ethers.formatEther(currentCap) + " MC");
  console.log("  剩余额度: " + ethers.formatEther(remaining) + " MC");
  const percent = Number(totalRevenue) / Number(currentCap) * 100;
  console.log("  完成度: " + percent.toFixed(2) + "%");
  
  console.log("\n📊 团队数据:");
  console.log("  直推数: " + ui.activeDirects);
  console.log("  团队人数: " + ui.teamCount);
  console.log("  团队总成交: " + ethers.formatEther(ui.teamTotalVolume) + " MC");
  
  console.log("\n⚠️ 数据事实:");
  console.log("  ✓ 购票 500 MC → 出局上限应为 1,500 MC");
  console.log("  ✓ 当前出局上限正确: " + ethers.formatEther(currentCap) + " MC");
  console.log("  ✓ 历史累计收益: 1,500 MC（来自事件日志）");
  console.log("  ✓ 但合约状态字段显示: 0 MC ← ⚠️ 数据不一致！");
  
})().catch(console.error);
