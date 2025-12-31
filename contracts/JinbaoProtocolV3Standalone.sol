// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IJinbaoProtocolV2 {
    function userInfo(address user) external view returns (
        uint256 totalTickets,
        uint256 totalStaked,
        uint256 totalRewards,
        uint256 referralCount,
        uint256 teamCount,
        address referrer,
        bool isActive
    );
    
    function tickets(address user, uint256 index) external view returns (
        uint256 amount,
        uint256 timestamp,
        bool isActive
    );
    
    function stakes(address user, uint256 index) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 cycleDays,
        bool isActive
    );
    
    function paused() external view returns (bool);
    function owner() external view returns (address);
}

/**
 * @title JinbaoProtocolV3Standalone
 * @dev 独立的V3升级合约，添加动态奖励功能
 * 通过UUPS代理升级现有合约，保持数据完整性
 */
contract JinbaoProtocolV3Standalone is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    
    // 版本标识
    string public constant VERSION_V3 = "3.0.0";
    
    // 动态奖励记录结构
    struct DynamicReward {
        uint256 amount;           // 奖励金额 (MC)
        uint256 timestamp;        // 获得时间
        uint8 sourceType;         // 来源类型 (1=直推, 2=层级, 3=极差)
        address fromUser;         // 来源用户
        bool claimed;             // 是否已提取
        uint256 unlockTime;       // 解锁时间
    }
    
    // V2合约数据存储布局 (保持兼容性)
    IERC20 public mcToken;
    IERC20 public jbcToken;
    
    // 用户信息结构 (与V2保持一致)
    struct UserInfo {
        uint256 totalTickets;
        uint256 totalStaked;
        uint256 totalRewards;
        uint256 referralCount;
        uint256 teamCount;
        address referrer;
        bool isActive;
    }
    
    // 门票结构 (与V2保持一致)
    struct Ticket {
        uint256 amount;
        uint256 timestamp;
        bool isActive;
    }
    
    // 质押结构 (与V2保持一致)
    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 cycleDays;
        bool isActive;
    }
    
    // V2数据映射 (保持存储布局)
    mapping(address => UserInfo) public userInfo;
    mapping(address => Ticket[]) public tickets;
    mapping(address => Stake[]) public stakes;
    mapping(address => address[]) public referrals;
    mapping(address => uint256) public pendingRewards;
    
    // V3新增：动态奖励存储
    mapping(address => DynamicReward[]) public userDynamicRewards;
    mapping(address => uint256) public totalDynamicEarned;    // 总获得动态奖励
    mapping(address => uint256) public totalDynamicClaimed;   // 总提取动态奖励
    
    // 存储间隙，为未来升级预留空间
    uint256[44] private __gap;
    
    // 动态奖励事件
    event DynamicRewardRecorded(address indexed user, uint256 amount, uint8 sourceType, address fromUser, uint256 unlockTime);
    event DynamicRewardsClaimed(address indexed user, uint256 amount, uint256 rewardCount);
    event DynamicRewardSystemInitialized(string version, uint256 timestamp);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev V3升级初始化函数
     */
    function initializeV3() external reinitializer(3) {
        // 验证现有数据完整性
        require(address(mcToken) != address(0), "MC token not initialized");
        require(address(jbcToken) != address(0), "JBC token not initialized");
        
        // 发出初始化事件
        emit DynamicRewardSystemInitialized(VERSION_V3, block.timestamp);
    }
    
    /**
     * @dev 获取V3版本信息
     */
    function getVersionV3() external pure returns (string memory) {
        return VERSION_V3;
    }
    
    /**
     * @dev 获取用户动态奖励概览
     */
    function getUserDynamicRewards(address user) external view returns (
        uint256 totalEarned,
        uint256 totalClaimed,
        uint256 pendingAmount,
        uint256 claimableAmount
    ) {
        totalEarned = totalDynamicEarned[user];
        totalClaimed = totalDynamicClaimed[user];
        
        DynamicReward[] memory rewards = userDynamicRewards[user];
        uint256 pending = 0;
        uint256 claimable = 0;
        
        for (uint256 i = 0; i < rewards.length; i++) {
            if (!rewards[i].claimed) {
                pending += rewards[i].amount;
                if (block.timestamp >= rewards[i].unlockTime) {
                    claimable += rewards[i].amount;
                }
            }
        }
        
        pendingAmount = pending;
        claimableAmount = claimable;
    }
    
    /**
     * @dev 获取用户动态奖励详细列表
     */
    function getUserDynamicRewardsList(address user, uint256 offset, uint256 limit) 
        external view returns (DynamicReward[] memory) {
        DynamicReward[] memory allRewards = userDynamicRewards[user];
        
        if (offset >= allRewards.length) {
            return new DynamicReward[](0);
        }
        
        uint256 end = offset + limit;
        if (end > allRewards.length) {
            end = allRewards.length;
        }
        
        DynamicReward[] memory result = new DynamicReward[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allRewards[i];
        }
        
        return result;
    }
    
    /**
     * @dev 提取可用的动态奖励
     */
    function claimDynamicRewards() external nonReentrant whenNotPaused {
        DynamicReward[] storage rewards = userDynamicRewards[msg.sender];
        uint256 claimableAmount = 0;
        uint256 claimedCount = 0;
        
        // 计算可提取金额并标记为已提取
        for (uint256 i = 0; i < rewards.length; i++) {
            if (!rewards[i].claimed && block.timestamp >= rewards[i].unlockTime) {
                claimableAmount += rewards[i].amount;
                rewards[i].claimed = true;
                claimedCount++;
            }
        }
        
        require(claimableAmount > 0, "No claimable dynamic rewards");
        require(address(this).balance >= claimableAmount, "Insufficient contract balance");
        
        // 更新统计
        totalDynamicClaimed[msg.sender] += claimableAmount;
        
        // 转账MC
        payable(msg.sender).transfer(claimableAmount);
        
        emit DynamicRewardsClaimed(msg.sender, claimableAmount, claimedCount);
    }
    
    /**
     * @dev 记录动态奖励 (内部函数，由其他功能调用)
     */
    function _recordDynamicReward(
        address user,
        uint256 amount,
        uint8 sourceType,
        address fromUser,
        uint256 unlockDelay
    ) internal {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Invalid reward amount");
        
        uint256 unlockTime = block.timestamp + unlockDelay;
        
        userDynamicRewards[user].push(DynamicReward({
            amount: amount,
            timestamp: block.timestamp,
            sourceType: sourceType,
            fromUser: fromUser,
            claimed: false,
            unlockTime: unlockTime
        }));
        
        totalDynamicEarned[user] += amount;
        
        emit DynamicRewardRecorded(user, amount, sourceType, fromUser, unlockTime);
    }
    
    /**
     * @dev 处理购买门票时的动态奖励分发
     */
    function _distributeDynamicRewardsOnTicketPurchase(address buyer, uint256 ticketAmount) internal {
        UserInfo memory buyerInfo = userInfo[buyer];
        
        // 1. 直推奖励 (25% MC, 即时解锁)
        if (buyerInfo.referrer != address(0)) {
            uint256 directReward = (ticketAmount * 25) / 100;
            _recordDynamicReward(buyerInfo.referrer, directReward, 1, buyer, 0);
        }
        
        // 2. 层级奖励 (每层1% MC, 即时解锁)
        address current = buyerInfo.referrer;
        uint256 layer = 1;
        
        while (current != address(0) && layer <= 15) {
            UserInfo memory currentInfo = userInfo[current];
            
            // 检查该层级用户是否有有效门票
            if (currentInfo.isActive && currentInfo.totalTickets > 0) {
                uint256 layerReward = ticketAmount / 100; // 1%
                _recordDynamicReward(current, layerReward, 2, buyer, 0);
            }
            
            current = currentInfo.referrer;
            layer++;
        }
        
        // 3. 极差奖励 (基于V等级, 30天解锁)
        _distributeDifferentialRewards(buyer, ticketAmount);
    }
    
    /**
     * @dev 分发极差奖励
     */
    function _distributeDifferentialRewards(address buyer, uint256 amount) internal {
        UserInfo memory buyerInfo = userInfo[buyer];
        address current = buyerInfo.referrer;
        uint256 previousPercent = 0;
        uint256 iterations = 0;
        
        while (current != address(0) && iterations < 20) {
            UserInfo memory currentInfo = userInfo[current];
            
            if (!currentInfo.isActive) {
                current = currentInfo.referrer;
                iterations++;
                continue;
            }

            (, uint256 percent) = _getLevel(currentInfo.teamCount);
            
            if (percent > previousPercent) {
                uint256 diffPercent = percent - previousPercent;
                uint256 baseAmount = amount;
                
                // 检查上级门票限制
                if (currentInfo.totalTickets > 0 && baseAmount > currentInfo.totalTickets) {
                    baseAmount = currentInfo.totalTickets;
                }
                
                uint256 rewardAmount = (baseAmount * diffPercent) / 100;
                
                if (rewardAmount > 0) {
                    // 极差奖励30天解锁
                    _recordDynamicReward(current, rewardAmount, 3, buyer, 30 days);
                }
                
                previousPercent = percent;
            }
            
            current = currentInfo.referrer;
            iterations++;
        }
    }
    
    /**
     * @dev 内部函数：根据团队数量计算等级和收益比例
     */
    function _getLevel(uint256 value) private pure returns (uint256 level, uint256 percent) {
        if (value >= 100000) return (9, 45);  // V9: 100,000个地址，45%极差收益
        if (value >= 30000) return (8, 40);   // V8: 30,000个地址，40%极差收益
        if (value >= 10000) return (7, 35);   // V7: 10,000个地址，35%极差收益
        if (value >= 3000) return (6, 30);    // V6: 3,000个地址，30%极差收益
        if (value >= 1000) return (5, 25);    // V5: 1,000个地址，25%极差收益
        if (value >= 300) return (4, 20);     // V4: 300个地址，20%极差收益
        if (value >= 100) return (3, 15);     // V3: 100个地址，15%极差收益
        if (value >= 30) return (2, 10);      // V2: 30个地址，10%极差收益
        if (value >= 10) return (1, 5);       // V1: 10个地址，5%极差收益
        return (0, 0);
    }
    
    /**
     * @dev 管理员函数：手动记录动态奖励 (用于数据迁移或特殊情况)
     */
    function adminRecordDynamicReward(
        address user,
        uint256 amount,
        uint8 sourceType,
        address fromUser,
        uint256 unlockDelay
    ) external onlyOwner {
        _recordDynamicReward(user, amount, sourceType, fromUser, unlockDelay);
    }
    
    /**
     * @dev 管理员函数：紧急提取合约余额
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev 接收MC代币
     */
    receive() external payable {}
    
    /**
     * @dev 回退函数
     */
    fallback() external payable {}
}