const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MaxSingleTicketAmount 功能测试", function () {
    let protocol;
    let mcToken;
    let jbcToken;
    let owner, user1;
    
    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();
        
        // 部署 MC Token
        const MCToken = await ethers.getContractFactory("MockMC");
        mcToken = await MCToken.deploy();
        await mcToken.waitForDeployment();
        
        // 部署 JBC Token
        const JBCToken = await ethers.getContractFactory("JBC");
        jbcToken = await JBCToken.deploy(owner.address);
        await jbcToken.waitForDeployment();
        
        // 部署协议合约 (使用代理)
        const JinbaoProtocol = await ethers.getContractFactory("JinbaoProtocol");
        protocol = await upgrades.deployProxy(JinbaoProtocol, [
            await mcToken.getAddress(),
            await jbcToken.getAddress(),
            owner.address, // marketing
            owner.address, // treasury
            owner.address, // lpInjection
            owner.address  // buybackWallet
        ], { 
            initializer: 'initialize',
            kind: 'uups' 
        });
        await protocol.waitForDeployment();
        
        // 给用户1一些MC代币
        await mcToken.transfer(user1.address, ethers.parseEther("2000"));
        await mcToken.connect(user1).approve(await protocol.getAddress(), ethers.parseEther("2000"));
        
        // 用户1绑定推荐人
        await protocol.connect(user1).bindReferrer(owner.address);
    });
    
    it("应该正确记录单张门票的最大值", async function () {
        // 用户1先购买100MC门票
        await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
        
        let userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("100"));
        
        // 用户1再购买300MC门票（累积）
        await protocol.connect(user1).buyTicket(ethers.parseEther("300"));
        
        // 检查累积门票金额
        userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxTicketAmount).to.equal(ethers.parseEther("400")); // 累积值
        
        // 检查单张门票最大值
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("300")); // 单张最大值
    });
    
    it("应该在购买更大单张门票时更新最大值", async function () {
        // 先购买300MC
        await protocol.connect(user1).buyTicket(ethers.parseEther("300"));
        let userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("300"));
        
        // 再购买500MC
        await protocol.connect(user1).buyTicket(ethers.parseEther("500"));
        userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("500")); // 更新为更大值
    });
    
    it("购买较小门票时不应该更新最大值", async function () {
        // 先购买500MC
        await protocol.connect(user1).buyTicket(ethers.parseEther("500"));
        let userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("500"));
        
        // 再购买100MC（较小）
        await protocol.connect(user1).buyTicket(ethers.parseEther("100"));
        userInfo = await protocol.userInfo(user1.address);
        expect(userInfo.maxSingleTicketAmount).to.equal(ethers.parseEther("500")); // 保持不变
    });
});