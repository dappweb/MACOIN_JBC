// Debug script for homepage level display issue
// User can copy and paste this into browser console on the homepage

console.log('🔍 [Homepage Level Debug] Starting debug...');

// Check if Web3 context is available
if (window.ethereum) {
    console.log('✅ MetaMask/Wallet detected');
    
    // Check current network
    window.ethereum.request({ method: 'eth_chainId' })
        .then(chainId => {
            const chainIdDecimal = parseInt(chainId, 16);
            console.log(`🌐 Current Chain ID: ${chainIdDecimal}`);
            
            if (chainIdDecimal === 88813) {
                console.log('✅ Connected to MC Chain');
            } else {
                console.log('❌ Not connected to MC Chain (88813)');
                console.log('Please switch to MC Chain in your wallet');
            }
        })
        .catch(err => console.error('❌ Failed to get chain ID:', err));
    
    // Check current account
    window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
            if (accounts.length > 0) {
                console.log(`✅ Wallet connected: ${accounts[0]}`);
                
                // Check if this is the expected user address
                const expectedAddress = "0x4C10831CBcF9884ba72051b5287b6c87E4F74A48";
                if (accounts[0].toLowerCase() === expectedAddress.toLowerCase()) {
                    console.log('✅ This is the test user address with 13 team members');
                } else {
                    console.log('ℹ️ Different user address - team count may vary');
                }
            } else {
                console.log('❌ No wallet connected');
                console.log('Please connect your wallet first');
            }
        })
        .catch(err => console.error('❌ Failed to get accounts:', err));
        
} else {
    console.log('❌ No wallet detected');
    console.log('Please install MetaMask or another Web3 wallet');
}

// Check if React components are loaded
setTimeout(() => {
    console.log('\n📊 [Component State Check]');
    
    // Look for level display elements
    const levelElements = document.querySelectorAll('[class*="level"], [class*="Level"]');
    console.log(`Found ${levelElements.length} potential level elements`);
    
    levelElements.forEach((el, index) => {
        console.log(`Level element ${index + 1}:`, el.textContent.trim());
    });
    
    // Look for team count elements
    const teamElements = document.querySelectorAll('[class*="team"], [class*="Team"]');
    console.log(`Found ${teamElements.length} potential team elements`);
    
    teamElements.forEach((el, index) => {
        if (el.textContent.includes('团队') || el.textContent.includes('Team') || /\d+/.test(el.textContent)) {
            console.log(`Team element ${index + 1}:`, el.textContent.trim());
        }
    });
    
    // Check for V0, V1, V2 text
    const vLevelElements = document.querySelectorAll('*');
    const vLevelTexts = [];
    vLevelElements.forEach(el => {
        if (el.textContent && /V[0-9]/.test(el.textContent) && el.children.length === 0) {
            vLevelTexts.push(el.textContent.trim());
        }
    });
    
    if (vLevelTexts.length > 0) {
        console.log('📋 Found level displays:', vLevelTexts);
        
        if (vLevelTexts.some(text => text.includes('V0'))) {
            console.log('❌ Still showing V0 - this is the issue!');
        } else if (vLevelTexts.some(text => text.includes('V2'))) {
            console.log('✅ Showing V2 - level is correct!');
        }
    }
    
}, 2000);

// Instructions for user
console.log('\n📱 [Instructions]');
console.log('1. Make sure you are connected to MC Chain (Chain ID: 88813)');
console.log('2. Wait 5-10 seconds for data to load');
console.log('3. Check the output above for any issues');
console.log('4. If still showing V0, try refreshing the page');
console.log('5. Report any errors shown in red above');

console.log('\n⏱️ Waiting 2 seconds to check component state...');