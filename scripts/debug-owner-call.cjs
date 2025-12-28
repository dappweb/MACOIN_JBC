const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 深度诊断拥有者调用问题");
    console.log("===============================");
    
    const PROTOCOL_ADDRESS = "0x515871E9eADbF976b546113BbD48964383f86E61";
    const MC_TOKEN = "0xB2B8777BcBc7A8DEf49F022773d392a8787cf9EF";
    const JBC_TOKEN = "0xA743cB357a9f59D349efB7985072779a094658dD";
    
    try {
        // 使用MC Chain RPC
        const provider = new ethers.JsonRpcProvider("https://chain.mcerscan.com/");
        
        // 如果有私钥，使用钱包；否则只读
        let signer = provider;
        if (process.env.PRIVATE_KEY) {
            signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            console.log("👤 使用钱包地址:", signer.address);
        } else {
            console.log("⚠️ 未找到私钥，使用只读模式");
        }
        
        // 合约ABI
        const protocolAbi = [
            "function owner() view returns (address)",
            "function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external"
        ];
        
        const tokenAbi = [
            "function balanceOf(address) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)"
        ];
        
        const protocol = new ethers.Contract(PROTOCOL_ADDRESS, protocolAbi, signer);
        const mcToken = new ethers.Contract(MC_TOKEN, tokenAbi, signer);
        const jbcToken = new ethers.Contract(JBC_TOKEN, tokenAbi, signer);
        
        // 1. 验证合约拥有者
        console.log("📋 合约状态检查:");
        const contractOwner = await protocol.owner();
        console.log("   合约拥有者:", contractOwner);
        console.log("   预期拥有者: 0x4C10831CBcF9884ba72051b5287b6c87E4F74A48");
        console.log("   地址匹配:", contractOwner.toLowerCase() === "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48".toLowerCase() ? "✅" : "❌");
        
        // 2. 如果有私钥，检查是否匹配
        if (process.env.PRIVATE_KEY) {
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
            console.log("   钱包地址:", wallet.address);
            console.log("   私钥匹配:", wallet.address.toLowerCase() === contractOwner.toLowerCase() ? "✅" : "❌");
            
            if (wallet.address.toLowerCase() === contractOwner.toLowerCase()) {
                console.log("\n💰 余额检查:");
                const mcBalance = await mcToken.balanceOf(wallet.address);
                const jbcBalance = await jbcToken.balanceOf(wallet.address);
                console.log("   MC 余额:", ethers.formatEther(mcBalance));
                console.log("   JBC 余额:", ethers.formatEther(jbcBalance));
                
                // 3. 尝试模拟调用
                console.log("\n🧪 模拟调用测试:");
                try {
                    const testAmount = ethers.parseEther("1"); // 1 token
                    
                    // 静态调用 (不实际执行)
                    await protocol.addLiquidity.staticCall(testAmount, testAmount);
                    console.log("   静态调用: ✅ 成功");
                    
                } catch (error) {
                    console.log("   静态调用: ❌ 失败");
                    console.log("   错误:", error.message);
                    
                    // 解析具体错误
                    if (error.message.includes("OwnableUnauthorizedAccount")) {
                        console.log("   🚨 权限错误 - 不是合约拥有者");
                    } else if (error.message.includes("insufficient")) {
                        console.log("   🚨 余额不足");
                    } else if (error.message.includes("allowance")) {
                        console.log("   🚨 授权不足");
                    } else {
                        console.log("   🚨 其他错误:", error.reason || error.message);
                    }
                }
                
                // 4. 检查授权状态
                console.log("\n🔐 授权状态检查:");
                const mcAllowance = await mcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
                const jbcAllowance = await jbcToken.allowance(wallet.address, PROTOCOL_ADDRESS);
                console.log("   MC 授权额度:", ethers.formatEther(mcAllowance));
                console.log("   JBC 授权额度:", ethers.formatEther(jbcAllowance));
                
            } else {
                console.log("\n❌ 私钥对应的地址与合约拥有者不匹配");
            }
        }
        
        // 5. 网络信息
        console.log("\n🌐 网络信息:");
        const network = await provider.getNetwork();
        console.log("   Chain ID:", network.chainId.toString());
        console.log("   网络名称:", network.name);
        console.log("   预期 Chain ID: 88813");
        console.log("   网络匹配:", network.chainId.toString() === "88813" ? "✅" : "❌");
        
        // 6. 合约代码检查
        console.log("\n📜 合约代码检查:");
        const code = await provider.getCode(PROTOCOL_ADDRESS);
        console.log("   合约代码长度:", code.length);
        console.log("   合约已部署:", code !== "0x" ? "✅" : "❌");
        
    } catch (error) {
        console.error("❌ 诊断失败:", error.message);
        
        if (error.message.includes("network")) {
            console.log("💡 可能是网络连接问题，请检查:");
            console.log("   1. 网络连接是否正常");
            console.log("   2. RPC 端点是否可访问");
            console.log("   3. 防火墙设置");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });