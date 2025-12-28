// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library AdminLib {
    
    struct UserInfo {
        address referrer;
        uint256 activeDirects;
        uint256 teamCount;
        uint256 totalRevenue;
        uint256 currentCap;
        bool isActive;
        uint256 refundFeeAmount;
        uint256 teamTotalVolume;
        uint256 teamTotalCap;
        uint256 maxTicketAmount;
        uint256 maxSingleTicketAmount;
    }

    struct Ticket {
        uint256 ticketId;
        uint256 amount;
        uint256 purchaseTime;
        bool exited;
    }

    struct Stake {
        uint256 id;
        uint256 amount;
        uint256 startTime;
        uint256 cycleDays;
        bool active;
        uint256 paid;
    }
    
    event ReferrerChanged(address indexed user, address indexed oldReferrer, address indexed newReferrer);
    event UserDataUpdated(address indexed user, uint256 activeDirects, uint256 totalRevenue, uint256 currentCap, uint256 refundFee);
    event UserReset(address indexed user);
    
    function hasCircularReference(
        address user, 
        address newReferrer,
        mapping(address => UserInfo) storage userInfo
    ) internal view returns (bool) {
        address current = newReferrer;
        uint256 depth = 0;
        
        while (current != address(0) && depth < 50) {
            if (current == user) {
                return true;
            }
            current = userInfo[current].referrer;
            depth++;
        }
        
        return false;
    }
    
    function removeFromDirectReferrals(
        address referrer, 
        address user,
        mapping(address => address[]) storage directReferrals
    ) internal {
        address[] storage referrals = directReferrals[referrer];
        for (uint256 i = 0; i < referrals.length; i++) {
            if (referrals[i] == user) {
                referrals[i] = referrals[referrals.length - 1];
                referrals.pop();
                break;
            }
        }
    }
    
    function getUserTeamSize(
        address user,
        mapping(address => UserInfo) storage userInfo
    ) internal view returns (uint256) {
        return userInfo[user].teamCount + 1;
    }
    
    function recalculateTeamCounts(
        address oldReferrer, 
        address newReferrer, 
        address user,
        mapping(address => UserInfo) storage userInfo
    ) internal {
        uint256 userTeamSize = getUserTeamSize(user, userInfo);
        
        // Remove from old referrer chain
        if (oldReferrer != address(0)) {
            address current = oldReferrer;
            uint256 iterations = 0;
            while (current != address(0) && iterations < 30) {
                if (userInfo[current].teamCount >= userTeamSize) {
                    userInfo[current].teamCount -= userTeamSize;
                } else {
                    userInfo[current].teamCount = 0;
                }
                current = userInfo[current].referrer;
                iterations++;
            }
        }
        
        // Add to new referrer chain
        if (newReferrer != address(0)) {
            address current = newReferrer;
            uint256 iterations = 0;
            while (current != address(0) && iterations < 30) {
                userInfo[current].teamCount += userTeamSize;
                current = userInfo[current].referrer;
                iterations++;
            }
        }
    }
    
    function setReferrer(
        address user,
        address newReferrer,
        mapping(address => UserInfo) storage userInfo,
        mapping(address => address[]) storage directReferrals
    ) internal {
        require(user != address(0) && newReferrer != address(0), "Invalid address");
        require(user != newReferrer, "Self reference not allowed");
        require(!hasCircularReference(user, newReferrer, userInfo), "Circular reference detected");
        
        address oldReferrer = userInfo[user].referrer;
        if (oldReferrer == newReferrer) return;
        
        userInfo[user].referrer = newReferrer;
        
        if (oldReferrer != address(0)) {
            removeFromDirectReferrals(oldReferrer, user, directReferrals);
        }
        directReferrals[newReferrer].push(user);
        
        recalculateTeamCounts(oldReferrer, newReferrer, user, userInfo);
        
        emit ReferrerChanged(user, oldReferrer, newReferrer);
    }
    
    function updateUserData(
        address user,
        bool updateActiveDirects,
        uint256 newActiveDirects,
        bool updateTotalRevenue,
        uint256 newTotalRevenue,
        bool updateCurrentCap,
        uint256 newCurrentCap,
        bool updateRefundFee,
        uint256 newRefundFee,
        mapping(address => UserInfo) storage userInfo
    ) internal {
        require(user != address(0), "Invalid address");
        
        UserInfo storage info = userInfo[user];
        
        if (updateActiveDirects) {
            info.activeDirects = newActiveDirects;
        }
        
        if (updateTotalRevenue) {
            info.totalRevenue = newTotalRevenue;
        }
        
        if (updateCurrentCap) {
            info.currentCap = newCurrentCap;
        }
        
        if (updateRefundFee) {
            info.refundFeeAmount = newRefundFee;
        }
        
        emit UserDataUpdated(user, newActiveDirects, newTotalRevenue, newCurrentCap, newRefundFee);
    }
    
    function resetUser(
        address user,
        mapping(address => UserInfo) storage userInfo,
        mapping(address => Ticket) storage userTicket,
        mapping(address => Stake[]) storage userStakes
    ) internal {
        require(user != address(0), "Invalid address");
        
        UserInfo storage info = userInfo[user];
        address referrer = info.referrer;
        uint256 teamCount = info.teamCount;
        
        info.activeDirects = 0;
        info.totalRevenue = 0;
        info.currentCap = 0;
        info.isActive = false;
        info.refundFeeAmount = 0;
        info.teamTotalVolume = 0;
        info.teamTotalCap = 0;
        info.maxTicketAmount = 0;
        info.maxSingleTicketAmount = 0;
        info.referrer = referrer;
        info.teamCount = teamCount;
        
        Ticket storage ticket = userTicket[user];
        ticket.ticketId = 0;
        ticket.amount = 0;
        ticket.purchaseTime = 0;
        ticket.exited = false;
        
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            stakes[i].active = false;
        }
        
        emit UserReset(user);
    }
}