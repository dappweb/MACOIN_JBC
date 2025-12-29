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

/**
 * @title JinbaoProtocolProduction
 * @dev 生产环境版本 - 修改了时间单位为天数计算
 * 
 * 主要变更:
 * 1. SECONDS_IN_UNIT 从 60 (分钟) 改为 86400 (天)
 * 2. 质押周期真正按天数计算
 * 3. 收益率按日计算
 */
contract JinbaoProtocolProduction is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    
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
    
    // 🔥 生产环境关键修改: 从分钟改为天数
    uint256 public constant SECONDS_IN_UNIT = 86400; // 24 * 60 * 60 = 86400秒 = 1天
    
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
    event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId);
    event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId);
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId);
    event RewardPaid(address indexed user, uint256 amount, uint8 rewardType);

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev 初始化函数
     */
    function initialize(
        address _mcToken,
        address _jbcToken,
        address _marketingWallet,
        address _treasuryWallet,
        address _lpInjectionWallet,
        address _buybackWallet
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketingWallet;
        treasuryWallet = _treasuryWallet;
        lpInjectionWallet = _lpInjectionWallet;
        buybackWallet = _buybackWallet;
        
        // 设置默认参数
        directRewardPercent = 1000; // 10%
        levelRewardPercent = 500;   // 5%
        marketingPercent = 300;     // 3%
        buybackPercent = 200;       // 2%
        lpInjectionPercent = 300;   // 3%
        treasuryPercent = 200;      // 2%
        redemptionFeePercent = 500; // 5%
        
        liquidityEnabled = true;
        redeemEnabled = true;
        nextTicketId = 1;
        nextStakeId = 1;
    }

    /**
     * @dev 提供流动性质押 - 生产环境版本
     * 质押周期按真实天数计算
     */
    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant {
        require(liquidityEnabled, "Liquidity disabled");
        Ticket storage ticket = userTicket[msg.sender];
        
        require(ticket.amount > 0, "No active ticket");
        require(!ticket.exited, "Ticket exited");
        
        // 🔥 生产环境: 真实的天数验证
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Invalid cycle: must be 7, 15, or 30 days");
        require(amount > 0, "Invalid amount");

        userStakes[msg.sender].push(Stake({
            id: nextStakeId,
            amount: amount,
            startTime: block.timestamp,
            cycleDays: cycleDays,  // 真实天数
            active: true,
            paid: 0
        }));
        
        stakeOwner[nextStakeId] = msg.sender;
        nextStakeId++;
        
        emit LiquidityStaked(msg.sender, amount, cycleDays, nextStakeId - 1);
    }

    /**
     * @dev 计算质押奖励 - 生产环境版本
     * 按天数计算收益
     */
    function calculateStakeRewards(address user) public view returns (uint256) {
        Stake[] storage stakes = userStakes[user];
        uint256 totalPending = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            // 🔥 生产环境收益率 (每日)
            uint256 ratePerBillion = 0;
            if (stakes[i].cycleDays == 7) {
                ratePerBillion = 13333334;      // 1.3333334% 每日
            } else if (stakes[i].cycleDays == 15) {
                ratePerBillion = 16666667;      // 1.6666667% 每日  
            } else if (stakes[i].cycleDays == 30) {
                ratePerBillion = 20000000;      // 2.0% 每日
            }
            
            // 🔥 生产环境时间计算: 按天数计算
            uint256 daysPassed = (block.timestamp - stakes[i].startTime) / SECONDS_IN_UNIT;
            if (daysPassed > stakes[i].cycleDays) {
                daysPassed = stakes[i].cycleDays;  // 不超过质押周期
            }
            
            if (daysPassed == 0) continue;

            // 计算总收益 = 本金 * 日收益率 * 天数
            uint256 totalStaticShouldBe = (stakes[i].amount * ratePerBillion * daysPassed) / 1000000000;
            
            uint256 paid = stakes[i].paid;
            if (totalStaticShouldBe > paid) {
                uint256 stakePending = totalStaticShouldBe - paid;
                totalPending += stakePending;
            }
        }
        
        return totalPending;
    }

    /**
     * @dev 获取质押详情 - 生产环境版本
     */
    function getStakeDetails(address user, uint256 stakeIndex) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 cycleDays,
        bool active,
        uint256 paid,
        uint256 daysRemaining,
        uint256 pendingRewards,
        uint256 dailyRate
    ) {
        require(stakeIndex < userStakes[user].length, "Invalid stake index");
        
        Stake storage stake = userStakes[user][stakeIndex];
        
        // 计算剩余天数
        uint256 daysPassed = (block.timestamp - stake.startTime) / SECONDS_IN_UNIT;
        uint256 remaining = 0;
        if (daysPassed < stake.cycleDays) {
            remaining = stake.cycleDays - daysPassed;
        }
        
        // 计算待领取奖励
        uint256 ratePerBillion = 0;
        if (stake.cycleDays == 7) ratePerBillion = 13333334;
        else if (stake.cycleDays == 15) ratePerBillion = 16666667;
        else if (stake.cycleDays == 30) ratePerBillion = 20000000;
        
        uint256 totalEarned = (stake.amount * ratePerBillion * (daysPassed > stake.cycleDays ? stake.cycleDays : daysPassed)) / 1000000000;
        uint256 pending = totalEarned > stake.paid ? totalEarned - stake.paid : 0;
        
        return (
            stake.amount,
            stake.startTime,
            stake.cycleDays,
            stake.active,
            stake.paid,
            remaining,
            pending,
            ratePerBillion  // 日收益率 (per billion)
        );
    }

    /**
     * @dev 获取用户当前的V等级信息
     */
    function getUserLevel(address user) external view returns (uint256 level, uint256 percent, uint256 teamCount) {
        teamCount = userInfo[user].teamCount;
        (level, percent) = _getLevel(teamCount);
        return (level, percent, teamCount);
    }

    /**
     * @dev 根据团队地址数计算等级信息
     */
    function calculateLevel(uint256 teamCount) external pure returns (uint256 level, uint256 percent) {
        return _getLevel(teamCount);
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
     * @dev 获取生产环境配置信息
     */
    function getProductionConfig() external pure returns (
        uint256 secondsInUnit,
        string memory timeUnit,
        uint256[3] memory supportedCycles,
        uint256[3] memory dailyRates
    ) {
        return (
            SECONDS_IN_UNIT,
            "days",
            [uint256(7), uint256(15), uint256(30)],
            [uint256(13333334), uint256(16666667), uint256(20000000)]  // 日收益率 per billion
        );
    }

    // 保留原有的核心功能
    function owner() public view override returns (address) {
        return super.owner();
    }

    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }
}