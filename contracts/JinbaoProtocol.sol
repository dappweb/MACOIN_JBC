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
    error ContractPaused();
    error ActionTooEarly();
    error TransferFromFailed(string reason);
    error TransferFromFailedLowLevel();
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
    event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount);
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
    event ReferrerChanged(address indexed user, address indexed oldReferrer, address indexed newReferrer);
    event UserDataFieldUpdated(address indexed user, uint8 field, uint256 value);

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
        if (emergencyPaused) revert ContractPaused();
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



    function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external onlyOwner {
        if (_marketing == address(0) || _treasury == address(0) || _lpInjection == address(0) || _buyback == address(0)) revert InvalidAddress();
        
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

    function addLiquidity(uint256 mcAmount, uint256 jbcAmount) external onlyOwner {
        if (mcAmount > 0) {
            try mcToken.transferFrom(msg.sender, address(this), mcAmount) {
                swapReserveMC += mcAmount;
            } catch Error(string memory reason) {
                revert TransferFromFailed(reason);
            } catch {
                revert TransferFromFailedLowLevel();
            }
        }
        if (jbcAmount > 0) {
            try jbcToken.transferFrom(msg.sender, address(this), jbcAmount) {
                swapReserveJBC += jbcAmount;
            } catch Error(string memory reason) {
                revert TransferFromFailed(reason);
            } catch {
                revert TransferFromFailedLowLevel();
            }
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
        if (_token == address(mcToken) || _token == address(jbcToken)) revert InvalidAddress();
        if (_to == address(0)) revert InvalidAddress();
        
        IERC20(_token).transfer(_to, _amount);
        emit TokensRescued(_token, _to, _amount);
    }

    // Helper Functions
    function calculateLevel(uint256 teamCount) external pure returns (uint256 level, uint256 percent) {
        return _getLevel(teamCount);
    }

    function getUserLevel(address user) external view returns (uint256 level, uint256 percent, uint256 teamCount) {
        teamCount = userInfo[user].teamCount;
        (level, percent) = _getLevel(teamCount);
        return (level, percent, teamCount);
    }

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


    // Admin User Management Functions
    function adminSetReferrer(address user, address newReferrer) external onlyOwner {
        if (user == address(0) || newReferrer == address(0)) revert InvalidAddress();
        if (user == newReferrer) revert SelfReference();
        
        address current = newReferrer;
        uint256 depth = 0;
        while (current != address(0) && depth < 50) {
            if (current == user) revert SelfReference();
            current = userInfo[current].referrer;
            depth++;
        }
        
        address oldReferrer = userInfo[user].referrer;
        if (oldReferrer == newReferrer) return;
        
        userInfo[user].referrer = newReferrer;
        
        if (oldReferrer != address(0)) {
            address[] storage referrals = directReferrals[oldReferrer];
            for (uint256 i = 0; i < referrals.length; i++) {
                if (referrals[i] == user) {
                    referrals[i] = referrals[referrals.length - 1];
                    referrals.pop();
                    break;
                }
            }
        }
        directReferrals[newReferrer].push(user);
        
        uint256 userTeamSize = userInfo[user].teamCount + 1;
        
        if (oldReferrer != address(0)) {
            _updateTeamCountRecursive(oldReferrer, userTeamSize, false);
        }
        
        if (newReferrer != address(0)) {
            _updateTeamCountRecursive(newReferrer, userTeamSize, true);
        }
        
        emit ReferrerChanged(user, oldReferrer, newReferrer);
    }
    
    function _updateTeamCountRecursive(address startNode, uint256 amount, bool isAdd) private {
        address current = startNode;
        uint256 iterations = 0;
        while (current != address(0) && iterations < 30) {
            if (isAdd) {
                userInfo[current].teamCount += amount;
            } else {
                if (userInfo[current].teamCount >= amount) {
                    userInfo[current].teamCount -= amount;
                } else {
                    userInfo[current].teamCount = 0;
                }
            }
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _updateTeamCount(address user) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
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
        
        while (current != address(0) && iterations < 30) {
            userInfo[current].teamTotalVolume += amount;
            current = userInfo[current].referrer;
            iterations++;
        }
    }


    function _getRate(uint256 cycleDays) private pure returns (uint256) {
        if (cycleDays == 7) return 13333334;
        if (cycleDays == 15) return 16666667;
        return 20000000;
    }

    function _calculateStakeReward(Stake storage stake) internal view returns (uint256) {
        uint256 ratePerBillion = _getRate(stake.cycleDays);
        uint256 unitsPassed = (block.timestamp - stake.startTime) / SECONDS_IN_UNIT;
        if (unitsPassed > stake.cycleDays) unitsPassed = stake.cycleDays;
        
        if (unitsPassed == 0) return 0;
        
        uint256 totalStaticShouldBe = (stake.amount * ratePerBillion * unitsPassed) / 1000000000;
        if (totalStaticShouldBe > stake.paid) {
            return totalStaticShouldBe - stake.paid;
        }
        return 0;
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
        _updateTeamStats(msg.sender, 0, true);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    function buyTicket(uint256 amount) external nonReentrant whenNotPaused {
        _expireTicketIfNeeded(msg.sender);
        if (amount != 100 * 1e18 && amount != 300 * 1e18 && amount != 500 * 1e18 && amount != 1000 * 1e18) revert InvalidAmount();
        
        mcToken.transferFrom(msg.sender, address(this), amount);

        Ticket storage t = userTicket[msg.sender];
        
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
        
        address referrerAddr = userInfo[msg.sender].referrer;
        if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
            if (paid > 0) {
                emit ReferralRewardPaid(referrerAddr, msg.sender, paid, REWARD_DIRECT, t.ticketId);
            }
        } else {
            mcToken.transfer(marketingWallet, (amount * directRewardPercent) / 100);
        }

        _distributeTicketLevelRewards(msg.sender, amount);

        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        uint256 buybackAmt = (amount * buybackPercent) / 100;
        _internalBuybackAndBurn(buybackAmt);

        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);

        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);
        
        // Update team stats (volume only, count updated on bind)
        _updateTeamStats(msg.sender, amount, false);

        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }

    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant whenNotPaused {
        Ticket storage ticket = userTicket[msg.sender];
        
        if (ticket.amount == 0) revert NotActive();
        if (ticket.exited) revert AlreadyExited();
        
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

        uint256 baseMaxAmount = userInfo[msg.sender].maxSingleTicketAmount;
        
        if (baseMaxAmount == 0) {
            baseMaxAmount = ticket.amount;
            userInfo[msg.sender].maxSingleTicketAmount = baseMaxAmount;
        }

        uint256 requiredAmount = (baseMaxAmount * 150) / 100;
        if (amount != requiredAmount) revert InvalidAmount();

        _updateActiveStatus(msg.sender);

        emit LiquidityStaked(msg.sender, amount, cycleDays, nextStakeId);

        // 计算并存储极差奖励
        _calculateAndStoreDifferentialRewards(msg.sender, amount, nextStakeId);

        uint256 refund = userInfo[msg.sender].refundFeeAmount;
        if (refund > 0) {
            userInfo[msg.sender].refundFeeAmount = 0;
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
            
            uint256 stakePending = _calculateStakeReward(stakes[i]);
            if (stakePending > 0) {
                totalPending += stakePending;
                stakes[i].paid += stakePending;
                
                // 检查质押是否已完成周期，如果是则发放极差奖励
                uint256 endTime = stakes[i].startTime + (stakes[i].cycleDays * SECONDS_IN_UNIT);
                if (block.timestamp >= endTime) {
                    stakes[i].active = false;
                    _releaseDifferentialRewards(stakes[i].id);
                }
            }
        }
        
        if (totalPending == 0) revert NoRewards();
        
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
        
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    function redeem() external nonReentrant {
        if (!redeemEnabled) revert Unauthorized();
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalReturn = 0;
        uint256 totalFee = 0;
        uint256 totalYield = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            uint256 endTime = stakes[i].startTime + (stakes[i].cycleDays * SECONDS_IN_UNIT);
            if (block.timestamp >= endTime) {
                uint256 pending = _calculateStakeReward(stakes[i]);
                
                totalYield += pending;
                stakes[i].paid += pending;

                uint256 feeBase = userInfo[msg.sender].maxTicketAmount;
                if (feeBase == 0) feeBase = userTicket[msg.sender].amount;
                
                uint256 fee = (feeBase * redemptionFeePercent) / 100;
                
                uint256 returnAmt = stakes[i].amount;
                if (returnAmt > fee) {
                    returnAmt -= fee;
                    totalFee += fee;
                } else {
                    totalFee += returnAmt;
                    returnAmt = 0;
                }
                
                totalReturn += returnAmt;
                stakes[i].active = false;
                
                _releaseDifferentialRewards(stakes[i].id);
            }
        }
        
        if (totalReturn == 0 && totalYield == 0) revert NothingToRedeem();

        if (totalFee > 0) {
            swapReserveMC += totalFee;
        }

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
                
                uint256 jbcPrice = swapReserveJBC == 0 || swapReserveMC < MIN_LIQUIDITY ? 1 ether : (swapReserveMC * 1e18) / swapReserveJBC;
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

        emit Redeemed(msg.sender, totalReturn, totalFee);
        
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

        if (mcToken.balanceOf(address(this)) < amount) {
            emit RewardCapped(user, amount, 0);
            return 0;
        }

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
            
            Stake[] storage stakes = userStakes[user];
            uint256 totalReturn = 0;
            uint256 totalFee = 0;
            
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
            
            if (totalReturn > 0) {
                if (contractBalance >= totalReturn) {
                    mcToken.transfer(user, totalReturn);
                } else {
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
        uint256 rewardPerLayer = (amount * 1) / 100;
        
        while (current != address(0) && layerCount < 15 && iterations < 20) {
            if (!userInfo[current].isActive) {
                current = userInfo[current].referrer;
                iterations++;
                continue;
            }
            
            uint256 maxLayers = getLevelRewardLayers(userInfo[current].activeDirects);
            
            if (maxLayers > layerCount) {
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
        
        uint256 totalLevelRewardAmount = (amount * levelRewardPercent) / 100;
        uint256 remaining = totalLevelRewardAmount - totalDistributed;
        if (remaining > 0) {
            levelRewardPool += remaining;
            emit LevelRewardPoolUpdated(remaining, levelRewardPool);
        }
    }

    function _updateTeamStats(address user, uint256 amount, bool updateCount) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        while (current != address(0) && iterations < 30) {
            UserInfo storage upline = userInfo[current];
            
            if (updateCount) {
                uint256 oldCount = upline.teamCount;
                upline.teamCount = oldCount + 1;
                emit TeamCountUpdated(current, oldCount, oldCount + 1);
                
                // 检查等级是否发生变化
                (uint256 oldLevel,) = _getLevel(oldCount);
                (uint256 newLevel,) = _getLevel(oldCount + 1);
                if (newLevel != oldLevel) {
                    emit UserLevelChanged(current, oldLevel, newLevel, oldCount + 1);
                }
            }
            
            if (amount > 0) {
                upline.teamTotalVolume += amount;
            }
            
            current = upline.referrer;
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

            (, uint256 percent) = _getLevel(userInfo[current].teamCount);
            
            if (percent > previousPercent) {
                uint256 diffPercent = percent - previousPercent;
                uint256 baseAmount = amount;
                if (baseAmount > uplineTicket.amount) {
                    baseAmount = uplineTicket.amount;
                }
                uint256 reward = (baseAmount * diffPercent) / 100;
                
                stakePendingRewards[stakeId].push(PendingReward({
                    upline: current,
                    amount: reward
                }));
                
                emit DifferentialRewardRecorded(stakeId, current, reward);
                
                previousPercent = percent;
            }
            
            if (percent >= 45) break;
            
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

    // 每日燃烧功能 - 燃烧池子中1%的JBC
    function dailyBurn() external {
        if (block.timestamp < lastBurnTime + 24 hours) revert ActionTooEarly();
        
        uint256 jbcReserve = swapReserveJBC;
        if (jbcReserve == 0) revert InvalidAmount();
        
        uint256 burnAmount = jbcReserve / 100; // 1%
        if (burnAmount == 0) revert InvalidAmount();
        
        // 更新储备
        swapReserveJBC -= burnAmount;
        
        // 燃烧代币
        jbcToken.burn(burnAmount);
        
        // 更新最后燃烧时间
        lastBurnTime = block.timestamp;
        
        emit BuybackAndBurn(0, burnAmount);
    }

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
