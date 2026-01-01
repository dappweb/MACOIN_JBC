const { ethers } = require("ethers");

// 配置
const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
// 尝试多个 RPC URL
const RPC_URLS = [
    process.env.MC_RPC_URL,
    "https://rpc.mcchain.io",
    "https://chain.mcerscan.com/",
    "https://mcchain.io/rpc"
].filter(Boolean);

// 要检查的函数
const FUNCTIONS_TO_CHECK = [
    {
        name: "adminSetTeamCount",
        signature: "adminSetTeamCount(address,uint256)",
        description: "管理员修改用户团队成员数量"
    },
    {
        name: "adminSetActiveDirects",
        signature: "adminSetActiveDirects(address,uint256)",
        description: "管理员修改用户活跃直推数量"
    },
    {
        name: "adminSetReferrer",
        signature: "adminSetReferrer(address,address)",
        description: "管理员修改用户推荐人"
    },
    {
        name: "owner",
        signature: "owner()",
        description: "获取合约所有者（用于验证）"
    }
];

async function getProvider() {
    for (const url of RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(url);
            // 尝试获取最新区块来测试连接
            await provider.getBlockNumber();
            console.log("✅ 使用 RPC URL:", url);
            return provider;
        } catch (error) {
            console.log("⚠️  RPC URL 不可用:", url);
            continue;
        }
    }
    throw new Error("所有 RPC URL 都不可用");
}

