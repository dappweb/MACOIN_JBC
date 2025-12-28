import { ethers } from "ethers";

// 简化的测试脚本
async function testStaticRewards() {
  console.log("🔍 测试静态奖励逻辑");
  
  try {
    // 模拟静态奖励计算
    const stakeAmount = ethers.parseEther("150"); // 150 MC质押
    const cycleDays = 7; // 7天周期
    const secondsInUnit = 60; // 1分钟为一个时间单位
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime - (2 * 24 * 3600); // 2天前开始质押
    
    // 计算已过时间单位
    const unitsPassed = Math.floor((currentTime - startTime) / secondsInUnit);
    const maxUnits = cycleDays * 24 * 60; // 7天 * 24小时 * 60分钟
    const actualUnits = Math.min(unitsPassed, maxUnits);
    
    console.log(`质押金额: ${ethers.formatEther(stakeAmount)} MC`);
    console.log(`质押周期: ${cycleDays} 天`);
    console.log(`时间单位: ${secondsInUnit} 秒`);
    console.log(`已过时间单位: ${actualUnits}/${maxUnits}`);
    
    // 根据周期确定收益率
    let ratePerBillion = 0;
    if (cycleDays === 7) ratePerBillion = 13333334;
    else if (cycleDays === 15) ratePerBillion = 16666667;
    else if (cycleDays === 30) ratePerBillion = 20000000;
    
    console.log(`收益率: ${ratePerBillion / 10000000}% 每时间单位`);
    
    // 计算应得奖励
    const totalStaticShouldBe = (stakeAmount * BigInt(ratePerBillion) * BigInt(actualUnits)) / 1000000000n;
    
    console.log(`应得总奖励: ${ethers.formatEther(totalStaticShouldBe)} MC`);
    
    // 计算日收益率
    const dailyUnits = 24 * 60; // 一天的时间单位数
    const dailyReward = (stakeAmount * BigInt(ratePerBillion) * BigInt(dailyUnits)) / 1000000000n;
    console.log(`日收益: ${ethers.formatEther(dailyReward)} MC`);
    console.log(`日收益率: ${(Number(dailyReward) / Number(stakeAmount) * 100).toFixed(4)}%`);
    
  } catch (error) {
    console.error("计算错误:", error.message);
  }
}

testStaticRewards();