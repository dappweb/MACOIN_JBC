// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./RedemptionLib.sol";

interface IJBC is IERC20 {
    function burn(uint256 amount) external;
}

contract JinbaoProtocolComplete is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using RedemptionLib for RedemptionLib.RedeemParams;
    
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
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId);
    event RewardPaid(address indexed user, uint256 amount, uint8 rewardType);
    event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId);
    event Redeemed(address indexed user, uint256 principal, uint256 fee);
    event RewardCapped(address indexed user, uint256 amount, uint256 cappedAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier whenNotPaused() {
        require(!emergencyPaused, "Contract is paused");
        _;
    }

    // === V等级系统 (保留现有功能) ===
    
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

    // === 核心功能恢复 ===

    /**
     * @dev 绑定推荐人
     */
    function bindReferrer(address _referrer) external {
        require(userInfo[msg.sender].referrer == address(0), "Already bound");
        require(_referrer != msg.sender, "Self reference");
        require(_referrer != address(0), "Invalid address");
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender);
        
        _updateTeamStats(msg.sender, 0, true);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    /**
     * @dev 购买门票
     */
    function buyTicket(uint256 amount) external nonReentrant whenNotPaused {
        require(amount == 100 * 1e18 || amount == 300 * 1e18 || amount == 500 * 1e18 || amount == 1000 * 1e18, "Invalid amount");
        
        mcToken.transferFrom(msg.sender, address(this), amount);

        Ticket storage t = userTicket[msg.sender];
        
        if (t.exited || t.amount == 0) {
            nextTicketId++;
            t.ticketId = nextTicketId;
            t.amount = amount;
            t.purchaseTime = block.timestamp;
            t.exited = false;
            
            userInfo[msg.sender].totalRevenue = 0;
            userInfo[msg.sender].currentCap = amount * 3;
        } else {
            t.amount += amount;
            userInfo[msg.sender].currentCap += amount * 3;
        }

        if (t.amount > userInfo[msg.sender].maxTicketAmount) {
            userInfo[msg.sender].maxTicketAmount = t.amount;
        }

        if (amount > userInfo[msg.sender].maxSingleTicketAmount) {
            userInfo[msg.sender].maxSingleTicketAmount = amount;
        }

        ticketOwner[t.ticketId] = msg.sender;
        
        // 分发奖励 (简化版本)
        address referrerAddr = userInfo[msg.sender].referrer;
        if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
        }

        // 更新团队统计
        _updateTeamStats(msg.sender, amount, false);
        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }

    /**
     * @dev 提供流动性质押
     */
    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant whenNotPaused {
        require(liquidityEnabled, "Liquidity disabled");
        Ticket storage ticket = userTicket[msg.sender];
        
        require(ticket.amount > 0, "No active ticket");
        require(!ticket.exited, "Ticket exited");
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Invalid cycle");
        require(amount > 0, "Invalid amount");

        mcToken.transferFrom(msg.sender, address(this), amount);

        nextStakeId++;
        userStakes[msg.sender].push(Stake({
            id: nextStakeId,
            amount: amount,
            startTime: block.timestamp,
            cycleDays: cycleDays,
            active: true,
            paid: 0
        }));

        stakeOwner[nextStakeId] = msg.sender;
        _updateActiveStatus(msg.sender);

        emit LiquidityStaked(msg.sender, amount, cycleDays, nextStakeId);
    }

    /**
     * @dev 领取奖励
     */
    function claimRewards() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0 && !ticket.exited, "No active ticket");
        
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalPending = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            uint256 ratePerBillion = 0;
            if (stakes[i].cycleDays == 7) ratePerBillion = 13333334;
            else if (stakes[i].cycleDays == 15) ratePerBillion = 16666667;
            else if (stakes[i].cycleDays == 30) ratePerBillion = 20000000;
            
            uint256 unitsPassed = (block.timestamp - stakes[i].startTime) / SECONDS_IN_UNIT;
            if (unitsPassed > stakes[i].cycleDays) unitsPassed = stakes[i].cycleDays;
            
            if (unitsPassed == 0) continue;

            uint256 totalStaticShouldBe = (stakes[i].amount * ratePerBillion * unitsPassed) / 1000000000;
            
            uint256 paid = stakes[i].paid;
            if (totalStaticShouldBe > paid) {
                uint256 stakePending = totalStaticShouldBe - paid;
                totalPending += stakePending;
                stakes[i].paid += stakePending;
            }
        }
        
        require(totalPending > 0, "No rewards");
        
        if (userInfo[msg.sender].totalRevenue + totalPending > userInfo[msg.sender].currentCap) {
            totalPending = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
        }
        
        require(totalPending > 0, "Cap reached");
        
        userInfo[msg.sender].totalRevenue += totalPending;
        
        // 分发奖励 50% MC + 50% JBC
        uint256 mcPart = totalPending / 2;
        uint256 jbcValuePart = totalPending / 2;
        
        uint256 mcTransferred = 0;
        if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
            mcToken.transfer(msg.sender, mcPart);
            mcTransferred = mcPart;
        }
        
        uint256 jbcPrice = swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY ? 1 ether : (swapReserveMC * 1e18) / swapReserveJBC;
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        uint256 jbcTransferred = 0;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
            jbcToken.transfer(msg.sender, jbcAmount);
            jbcTransferred = jbcAmount;
        }
        
        emit RewardPaid(msg.sender, totalPending, REWARD_STATIC);
        emit RewardClaimed(msg.sender, mcTransferred, jbcTransferred, REWARD_STATIC, ticket.ticketId);
    }

    /**
     * @dev 单个质押赎回 - 修复版本
     */
    function redeemStake(uint256 stakeId) external nonReentrant {
        require(redeemEnabled, "Disabled");
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeId < stakes.length && stakes[stakeId].active, "Invalid stake");
        
        Stake storage stake = stakes[stakeId];
        
        // 使用修复后的RedemptionLib
        RedemptionLib.RedeemParams memory params = RedemptionLib.RedeemParams({
            amount: stake.amount,
            startTime: stake.startTime,
            cycleDays: stake.cycleDays,
            paid: stake.paid,
            maxTicketAmount: userInfo[msg.sender].maxTicketAmount,
            fallbackAmount: userTicket[msg.sender].amount,
            redemptionFeePercent: redemptionFeePercent,
            secondsInUnit: SECONDS_IN_UNIT
        });
        
        (uint256 pending, uint256 fee, bool canRedeem) = RedemptionLib.calculateRedemption(params);
        require(canRedeem, "Not expired");
        
        stake.paid += pending;
        stake.active = false;
        
        // 修复：直接转账本金，用户支付手续费
        if (fee > 0) {
            require(mcToken.balanceOf(msg.sender) >= fee, "Insufficient balance for fee");
            require(mcToken.allowance(msg.sender, address(this)) >= fee, "Insufficient allowance for fee");
            mcToken.transferFrom(msg.sender, address(this), fee);
            swapReserveMC += fee;
        }
        
        // 转账本金给用户
        mcToken.transfer(msg.sender, stake.amount);
        
        // 处理待领取奖励
        if (pending > 0) {
            uint256 available = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
            if (pending > available) {
                emit RewardCapped(msg.sender, pending, available);
                pending = available;
            }
            
            if (pending > 0) {
                userInfo[msg.sender].totalRevenue += pending;
                uint256 mcPart = pending / 2;
                if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
                    mcToken.transfer(msg.sender, mcPart);
                }
                uint256 jbcPrice = swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY ? 1 ether : (swapReserveMC * 1e18) / swapReserveJBC;
                uint256 jbcAmount = ((pending - mcPart) * 1 ether) / jbcPrice;
                if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
                    jbcToken.transfer(msg.sender, jbcAmount);
                }
                emit RewardPaid(msg.sender, pending, REWARD_STATIC);
            }
        }
        
        emit Redeemed(msg.sender, stake.amount, fee);
        _updateActiveStatus(msg.sender);
    }

    // === 内部函数 ===

    function _distributeReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        if (!u.isActive || t.exited || t.amount == 0) {
            return 0;
        }

        uint256 available = u.currentCap - u.totalRevenue;
        if (amount > available) amount = available;
        if (amount == 0) return 0;

        u.totalRevenue += amount;
        
        uint256 mcPart = amount / 2;
        if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
            mcToken.transfer(user, mcPart);
        }
        
        uint256 jbcPrice = swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY ? 1 ether : (swapReserveMC * 1e18) / swapReserveJBC;
        uint256 jbcAmount = ((amount - mcPart) * 1 ether) / jbcPrice;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
            jbcToken.transfer(user, jbcAmount);
        }
        
        emit RewardPaid(user, amount, rType);
        return amount;
    }

    function _updateActiveStatus(address user) internal {
        Stake[] storage stakes = userStakes[user];
        bool hasActiveStake = false;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].active) {
                hasActiveStake = true;
                break;
            }
        }
        
        userInfo[user].isActive = hasActiveStake;
    }

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

    // === 管理员函数 ===

    function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external onlyOwner {
        liquidityEnabled = _liquidityEnabled;
        redeemEnabled = _redeemEnabled;
    }

    function setRedemptionFeePercent(uint256 _fee) external onlyOwner {
        redemptionFeePercent = _fee;
    }

    function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external onlyOwner {
        if (mcAmount > 0) {
            mcToken.transferFrom(msg.sender, address(this), mcAmount);
            swapReserveMC += mcAmount;
        }
        if (jbcAmount > 0) {
            jbcToken.transferFrom(msg.sender, address(this), jbcAmount);
            swapReserveJBC += jbcAmount;
        }
    }

    // === 兼容性函数 ===

    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }
}