async function main() {
    console.log("🔍 检查实现合约字节码以确认函数是否存在\n");
    console.log("=".repeat(80));
    
    const provider = await getProvider();
    
    // 1. 获取实现合约地址
    console.log("\n📋 步骤 1: 获取实现合约地址");
    console.log("代理合约地址:", PROXY_ADDRESS);
    
    // UUPS 代理的实现地址存储在特定存储槽中
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    
    try {
        const slotValue = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT);
        // 实现地址是存储槽值的最后20字节（40个十六进制字符）
        const implAddress = "0x" + slotValue.slice(-40);
        console.log("✅ 实现合约地址:", implAddress);
        
        // 2. 获取实现合约的字节码
        console.log("\n📋 步骤 2: 获取实现合约字节码");
        const bytecode = await provider.getCode(implAddress);
        
        if (!bytecode || bytecode === "0x") {
            console.error("❌ 错误: 实现合约地址没有代码");
            return;
        }
        
        console.log("✅ 字节码长度:", bytecode.length, "字符");
        console.log("   字节码大小:", (bytecode.length - 2) / 2, "字节");
        console.log("   字节码前100字符:", bytecode.substring(0, 100) + "...");
        
        // 3. 计算函数选择器并检查
        console.log("\n📋 步骤 3: 检查函数选择器");
        console.log("-".repeat(80));
        
        const results = [];
        
        for (const func of FUNCTIONS_TO_CHECK) {
            // 计算函数选择器（前4字节的哈希）
            const selector = ethers.id(func.signature).slice(0, 10); // 0x + 8个十六进制字符
            const selectorBytes = selector.slice(2); // 去掉 0x
            
            // 检查字节码中是否包含选择器
            const bytecodeLower = bytecode.toLowerCase();
            const selectorLower = selectorBytes.toLowerCase();
            const containsSelector = bytecodeLower.includes(selectorLower);
            
            results.push({
                name: func.name,
                signature: func.signature,
                selector: selector,
                found: containsSelector
            });
            
            console.log(`\n${containsSelector ? "✅" : "❌"} ${func.name}`);
            console.log("   签名:", func.signature);
            console.log("   选择器:", selector);
            console.log("   状态:", containsSelector ? "✅ 存在于字节码中" : "❌ 不存在于字节码中");
            console.log("   描述:", func.description);
            
            if (containsSelector) {
                // 查找选择器在字节码中的位置（可能有多个）
                const positions = [];
                let index = bytecodeLower.indexOf(selectorLower);
                let count = 0;
                while (index !== -1 && count < 5) {
                    positions.push(index);
                    index = bytecodeLower.indexOf(selectorLower, index + 1);
                    count++;
                }
                console.log("   出现位置:", positions.length > 0 ? positions.join(", ") : "未找到");
                console.log("   出现次数:", positions.length);
            }
        }
        
        // 4. 总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 检查结果总结:");
        console.log("-".repeat(80));
        
        const foundCount = results.filter(r => r.found).length;
        const totalCount = results.length;
        
        console.log(`\n✅ 找到的函数: ${foundCount}/${totalCount}`);
        for (const result of results) {
            if (result.found) {
                console.log(`   ✅ ${result.name}`);
            }
        }
        
        console.log(`\n❌ 未找到的函数: ${totalCount - foundCount}/${totalCount}`);
        for (const result of results) {
            if (!result.found) {
                console.log(`   ❌ ${result.name}`);
            }
        }
        
        // 5. 额外检查：查找所有可能的函数选择器模式
        console.log("\n📋 步骤 4: 分析字节码中的函数选择器模式");
        console.log("-".repeat(80));
        
        // 提取字节码中所有可能的4字节选择器（以 PUSH4 指令开头）
        // PUSH4 的操作码是 0x63，后面跟着4字节的数据
        const push4Pattern = /63([0-9a-f]{8})/gi;
        const matches = [...bytecode.matchAll(push4Pattern)];
        
        console.log(`\n找到 ${matches.length} 个可能的函数选择器（PUSH4 指令）`);
        
        // 检查我们关心的选择器是否在 PUSH4 指令中
        const adminSetTeamCountSelector = results.find(r => r.name === "adminSetTeamCount")?.selector.slice(2).toLowerCase();
        const adminSetActiveDirectsSelector = results.find(r => r.name === "adminSetActiveDirects")?.selector.slice(2).toLowerCase();
        
        if (adminSetTeamCountSelector) {
            const foundInPush4 = matches.some(m => m[1].toLowerCase() === adminSetTeamCountSelector);
            console.log(`\nadminSetTeamCount 选择器在 PUSH4 中: ${foundInPush4 ? "✅ 是" : "❌ 否"}`);
        }
        
        if (adminSetActiveDirectsSelector) {
            const foundInPush4 = matches.some(m => m[1].toLowerCase() === adminSetActiveDirectsSelector);
            console.log(`adminSetActiveDirects 选择器在 PUSH4 中: ${foundInPush4 ? "✅ 是" : "❌ 否"}`);
        }
        
        // 显示前10个选择器作为示例
        console.log("\n前10个函数选择器示例:");
        for (let i = 0; i < Math.min(10, matches.length); i++) {
            console.log(`   ${i + 1}. 0x${matches[i][1]}`);
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("✅ 检查完成!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.stack) {
            console.error("堆栈:", error.stack);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });


// 配置
const PROXY_ADDRESS = "0x77601aC473dB1195A1A9c82229C9bD008a69987A";
// 尝试多个 RPC URL
const RPC_URLS = [
    process.env.MC_RPC_URL,
    "https://rpc.mcchain.io",
    "https://chain.mcerscan.com/",
    "https://mcchain.io/rpc"
].filter(Boolean);

// 要检查的函数
const FUNCTIONS_TO_CHECK = [
    {
        name: "adminSetTeamCount",
        signature: "adminSetTeamCount(address,uint256)",
        description: "管理员修改用户团队成员数量"
    },
    {
        name: "adminSetActiveDirects",
        signature: "adminSetActiveDirects(address,uint256)",
        description: "管理员修改用户活跃直推数量"
    },
    {
        name: "adminSetReferrer",
        signature: "adminSetReferrer(address,address)",
        description: "管理员修改用户推荐人"
    },
    {
        name: "owner",
        signature: "owner()",
        description: "获取合约所有者（用于验证）"
    }
];

async function getProvider() {
    for (const url of RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(url);
            // 尝试获取最新区块来测试连接
            await provider.getBlockNumber();
            console.log("✅ 使用 RPC URL:", url);
            return provider;
        } catch (error) {
            console.log("⚠️  RPC URL 不可用:", url);
            continue;
        }
    }
    throw new Error("所有 RPC URL 都不可用");
}

