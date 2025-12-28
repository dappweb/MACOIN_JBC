// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IJBC is IERC20 {
    function burn(uint256 amount) external;
}

contract JinbaoProtocolMinimal is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    
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

    struct Stake {
        uint256 id;
        uint256 amount;
        uint256 startTime;
        uint256 cycleDays;
        bool active;
        uint256 paid;
    }

    struct Ticket {
        uint256 ticketId;
        uint256 amount;
        uint256 purchaseTime;
        bool exited;
    }

    struct PendingReward {
        address upline;
        uint256 amount;
    }

    IERC20 public mcToken;
    IJBC public jbcToken;
    
    address public marketingWallet;
    address public treasuryWallet;
    address public lpInjectionWallet;
    address public buybackWallet;
    
    uint256 public constant SECONDS_IN_UNIT = 60;
    
    uint256 public directRewardPercent;
    uint256 public levelRewardPercent;
    uint256 public marketingPercent;
    uint256 public buybackPercent;
    uint256 public lpInjectionPercent;
    uint256 public treasuryPercent;
    
    uint256 public redemptionFeePercent;
    uint256 public swapBuyTax;
    uint256 public swapSellTax;

    uint8 public constant REWARD_STATIC = 0;
    uint8 public constant REWARD_DYNAMIC = 1;
    uint8 public constant REWARD_DIRECT = 2;
    uint8 public constant REWARD_LEVEL = 3;
    uint8 public constant REWARD_DIFFERENTIAL = 4;

    mapping(address => UserInfo) public userInfo;
    mapping(address => Ticket) public userTicket;
    mapping(address => Stake[]) public userStakes;
    mapping(address => address[]) public directReferrals;
    mapping(uint256 => PendingReward[]) public ticketPendingRewards;
    
    uint256 public ticketFlexibilityDuration;
    bool public liquidityEnabled;
    bool public redeemEnabled;

    uint256 public swapReserveMC;
    uint256 public swapReserveJBC;
    
    uint256 public constant MIN_LIQUIDITY = 1000 * 1e18;
    uint256 public constant MAX_PRICE_IMPACT = 1000;

    uint256 public nextTicketId;
    uint256 public nextStakeId;
    uint256 public lastBurnTime;
    mapping(uint256 => address) public ticketOwner;
    mapping(uint256 => PendingReward[]) public stakePendingRewards;
    mapping(uint256 => address) public stakeOwner;
    uint256 public levelRewardPool;
    uint256[47] private __gap;
    bool public emergencyPaused;
    address public priceOracle;
    
    // Events
    event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount);
    event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev 获取用户当前的V等级信息 - 更新的极差裂变机制
     */
    function getUserLevel(address user) external view returns (uint256 level, uint256 percent, uint256 teamCount) {
        teamCount = userInfo[user].teamCount;
        (level, percent) = _getLevel(teamCount);
    }

    /**
     * @dev 根据团队地址数计算等级信息（纯函数，可用于前端计算）
     */
    function calculateLevel(uint256 teamCount) external pure returns (uint256 level, uint256 percent) {
        return _getLevel(teamCount);
    }

    /**
     * @dev 内部函数：根据团队数量计算等级和收益比例
     * 更新的极差裂变机制等级标准
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
     * @dev 更新团队统计并触发等级变化事件
     */
    function _updateTeamStats(address user, uint256 amount, bool isNewUser) internal {
        if (isNewUser) {
            _updateTeamCount(user);
        }
        if (amount > 0) {
            _updateTeamVolume(user, amount);
        }
        _checkAndEmitLevelChange(user);
    }

    function _updateTeamCount(address user) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        while (current != address(0) && iterations < 30) {
            uint256 oldCount = userInfo[current].teamCount;
            userInfo[current].teamCount = oldCount + 1;
            emit TeamCountUpdated(current, oldCount, oldCount + 1);
            _checkAndEmitLevelChange(current);
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _updateTeamVolume(address user, uint256 amount) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        while (current != address(0) && iterations < 30) {
            userInfo[current].teamTotalVolume += amount;
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _checkAndEmitLevelChange(address user) internal {
        uint256 teamCount = userInfo[user].teamCount;
        (uint256 newLevel,) = _getLevel(teamCount);
        emit UserLevelChanged(user, 0, newLevel, teamCount);
    }

    // 保留必要的接口兼容性
    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }
}