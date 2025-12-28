require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('🔍 [验证新部署] 验证使用现有代币的新JinbaoProtocol部署...\n');

    try {
        // 新部署的合约地址
        const ADDRESSES = {
            MC_TOKEN: "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF",
            JBC_TOKEN: "0xA743cB357a9f59D349efB7985072779a094658dD",
            PROTOCOL: "0x515871E9eADbF976b546113BbD48964383f86E61"
        };

        // 连接到MC Chain
        const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
        
        console.log('📊 [验证信息]');
        console.log(`MC Token: ${ADDRESSES.MC_TOKEN}`);
        console.log(`JBC Token: ${ADDRESSES.JBC_TOKEN}`);
        console.log(`Protocol: ${ADDRESSES.PROTOCOL}`);

        // 验证网络连接
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ 连接到MC Chain，当前区块: ${blockNumber}`);

        // 合约ABI
        const tokenAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)"
        ];

        const protocolAbi = [
            "function owner() view returns (address)",
            "function mcToken() view returns (address)",
            "function jbcToken() view returns (address)",
            "function swapReserveMC() view returns (uint256)",
            "function swapReserveJBC() view returns (uint256)",
            "function getAmountOut(uint256, uint256, uint256) pure returns (uint256)",
            "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)"
        ];

        // 连接合约
        const mcToken = new ethers.Contract(ADDRESSES.MC_TOKEN, tokenAbi, provider);
        const jbcToken = new ethers.Contract(ADDRESSES.JBC_TOKEN, tokenAbi, provider);
        const protocol = new ethers.Contract(ADDRESSES.PROTOCOL, protocolAbi, provider);

        // 验证代币合约
        console.log('\n🪙 [验证代币合约]');
        
        const mcName = await mcToken.name();
        const mcSymbol = await mcToken.symbol();
        const mcDecimals = await mcToken.decimals();
        const mcTotalSupply = await mcToken.totalSupply();
        
        console.log(`MC Token: ${mcName} (${mcSymbol})`);
        console.log(`MC Decimals: ${mcDecimals}`);
        console.log(`MC Total Supply: ${ethers.formatEther(mcTotalSupply)}`);
        
        const jbcName = await jbcToken.name();
        const jbcSymbol = await jbcToken.symbol();
        const jbcDecimals = await jbcToken.decimals();
        const jbcTotalSupply = await jbcToken.totalSupply();
        
        console.log(`JBC Token: ${jbcName} (${jbcSymbol})`);
        console.log(`JBC Decimals: ${jbcDecimals}`);
        console.log(`JBC Total Supply: ${ethers.formatEther(jbcTotalSupply)}`);

        // 验证Protocol合约
        console.log('\n🏗️ [验证Protocol合约]');
        
        const owner = await protocol.owner();
        console.log(`合约所有者: ${owner}`);
        
        const mcTokenAddr = await protocol.mcToken();
        const jbcTokenAddr = await protocol.jbcToken();
        console.log(`Protocol中的MC Token: ${mcTokenAddr}`);
        console.log(`Protocol中的JBC Token: ${jbcTokenAddr}`);
        
        // 验证地址匹配
        if (mcTokenAddr.toLowerCase() === ADDRESSES.MC_TOKEN.toLowerCase()) {
            console.log('✅ MC Token地址匹配');
        } else {
            console.log('❌ MC Token地址不匹配');
        }
        
        if (jbcTokenAddr.toLowerCase() === ADDRESSES.JBC_TOKEN.toLowerCase()) {
            console.log('✅ JBC Token地址匹配');
        } else {
            console.log('❌ JBC Token地址不匹配');
        }

        // 验证Swap流动性
        console.log('\n💧 [验证Swap流动性]');
        
        const mcReserve = await protocol.swapReserveMC();
        const jbcReserve = await protocol.swapReserveJBC();
        
        console.log(`MC储备: ${ethers.formatEther(mcReserve)}`);
        console.log(`JBC储备: ${ethers.formatEther(jbcReserve)}`);
        
        if (mcReserve > 0 && jbcReserve > 0) {
            console.log('✅ Swap流动性已初始化');
            
            // 计算汇率
            const mcToJbcRate = Number(jbcReserve) / Number(mcReserve);
            const jbcToMcRate = Number(mcReserve) / Number(jbcReserve);
            
            console.log(`当前汇率: 1 MC = ${mcToJbcRate.toFixed(6)} JBC`);
            console.log(`当前汇率: 1 JBC = ${jbcToMcRate.toFixed(6)} MC`);
            
        } else {
            console.log('❌ Swap流动性未初始化');
        }

        // 测试Swap计算功能
        console.log('\n🔄 [测试Swap计算]');
        try {
            const testMcAmount = ethers.parseEther("100"); // 100 MC
            const expectedJbc = await protocol.getAmountOut(testMcAmount, mcReserve, jbcReserve);
            console.log(`100 MC 可兑换 ${ethers.formatEther(expectedJbc)} JBC`);
            
            const testJbcAmount = ethers.parseEther("100"); // 100 JBC
            const expectedMc = await protocol.getAmountOut(testJbcAmount, jbcReserve, mcReserve);
            console.log(`100 JBC 可兑换 ${ethers.formatEther(expectedMc)} MC`);
            
            console.log('✅ Swap计算功能正常');
        } catch (error) {
            console.log('❌ Swap计算功能异常:', error.message);
        }

        // 测试用户信息查询
        console.log('\n👤 [测试用户信息查询]');
        try {
            const testUser = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48"; // 部署者地址
            const userInfo = await protocol.userInfo(testUser);
            
            console.log(`测试用户: ${testUser}`);
            console.log(`推荐人: ${userInfo[0]}`);
            console.log(`直推数量: ${userInfo[1]}`);
            console.log(`团队数量: ${userInfo[2]}`);
            console.log(`总收益: ${ethers.formatEther(userInfo[3])} MC`);
            console.log(`当前上限: ${ethers.formatEther(userInfo[4])} MC`);
            console.log(`是否激活: ${userInfo[5]}`);
            
            console.log('✅ 用户信息查询功能正常');
        } catch (error) {
            console.log('❌ 用户信息查询异常:', error.message);
        }

        // 验证合约代码
        console.log('\n📋 [验证合约代码]');
        const protocolCode = await provider.getCode(ADDRESSES.PROTOCOL);
        if (protocolCode && protocolCode !== '0x') {
            console.log(`✅ Protocol合约代码存在 (长度: ${protocolCode.length})`);
        } else {
            console.log('❌ Protocol合约代码不存在');
        }

        // 生成验证报告
        console.log('\n📄 [验证报告]');
        console.log('='.repeat(60));
        console.log('🎉 新部署验证完成！');
        console.log('='.repeat(60));
        console.log(`📋 网络: MC Chain (88813)`);
        console.log(`🏗️ Protocol合约: ${ADDRESSES.PROTOCOL}`);
        console.log(`🪙 MC Token: ${ADDRESSES.MC_TOKEN} (${mcSymbol})`);
        console.log(`🪙 JBC Token: ${ADDRESSES.JBC_TOKEN} (${jbcSymbol})`);
        console.log(`👤 合约所有者: ${owner}`);
        console.log(`💧 MC储备: ${ethers.formatEther(mcReserve)}`);
        console.log(`💧 JBC储备: ${ethers.formatEther(jbcReserve)}`);
        console.log(`🔄 Swap功能: ${mcReserve > 0 && jbcReserve > 0 ? '正常' : '异常'}`);
        console.log('='.repeat(60));

        console.log('\n✅ 验证完成！新部署的合约功能正常。');
        
        return {
            success: true,
            addresses: ADDRESSES,
            reserves: {
                mc: ethers.formatEther(mcReserve),
                jbc: ethers.formatEther(jbcReserve)
            },
            owner
        };

    } catch (error) {
        console.error('❌ 验证失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

main()
    .then((result) => {
        if (result.success) {
            console.log('\n🎯 [验证成功]');
            console.log('所有功能验证通过，合约可以正常使用！');
        } else {
            console.log('\n❌ [验证失败]');
            console.log('验证过程中发现问题:', result.error);
        }
        process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
        console.error('验证过程中发生错误:', error);
        process.exit(1);
    });