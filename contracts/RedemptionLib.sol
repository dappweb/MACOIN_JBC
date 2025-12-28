// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library RedemptionLib {
    
    struct RedeemParams {
        uint256 amount;
        uint256 startTime;
        uint256 cycleDays;
        uint256 paid;
        uint256 maxTicketAmount;
        uint256 fallbackAmount;
        uint256 redemptionFeePercent;
        uint256 secondsInUnit;
    }
    
    function calculateRedemption(RedeemParams memory params) 
        internal 
        view 
        returns (uint256 pending, uint256 fee, bool canRedeem) 
    {
        uint256 endTime = params.startTime + (params.cycleDays * params.secondsInUnit);
        canRedeem = block.timestamp >= endTime;
        
        if (!canRedeem) return (0, 0, false);
        
        uint256 ratePerBillion = params.cycleDays == 7 ? 13333334 : 
                                params.cycleDays == 15 ? 16666667 : 20000000;
        
        uint256 totalStaticShouldBe = (params.amount * ratePerBillion * params.cycleDays) / 1000000000;
        pending = totalStaticShouldBe > params.paid ? totalStaticShouldBe - params.paid : 0;
        
        uint256 feeBase = params.maxTicketAmount > 0 ? params.maxTicketAmount : params.fallbackAmount;
        fee = (feeBase * params.redemptionFeePercent) / 100;
    }
    
    function processIndividualRedemption(
        IERC20 mcToken,
        address user,
        address contractAddr,
        uint256 amount,
        uint256 fee
    ) internal returns (bool success) {
        if (fee > 0) {
            if (mcToken.balanceOf(user) < fee) return false;
            if (mcToken.allowance(user, contractAddr) < fee) return false;
            if (!mcToken.transferFrom(user, contractAddr, fee)) return false;
        }
        
        return mcToken.transfer(user, amount);
    }
}