// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IJBC is IERC20 {
    function burn(uint256 amount) external;
}

contract JinbaoProtocol is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    struct UserInfo {
        address referrer;
        uint256 activeDirects; // Number of active direct referrals (Valid Ticket + Liquidity)
        uint256 teamCount;     // Total team size (Optional/Display)
        uint256 totalRevenue;  // Total earnings (dynamic + static) for CURRENT ticket
        uint256 currentCap;    // Current max cap (3x ticket)
        bool isActive;         // Has active ticket with liquidity
        uint256 refundFeeAmount; // Amount of fee to refund on next stake
        uint256 teamTotalVolume; // Community Ticket Total Volume
        uint256 teamTotalCap;    // Community Ticket Total Cap
    }

    struct Stake {
        uint256 id;
        uint256 amount;
        uint256 startTime;
        uint256 cycleDays;
        bool active;
        uint256 paid; // Track paid rewards for this stake
    }

    struct Ticket {
        uint256 ticketId;
        uint256 amount; // MC Amount
        uint256 purchaseTime;
        bool exited; // True if 3x cap reached
    }

    struct PendingReward {
        address upline;
        uint256 amount;
    }

    struct LevelConfig {
        uint256 minDirects;
        uint256 level;
        uint256 percent;
    }

    struct DirectReferralData {
        address user;
        uint256 ticketAmount;
        uint256 joinTime;
    }

    IERC20 public mcToken;
    IJBC public jbcToken;
    
    // Wallets
    address public marketingWallet;
    address public treasuryWallet;
    address public lpInjectionWallet; // Buffer Contract
    address public buybackWallet;     // Buyback Wallet (for future use or external buyback)
    
    // Constants
    uint256 public constant SECONDS_IN_UNIT = 60; // Minutes for Demo, Days for Prod
    
    // Distribution Config
    uint256 public directRewardPercent;
    uint256 public levelRewardPercent;
    uint256 public marketingPercent;
    uint256 public buybackPercent;
    uint256 public lpInjectionPercent;
    uint256 public treasuryPercent;
    
    // Fees & Taxes
    uint256 public redemptionFeePercent; // 1% of Ticket Amount
    uint256 public swapBuyTax; // 50%
    uint256 public swapSellTax; // 25%

    // Reward Types
    uint8 public constant REWARD_STATIC = 0;
    uint8 public constant REWARD_DYNAMIC = 1; // General dynamic
    uint8 public constant REWARD_DIRECT = 2;
    uint8 public constant REWARD_LEVEL = 3;

    // State
    mapping(address => UserInfo) public userInfo;
    mapping(address => Ticket) public userTicket; // One active ticket per user
    mapping(address => Stake[]) public userStakes; // Multiple stakes per user
    mapping(address => address[]) public directReferrals;
    
    // Pending Rewards for Differential System: ticketId => List of rewards to release upon redemption
    mapping(uint256 => PendingReward[]) public ticketPendingRewards;
    
    // Level Configs
    LevelConfig[] public levelConfigs;

    // Admin Controls
    uint256 public ticketFlexibilityDuration;
    bool public liquidityEnabled;
    bool public redeemEnabled;

    // Swap Pool Reserves
    uint256 public swapReserveMC;
    uint256 public swapReserveJBC;

    uint256 public nextTicketId;
    uint256 public nextStakeId;
    uint256 public lastBurnTime;
    mapping(uint256 => address) public ticketOwner;
    
    // Storage gap for future upgrades
    // This reserves 50 storage slots to allow adding new state variables
    // without affecting the storage layout of derived contracts
    uint256[50] private __gap;
    
    // Events
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event TicketExpired(address indexed user, uint256 ticketId, uint256 amount);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId);
    event FeeRefunded(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount, uint8 rewardType);
    event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId);
    event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint8 rewardType, uint256 ticketId);
    event RewardCapped(address indexed user, uint256 amount, uint256 cappedAmount);
    event LevelRewardRecorded(uint256 indexed ticketId, address indexed upline, uint256 amount);
    event LevelRewardReleased(uint256 indexed ticketId, address indexed upline, uint256 amount);
    event Redeemed(address indexed user, uint256 principal, uint256 fee);
    event Exited(address indexed user, uint256 ticketId);
    event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax);
    event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax);
    event BuybackAndBurn(uint256 mcAmount, uint256 jbcBurned);
    event LiquidityAdded(uint256 mcAmount, uint256 jbcAmount);
    event LevelConfigsUpdated();
    event TicketFlexibilityDurationUpdated(uint256 newDuration);
    event LiquidityStatusUpdated(bool enabled);
    event RedeemStatusUpdated(bool enabled);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _mcToken, 
        address _jbcToken,
        address _marketing,
        address _treasury,
        address _lpInjection,
        address _buybackWallet
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buybackWallet;

        // Init Default Values
        directRewardPercent = 25;
        levelRewardPercent = 15;
        marketingPercent = 5;
        buybackPercent = 5;
        lpInjectionPercent = 25;
        treasuryPercent = 25;
        
        redemptionFeePercent = 1;
        swapBuyTax = 50;
        swapSellTax = 25;

        ticketFlexibilityDuration = 72 hours;
        liquidityEnabled = true;
        redeemEnabled = true;
        lastBurnTime = block.timestamp;

        // Init Levels
        levelConfigs.push(LevelConfig(100000, 9, 45));
        levelConfigs.push(LevelConfig(30000, 8, 40));
        levelConfigs.push(LevelConfig(10000, 7, 35));
        levelConfigs.push(LevelConfig(3000, 6, 30));
        levelConfigs.push(LevelConfig(1000, 5, 25));
        levelConfigs.push(LevelConfig(300, 4, 20));
        levelConfigs.push(LevelConfig(100, 3, 15));
        levelConfigs.push(LevelConfig(30, 2, 10));
        levelConfigs.push(LevelConfig(10, 1, 5));
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Admin Functions ---

    function setDistributionPercents(
        uint256 _direct, 
        uint256 _level, 
        uint256 _marketing, 
        uint256 _buyback, 
        uint256 _lp, 
        uint256 _treasury
    ) external onlyOwner {
        require(_direct + _level + _marketing + _buyback + _lp + _treasury == 100, "Sum!=100");
        require(_direct <= 50 && _level <= 50 && _marketing <= 50 && _buyback <= 50 && _lp <= 50 && _treasury <= 50, "Rate>50%");
        directRewardPercent = _direct;
        levelRewardPercent = _level;
        marketingPercent = _marketing;
        buybackPercent = _buyback;
        lpInjectionPercent = _lp;
        treasuryPercent = _treasury;
    }

    function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external onlyOwner {
        require(_buyTax <= 50 && _sellTax <= 50, "Tax>50%");
        swapBuyTax = _buyTax;
        swapSellTax = _sellTax;
    }

    function setRedemptionFee(uint256 _fee) external onlyOwner {
        require(_fee <= 50, "Fee>50%");
        redemptionFeePercent = _fee;
    }

    function adminSetUserStats(address user, uint256 _activeDirects, uint256 _teamCount, uint256 _teamTotalVolume, uint256 _teamTotalCap) external onlyOwner {
        userInfo[user].activeDirects = _activeDirects;
        userInfo[user].teamCount = _teamCount;
        userInfo[user].teamTotalVolume = _teamTotalVolume;
        userInfo[user].teamTotalCap = _teamTotalCap;
    }

    function adminSetReferrer(address user, address newReferrer) external onlyOwner {
        require(user != newReferrer, "Cannot bind self");
        address oldReferrer = userInfo[user].referrer;
        
        userInfo[user].referrer = newReferrer;
        
        // Remove from old
        if (oldReferrer != address(0)) {
            address[] storage oldList = directReferrals[oldReferrer];
            for (uint256 i = 0; i < oldList.length; i++) {
                if (oldList[i] == user) {
                    oldList[i] = oldList[oldList.length - 1];
                    oldList.pop();
                    break;
                }
            }
        }
        
        // Add to new
        if (newReferrer != address(0)) {
            directReferrals[newReferrer].push(user);
        }
    }

    function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external onlyOwner {
        require(mcAmount > 0 || jbcAmount > 0, "Zero amount");
        if (mcAmount > 0) {
            mcToken.transferFrom(msg.sender, address(this), mcAmount);
            swapReserveMC += mcAmount;
        }
        if (jbcAmount > 0) {
            jbcToken.transferFrom(msg.sender, address(this), jbcAmount);
            swapReserveJBC += jbcAmount;
        }
        emit LiquidityAdded(mcAmount, jbcAmount);
    }

    function adminWithdrawMC(uint256 amount, address to) external onlyOwner {
        require(amount > 0, "Zero");
        require(amount <= swapReserveMC, "Over");
        swapReserveMC -= amount;
        mcToken.transfer(to, amount);
    }

    function adminWithdrawJBC(uint256 amount, address to) external onlyOwner {
        require(amount > 0, "Zero");
        require(amount <= swapReserveJBC, "Over");
        swapReserveJBC -= amount;
        jbcToken.transfer(to, amount);
    }

    function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external onlyOwner {
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buyback;
    }

    // New Admin Features

    function setLevelConfigs(LevelConfig[] memory _configs) external onlyOwner {
        delete levelConfigs;
        for(uint i=0; i<_configs.length; i++) {
            levelConfigs.push(_configs[i]);
        }
        emit LevelConfigsUpdated();
    }

    function setTicketFlexibilityDuration(uint256 _duration) external onlyOwner {
        ticketFlexibilityDuration = _duration;
        emit TicketFlexibilityDurationUpdated(_duration);
    }

    function setLiquidityEnabled(bool _enabled) external onlyOwner {
        liquidityEnabled = _enabled;
        emit LiquidityStatusUpdated(_enabled);
    }

    function setRedeemEnabled(bool _enabled) external onlyOwner {
        redeemEnabled = _enabled;
        emit RedeemStatusUpdated(_enabled);
    }

    // --- Helper Views ---

    function getLevel(uint256 activeDirects) public view returns (uint256 level, uint256 percent) {
        for(uint i = 0; i < levelConfigs.length; i++) {
            if (activeDirects >= levelConfigs[i].minDirects) {
                return (levelConfigs[i].level, levelConfigs[i].percent);
            }
        }
        return (0, 0);
    }

    function getJBCPrice() public view returns (uint256) {
        if (swapReserveJBC == 0) return 1 ether;
        return (swapReserveMC * 1e18) / swapReserveJBC;
    }

    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }

    function getDirectReferralsData(address user) external view returns (DirectReferralData[] memory) {
        address[] storage refs = directReferrals[user];
        DirectReferralData[] memory rows = new DirectReferralData[](refs.length);
        for (uint256 i = 0; i < refs.length; i++) {
            address ref = refs[i];
            Ticket storage t = userTicket[ref];
            rows[i] = DirectReferralData({user: ref, ticketAmount: t.amount, joinTime: t.purchaseTime});
        }
        return rows;
    }

    function expireMyTicket() external {
        _expireTicketIfNeeded(msg.sender);
    }

    // --- Core Functions ---

    function bindReferrer(address _referrer) external {
        require(userInfo[msg.sender].referrer == address(0), "Already bound");
        require(_referrer != msg.sender, "Cannot bind self");
        require(_referrer != address(0), "Invalid referrer");
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    function buyTicket(uint256 amount) external nonReentrant {
        _expireTicketIfNeeded(msg.sender);
        // Validate Amount (T1-T4)
        require(amount == 100 * 1e18 || amount == 300 * 1e18 || amount == 500 * 1e18 || amount == 1000 * 1e18, "Bad amt");
        
        // Transfer MC
        mcToken.transferFrom(msg.sender, address(this), amount);

        // Multi-Ticket Accumulation Logic
        Ticket storage t = userTicket[msg.sender];
        
        if (t.exited) {
            // Re-entry after exit: Reset everything
            nextTicketId++;
            t.ticketId = nextTicketId;
            t.amount = amount;
            t.purchaseTime = block.timestamp;
            t.exited = false;
            
            userInfo[msg.sender].totalRevenue = 0;
            userInfo[msg.sender].currentCap = amount * 3;
        } else {
            // Active user adding ticket: Accumulate
            if (t.amount == 0) {
                // First time purchase
                nextTicketId++;
                t.ticketId = nextTicketId;
                t.amount = amount;
                t.purchaseTime = block.timestamp;
                t.exited = false;
                
                userInfo[msg.sender].totalRevenue = 0;
                userInfo[msg.sender].currentCap = amount * 3;
            } else {
                // Accumulate to existing
                t.amount += amount;
                if (userInfo[msg.sender].isActive) {
                    t.purchaseTime = block.timestamp;
                }
                userInfo[msg.sender].currentCap += amount * 3;
            }
        }

        ticketOwner[t.ticketId] = msg.sender;
        
        // --- Distribution ---
        
        // 1. Direct Reward (25%)
        address referrerAddr = userInfo[msg.sender].referrer;
        if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
            if (paid > 0) {
                emit ReferralRewardPaid(referrerAddr, msg.sender, paid, REWARD_DIRECT, t.ticketId);
            }
        } else {
            // No referrer -> Marketing
            mcToken.transfer(marketingWallet, (amount * directRewardPercent) / 100);
        }

        // 2. Differential Reward (15%) - Calculate & Store Pending
        _calculateAndStoreLevelRewards(msg.sender, amount, userTicket[msg.sender].ticketId);

        // 3. Marketing (5%)
        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        // 4. Buyback (5%) - Internal Swap & Burn
        uint256 buybackAmt = (amount * buybackPercent) / 100;
        _internalBuybackAndBurn(buybackAmt);

        // 5. Buffer / LP Injection (25%)
        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);

        // 6. Treasury (25%)
        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);

        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }

    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant {
        require(liquidityEnabled, "Disabled");
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0, "No ticket");
        require(!ticket.exited, "Exited");
        require(block.timestamp <= ticket.purchaseTime + ticketFlexibilityDuration, "Expired");
        
        // Cycle Check: 7, 15, 30
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Bad cycle");
        require(amount > 0, "Zero");

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

        uint256 requiredLiquidity = _requiredLiquidity(ticket.amount);
        uint256 totalActive = _getActiveStakeTotal(msg.sender);
        require(totalActive >= requiredLiquidity, "Low liq");

        _updateActiveStatus(msg.sender);

        emit LiquidityStaked(msg.sender, amount, cycleDays, nextStakeId);

        // Refund Fee if applicable
        uint256 refund = userInfo[msg.sender].refundFeeAmount;
        if (refund > 0) {
            userInfo[msg.sender].refundFeeAmount = 0;
            if (mcToken.balanceOf(address(this)) >= refund) {
                mcToken.transfer(msg.sender, refund);
                emit FeeRefunded(msg.sender, refund);
            }
        }
    }

    function claimRewards() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0 && !ticket.exited, "Inactive");
        
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalPending = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            // Calculate Static Reward for this stake
            uint256 ratePerBillion = 0;
            if (stakes[i].cycleDays == 7) ratePerBillion = 13333334;      // 1.3333334%
            else if (stakes[i].cycleDays == 15) ratePerBillion = 16666667; // 1.6666667%
            else if (stakes[i].cycleDays == 30) ratePerBillion = 20000000; // 2.0%
            
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
        
        // Check Cap first (Static counts to cap).
        if (userInfo[msg.sender].totalRevenue + totalPending > userInfo[msg.sender].currentCap) {
            totalPending = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
        }
        
        if (totalPending == 0) {
            _handleExit(msg.sender);
            return;
        }
        
        userInfo[msg.sender].totalRevenue += totalPending;
        
        uint256 mcPart = totalPending / 2;
        uint256 jbcValuePart = totalPending / 2;
        
        // MC Transfer
        uint256 mcTransferred = 0;
        if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
            mcToken.transfer(msg.sender, mcPart);
            mcTransferred = mcPart;
        }
        
        // JBC Transfer
        uint256 jbcPrice = getJBCPrice(); 
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        uint256 jbcTransferred = 0;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
            jbcToken.transfer(msg.sender, jbcAmount);
            jbcTransferred = jbcAmount;
        }
        
        emit RewardPaid(msg.sender, totalPending, REWARD_STATIC);
        emit RewardClaimed(msg.sender, mcTransferred, jbcTransferred, REWARD_STATIC, ticket.ticketId);
        
        // Check Exit
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    function redeem() external nonReentrant {
        require(redeemEnabled, "Disabled");
        // Redeem all expired stakes
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalReturn = 0;
        uint256 totalFee = 0;
        uint256 totalYield = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            uint256 endTime = stakes[i].startTime + (stakes[i].cycleDays * SECONDS_IN_UNIT);
            if (block.timestamp >= endTime) {
                // 1. Calculate and Settle Static Yield
                uint256 ratePerBillion = 0;
                if (stakes[i].cycleDays == 7) ratePerBillion = 13333334;      // 1.3333334%
                else if (stakes[i].cycleDays == 15) ratePerBillion = 16666667; // 1.6666667%
                else if (stakes[i].cycleDays == 30) ratePerBillion = 20000000; // 2.0%
                
                uint256 totalStaticShouldBe = (stakes[i].amount * ratePerBillion * stakes[i].cycleDays) / 1000000000;
                uint256 pending = 0;
                if (totalStaticShouldBe > stakes[i].paid) {
                    pending = totalStaticShouldBe - stakes[i].paid;
                }
                
                totalYield += pending;
                stakes[i].paid += pending;

                // 2. Calculate Principal Return & Fee
                uint256 fee = (stakes[i].amount * 2 * redemptionFeePercent) / 300;
                
                uint256 returnAmt = stakes[i].amount;
                if (returnAmt >= fee) {
                    returnAmt -= fee;
                } else {
                    fee = 0; 
                }
                
                totalReturn += returnAmt;
                totalFee += fee;
                
                stakes[i].active = false;
            }
        }
        
        require(totalReturn > 0 || totalYield > 0, "Nothing to redeem");

        // Distribute Yield (Subject to Cap)
        if (totalYield > 0) {
            uint256 available = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
            if (totalYield > available) {
                emit RewardCapped(msg.sender, totalYield, available);
                totalYield = available;
            }
            
            if (totalYield > 0) {
                userInfo[msg.sender].totalRevenue += totalYield;
                
                uint256 mcPart = totalYield / 2;
                uint256 jbcValuePart = totalYield / 2;
                
                uint256 mcTransferred = 0;
                if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
                    mcToken.transfer(msg.sender, mcPart);
                    mcTransferred = mcPart;
                }
                
                uint256 jbcPrice = getJBCPrice(); 
                uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
                uint256 jbcTransferred = 0;
                if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
                    jbcToken.transfer(msg.sender, jbcAmount);
                    jbcTransferred = jbcAmount;
                }
                
                emit RewardPaid(msg.sender, totalYield, REWARD_STATIC);
                emit RewardClaimed(msg.sender, mcTransferred, jbcTransferred, REWARD_STATIC, userTicket[msg.sender].ticketId);
            }
        }

        if (totalReturn > 0) {
            mcToken.transfer(msg.sender, totalReturn);
        }
        
        // Record Fee for next refund
        userInfo[msg.sender].refundFeeAmount += totalFee;

        emit Redeemed(msg.sender, totalReturn, totalFee);
        
        _releaseLevelRewards(userTicket[msg.sender].ticketId);

        _updateActiveStatus(msg.sender);
        
        // Check Exit
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    // --- Internal Logic ---

    function _distributeReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        if (!u.isActive || t.exited || t.amount == 0) {
            return 0;
        }

        // Check Cap
        uint256 available = u.currentCap - u.totalRevenue;
        uint256 payout = amount;
        
        if (amount > available) {
            payout = available;
            emit RewardCapped(user, amount, available);
        }
        
        if (payout > 0) {
            u.totalRevenue += payout;
            mcToken.transfer(user, payout);
            emit RewardPaid(user, payout, rType);
        }

        if (u.totalRevenue >= u.currentCap) {
            _handleExit(user);
        }
        return payout;
    }

    function _handleExit(address user) internal {
        Ticket storage t = userTicket[user];
        if (!t.exited) {
            t.exited = true;
            
            // Force redeem all active stakes (minus fee)
            Stake[] storage stakes = userStakes[user];
            uint256 totalReturn = 0;
            uint256 totalFee = 0;
            
            for (uint256 i = 0; i < stakes.length; i++) {
                if (!stakes[i].active) continue;
                
                uint256 fee = (stakes[i].amount * 2 * redemptionFeePercent) / 300;
                uint256 returnAmt = stakes[i].amount;
                if (returnAmt >= fee) {
                    returnAmt -= fee;
                } else {
                    fee = 0;
                }
                
                totalReturn += returnAmt;
                totalFee += fee;
                
                stakes[i].active = false;
            }
            
            if (totalReturn > 0) {
                mcToken.transfer(user, totalReturn);
            }

            if (totalFee > 0) {
                userInfo[user].refundFeeAmount += totalFee;
            }
            
            bool wasActive = userInfo[user].isActive;
            userInfo[user].isActive = false;
            
            // Decrement referrer
            address referrer = userInfo[user].referrer;
            if (wasActive && referrer != address(0) && userInfo[referrer].activeDirects > 0) {
                userInfo[referrer].activeDirects--;
            }
            
            emit Redeemed(user, totalReturn, totalFee);
            emit Exited(user, t.ticketId);
        }
    }

    function _calculateAndStoreLevelRewards(address user, uint256 amount, uint256 ticketId) internal {
        address current = userInfo[user].referrer;
        uint256 previousPercent = 0;
        uint256 iterations = 0;

        while (current != address(0) && iterations < 20) {
            if (!userInfo[current].isActive) {
                current = userInfo[current].referrer;
                iterations++;
                continue;
            }

            Ticket storage uplineTicket = userTicket[current];
            if (uplineTicket.amount == 0 || uplineTicket.exited) {
                current = userInfo[current].referrer;
                iterations++;
                continue;
            }

            // Get Upline Level
            (, uint256 percent) = getLevel(userInfo[current].activeDirects);
            
            if (percent > previousPercent) {
                uint256 diffPercent = percent - previousPercent;
                uint256 baseAmount = amount;
                if (baseAmount > uplineTicket.amount) {
                    baseAmount = uplineTicket.amount;
                }
                uint256 reward = (baseAmount * diffPercent) / 100;
                
                // Store Pending
                ticketPendingRewards[ticketId].push(PendingReward({
                    upline: current,
                    amount: reward
                }));
                
                emit LevelRewardRecorded(ticketId, current, reward);
                
                previousPercent = percent;
            }
            
            if (percent >= 45) break; // Max V9
            
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _releaseLevelRewards(uint256 ticketId) internal {
        address from = ticketOwner[ticketId];
        PendingReward[] memory rewards = ticketPendingRewards[ticketId];
        for (uint256 i = 0; i < rewards.length; i++) {
            uint256 paid = _distributeReward(rewards[i].upline, rewards[i].amount, REWARD_LEVEL);
            if (paid > 0) {
                emit ReferralRewardPaid(rewards[i].upline, from, paid, REWARD_LEVEL, ticketId);
            }
            emit LevelRewardReleased(ticketId, rewards[i].upline, paid);
        }
        delete ticketPendingRewards[ticketId];
    }

    function _internalBuybackAndBurn(uint256 mcAmount) internal {
        if (mcAmount == 0) return;
        if (swapReserveMC == 0 || swapReserveJBC == 0) return;
        if (mcToken.balanceOf(address(this)) < swapReserveMC + mcAmount) return;

        uint256 jbcOut = getAmountOut(mcAmount, swapReserveMC, swapReserveJBC);
        if (jbcOut == 0 || jbcOut > swapReserveJBC) return;
        if (jbcToken.balanceOf(address(this)) < swapReserveJBC) return;

        swapReserveMC += mcAmount;
        swapReserveJBC -= jbcOut;

        jbcToken.burn(jbcOut);
        emit BuybackAndBurn(mcAmount, jbcOut);
    }

    function _expireTicketIfNeeded(address user) internal {
        Ticket storage t = userTicket[user];
        if (t.amount == 0 || t.exited) return;
        if (_getActiveStakeTotal(user) > 0) return;
        if (block.timestamp <= t.purchaseTime + ticketFlexibilityDuration) return;

        uint256 ticketId = t.ticketId;
        uint256 ticketAmount = t.amount;

        address referrer = userInfo[user].referrer;
        if (userInfo[user].isActive && referrer != address(0) && userInfo[referrer].activeDirects > 0) {
            userInfo[referrer].activeDirects--;
        }

        userInfo[user].isActive = false;
        userInfo[user].totalRevenue = 0;
        userInfo[user].currentCap = 0;

        t.ticketId = 0;
        t.amount = 0;
        t.purchaseTime = 0;
        t.exited = false;

        if (ticketId != 0) {
            delete ticketPendingRewards[ticketId];
            ticketOwner[ticketId] = address(0);
        }

        emit TicketExpired(user, ticketId, ticketAmount);
    }

    function dailyBurn() external {
        require(block.timestamp >= lastBurnTime + 1 days, "Early");
        require(swapReserveJBC > 0, "No res");
        
        uint256 burnAmount = swapReserveJBC / 100; // 1%
        if (burnAmount > 0) {
            require(jbcToken.balanceOf(address(this)) >= burnAmount, "Low JBC");
            swapReserveJBC -= burnAmount;
            jbcToken.burn(burnAmount);
            emit BuybackAndBurn(0, burnAmount); // Reusing event with 0 MC input
        }
        
        lastBurnTime = block.timestamp;
    }

    function _requiredLiquidity(uint256 ticketAmount) internal pure returns (uint256) {
        return (ticketAmount * 3) / 2;
    }

    function _getActiveStakeTotal(address user) internal view returns (uint256 total) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].active) {
                total += stakes[i].amount;
            }
        }
    }

    function _updateActiveStatus(address user) internal {
        Ticket storage t = userTicket[user];
        uint256 required = t.amount == 0 ? 0 : _requiredLiquidity(t.amount);
        bool shouldBeActive = t.amount > 0 && !t.exited && required > 0 && _getActiveStakeTotal(user) >= required;
        bool currentlyActive = userInfo[user].isActive;
        if (shouldBeActive == currentlyActive) return;

        userInfo[user].isActive = shouldBeActive;

        address referrer = userInfo[user].referrer;
        if (referrer == address(0)) return;

        if (shouldBeActive) {
            userInfo[referrer].activeDirects++;
        } else if (userInfo[referrer].activeDirects > 0) {
            userInfo[referrer].activeDirects--;
        }
    }

    // --- AMM & Swap Support ---

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "Bad in");
        require(reserveIn > 0 && reserveOut > 0, "Low liq");
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    function swapMCToJBC(uint256 mcAmount) external nonReentrant {
        require(mcAmount > 0, "Bad amt");
        mcToken.transferFrom(msg.sender, address(this), mcAmount);

        uint256 jbcOutput = getAmountOut(mcAmount, swapReserveMC, swapReserveJBC);
        uint256 tax = (jbcOutput * swapBuyTax) / 100;
        uint256 amountToUser = jbcOutput - tax;
        
        require(jbcToken.balanceOf(address(this)) >= jbcOutput, "Low JBC");

        // Update Reserves
        swapReserveMC += mcAmount;
        swapReserveJBC -= jbcOutput;
        
        jbcToken.burn(tax);
        jbcToken.transfer(msg.sender, amountToUser);
        
        emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
    }

    function swapJBCToMC(uint256 jbcAmount) external nonReentrant {
        require(jbcAmount > 0, "Bad amt");
        jbcToken.transferFrom(msg.sender, address(this), jbcAmount);

        uint256 tax = (jbcAmount * swapSellTax) / 100;
        uint256 amountToSwap = jbcAmount - tax;
        
        jbcToken.burn(tax);
        
        uint256 mcOutput = getAmountOut(amountToSwap, swapReserveJBC, swapReserveMC);
        require(mcToken.balanceOf(address(this)) >= mcOutput, "Low MC");

        // Update Reserves
        swapReserveJBC += amountToSwap;
        swapReserveMC -= mcOutput;
        
        mcToken.transfer(msg.sender, mcOutput);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
    }
}
