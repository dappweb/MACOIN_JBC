// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./JinbaoProtocol.sol";

/**
 * @title JinbaoProtocolV2Complete
 * @dev 完整升级版本，实现四种奖励类型的 50% MC + 50% JBC 分配
 */
contract JinbaoProtocolV2Complete is JinbaoProtocol {
    
    // 版本标识
    string public constant VERSION = "2.0.0-complete";
    
    // 调试事件
    event RewardDistributionDebug(address indexed user, uint256 amount, uint8 rewardType, bool success, string reason);
    event UpgradeCompleted(string version, uint256 timestamp);
    
    /**
     * @dev 初始化升级
     */
    function initializeV2() external onlyOwner {
        emit UpgradeCompleted(VERSION, block.timestamp);
    }
    
    /**
     * @dev 获取合约版本
     */
    function getVersion() external pure returns (string memory) {
        return VERSION;
    }
    
    /**
     * @dev 重写 _distributeReward 实现 50% MC + 50% JBC 分配
     */
    function _distributeReward(address user, uint256 amount, uint8 rType) internal override returns (uint256) {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        if (!u.isActive || t.exited || t.amount == 0) {
            emit RewardDistributionDebug(user, amount, rType, false, "User not eligible");
            return 0;
        }

        uint256 available = u.currentCap - u.totalRevenue;
        uint256 payout = amount;
        
        if (amount > available) {
            payout = available;
            emit RewardCapped(user, amount, available);
        }
        
        if (payout == 0) {
            emit RewardDistributionDebug(user, amount, rType, false, "No payout after cap check");
            return 0;
        }
        
        // 對於級差獎勵，使用原有邏輯
        if (rType == REWARD_DIFFERENTIAL) {
            return _distributeDifferentialReward(user, payout, rType);
        }
        
        // 對於直推、層級和靜態獎勵，實施 50% MC + 50% JBC 分配
        if (rType == REWARD_DIRECT || rType == REWARD_LEVEL || rType == REWARD_STATIC) {
            return _distribute50_50Reward(user, payout, rType);
        }
        
        // 其他類型保持原有邏輯（純 MC）
        return _distributeOriginalReward(user, payout, rType);
    }
    
    /**
     * @dev 實施 50% MC + 50% JBC 分配機制
     */
    function _distribute50_50Reward(address user, uint256 totalAmount, uint8 rType) internal returns (uint256) {
        // 計算 50/50 分配
        uint256 mcPart = totalAmount / 2;
        uint256 jbcValuePart = totalAmount - mcPart;
        
        // 檢查 MC 餘額
        if (mcToken.balanceOf(address(this)) < mcPart) {
            emit RewardDistributionDebug(user, totalAmount, rType, false, "Insufficient MC balance");
            return 0;
        }
        
        // 計算 JBC 數量（根據當前匯率）
        uint256 jbcAmount = 0;
        if (swapReserveMC > 0 && swapReserveJBC > 0) {
            jbcAmount = (jbcValuePart * swapReserveJBC) / swapReserveMC;
        } else {
            jbcAmount = jbcValuePart;
        }
        
        // 檢查 JBC 餘額
        if (jbcToken.balanceOf(address(this)) < jbcAmount) {
            emit RewardDistributionDebug(user, totalAmount, rType, false, "Insufficient JBC balance, MC only");
            return _distributeOriginalReward(user, totalAmount, rType);
        }
        
        // 執行分配
        UserInfo storage u = userInfo[user];
        u.totalRevenue += totalAmount;
        
        // 轉賬 MC
        bool mcSuccess = mcToken.transfer(user, mcPart);
        if (!mcSuccess) {
            u.totalRevenue -= totalAmount;
            emit RewardDistributionDebug(user, totalAmount, rType, false, "MC transfer failed");
            return 0;
        }
        
        // 轉賬 JBC
        bool jbcSuccess = jbcToken.transfer(user, jbcAmount);
        if (!jbcSuccess) {
            u.totalRevenue -= totalAmount;
            emit RewardDistributionDebug(user, totalAmount, rType, false, "JBC transfer failed");
            return 0;
        }
        
        // 觸發事件
        emit RewardPaid(user, totalAmount, rType);
        emit RewardDistributionDebug(user, totalAmount, rType, true, "50/50 reward distributed");
        
        // 檢查收益上限
        if (u.totalRevenue >= u.currentCap) {
            _handleExit(user);
        }
        
        return totalAmount;
    }
    
    /**
     * @dev 原有的純 MC 分配邏輯
     */
    function _distributeOriginalReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
        if (mcToken.balanceOf(address(this)) < amount) {
            emit RewardCapped(user, amount, 0);
            return 0;
        }
        
        UserInfo storage u = userInfo[user];
        u.totalRevenue += amount;
        
        bool success = mcToken.transfer(user, amount);
        if (!success) {
            u.totalRevenue -= amount;
            return 0;
        }
        
        emit RewardPaid(user, amount, rType);
        
        if (u.totalRevenue >= u.currentCap) {
            _handleExit(user);
        }
        
        return amount;
    }
}