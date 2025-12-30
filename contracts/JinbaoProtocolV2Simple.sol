// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./JinbaoProtocol.sol";

/**
 * @title JinbaoProtocolV2Simple
 * @dev 简化升级版本，专门修复奖励事件问题，不改变存储布局
 * 主要修复：
 * 1. 确保ReferralRewardPaid事件在直推和层级奖励时正确触发
 * 2. 添加调试功能帮助排查问题
 * 3. 保持完全的存储兼容性
 */
contract JinbaoProtocolV2Simple is JinbaoProtocol {
    
    // 版本标识 - 使用常量不占用存储槽
    string public constant VERSION = "2.0.0-simple";
    
    // 调试事件 - 不占用存储
    event RewardDistributionDebug(address indexed user, uint256 amount, uint8 rewardType, bool success, string reason);
    event UpgradeCompleted(string version, uint256 timestamp);
    
    /**
     * @dev 初始化升级 - 在升级后调用一次
     */
    function initializeV2() external onlyOwner {
        emit UpgradeCompleted(VERSION, block.timestamp);
    }
    
    /**
     * @dev 重写 _distributeReward 确保事件触发
     */
    function _distributeReward(address user, uint256 amount, uint8 rType) internal override returns (uint256) {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        // 增强验证并记录调试信息
        if (!u.isActive) {
            emit RewardDistributionDebug(user, amount, rType, false, "User not active");
            return 0;
        }
        
        if (t.exited) {
            emit RewardDistributionDebug(user, amount, rType, false, "User ticket exited");
            return 0;
        }
        
        if (t.amount == 0) {
            emit RewardDistributionDebug(user, amount, rType, false, "No ticket amount");
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
        
        // 其他獎勵類型 - 確保有足夠餘額
        uint256 contractBalance = mcToken.balanceOf(address(this));
        if (contractBalance < payout) {
            emit RewardDistributionDebug(user, payout, rType, false, "Insufficient MC balance");
            emit RewardCapped(user, payout, 0);
            return 0;
        }
        
        // 執行轉賬
        u.totalRevenue += payout;
        
        bool transferSuccess = false;
        try mcToken.transfer(user, payout) {
            transferSuccess = true;
        } catch {
            // 轉賬失敗，回滾狀態
            u.totalRevenue -= payout;
            emit RewardDistributionDebug(user, payout, rType, false, "MC transfer failed");
            return 0;
        }
        
        if (transferSuccess) {
            // 確保觸發 RewardPaid 事件
            emit RewardPaid(user, payout, rType);
            emit RewardDistributionDebug(user, payout, rType, true, "Reward distributed successfully");
            
            // 檢查是否達到收益上限
            if (u.totalRevenue >= u.currentCap) {
                _handleExit(user);
            }
        }
        
        return payout;
    }
    
    /**
     * @dev 重写 buyTicket 确保奖励事件触发
     */
    function buyTicket(uint256 amount) external override nonReentrant whenNotPaused {
        _expireTicketIfNeeded(msg.sender);
        if (amount != 100 * 1e18 && amount != 300 * 1e18 && amount != 500 * 1e18 && amount != 1000 * 1e18) revert InvalidAmount();
        
        mcToken.transferFrom(msg.sender, address(this), amount);

        Ticket storage t = userTicket[msg.sender];
        
        // 门票逻辑保持不变
        if (t.exited) {
            nextTicketId++;
            t.ticketId = nextTicketId;
            t.amount = amount;
            t.purchaseTime = block.timestamp;
            t.exited = false;
            
            userInfo[msg.sender].totalRevenue = 0;
            userInfo[msg.sender].currentCap = amount * 3;
        } else {
            if (t.amount == 0) {
                nextTicketId++;
                t.ticketId = nextTicketId;
                t.amount = amount;
                t.purchaseTime = block.timestamp;
                t.exited = false;
                
                userInfo[msg.sender].totalRevenue = 0;
                userInfo[msg.sender].currentCap = amount * 3;
            } else {
                t.amount += amount;
                if (userInfo[msg.sender].isActive) {
                    t.purchaseTime = block.timestamp;
                }
                userInfo[msg.sender].currentCap += amount * 3;
            }
        }

        if (t.amount > userInfo[msg.sender].maxTicketAmount) {
            userInfo[msg.sender].maxTicketAmount = t.amount;
        }

        if (amount > userInfo[msg.sender].maxSingleTicketAmount) {
            userInfo[msg.sender].maxSingleTicketAmount = amount;
        }

        ticketOwner[t.ticketId] = msg.sender;
        
        // 🔥 关键修复：直推奖励分发
        address referrerAddr = userInfo[msg.sender].referrer;
        if (referrerAddr != address(0)) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            
            // 检查推荐人状态
            if (userInfo[referrerAddr].isActive) {
                uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
                
                // 🔥 强制触发事件 - 使用6参数格式
                emit ReferralRewardPaid(referrerAddr, msg.sender, paid, 0, REWARD_DIRECT, t.ticketId);
                emit RewardDistributionDebug(referrerAddr, directAmt, REWARD_DIRECT, paid > 0, 
                    paid > 0 ? "Direct reward paid" : "Direct reward capped");
            } else {
                // 推荐人不活跃，发送到营销钱包
                mcToken.transfer(marketingWallet, directAmt);
                emit RewardDistributionDebug(referrerAddr, directAmt, REWARD_DIRECT, false, "Referrer not active");
            }
        } else {
            // 没有推荐人，发送到营销钱包
            mcToken.transfer(marketingWallet, (amount * directRewardPercent) / 100);
        }

        // 🔥 关键修复：层级奖励分发
        _distributeTicketLevelRewardsV2(msg.sender, amount);

        // 其他分发保持不变
        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        uint256 buybackAmt = (amount * buybackPercent) / 100;
        _internalBuybackAndBurn(buybackAmt);

        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);
        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);
        
        // 更新团队统计
        _updateTeamStats(msg.sender, amount, false);
        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }
    
    /**
     * @dev 增强的层级奖励分发，确保事件触发
     */
    function _distributeTicketLevelRewardsV2(address user, uint256 amount) internal {
        address current = userInfo[user].referrer;
        uint256 totalDistributed = 0;
        uint256 layerCount = 0;
        uint256 iterations = 0;
        uint256 rewardPerLayer = (amount * 1) / 100; // 1% per layer
        
        while (current != address(0) && layerCount < 15 && iterations < 20) {
            if (!userInfo[current].isActive) {
                current = userInfo[current].referrer;
                iterations++;
                continue;
            }
            
            uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
            
            if (maxLayers > layerCount) {
                uint256 paid = _distributeReward(current, rewardPerLayer, REWARD_LEVEL);
                
                // 🔥 强制触发层级奖励事件 - 使用6参数格式
                emit ReferralRewardPaid(current, user, paid, 0, REWARD_LEVEL, userTicket[user].ticketId);
                emit RewardDistributionDebug(current, rewardPerLayer, REWARD_LEVEL, paid > 0,
                    paid > 0 ? "Level reward paid" : "Level reward capped");
                
                if (paid > 0) {
                    totalDistributed += paid;
                }
            }
            
            current = userInfo[current].referrer;
            layerCount++;
            iterations++;
        }
        
        // 处理剩余的层级奖励池
        uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;
        uint256 remaining = totalLevelRewardAmount - totalDistributed;
        if (remaining > 0) {
            levelRewardPool += remaining;
            emit LevelRewardPoolUpdated(remaining, levelRewardPool);
        }
    }
    
    /**
     * @dev 获取合约版本
     */
    function getVersion() external pure returns (string memory) {
        return VERSION;
    }
    
    /**
     * @dev 管理员紧急修复函数 - 手动触发缺失的奖励事件
     */
    function emitMissingRewardEvent(
        address user,
        address from,
        uint256 mcAmount,
        uint256 jbcAmount,
        uint8 rewardType,
        uint256 ticketId
    ) external onlyOwner {
        emit ReferralRewardPaid(user, from, mcAmount, jbcAmount, rewardType, ticketId);
        emit RewardDistributionDebug(user, mcAmount, rewardType, true, "Manual event emission");
    }
    
    /**
     * @dev 批量修复缺失事件
     */
    function batchEmitRewardEvents(
        address[] calldata users,
        address[] calldata froms,
        uint256[] calldata mcAmounts,
        uint256[] calldata jbcAmounts,
        uint8[] calldata rewardTypes,
        uint256[] calldata ticketIds
    ) external onlyOwner {
        require(users.length == froms.length && 
                users.length == mcAmounts.length && 
                users.length == jbcAmounts.length && 
                users.length == rewardTypes.length && 
                users.length == ticketIds.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            emit ReferralRewardPaid(users[i], froms[i], mcAmounts[i], jbcAmounts[i], rewardTypes[i], ticketIds[i]);
        }
    }
}