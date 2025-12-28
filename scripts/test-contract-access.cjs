require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    console.log('🔍 [Contract Access Test] Testing MC Chain contract access...\n');

    try {
        // MC Chain RPC
        const provider = new ethers.JsonRpcProvider('https://chain.mcerscan.com/');
        
        const protocolAddress = "0xc938b6D9ebC484BE7e946e11CD46BE56ee29BE19";
        
        // Minimal ABI for testing
        const abi = [
            "function userInfo(address) view returns (address referrer, uint256 activeDirects, uint256 teamCount, uint256 totalRevenue, uint256 currentCap, bool isActive, uint256 refundFeeAmount, uint256 teamTotalVolume, uint256 teamTotalCap, uint256 maxTicketAmount, uint256 maxSingleTicketAmount)"
        ];
        
        const protocol = new ethers.Contract(protocolAddress, abi, provider);
        
        // Test with the deployer address that likely has data
        const testAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48"; // deployer address
        
        console.log('📊 [Contract Info]');
        console.log(`Protocol Address: ${protocolAddress}`);
        console.log(`Provider: MC Chain RPC`);
        console.log(`Test Address: ${testAddress}`);
        
        try {
            const userInfo = await protocol.userInfo(testAddress);
            console.log('\n✅ Contract call successful!');
            console.log('User Info:', userInfo);
            
            const teamCount = Number(userInfo[2]);
            console.log(`Team Count: ${teamCount}`);
            
            // Test level calculation
            let level = "V0";
            if (teamCount >= 5000) level = "V9";
            else if (teamCount >= 1000) level = "V8";
            else if (teamCount >= 500) level = "V7";
            else if (teamCount >= 200) level = "V6";
            else if (teamCount >= 100) level = "V5";
            else if (teamCount >= 50) level = "V4";
            else if (teamCount >= 20) level = "V3";
            else if (teamCount >= 10) level = "V2";
            else if (teamCount >= 5) level = "V1";
            
            console.log(`Calculated Level: ${level}`);
            
        } catch (callError) {
            console.log('❌ Contract call failed:', callError.message);
            
            // Try to get more info about the contract
            try {
                const code = await provider.getCode(protocolAddress);
                if (code === '0x') {
                    console.log('❌ No contract code at this address');
                } else {
                    console.log('✅ Contract exists, but call failed');
                    console.log('Code length:', code.length);
                }
            } catch (e) {
                console.log('❌ Failed to check contract code:', e.message);
            }
        }
        
        // Test network connection
        console.log('\n🌐 [Network Test]');
        try {
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ Connected to MC Chain, block: ${blockNumber}`);
        } catch (e) {
            console.log('❌ Network connection failed:', e.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });