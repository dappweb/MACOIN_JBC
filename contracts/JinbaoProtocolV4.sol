// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./Tokenomics.sol";

interface IJBC is IERC20 {
    function burn(uint256 amount) external;
}

/**
 * @title JinbaoProtocolV4
 * @author Jinbao Protocol Team
 * @notice 金宝协议 V4 版本 - 原生 MC 代币版本
 * @dev 
 *   - 使用原生 MC 代币 (Native Token) 而非 ERC20
 *   - 集成 TokenomicsLib 代币经济参数库
 *   - 支持 UUPS 可升级模式
 * 
 * 版本历史:
 *   V1: 基础版本
 *   V2: 添加级差奖励
 *   V3: 原生 MC 支持
 *   V4: 代币经济模型标准化 + TokenomicsLib 集成
 */
contract JinbaoProtocolV4 is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using TokenomicsLib for uint256;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              数据结构
    // ═══════════════════════════════════════════════════════════════════════
    
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

    // ═══════════════════════════════════════════════════════════════════════
    //                              状态变量
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice JBC 代币合约
    IJBC public jbcToken;
    
    /// @notice 钱包地址
    address public marketingWallet;
    address public treasuryWallet;
    address public lpInjectionWallet;
    address public buybackWallet;
    
    /// @notice 时间单位 (生产环境: 86400秒=1天, 测试环境: 60秒=1分钟)
    uint256 public constant SECONDS_IN_UNIT = 86400;
    
    /// @notice 分配比例 (可调整)
    uint256 public directRewardPercent;
    uint256 public levelRewardPercent;
    uint256 public marketingPercent;
    uint256 public buybackPercent;
    uint256 public lpInjectionPercent;
    uint256 public treasuryPercent;
    
    /// @notice 费用设置
    uint256 public redemptionFeePercent;
    uint256 public swapBuyTax;
    uint256 public swapSellTax;

    /// @notice 奖励类型常量
    uint8 public constant REWARD_STATIC = 0;
    uint8 public constant REWARD_DYNAMIC = 1;
    uint8 public constant REWARD_DIRECT = 2;
    uint8 public constant REWARD_LEVEL = 3;
    uint8 public constant REWARD_DIFFERENTIAL = 4;

    /// @notice 用户数据映射
    mapping(address => UserInfo) public userInfo;
    mapping(address => Ticket) public userTicket;
    mapping(address => Stake[]) public userStakes;
    mapping(address => address[]) public directReferrals;
    mapping(uint256 => PendingReward[]) public ticketPendingRewards;
    mapping(uint256 => PendingReward[]) public stakePendingRewards;
    mapping(uint256 => address) public ticketOwner;
    mapping(uint256 => address) public stakeOwner;
    
    /// @notice 操作状态
    uint256 public ticketFlexibilityDuration;
    bool public liquidityEnabled;
    bool public redeemEnabled;

    /// @notice 交换储备
    uint256 public swapReserveMC;
    uint256 public swapReserveJBC;

    /// @notice 计数器和池
    uint256 public nextTicketId;
    uint256 public nextStakeId;
    uint256 public lastBurnTime;
    uint256 public levelRewardPool;
    
    /// @notice 紧急状态
    bool public emergencyPaused;
    address public priceOracle;
    
    /// @notice 升级预留空间
    uint256[45] private __gap;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              错误定义
    // ═══════════════════════════════════════════════════════════════════════
    
    error InvalidAmount();
    error InvalidAddress();
    error InvalidCycle();
    error Unauthorized();
    error AlreadyBound();
    error SelfReference();
    error NotActive();
    error AlreadyExited();
    error LowLiquidity();
    error InsufficientBalance();
    error NoRewards();
    error NothingToRedeem();
    error ContractPaused();
    error ActionTooEarly();
    error InsufficientNativeBalance();
    error NativeTransferFailed();
    error TransferFromFailed(string reason);
    error TransferFromFailedLowLevel();

    // ═══════════════════════════════════════════════════════════════════════
    //                              事件定义
    // ═══════════════════════════════════════════════════════════════════════
    
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event TicketExpired(address indexed user, uint256 ticketId, uint256 amount);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId);
    event FeeRefunded(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount, uint8 rewardType);
    event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId);
    event ReferralRewardPaid(address indexed user, address indexed from, uint256 mcAmount, uint256 jbcAmount, uint8 rewardType, uint256 ticketId);
    event RewardCapped(address indexed user, uint256 amount, uint256 cappedAmount);
    event DifferentialRewardRecorded(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event DifferentialRewardReleased(uint256 indexed stakeId, address indexed upline, uint256 amount);
    event DifferentialRewardDistributed(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 jbcPrice, uint256 timestamp);
    event TeamCountUpdated(address indexed user, uint256 oldCount, uint256 newCount);
    event UserLevelChanged(address indexed user, uint256 oldLevel, uint256 newLevel, uint256 teamCount);
    event UserDataUpdated(address indexed user, uint256 activeDirects, uint256 totalRevenue, uint256 currentCap, uint256 refundFeeAmount);
    event Redeemed(address indexed user, uint256 principal, uint256 fee);
    event Exited(address indexed user, uint256 ticketId);
    event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax);
    event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax);
    event BuybackAndBurn(uint256 mcAmount, uint256 jbcBurned);
    event LiquidityAdded(uint256 mcAmount, uint256 jbcAmount);
    event DistributionConfigUpdated(uint256 direct, uint256 level, uint256 marketing, uint256 buyback, uint256 lpInjection, uint256 treasury);
    event SwapTaxesUpdated(uint256 buyTax, uint256 sellTax);
    event NativeMCReceived(address indexed from, uint256 amount);
    event NativeMCWithdrawn(address indexed to, uint256 amount);
    event EmergencyPaused();
    event EmergencyUnpaused();
    event ReferrerChanged(address indexed user, address indexed oldReferrer, address indexed newReferrer);

    // ═══════════════════════════════════════════════════════════════════════
    //                              修饰器
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier whenNotPaused() {
        if (emergencyPaused) revert ContractPaused();
        _;
    }

    modifier hasNativeBalance(uint256 amount) {
        if (address(this).balance < amount) revert InsufficientNativeBalance();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              初始化
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice 初始化合约
     * @param _jbcToken JBC 代币地址
     * @param _marketing 市场钱包
     * @param _treasury 国库钱包
     * @param _lpInjection LP注入钱包
     * @param _buybackWallet 回购钱包
     */
    function initialize(
        address _jbcToken,
        address _marketing,
        address _treasury,
        address _lpInjection,
        address _buybackWallet
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buybackWallet;

        // 使用 TokenomicsLib 常量初始化
        directRewardPercent = TokenomicsLib.DIRECT_REWARD_PERCENT;
        levelRewardPercent = TokenomicsLib.LEVEL_REWARD_PERCENT;
        marketingPercent = TokenomicsLib.MARKETING_PERCENT;
        buybackPercent = TokenomicsLib.BUYBACK_PERCENT;
        lpInjectionPercent = TokenomicsLib.LP_INJECTION_PERCENT;
        treasuryPercent = TokenomicsLib.TREASURY_PERCENT;
        
        redemptionFeePercent = TokenomicsLib.REDEMPTION_FEE_PERCENT;
        swapBuyTax = TokenomicsLib.SWAP_BUY_TAX;
        swapSellTax = TokenomicsLib.SWAP_SELL_TAX;

        ticketFlexibilityDuration = TokenomicsLib.TICKET_FLEXIBILITY_DURATION;
        liquidityEnabled = true;
        redeemEnabled = true;
        lastBurnTime = block.timestamp;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice 接收原生 MC 代币
     */
    receive() external payable {
        swapReserveMC += msg.value;
        emit NativeMCReceived(msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              核心功能
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice 绑定推荐人
     * @param _referrer 推荐人地址
     */
    function bindReferrer(address _referrer) external {
        if (userInfo[msg.sender].referrer != address(0)) revert AlreadyBound();
        if (_referrer == msg.sender) revert SelfReference();
        if (_referrer == address(0)) revert InvalidAddress();
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender);
        
        _updateTeamStats(msg.sender, 0, true);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    /**
     * @notice 购买门票
     * @dev 使用原生 MC 代币 (payable)
     */
    function buyTicket() external payable nonReentrant whenNotPaused {
        uint256 amount = msg.value;
        _expireTicketIfNeeded(msg.sender);
        
        // 使用 TokenomicsLib 验证门票金额
        if (!TokenomicsLib.isValidTicketAmount(amount)) {
            revert InvalidAmount();
        }

        Ticket storage t = userTicket[msg.sender];
        
        if (t.exited) {
            nextTicketId++;
            t.ticketId = nextTicketId;
            t.amount = amount;
            t.purchaseTime = block.timestamp;
            t.exited = false;
            
            userInfo[msg.sender].totalRevenue = 0;
            userInfo[msg.sender].currentCap = TokenomicsLib.calculateCap(amount);
        } else {
            if (t.amount == 0) {
                nextTicketId++;
                t.ticketId = nextTicketId;
                t.amount = amount;
                t.purchaseTime = block.timestamp;
                t.exited = false;
                
                userInfo[msg.sender].totalRevenue = 0;
                userInfo[msg.sender].currentCap = TokenomicsLib.calculateCap(amount);
            } else {
                t.amount += amount;
                if (userInfo[msg.sender].isActive) {
                    t.purchaseTime = block.timestamp;
                }
                userInfo[msg.sender].currentCap += TokenomicsLib.calculateCap(amount);
            }
        }

        if (t.amount > userInfo[msg.sender].maxTicketAmount) {
            userInfo[msg.sender].maxTicketAmount = t.amount;
        }

        if (amount > userInfo[msg.sender].maxSingleTicketAmount) {
            userInfo[msg.sender].maxSingleTicketAmount = amount;
        }

        ticketOwner[t.ticketId] = msg.sender;
        
        // 分配奖励
        _distributeTicketRewards(msg.sender, amount, t.ticketId);
        
        // 更新团队统计
        _updateTeamStats(msg.sender, amount, false);
        _updateActiveStatus(msg.sender);

        emit TicketPurchased(msg.sender, amount, t.ticketId);
    }

    /**
     * @notice 质押流动性
     * @param cycleDays 周期天数 (7/15/30)
     */
    function stakeLiquidity(uint256 cycleDays) external payable nonReentrant whenNotPaused {
        uint256 amount = msg.value;
        Ticket storage ticket = userTicket[msg.sender];
        
        if (ticket.amount == 0) revert NotActive();
        if (ticket.exited) revert AlreadyExited();
        
        // 使用 TokenomicsLib 验证周期
        if (!TokenomicsLib.isValidCycle(cycleDays)) revert InvalidCycle();
        if (amount == 0) revert InvalidAmount();

        // 验证流动性金额
        uint256 baseMaxAmount = userInfo[msg.sender].maxSingleTicketAmount;
        if (baseMaxAmount == 0) {
            baseMaxAmount = ticket.amount;
            userInfo[msg.sender].maxSingleTicketAmount = baseMaxAmount;
        }

        uint256 requiredAmount = TokenomicsLib.calculateRequiredLiquidity(baseMaxAmount);
        if (amount != requiredAmount) revert InvalidAmount();

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

        // 计算并存储极差奖励
        _calculateAndStoreDifferentialRewards(msg.sender, amount, nextStakeId);

        // 退还上次手续费
        uint256 refund = userInfo[msg.sender].refundFeeAmount;
        if (refund > 0) {
            userInfo[msg.sender].refundFeeAmount = 0;
            if (swapReserveMC >= refund && address(this).balance >= refund) {
                swapReserveMC -= refund;
                _transferNativeMC(msg.sender, refund);
                emit FeeRefunded(msg.sender, refund);
            }
        }
    }

    /**
     * @notice 领取收益
     */
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
        
        // 50% MC + 50% JBC 分配
        _distributeStaticReward(msg.sender, totalPending, ticket.ticketId);
        
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    /**
     * @notice 赎回流动性
     */
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
                _distributeStaticReward(msg.sender, totalYield, userTicket[msg.sender].ticketId);
            }
        }

        if (totalReturn > 0) {
            _transferNativeMC(msg.sender, totalReturn);
        }
        
        _updateActiveStatus(msg.sender);
        
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              AMM 交换
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice MC 换 JBC
     */
    function swapMCToJBC() external payable nonReentrant whenNotPaused {
        uint256 mcAmount = msg.value;
        if (mcAmount == 0) revert InvalidAmount();
        if (swapReserveMC < TokenomicsLib.MIN_LIQUIDITY || swapReserveJBC < TokenomicsLib.MIN_LIQUIDITY) revert LowLiquidity();

        uint256 numerator = mcAmount * swapReserveJBC;
        uint256 denominator = swapReserveMC + mcAmount;
        uint256 jbcOutput = numerator / denominator;
        
        uint256 priceImpact = (mcAmount * 10000) / swapReserveMC;
        if (priceImpact > TokenomicsLib.MAX_PRICE_IMPACT) revert InvalidAmount();

        uint256 tax = (jbcOutput * swapBuyTax) / 100;
        uint256 amountToUser = jbcOutput - tax;
        
        if (jbcToken.balanceOf(address(this)) < jbcOutput) revert LowLiquidity();

        swapReserveMC += mcAmount;
        swapReserveJBC -= jbcOutput;
        
        jbcToken.burn(tax);
        jbcToken.transfer(msg.sender, amountToUser);
        
        emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
    }

    /**
     * @notice JBC 换 MC
     */
    function swapJBCToMC(uint256 jbcAmount) external nonReentrant whenNotPaused {
        if (jbcAmount == 0) revert InvalidAmount();
        if (swapReserveMC < TokenomicsLib.MIN_LIQUIDITY || swapReserveJBC < TokenomicsLib.MIN_LIQUIDITY) revert LowLiquidity();
        
        jbcToken.transferFrom(msg.sender, address(this), jbcAmount);

        uint256 tax = (jbcAmount * swapSellTax) / 100;
        uint256 amountToSwap = jbcAmount - tax;
        
        uint256 priceImpact = (amountToSwap * 10000) / swapReserveJBC;
        if (priceImpact > TokenomicsLib.MAX_PRICE_IMPACT) revert InvalidAmount();
        
        jbcToken.burn(tax);
        
        uint256 numerator = amountToSwap * swapReserveMC;
        uint256 denominator = swapReserveJBC + amountToSwap;
        uint256 mcOutput = numerator / denominator;

        if (address(this).balance < mcOutput) revert LowLiquidity();

        swapReserveJBC += amountToSwap;
        swapReserveMC -= mcOutput;
        
        _transferNativeMC(msg.sender, mcOutput);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
    }

    /**
     * @notice 每日销毁
     */
    function dailyBurn() external {
        if (block.timestamp < lastBurnTime + TokenomicsLib.DAILY_BURN_INTERVAL) revert ActionTooEarly();
        
        uint256 jbcReserve = swapReserveJBC;
        if (jbcReserve == 0) revert InvalidAmount();
        
        uint256 burnAmount = (jbcReserve * TokenomicsLib.DAILY_BURN_PERCENT) / 100;
        if (burnAmount == 0) revert InvalidAmount();
        
        swapReserveJBC -= burnAmount;
        jbcToken.burn(burnAmount);
        lastBurnTime = block.timestamp;
        
        emit BuybackAndBurn(0, burnAmount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              查询函数
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice 获取用户等级
     */
    function getUserLevel(address user) external view returns (uint256 level, uint256 percent, uint256 teamCount) {
        teamCount = userInfo[user].teamCount;
        (level, percent) = TokenomicsLib.getLevel(teamCount);
        return (level, percent, teamCount);
    }

    /**
     * @notice 计算等级
     */
    function calculateLevel(uint256 teamCount) external pure returns (uint256 level, uint256 percent) {
        return TokenomicsLib.getLevel(teamCount);
    }

    /**
     * @notice 获取层级奖励层数
     */
    function getLevelRewardLayers(uint256 activeDirects) public pure returns (uint256) {
        return TokenomicsLib.getLevelRewardLayers(activeDirects);
    }

    /**
     * @notice 获取直推列表
     */
    function getDirectReferrals(address user) external view returns (address[] memory) {
        return directReferrals[user];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              内部函数
    // ═══════════════════════════════════════════════════════════════════════

    function _transferNativeMC(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (address(this).balance < amount) revert InsufficientNativeBalance();
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
    }

    function _getRate(uint256 cycleDays) private pure returns (uint256) {
        return TokenomicsLib.getRate(cycleDays);
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

    function _distributeTicketRewards(address user, uint256 amount, uint256 ticketId) internal {
        // 直推奖励
        address referrerAddr = userInfo[user].referrer;
        if (referrerAddr != address(0) && userInfo[referrerAddr].isActive) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            uint256 paid = _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
            if (paid > 0) {
                emit ReferralRewardPaid(referrerAddr, user, paid, 0, REWARD_DIRECT, ticketId);
            }
        } else {
            _transferNativeMC(marketingWallet, (amount * directRewardPercent) / 100);
        }

        // 层级奖励
        _distributeTicketLevelRewards(user, amount);

        // 其他分配
        _transferNativeMC(marketingWallet, (amount * marketingPercent) / 100);
        _internalBuybackAndBurn((amount * buybackPercent) / 100);
        _transferNativeMC(lpInjectionWallet, (amount * lpInjectionPercent) / 100);
        _transferNativeMC(treasuryWallet, (amount * treasuryPercent) / 100);
    }

    function _distributeStaticReward(address user, uint256 amount, uint256 ticketId) internal {
        uint256 mcPart = amount / 2;
        uint256 jbcValuePart = amount / 2;
        
        uint256 mcTransferred = 0;
        if (address(this).balance >= mcPart && mcPart > 0) {
            _transferNativeMC(user, mcPart);
            mcTransferred = mcPart;
        }
        
        uint256 jbcPrice = _getCurrentJBCPrice();
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        uint256 jbcTransferred = 0;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount && jbcAmount > 0) {
            jbcToken.transfer(user, jbcAmount);
            jbcTransferred = jbcAmount;
        }
        
        emit RewardPaid(user, amount, REWARD_STATIC);
        emit RewardClaimed(user, mcTransferred, jbcTransferred, REWARD_STATIC, ticketId);
    }

    function _getCurrentJBCPrice() internal view returns (uint256) {
        if (swapReserveJBC == 0 || swapReserveMC < TokenomicsLib.MIN_LIQUIDITY) {
            return 1 ether;
        }
        
        uint256 rawPrice = (swapReserveMC * 1e18) / swapReserveJBC;
        
        // 价格保护
        uint256 minPrice = 0.1 ether;
        uint256 maxPrice = 10 ether;
        
        if (rawPrice < minPrice) return minPrice;
        if (rawPrice > maxPrice) return maxPrice;
        
        return rawPrice;
    }

    function _distributeReward(address user, uint256 amount, uint8 rType) internal returns (uint256) {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        if (!u.isActive || t.exited || t.amount == 0) {
            return 0;
        }

        uint256 available = u.currentCap - u.totalRevenue;
        uint256 payout = amount;
        
        if (amount > available) {
            payout = available;
            emit RewardCapped(user, amount, available);
        }
        
        if (payout == 0) {
            return 0;
        }
        
        if (rType == REWARD_DIFFERENTIAL) {
            return _distributeDifferentialReward(user, payout);
        }
        
        if (address(this).balance < payout) {
            emit RewardCapped(user, payout, 0);
            return 0;
        }
        
        u.totalRevenue += payout;
        _transferNativeMC(user, payout);
        emit RewardPaid(user, payout, rType);

        if (u.totalRevenue >= u.currentCap) {
            _handleExit(user);
        }
        return payout;
    }

    function _distributeDifferentialReward(address user, uint256 amount) internal returns (uint256) {
        UserInfo storage u = userInfo[user];
        
        uint256 mcPart = amount / 2;
        uint256 jbcValuePart = amount / 2;
        uint256 jbcPrice = _getCurrentJBCPrice();
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        
        uint256 mcTransferred = 0;
        uint256 jbcTransferred = 0;
        
        if (mcPart > 0 && address(this).balance >= mcPart) {
            _transferNativeMC(user, mcPart);
            mcTransferred = mcPart;
        }
        
        if (jbcAmount > 0 && jbcToken.balanceOf(address(this)) >= jbcAmount) {
            jbcToken.transfer(user, jbcAmount);
            jbcTransferred = jbcAmount;
        }
        
        uint256 actualValue = mcTransferred + ((jbcTransferred * jbcPrice) / 1 ether);
        
        if (actualValue > 0) {
            u.totalRevenue += actualValue;
            emit RewardPaid(user, actualValue, REWARD_DIFFERENTIAL);
            emit DifferentialRewardDistributed(user, mcTransferred, jbcTransferred, jbcPrice, block.timestamp);
            
            if (u.totalRevenue >= u.currentCap) {
                _handleExit(user);
            }
        }
        
        return actualValue;
    }

    function _distributeTicketLevelRewards(address user, uint256 amount) internal {
        address current = userInfo[user].referrer;
        uint256 totalDistributed = 0;
        uint256 layerCount = 0;
        uint256 iterations = 0;
        uint256 rewardPerLayer = (amount * TokenomicsLib.LEVEL_REWARD_PER_LAYER) / 100;
        
        while (current != address(0) && layerCount < TokenomicsLib.MAX_LEVEL_LAYERS && iterations < 20) {
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
                    emit ReferralRewardPaid(current, user, paid, 0, REWARD_LEVEL, userTicket[user].ticketId);
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
        }
    }

    function _calculateAndStoreDifferentialRewards(address user, uint256 amount, uint256 stakeId) internal {
        address current = userInfo[user].referrer;
        uint256 previousPercent = 0;
        uint256 iterations = 0;

        while (current != address(0) && iterations < TokenomicsLib.MAX_DIFFERENTIAL_LAYERS) {
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

            (, uint256 percent) = TokenomicsLib.getLevel(userInfo[current].teamCount);
            
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
            
            if (percent >= TokenomicsLib.V9_PERCENT) break;
            
            current = userInfo[current].referrer;
            iterations++;
        }
    }

    function _releaseDifferentialRewards(uint256 stakeId) internal {
        PendingReward[] memory rewards = stakePendingRewards[stakeId];
        for (uint256 i = 0; i < rewards.length; i++) {
            uint256 paid = _distributeReward(rewards[i].upline, rewards[i].amount, REWARD_DIFFERENTIAL);
            emit DifferentialRewardReleased(stakeId, rewards[i].upline, paid);
        }
        delete stakePendingRewards[stakeId];
    }

    function _handleExit(address user) internal {
        Ticket storage t = userTicket[user];
        if (!t.exited) {
            t.exited = true;
            
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
            
            if (totalReturn > 0 && address(this).balance >= totalReturn) {
                _transferNativeMC(user, totalReturn);
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

    function _updateTeamStats(address user, uint256 amount, bool updateCount) internal {
        address current = userInfo[user].referrer;
        uint256 iterations = 0;
        
        while (current != address(0) && iterations < TokenomicsLib.MAX_RECURSION_DEPTH) {
            UserInfo storage upline = userInfo[current];
            
            if (updateCount) {
                uint256 oldCount = upline.teamCount;
                upline.teamCount = oldCount + 1;
                emit TeamCountUpdated(current, oldCount, oldCount + 1);
                
                (uint256 oldLevel,) = TokenomicsLib.getLevel(oldCount);
                (uint256 newLevel,) = TokenomicsLib.getLevel(oldCount + 1);
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

    function _getActiveStakeTotal(address user) internal view returns (uint256 total) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].active) {
                total += stakes[i].amount;
            }
        }
    }

    function _internalBuybackAndBurn(uint256 mcAmount) internal {
        if (mcAmount == 0) return;
        if (swapReserveMC < TokenomicsLib.MIN_LIQUIDITY || swapReserveJBC < TokenomicsLib.MIN_LIQUIDITY) return;
        if (address(this).balance < swapReserveMC + mcAmount) return;

        uint256 priceImpact = (mcAmount * 10000) / swapReserveMC;
        if (priceImpact > TokenomicsLib.MAX_PRICE_IMPACT) return;

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

    // ═══════════════════════════════════════════════════════════════════════
    //                              管理员函数
    // ═══════════════════════════════════════════════════════════════════════

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
    }

    function setOperationalStatus(bool _liquidityEnabled, bool _redeemEnabled) external onlyOwner {
        liquidityEnabled = _liquidityEnabled;
        redeemEnabled = _redeemEnabled;
    }

    function setTicketFlexibilityDuration(uint256 _duration) external onlyOwner {
        ticketFlexibilityDuration = _duration;
    }

    function addLiquidity(uint256 jbcAmount) external payable onlyOwner {
        uint256 mcAmount = msg.value;
        
        if (mcAmount > 0) {
            swapReserveMC += mcAmount;
        }
        
        if (jbcAmount > 0) {
            jbcToken.transferFrom(msg.sender, address(this), jbcAmount);
            swapReserveJBC += jbcAmount;
        }
        
        emit LiquidityAdded(mcAmount, jbcAmount);
    }

    function withdrawSwapReserves(address _toMC, uint256 _amountMC, address _toJBC, uint256 _amountJBC) external onlyOwner {
        if (_amountMC > 0) {
            if (address(this).balance < _amountMC) revert InsufficientNativeBalance();
            swapReserveMC -= _amountMC;
            _transferNativeMC(_toMC, _amountMC);
        }
        
        if (_amountJBC > 0) {
            swapReserveJBC -= _amountJBC;
            jbcToken.transfer(_toJBC, _amountJBC);
        }
    }

    function adminSetReferrer(address user, address newReferrer) external onlyOwner {
        if (user == address(0) || newReferrer == address(0)) revert InvalidAddress();
        if (user == newReferrer) revert SelfReference();
        
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
        
        emit ReferrerChanged(user, oldReferrer, newReferrer);
    }

    /// @notice 管理员修改用户的活跃直推数量
    /// @param user 用户地址
    /// @param newActiveDirects 新的活跃直推数量
    function adminSetActiveDirects(address user, uint256 newActiveDirects) external onlyOwner {
        if (user == address(0)) revert InvalidAddress();
        
        uint256 oldActiveDirects = userInfo[user].activeDirects;
        userInfo[user].activeDirects = newActiveDirects;
        
        emit UserDataUpdated(user, newActiveDirects, userInfo[user].totalRevenue, userInfo[user].currentCap, userInfo[user].refundFeeAmount);
    }

    /// @notice 管理员修改用户的团队成员数量
    /// @param user 用户地址
    /// @param newTeamCount 新的团队成员数量
    function adminSetTeamCount(address user, uint256 newTeamCount) external onlyOwner {
        if (user == address(0)) revert InvalidAddress();
        
        uint256 oldTeamCount = userInfo[user].teamCount;
        userInfo[user].teamCount = newTeamCount;
        
        // 检查并触发等级变化事件
        (uint256 oldLevel,) = TokenomicsLib.getLevel(oldTeamCount);
        (uint256 newLevel,) = TokenomicsLib.getLevel(newTeamCount);
        if (newLevel != oldLevel) {
            emit UserLevelChanged(user, oldLevel, newLevel, newTeamCount);
        }
        
        emit TeamCountUpdated(user, oldTeamCount, newTeamCount);
    }

    function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        if (_token == address(jbcToken)) revert InvalidAddress();
        if (_to == address(0)) revert InvalidAddress();
        
        IERC20(_token).transfer(_to, _amount);
    }

    function emergencyWithdrawNative(address _to, uint256 _amount) external onlyOwner hasNativeBalance(_amount) {
        _transferNativeMC(_to, _amount);
        emit NativeMCWithdrawn(_to, _amount);
    }
}

