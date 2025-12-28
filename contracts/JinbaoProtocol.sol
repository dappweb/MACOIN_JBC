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

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
}

contract JinbaoProtocol is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
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

    struct DirectReferralData {
        address user;
        uint256 ticketAmount;
        uint256 joinTime;
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
    
    struct LevelConfig {
        uint256 minDirects;
        uint256 level;
        uint256 percent;
    }
    LevelConfig[] public levelConfigs;
    
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
    
    error InvalidAmount();
    error InvalidAddress();
    error InvalidRate();
    error InvalidTax();
    error InvalidFee();
    error InvalidCycle();
    error InvalidLevelConfig();
    error Unauthorized();
    error AlreadyBound();
    error SelfReference();
    error NotActive();
    error AlreadyExited();
    error Expired();
    error LowLiquidity();
    error InsufficientBalance();
    error NoRewards();
    error NothingToRedeem();
    error TransferFailed();
    error SumNot100();
    error TeamCountOverflow();
    error RecursionDepthExceeded();
    error InvalidTeamCountUpdate();
    error TeamCountMismatch(address user, uint256 expected, uint256 actual);
    error BatchUpdateSizeMismatch();
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
    event LevelRewardPoolUpdated(uint256 amount, uint256 newTotal);
    event LevelRewardPoolWithdrawn(address indexed to, uint256 amount);
    event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount);
    event TeamBasedRewardCalculated(uint256 indexed stakeId, address indexed upline, uint256 amount, uint256 teamCount);
    event BatchTeamCountsUpdated(uint256 usersUpdated);
    event TeamCountValidationFailed(address indexed user, uint256 expected, uint256 actual);
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
    event WalletsUpdated(address marketing, address treasury, address lpInjection, address buyback);
    event DistributionConfigUpdated(uint256 direct, uint256 level, uint256 marketing, uint256 buyback, uint256 lpInjection, uint256 treasury);
    event SwapTaxesUpdated(uint256 buyTax, uint256 sellTax);
    event RedemptionFeeUpdated(uint256 newFee);
    event SwapReservesWithdrawn(uint256 mcAmount, uint256 jbcAmount);
    event TokensRescued(address token, address to, uint256 amount);
    event EmergencyPaused();
    event EmergencyUnpaused();

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
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buybackWallet;

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
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier whenNotPaused() {
        require(!emergencyPaused, "Contract is paused");
        _;
    }

    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        emit EmergencyPaused();
    }

    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    function getJBCPrice() public view returns (uint256) {
        if (priceOracle != address(0)) {
            try IPriceOracle(priceOracle).getPrice(address(jbcToken)) returns (uint256 oraclePrice) {
                if (oraclePrice > 0) return oraclePrice;
            } catch {
            }
        }
        
        if (swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY) {
            return 1 ether;
        }
        
        return (swapReserveMC * 1e18) / swapReserveJBC;
    }

    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
    }

    function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external onlyOwner {
        require(_marketing != address(0) && _treasury != address(0) && _lpInjection != address(0) && _buyback != address(0), "Invalid address");
        
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buyback;
        emit WalletsUpdated(_marketing, _treasury, _lpInjection, _buyback);
    }

    function setDistributionConfig(uint256 _direct, uint256 _level, uint256 _marketing, uint256 _buyback, uint256 _lpInjection, uint256 _treasury) external onlyOwner {
        directRewardPercent = _direct;
        levelRewardPercent = _level;
        marketingPercent = _marketing;
        buybackPercent = _buyback;
        lpInjectionPercent = _lpInjection;
        treasuryPercent = _treasury;
        emit DistributionConfigUpdated(_direct, _level, _marketing, _buyback, _lpInjection, _treasury);
    }

    function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external onlyOwner {
        swapBuyTax = _buyTax;
        swapSellTax = _sellTax;
        emit SwapTaxesUpdated(_buyTax, _sellTax);
    }

    function setRedemptionFeePercent(uint256 _fee) external onlyOwner {
        redemptionFeePercent = _fee;
        emit RedemptionFeeUpdated(_fee);
    }

    function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external onlyOwner {
        liquidityEnabled = _liquidityEnabled;
        redeemEnabled = _redeemEnabled;
        emit LiquidityStatusUpdated(_liquidityEnabled);
        emit RedeemStatusUpdated(_redeemEnabled);
    }

    function setTicketFlexibilityDuration(uint256 _duration) external onlyOwner {
        ticketFlexibilityDuration = _duration;
        emit TicketFlexibilityDurationUpdated(_duration);
    }

    function batchUpdateTeamCounts(address[] calldata users, uint256[] calldata counts) external onlyOwner {
        if (users.length != counts.length) revert BatchUpdateSizeMismatch();
        
        uint256 count = users.length;
        for (uint256 i = 0; i < count; i++) {
            userInfo[users[i]].teamCount = counts[i];
            emit TeamCountUpdated(users[i], 0, counts[i]);
        }
        emit BatchTeamCountsUpdated(count);
    }

    function batchUpdateTeamVolumes(address[] calldata users, uint256[] calldata volumes) external onlyOwner {
        if (users.length != volumes.length) revert BatchUpdateSizeMismatch();
        
        uint256 count = users.length;
        for (uint256 i = 0; i < count; i++) {
            userInfo[users[i]].teamTotalVolume = volumes[i];
        }
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
        emit LiquidityAdded(mcAmount, jbcAmount);
    }

    function withdrawLevelRewardPool(address _to, uint256 _amount) external onlyOwner {
        levelRewardPool -= _amount;
        mcToken.transfer(_to, _amount);
        emit LevelRewardPoolWithdrawn(_to, _amount);
    }

    function withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC) external onlyOwner {
        if (_amountMC > 0) {
            swapReserveMC -= _amountMC;
            mcToken.transfer(_toMC, _amountMC);
        }
        if (_amountJBC > 0) {
            swapReserveJBC -= _amountJBC;
            jbcToken.transfer(_toJBC, _amountJBC);
        }
        emit SwapReservesWithdrawn(_amountMC, _amountJBC);
    }

    function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_token != address(mcToken) && _token != address(jbcToken), "Cannot rescue protocol tokens");
        require(_to != address(0), "Invalid recipient");
        
        IERC20(_token).transfer(_to, _amount);
        emit TokensRescued(_token, _to, _amount);
    }


    function _getLevel(uint256 value) private pure returns (uint256 level, uint256 percent) {
        if (value >= 10000) return (9, 45);
        if (value >= 5000) return (8, 40);
        if (value >= 2000) return (7, 35);
        if (value >= 1000) return (6, 30);
        if (value >= 500) return (5, 25);
        if (value >= 200) return (4, 20);
        if (value >= 100) return (3, 15);
        if (value >= 50) return (2, 10);
        if (value >= 20) return (1, 5);
        return (0, 0);
    }

    function getLevel(uint256 activeDirects) public pure returns (uint256 level, uint256 percent) {
        return _getLevel(activeDirects);
    }

    function getLevelByTeamCount(uint256 teamCount) public pure returns (uint256 level, uint256 percent) {
        return _getLevel(teamCount);
    }

    function getLevelRewardLayers(uint256 activeDirects) public pure returns (uint256) {
        if (activeDirects >= 3) return 15;
        if (activeDirects >= 2) return 10;
        if (activeDirects >= 1) return 5;
        return 0;
    }

    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }

    // --- Core Functions ---

    function bindReferrer(address _referrer) external {
        if (userInfo[msg.sender].referrer != address(0)) revert AlreadyBound();
        if (_referrer == msg.sender) revert SelfReference();
        if (_referrer == address(0)) revert InvalidAddress();
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender);
        
        // 更新推荐体系中的团队人数统计
        _updateTeamCount(msg.sender);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    function buyTicket(uint256 amount) external nonReentrant whenNotPaused {
        _expireTicketIfNeeded(msg.sender);
        // Validate Amount (T1-T4)
        if (amount != 100 * 1e18 && amount != 300 * 1e18 && amount != 500 * 1e18 && amount != 1000 * 1e18) revert InvalidAmount();
        
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

        // Update Max Ticket Amount (累积值，用于赎回费用计算)
        if (t.amount > userInfo[msg.sender].maxTicketAmount) {
            userInfo[msg.sender].maxTicketAmount = t.amount;
        }

        // Update Max Single Ticket Amount (单张最大值，用于流动性计算)
        if (amount > userInfo[msg.sender].maxSingleTicketAmount) {
            userInfo[msg.sender].maxSingleTicketAmount = amount;
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

        // 2. Level Reward (15%) - Fixed Layers
        _distributeTicketLevelRewards(msg.sender, amount);

        // 3. Marketing (5%)
        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        // 4. Buyback (5%) - Internal Swap & Burn
        uint256 buybackAmt = (amount * buybackPercent) / 100;
        _internalBuybackAndBurn(buybackAmt);

        // 5. Buffer / LP Injection (25%)
        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);

        // 6. Treasury (25%)
        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);

        // Update Team Volume (Community Volume)
        _updateTeamVolume(msg.sender, amount);

        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }

    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant whenNotPaused {
        Ticket storage ticket = userTicket[msg.sender];
        
        if (ticket.amount == 0) revert NotActive();
        if (ticket.exited) revert AlreadyExited();
        // Removed expiration check to allow staking anytime as long as not exited
        // if (block.timestamp > ticket.purchaseTime + ticketFlexibilityDuration) revert Expired();
        
        // Cycle Check: 7, 15, 30
        if (cycleDays != 7 && cycleDays != 15 && cycleDays != 30) revert InvalidCycle();
        if (amount == 0) revert InvalidAmount();

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

        // Enforce 1.5x Liquidity Rule
        // Liquidity Amount must be exactly 1.5x the Max Single Ticket Amount
        uint256 baseMaxAmount = userInfo[msg.sender].maxSingleTicketAmount;
        
        // Fallback for legacy users: if maxSingleTicketAmount is 0, use current ticket amount
        if (baseMaxAmount == 0) {
            baseMaxAmount = ticket.amount;
            // Update state to fix for future
            userInfo[msg.sender].maxSingleTicketAmount = baseMaxAmount;
        }

        uint256 requiredAmount = (baseMaxAmount * 150) / 100;
        if (amount != requiredAmount) revert InvalidAmount();

        _updateActiveStatus(msg.sender);

        emit LiquidityStaked(msg.sender, amount, cycleDays, nextStakeId);

        // Refund Fee if applicable (Refund 1% Fee from previous redemption)
        uint256 refund = userInfo[msg.sender].refundFeeAmount;
        if (refund > 0) {
            userInfo[msg.sender].refundFeeAmount = 0;
            // Check if we have enough MC in reserve to refund (Fee was injected into reserve)
            if (swapReserveMC >= refund && mcToken.balanceOf(address(this)) >= refund) {
                swapReserveMC -= refund;
                mcToken.transfer(msg.sender, refund);
                emit FeeRefunded(msg.sender, refund);
            }
        }
    }

    function claimRewards() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        if (ticket.amount == 0 || ticket.exited) revert NotActive();
        
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
        
        if (totalPending == 0) revert NoRewards();
        
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
        uint256 jbcPrice = getJBCPrice(); // Use protected price function
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

                // 2. Calculate Principal Return & Fee (deducted from principal)
                uint256 feeBase = userInfo[msg.sender].maxTicketAmount;
                if (feeBase == 0) feeBase = userTicket[msg.sender].amount; // Fallback
                
                uint256 fee = (feeBase * redemptionFeePercent) / 100;
                
                // Deduct fee from principal instead of user wallet
                uint256 returnAmt = stakes[i].amount;
                if (returnAmt > fee) {
                    returnAmt -= fee;
                    totalFee += fee;
                } else {
                    // If principal is less than fee, take all principal as fee
                    totalFee += returnAmt;
                    returnAmt = 0;
                }
                
                totalReturn += returnAmt;
                stakes[i].active = false;
                
                // Release Differential Rewards for this stake
                _releaseDifferentialRewards(stakes[i].id);
            }
        }
        
        require(totalReturn > 0 || totalYield > 0, "Nothing to redeem");

        // Inject Fee into Liquidity Pool (Swap Reserve MC)
        if (totalFee > 0) {
            swapReserveMC += totalFee;
        }

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
                
                uint256 jbcPrice = getJBCPrice(); // Use protected price function
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
        
        // No longer need to record fee for refund since it's deducted from principal
        // userInfo[msg.sender].refundFeeAmount += totalFee;

        emit Redeemed(msg.sender, totalReturn, totalFee);
        
        _updateActiveStatus(msg.sender);
        
        // Check Exit
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    // Individual stake redemption
    function redeemStake(uint256 stakeId) external nonReentrant {
        require(redeemEnabled, "Disabled");
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeId < stakes.length && stakes[stakeId].active, "Invalid stake");
        
        Stake storage stake = stakes[stakeId];
        
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
        
        require(RedemptionLib.processIndividualRedemption(mcToken, msg.sender, address(this), stake.amount, fee), "Transfer failed");
        
        if (fee > 0) {
            swapReserveMC += fee;
            userInfo[msg.sender].refundFeeAmount += fee;
        }
        
        _releaseDifferentialRewards(stake.id);
        
        if (pending > 0) {
            uint256 available = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
            if (pending > available) pending = available;
            if (pending > 0) {
                userInfo[msg.sender].totalRevenue += pending;
                uint256 mcPart = pending / 2;
                if (mcToken.balanceOf(address(this)) >= mcPart && mcPart > 0) {
                    mcToken.transfer(msg.sender, mcPart);
                }
                uint256 jbcPrice = getJBCPrice();
                uint256 jbcAmount = ((pending - mcPart) * 1 ether) / jbcPrice;
                if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
                    jbcToken.transfer(msg.sender, jbcAmount);
                }
                emit RewardPaid(msg.sender, pending, REWARD_STATIC);
            }
        }
        
        emit Redeemed(msg.sender, stake.amount, fee);
        _updateActiveStatus(msg.sender);
        
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

        // Check contract has sufficient balance before distribution
        if (mcToken.balanceOf(address(this)) < amount) {
            emit RewardCapped(user, amount, 0);
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
            
            // Check contract balance before processing
            uint256 contractBalance = mcToken.balanceOf(address(this));
            
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
            
            // Only transfer if contract has sufficient balance
            if (totalReturn > 0) {
                if (contractBalance >= totalReturn) {
                    mcToken.transfer(user, totalReturn);
                } else {
                    // Emergency: transfer what we can and emit event
                    if (contractBalance > 0) {
                        mcToken.transfer(user, contractBalance);
                    }
                    emit RewardCapped(user, totalReturn, contractBalance);
                }
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

    function _distributeTicketLevelRewards(address user, uint256 amount) internal {
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
            
            // Check how many layers this user can receive based on their active directs
            uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
            
            if (maxLayers > layerCount) {
                // This user can receive reward for this layer
                uint256 paid = _distributeReward(current, rewardPerLayer, REWARD_LEVEL);
                if (paid > 0) {
                    totalDistributed += paid;
                    emit ReferralRewardPaid(current, user, paid, REWARD_LEVEL, userTicket[user].ticketId);
                }
            }
            
            current = userInfo[current].referrer;
            layerCount++;
            iterations++;
        }
        
        // Store remaining amount in level reward pool
        uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;
        uint256 remaining = totalLevelRewardAmount - totalDistributed;
        if (remaining > 0) {
            levelRewardPool += remaining;
            emit LevelRewardPoolUpdated(remaining, levelRewardPool);
        }
    }

    function _updateTeamCount(address user) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        // Update up to 30 layers to track team count
        while (current != address(0) && iterations < 30) {
            uint256 oldCount = userInfo[current].teamCount;
            userInfo[current].teamCount = oldCount + 1;
            emit TeamCountUpdated(current, oldCount, oldCount + 1);
            
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _updateTeamVolume(address user, uint256 amount) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        // Update up to 30 layers to track community volume
        while (current != address(0) && iterations < 30) {
            userInfo[current].teamTotalVolume += amount;
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _calculateAndStoreDifferentialRewards(address user, uint256 amount, uint256 stakeId) internal {
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
                stakePendingRewards[stakeId].push(PendingReward({
                    upline: current,
                    amount: reward
                }));
                
                emit DifferentialRewardRecorded(stakeId, current, reward);
                
                previousPercent = percent;
            }
            
            if (percent >= 45) break; // Max V9
            
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _releaseDifferentialRewards(uint256 stakeId) internal {
        address from = stakeOwner[stakeId];
        PendingReward[] memory rewards = stakePendingRewards[stakeId];
        for (uint256 i = 0; i < rewards.length; i++) {
            uint256 paid = _distributeReward(rewards[i].upline, rewards[i].amount, REWARD_DIFFERENTIAL);
            if (paid > 0) {
                emit ReferralRewardPaid(rewards[i].upline, from, paid, REWARD_DIFFERENTIAL, stakeId);
            }
            emit DifferentialRewardReleased(stakeId, rewards[i].upline, paid);
        }
        delete stakePendingRewards[stakeId];
    }

    function _internalBuybackAndBurn(uint256 mcAmount) internal {
        if (mcAmount == 0) return;
        if (swapReserveMC < MIN_LIQUIDITY || swapReserveJBC < MIN_LIQUIDITY) return;
        if (mcToken.balanceOf(address(this)) < swapReserveMC + mcAmount) return;

        // Check price impact
        uint256 priceImpact = (mcAmount * 10000) / swapReserveMC;
        if (priceImpact > MAX_PRICE_IMPACT) return; // Skip if price impact too high

        // getAmountOut inlined
        uint256 numerator = mcAmount * swapReserveJBC;
        uint256 denominator = swapReserveMC + mcAmount;
        uint256 jbcOut = numerator / denominator;

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

    // Removed dailyBurn to reduce contract size

    function _requiredLiquidity(uint256 ticketAmount) internal pure returns (uint256) {
        return (ticketAmount * 3) / 2; // 1.5x
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
        // 活跃状态判断：只要有门票且未出局就是活跃
        bool shouldBeActive = t.amount > 0 && !t.exited;
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

    function swapMCToJBC(uint256 mcAmount) external nonReentrant whenNotPaused {
        if (mcAmount == 0) revert InvalidAmount();
        if (swapReserveMC < MIN_LIQUIDITY || swapReserveJBC < MIN_LIQUIDITY) revert LowLiquidity();
        
        mcToken.transferFrom(msg.sender, address(this), mcAmount);

        uint256 numerator = mcAmount * swapReserveJBC;
        uint256 denominator = swapReserveMC + mcAmount;
        uint256 jbcOutput = numerator / denominator;
        
        uint256 priceImpact = (mcAmount * 10000) / swapReserveMC;
        if (priceImpact > MAX_PRICE_IMPACT) revert InvalidAmount();

        uint256 tax = (jbcOutput * swapBuyTax) / 100;
        uint256 amountToUser = jbcOutput - tax;
        
        if (jbcToken.balanceOf(address(this)) < jbcOutput) revert LowLiquidity();

        swapReserveMC += mcAmount;
        swapReserveJBC -= jbcOutput;
        
        jbcToken.burn(tax);
        jbcToken.transfer(msg.sender, amountToUser);
        
        emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
    }

    function swapJBCToMC(uint256 jbcAmount) external nonReentrant whenNotPaused {
        if (jbcAmount == 0) revert InvalidAmount();
        if (swapReserveMC < MIN_LIQUIDITY || swapReserveJBC < MIN_LIQUIDITY) revert LowLiquidity();
        
        jbcToken.transferFrom(msg.sender, address(this), jbcAmount);

        uint256 tax = (jbcAmount * swapSellTax) / 100;
        uint256 amountToSwap = jbcAmount - tax;
        
        uint256 priceImpact = (amountToSwap * 10000) / swapReserveJBC;
        if (priceImpact > MAX_PRICE_IMPACT) revert InvalidAmount();
        
        jbcToken.burn(tax);
        
        uint256 numerator = amountToSwap * swapReserveMC;
        uint256 denominator = swapReserveJBC + amountToSwap;
        uint256 mcOutput = numerator / denominator;

        if (mcToken.balanceOf(address(this)) < mcOutput) revert LowLiquidity();

        swapReserveJBC += amountToSwap;
        swapReserveMC -= mcOutput;
        
        mcToken.transfer(msg.sender, mcOutput);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
    }

}
