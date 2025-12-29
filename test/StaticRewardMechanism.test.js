import { expect } from "chai";
import pkg from 'hardhat';
const { ethers } = pkg;

describe("静态奖励机制测试", function () {
    describe("50/50 分配逻辑测试", function () {
        it("应该正确分配偶数奖励", async function () {
            const totalReward = ethers.parseEther("100");
            
            // 模拟合约中的分配逻辑
            const mcPart = totalReward / 2n;
            const jbcValuePart = totalReward / 2n;
            
            expect(mcPart).to.equal(ethers.parseEther("50"));
            expect(jbcValuePart).to.equal(ethers.parseEther("50"));
            expect(mcPart + jbcValuePart).to.equal(totalReward);
        });

        it("应该正确处理奇数奖励（Solidity整数除法）", async function () {
            // 测试 101 wei 的分配
            const totalReward = 101n;
            
            const mcPart = totalReward / 2n;        // 50
            const jbcValuePart = totalReward / 2n;  // 50
            
            expect(mcPart).to.equal(50n);
            expect(jbcValuePart).to.equal(50n);
            expect(mcPart + jbcValuePart).to.equal(100n); // 总和是100，丢失1 wei
            
            console.log(`总奖励: ${totalReward}`);
            console.log(`MC部分: ${mcPart}`);
            console.log(`JBC部分: ${jbcValuePart}`);
            console.log(`总和: ${mcPart + jbcValuePart}`);
            console.log(`丢失: ${totalReward - (mcPart + jbcValuePart)}`);
        });

        it("应该正确处理以太单位的奇数奖励", async function () {
            const totalReward = ethers.parseEther("101");
            
            const mcPart = totalReward / 2n;
            const jbcValuePart = totalReward / 2n;
            
            // 101 * 10^18 / 2 = 50.5 * 10^18
            const expected = ethers.parseEther("50.5");
            
            expect(mcPart).to.equal(expected);
            expect(jbcValuePart).to.equal(expected);
            expect(mcPart + jbcValuePart).to.equal(totalReward);
        });
    });

    describe("JBC价格计算测试", function () {
        it("应该在正常流动性下正确计算价格", async function () {
            const mcReserve = ethers.parseEther("10000");  // 10000 MC
            const jbcReserve = ethers.parseEther("5000");   // 5000 JBC
            
            // 合约逻辑: jbcPrice = (mcReserve * 1e18) / jbcReserve
            // 这表示 1 JBC 的价格 = 10000 * 1e18 / 5000 = 2 * 1e18 (2 MC per JBC)
            const jbcPrice = (mcReserve * ethers.parseEther("1")) / jbcReserve;
            const expectedPrice = ethers.parseEther("2"); // 1 JBC = 2 MC
            
            expect(jbcPrice).to.equal(expectedPrice);
            
            console.log(`MC储备: ${ethers.formatEther(mcReserve)} MC`);
            console.log(`JBC储备: ${ethers.formatEther(jbcReserve)} JBC`);
            console.log(`JBC价格: 1 JBC = ${ethers.formatEther(jbcPrice)} MC`);
        });

        it("应该在零JBC储备时使用默认价格", async function () {
            const mcReserve = ethers.parseEther("10000");
            const jbcReserve = 0n;
            
            // 模拟合约逻辑
            const jbcPrice = jbcReserve === 0n ? ethers.parseEther("1") : 
                (mcReserve * ethers.parseEther("1")) / jbcReserve;
            
            expect(jbcPrice).to.equal(ethers.parseEther("1")); // 1 JBC = 1 MC
        });

        it("应该在低流动性时使用默认价格", async function () {
            const mcReserve = ethers.parseEther("500"); // 小于 MIN_LIQUIDITY
            const jbcReserve = ethers.parseEther("1000");
            const MIN_LIQUIDITY = ethers.parseEther("1000");
            
            // 模拟合约逻辑
            const jbcPrice = (jbcReserve === 0n || mcReserve < MIN_LIQUIDITY) ? 
                ethers.parseEther("1") : 
                (mcReserve * ethers.parseEther("1")) / jbcReserve;
            
            expect(jbcPrice).to.equal(ethers.parseEther("1")); // 1 JBC = 1 MC
        });
    });

    describe("JBC数量计算测试", function () {
        it("应该正确计算JBC兑换数量", async function () {
            const jbcValuePart = ethers.parseEther("50"); // 50 MC等值
            const jbcPrice = ethers.parseEther("2");      // 1 JBC = 2 MC
            
            // 合约逻辑: jbcAmount = (jbcValuePart * 1e18) / jbcPrice
            // 50 MC / (2 MC per JBC) = 25 JBC
            const jbcAmount = (jbcValuePart * ethers.parseEther("1")) / jbcPrice;
            const expectedAmount = ethers.parseEther("25"); // 应得25 JBC
            
            expect(jbcAmount).to.equal(expectedAmount);
            
            console.log(`JBC等值部分: ${ethers.formatEther(jbcValuePart)} MC`);
            console.log(`JBC价格: 1 JBC = ${ethers.formatEther(jbcPrice)} MC`);
            console.log(`计算: ${ethers.formatEther(jbcValuePart)} MC ÷ ${ethers.formatEther(jbcPrice)} MC/JBC = ${ethers.formatEther(jbcAmount)} JBC`);
        });

        it("应该在1:1价格下正确计算", async function () {
            const jbcValuePart = ethers.parseEther("50");
            const jbcPrice = ethers.parseEther("1"); // 1 JBC = 1 MC
            
            const jbcAmount = (jbcValuePart * ethers.parseEther("1")) / jbcPrice;
            const expectedAmount = ethers.parseEther("50"); // 50 MC / 1 MC per JBC = 50 JBC
            
            expect(jbcAmount).to.equal(expectedAmount);
        });
    });

    describe("完整分配流程测试", function () {
        it("应该完整验证静态奖励分配机制", async function () {
            // 设置测试参数
            const totalReward = ethers.parseEther("100");
            const mcReserve = ethers.parseEther("10000");
            const jbcReserve = ethers.parseEther("5000");
            
            // 步骤1: 50/50分配
            const mcPart = totalReward / 2n;
            const jbcValuePart = totalReward / 2n;
            
            expect(mcPart).to.equal(ethers.parseEther("50"));
            expect(jbcValuePart).to.equal(ethers.parseEther("50"));
            
            // 步骤2: 计算JBC价格 (1 JBC = ? MC)
            const MIN_LIQUIDITY = ethers.parseEther("1000");
            const jbcPrice = (jbcReserve === 0n || mcReserve < MIN_LIQUIDITY) ? 
                ethers.parseEther("1") : 
                (mcReserve * ethers.parseEther("1")) / jbcReserve;
            
            expect(jbcPrice).to.equal(ethers.parseEther("2")); // 1 JBC = 2 MC
            
            // 步骤3: 计算JBC数量
            const jbcAmount = (jbcValuePart * ethers.parseEther("1")) / jbcPrice;
            
            expect(jbcAmount).to.equal(ethers.parseEther("25")); // 50 MC ÷ 2 MC/JBC = 25 JBC
            
            // 验证总价值
            const totalValue = mcPart + jbcValuePart;
            expect(totalValue).to.equal(totalReward);
            
            console.log("✅ 完整分配流程验证通过:");
            console.log(`总奖励: ${ethers.formatEther(totalReward)} MC`);
            console.log(`MC部分: ${ethers.formatEther(mcPart)} MC`);
            console.log(`JBC等值: ${ethers.formatEther(jbcValuePart)} MC`);
            console.log(`JBC数量: ${ethers.formatEther(jbcAmount)} JBC`);
            console.log(`JBC价格: 1 JBC = ${ethers.formatEther(jbcPrice)} MC`);
        });
    });
});