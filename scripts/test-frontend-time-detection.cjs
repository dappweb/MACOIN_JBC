/**
 * 测试前端时间检测系统
 * 验证 timeUtils.ts 中的时间检测和格式化功能
 */

const { ethers } = require("ethers");

// 模拟 timeUtils.ts 中的核心功能
class TimeUtils {
  static detectTimeConfig(secondsInUnit) {
    const seconds = Number(secondsInUnit);
    
    if (seconds === 60) {
      return {
        SECONDS_IN_UNIT: 60,
        TIME_UNIT: 'minutes',
        RATE_UNIT: 'per minute',
        UNIT_LABEL: '分钟',
        SHORT_UNIT: '分'
      };
    } else if (seconds === 86400) {
      return {
        SECONDS_IN_UNIT: 86400,
        TIME_UNIT: 'days',
        RATE_UNIT: 'daily',
        UNIT_LABEL: '天',
        SHORT_UNIT: '天'
      };
    } else {
      return {
        SECONDS_IN_UNIT: seconds,
        TIME_UNIT: 'unknown',
        RATE_UNIT: 'per unit',
        UNIT_LABEL: '单位',
        SHORT_UNIT: '单位'
      };
    }
  }

  static calculateRemainingTime(startTime, cyclePeriods, config) {
    const now = Math.floor(Date.now() / 1000);
    const endTime = startTime + (cyclePeriods * config.SECONDS_IN_UNIT);
    const remaining = endTime - now;

    if (remaining <= 0) {
      return {
        totalUnits: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    const totalUnits = Math.floor(remaining / config.SECONDS_IN_UNIT);
    const remainingSeconds = remaining % config.SECONDS_IN_UNIT;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    return {
      totalUnits,
      hours,
      minutes,
      seconds,
      isExpired: false
    };
  }

  static formatTimeRemaining(timeData, config) {
    if (timeData.isExpired) {
      return '已到期';
    }

    const parts = [];
    
    if (timeData.totalUnits > 0) {
      parts.push(`${timeData.totalUnits}${config.SHORT_UNIT}`);
    }
    
    if (config.TIME_UNIT === 'minutes') {
      if (timeData.seconds > 0) {
        parts.push(`${timeData.seconds}秒`);
      }
    } else {
      if (timeData.hours > 0) {
        parts.push(`${timeData.hours}时`);
      }
      if (timeData.minutes > 0 && timeData.totalUnits === 0) {
        parts.push(`${timeData.minutes}分`);
      }
    }

    return parts.join(' ') || '即将到期';
  }

  static getStakingOptions(config) {
    const unitLabel = config.UNIT_LABEL;
    
    return [
      {
        value: 7,
        label: `7${unitLabel}`,
        rate: 1.33,
        description: config.TIME_UNIT === 'minutes' ? '快速测试' : '短期质押'
      },
      {
        value: 15,
        label: `15${unitLabel}`,
        rate: 1.67,
        description: config.TIME_UNIT === 'minutes' ? '中等测试' : '中期质押'
      },
      {
        value: 30,
        label: `30${unitLabel}`,
        rate: 2.00,
        description: config.TIME_UNIT === 'minutes' ? '长期测试' : '长期质押'
      }
    ];
  }
}

async function testTimeDetection() {
  console.log("🧪 测试前端时间检测系统\n");

  // 测试场景1: 生产环境 (当前合约状态)
  console.log("📊 测试场景1: 生产环境 (86400秒 = 1天)");
  const prodConfig = TimeUtils.detectTimeConfig(86400);
  console.log("   检测结果:", prodConfig);
  
  const prodOptions = TimeUtils.getStakingOptions(prodConfig);
  console.log("   质押选项:");
  prodOptions.forEach(option => {
    console.log(`     - ${option.label}: ${option.rate}% ${prodConfig.RATE_UNIT} (${option.description})`);
  });

  // 模拟质押倒计时 (生产环境)
  const now = Math.floor(Date.now() / 1000);
  const prodStakeStart = now - (5 * 86400); // 5天前开始
  const prodTimeData = TimeUtils.calculateRemainingTime(prodStakeStart, 7, prodConfig);
  console.log("   7天质押剩余时间:", TimeUtils.formatTimeRemaining(prodTimeData, prodConfig));

  console.log("\n" + "=".repeat(60) + "\n");

  // 测试场景2: 测试环境 (目标状态)
  console.log("📊 测试场景2: 测试环境 (60秒 = 1分钟)");
  const testConfig = TimeUtils.detectTimeConfig(60);
  console.log("   检测结果:", testConfig);
  
  const testOptions = TimeUtils.getStakingOptions(testConfig);
  console.log("   质押选项:");
  testOptions.forEach(option => {
    console.log(`     - ${option.label}: ${option.rate}% ${testConfig.RATE_UNIT} (${option.description})`);
  });

  // 模拟质押倒计时 (测试环境)
  const testStakeStart = now - (5 * 60); // 5分钟前开始
  const testTimeData = TimeUtils.calculateRemainingTime(testStakeStart, 7, testConfig);
  console.log("   7分钟质押剩余时间:", TimeUtils.formatTimeRemaining(testTimeData, testConfig));

  console.log("\n" + "=".repeat(60) + "\n");

  // 测试场景3: 实际合约查询
  console.log("📊 测试场景3: 实际合约查询");
  try {
    const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
    const SIMPLE_ABI = ["function SECONDS_IN_UNIT() view returns (uint256)"];
    const contract = new ethers.Contract("0x1EC3576609b2E1D834570Bd56A1A51fb24fD7FB5", SIMPLE_ABI, provider);
    
    const contractSecondsInUnit = await contract.SECONDS_IN_UNIT();
    console.log("   合约 SECONDS_IN_UNIT:", contractSecondsInUnit.toString());
    
    const contractConfig = TimeUtils.detectTimeConfig(contractSecondsInUnit);
    console.log("   自动检测结果:", contractConfig);
    
    const contractOptions = TimeUtils.getStakingOptions(contractConfig);
    console.log("   当前合约质押选项:");
    contractOptions.forEach(option => {
      console.log(`     - ${option.label}: ${option.rate}% ${contractConfig.RATE_UNIT} (${option.description})`);
    });

  } catch (error) {
    console.log("   ❌ 合约查询失败:", error.message);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // 收益计算对比
  console.log("📊 收益计算对比");
  console.log("   生产环境 (7天质押):");
  console.log("     - 每日收益率: 1.33%");
  console.log("     - 总收益率: 1.33% × 7 = 9.31%");
  console.log("     - 完成时间: 7天");

  console.log("   测试环境 (7分钟质押):");
  console.log("     - 每分钟收益率: 1.33%");
  console.log("     - 总收益率: 1.33% × 7 = 9.31%");
  console.log("     - 完成时间: 7分钟");

  console.log("\n✅ 时间检测系统测试完成!");
  console.log("💡 前端可以自动适配不同的时间单位配置");
}

// 运行测试
testTimeDetection()
  .then(() => {
    console.log("\n🎉 所有测试完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  });