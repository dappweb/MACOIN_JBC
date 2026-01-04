const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 更新 JBC Token 合约中的 protocolAddress
 * 新协议地址: 0x0897Cee05E43B2eCf331cd80f881c211eb86844E
 */
async function main() {
    const JBC_TOKEN_ADDRESS = process.env.JBC_TOKEN_ADDRESS || "0x1Bf9ACe2485BC3391150762a109886d0B85f40Da";
    const NEW_PROTOCOL_ADDRESS = process.env.NEW_PROTOCOL_ADDRESS || "0x0897Cee05E43B2eCf331cd80f881c211eb86844E";
    
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 更新 JBC Token 的 Protocol 地址");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    
    // 读取部署信息
    const deploymentPath = path.join(__dirname, "../deployments/new-protocol-deployment-1767522867325.json");
    let deploymentData = null;
    
    if (fs.existsSync(deploymentPath)) {
        deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log("📄 从部署文件读取协议地址:", deploymentData.contracts.proxy);
    }
    
    const protocolAddress = deploymentData?.contracts?.proxy || NEW_PROTOCOL_ADDRESS;
    
    console.log("📍 JBC Token 地址:", JBC_TOKEN_ADDRESS);
    console.log("📍 新协议地址:", protocolAddress);
    console.log("");
    
    // 获取签名者（需要是 JBC Token Owner）
    const [signer] = await ethers.getSigners();
    console.log("👤 当前签名者:", signer.address);
    console.log("");
    
    // 连接 JBC Token 合约
    const JBC_ABI = [
        "function protocolAddress() view returns (address)",
        "function setProtocol(address _protocol) external",
        "function owner() view returns (address)"
    ];
    
    const jbc = await ethers.getContractAt(JBC_ABI, JBC_TOKEN_ADDRESS, signer);
    
    // 检查当前 Owner
    const jbcOwner = await jbc.owner();
    console.log("🔐 JBC Token Owner:", jbcOwner);
    
    if (jbcOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ 错误: 当前签名者不是 JBC Token Owner!");
        console.error("   需要 JBC Token Owner 的私钥才能更新 protocolAddress");
        process.exit(1);
    }
    
    // 检查当前 protocolAddress
    const currentProtocol = await jbc.protocolAddress();
    console.log("📊 当前 Protocol 地址:", currentProtocol);
    console.log("📊 新 Protocol 地址:", protocolAddress);
    console.log("");
    
    if (currentProtocol.toLowerCase() === protocolAddress.toLowerCase()) {
        console.log("✅ JBC Token 的 Protocol 地址已经是最新的，无需更新");
        return;
    }
    
    // 确认更新
    console.log("⚠️  准备更新 JBC Token 的 Protocol 地址...");
    console.log("   从:", currentProtocol);
    console.log("   到:", protocolAddress);
    console.log("");
    
    try {
        // 更新 protocolAddress
        console.log("📤 发送交易...");
        const tx = await jbc.setProtocol(protocolAddress);
        console.log("📝 交易哈希:", tx.hash);
        console.log("⏳ 等待确认...");
        
        const receipt = await tx.wait();
        console.log("✅ 交易已确认!");
        console.log("   区块号:", receipt.blockNumber);
        console.log("   Gas 使用:", receipt.gasUsed.toString());
        console.log("");
        
        // 验证更新
        const updatedProtocol = await jbc.protocolAddress();
        if (updatedProtocol.toLowerCase() === protocolAddress.toLowerCase()) {
            console.log("✅ JBC Token 的 Protocol 地址更新成功!");
            console.log("   新地址:", updatedProtocol);
        } else {
            console.error("❌ 验证失败: 地址不匹配");
            console.error("   期望:", protocolAddress);
            console.error("   实际:", updatedProtocol);
        }
        
    } catch (error) {
        console.error("❌ 更新失败:", error.message);
        if (error.reason) {
            console.error("   原因:", error.reason);
        }
        throw error;
    }
}

main()
    .then(() => {
        console.log("");
        console.log("═══════════════════════════════════════════════════════════");
        console.log("✅ 脚本执行完成");
        console.log("═══════════════════════════════════════════════════════════");
        process.exit(0);
    })
    .catch((error) => {
        console.error("");
        console.error("═══════════════════════════════════════════════════════════");
        console.error("❌ 脚本执行失败");
        console.error("═══════════════════════════════════════════════════════════");
        console.error(error);
        process.exit(1);
    });