async function main() {
    console.log("🔍 检查实现合约字节码以确认函数是否存在\n");
    console.log("=".repeat(80));
    
    const provider = await getProvider();
    
    // 1. 获取实现合约地址
    console.log("\n📋 步骤 1: 获取实现合约地址");
    console.log("代理合约地址:", PROXY_ADDRESS);
    
    // UUPS 代理的实现地址存储在特定存储槽中
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    
    try {
        const slotValue = await provider.getStorage(PROXY_ADDRESS, IMPLEMENTATION_SLOT);
        // 实现地址是存储槽值的最后20字节（40个十六进制字符）
        const implAddress = "0x" + slotValue.slice(-40);
        console.log("✅ 实现合约地址:", implAddress);
        
        // 2. 获取实现合约的字节码
        console.log("\n📋 步骤 2: 获取实现合约字节码");
        const bytecode = await provider.getCode(implAddress);
        
        if (!bytecode || bytecode === "0x") {
            console.error("❌ 错误: 实现合约地址没有代码");
            return;
        }
        
        console.log("✅ 字节码长度:", bytecode.length, "字符");
        console.log("   字节码大小:", (bytecode.length - 2) / 2, "字节");
        console.log("   字节码前100字符:", bytecode.substring(0, 100) + "...");
        
        // 3. 计算函数选择器并检查
        console.log("\n📋 步骤 3: 检查函数选择器");
        console.log("-".repeat(80));
        
        const results = [];
        
        for (const func of FUNCTIONS_TO_CHECK) {
            // 计算函数选择器（前4字节的哈希）
            const selector = ethers.id(func.signature).slice(0, 10); // 0x + 8个十六进制字符
            const selectorBytes = selector.slice(2); // 去掉 0x
            
            // 检查字节码中是否包含选择器
            const bytecodeLower = bytecode.toLowerCase();
            const selectorLower = selectorBytes.toLowerCase();
            const containsSelector = bytecodeLower.includes(selectorLower);
            
            results.push({
                name: func.name,
                signature: func.signature,
                selector: selector,
                found: containsSelector
            });
            
            console.log(`\n${containsSelector ? "✅" : "❌"} ${func.name}`);
            console.log("   签名:", func.signature);
            console.log("   选择器:", selector);
            console.log("   状态:", containsSelector ? "✅ 存在于字节码中" : "❌ 不存在于字节码中");
            console.log("   描述:", func.description);
            
            if (containsSelector) {
                // 查找选择器在字节码中的位置（可能有多个）
                const positions = [];
                let index = bytecodeLower.indexOf(selectorLower);
                let count = 0;
                while (index !== -1 && count < 5) {
                    positions.push(index);
                    index = bytecodeLower.indexOf(selectorLower, index + 1);
                    count++;
                }
                console.log("   出现位置:", positions.length > 0 ? positions.join(", ") : "未找到");
                console.log("   出现次数:", positions.length);
            }
        }
        
        // 4. 总结
        console.log("\n" + "=".repeat(80));
        console.log("📊 检查结果总结:");
        console.log("-".repeat(80));
        
        const foundCount = results.filter(r => r.found).length;
        const totalCount = results.length;
        
        console.log(`\n✅ 找到的函数: ${foundCount}/${totalCount}`);
        for (const result of results) {
            if (result.found) {
                console.log(`   ✅ ${result.name}`);
            }
        }
        
        console.log(`\n❌ 未找到的函数: ${totalCount - foundCount}/${totalCount}`);
        for (const result of results) {
            if (!result.found) {
                console.log(`   ❌ ${result.name}`);
            }
        }
        
        // 5. 额外检查：查找所有可能的函数选择器模式
        console.log("\n📋 步骤 4: 分析字节码中的函数选择器模式");
        console.log("-".repeat(80));
        
        // 提取字节码中所有可能的4字节选择器（以 PUSH4 指令开头）
        // PUSH4 的操作码是 0x63，后面跟着4字节的数据
        const push4Pattern = /63([0-9a-f]{8})/gi;
        const matches = [...bytecode.matchAll(push4Pattern)];
        
        console.log(`\n找到 ${matches.length} 个可能的函数选择器（PUSH4 指令）`);
        
        // 检查我们关心的选择器是否在 PUSH4 指令中
        const adminSetTeamCountSelector = results.find(r => r.name === "adminSetTeamCount")?.selector.slice(2).toLowerCase();
        const adminSetActiveDirectsSelector = results.find(r => r.name === "adminSetActiveDirects")?.selector.slice(2).toLowerCase();
        
        if (adminSetTeamCountSelector) {
            const foundInPush4 = matches.some(m => m[1].toLowerCase() === adminSetTeamCountSelector);
            console.log(`\nadminSetTeamCount 选择器在 PUSH4 中: ${foundInPush4 ? "✅ 是" : "❌ 否"}`);
        }
        
        if (adminSetActiveDirectsSelector) {
            const foundInPush4 = matches.some(m => m[1].toLowerCase() === adminSetActiveDirectsSelector);
            console.log(`adminSetActiveDirects 选择器在 PUSH4 中: ${foundInPush4 ? "✅ 是" : "❌ 否"}`);
        }
        
        // 显示前10个选择器作为示例
        console.log("\n前10个函数选择器示例:");
        for (let i = 0; i < Math.min(10, matches.length); i++) {
            console.log(`   ${i + 1}. 0x${matches[i][1]}`);
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("✅ 检查完成!");
        
    } catch (error) {
        console.error("\n❌ 错误:", error.message);
        if (error.stack) {
            console.error("堆栈:", error.stack);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

