// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TokenomicsLib
 * @dev 金宝协议代币经济参数库
 */
library TokenomicsLib {
    // ═══════════════════════════════════════════════════════════════════════
    //                              奖励分配比例
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant DIRECT_REWARD_PERCENT = 25;
    uint256 public constant LEVEL_REWARD_PERCENT = 15;
    uint256 public constant LEVEL_REWARD_PER_LAYER = 1;
    uint256 public constant MAX_LEVEL_LAYERS = 15;
    uint256 public constant MARKETING_PERCENT = 3;
    uint256 public constant BUYBACK_PERCENT = 2;
    uint256 public constant LP_INJECTION_PERCENT = 3;
    uint256 public constant TREASURY_PERCENT = 2;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              费用设置
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant REDEMPTION_FEE_PERCENT = 5;
    uint256 public constant SWAP_BUY_TAX = 25;
    uint256 public constant SWAP_SELL_TAX = 50;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              时间参数
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant TICKET_FLEXIBILITY_DURATION = 72 hours;
    uint256 public constant DAILY_BURN_INTERVAL = 24 hours;
    uint256 public constant DAILY_BURN_PERCENT = 1;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              流动性参数
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant MIN_LIQUIDITY = 1000 * 1e18;
    uint256 public constant MAX_PRICE_IMPACT = 1000;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              级差奖励参数
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant MAX_DIFFERENTIAL_LAYERS = 20;
    uint256 public constant V9_PERCENT = 45;
    uint256 public constant MAX_RECURSION_DEPTH = 20;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              门票金额
    // ═══════════════════════════════════════════════════════════════════════
    
    uint256 public constant TICKET_AMOUNT_1 = 100 ether;
    uint256 public constant TICKET_AMOUNT_2 = 300 ether;
    uint256 public constant TICKET_AMOUNT_3 = 500 ether;
    uint256 public constant TICKET_AMOUNT_4 = 1000 ether;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              验证函数
    // ═══════════════════════════════════════════════════════════════════════
    
    function isValidTicketAmount(uint256 amount) internal pure returns (bool) {
        return amount == TICKET_AMOUNT_1 || 
               amount == TICKET_AMOUNT_2 || 
               amount == TICKET_AMOUNT_3 || 
               amount == TICKET_AMOUNT_4;
    }
    
    function isValidCycle(uint256 cycleDays) internal pure returns (bool) {
        return cycleDays == 7 || cycleDays == 15 || cycleDays == 30;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              计算函数
    // ═══════════════════════════════════════════════════════════════════════
    
    function calculateCap(uint256 ticketAmount) internal pure returns (uint256) {
        return ticketAmount * 2;
    }
    
    function calculateRequiredLiquidity(uint256 baseMaxAmount) internal pure returns (uint256) {
        return (baseMaxAmount * 150) / 100;
    }
    
    function getRate(uint256 cycleDays) internal pure returns (uint256) {
        if (cycleDays == 7) return 13333334;
        if (cycleDays == 15) return 16666667;
        if (cycleDays == 30) return 20000000;
        return 0;
    }
    
    function getLevel(uint256 teamCount) internal pure returns (uint256 level, uint256 percent) {
        if (teamCount >= 100000) return (9, 45);
        if (teamCount >= 30000) return (8, 40);
        if (teamCount >= 10000) return (7, 35);
        if (teamCount >= 3000) return (6, 30);
        if (teamCount >= 1000) return (5, 25);
        if (teamCount >= 300) return (4, 20);
        if (teamCount >= 100) return (3, 15);
        if (teamCount >= 30) return (2, 10);
        if (teamCount >= 10) return (1, 5);
        return (0, 0);
    }
    
    function getLevelRewardLayers(uint256 activeDirects) internal pure returns (uint256) {
        if (activeDirects >= 15) return 15;
        if (activeDirects >= 10) return 10;
        if (activeDirects >= 5) return 5;
        if (activeDirects >= 3) return 3;
        if (activeDirects >= 1) return 1;
        return 0;
    }
}


