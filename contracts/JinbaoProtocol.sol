// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IJBC is IERC20 {
    function burn(uint256 amount) external;
}

contract JinbaoProtocol is Ownable, ReentrancyGuard {
    
    struct UserInfo {
        address referrer;
        uint256 activeDirects; // Number of active direct referrals (Valid Ticket + Liquidity)
        uint256 teamCount;     // Total team size (Optional/Display)
        uint256 totalRevenue;  // Total earnings (dynamic + static) for CURRENT ticket
        uint256 currentCap;    // Current max cap (3x ticket)
        bool isActive;         // Has active ticket with liquidity
        uint256 refundFeeAmount; // Amount of fee to refund on next stake
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
    uint256 public directRewardPercent = 25;
    uint256 public levelRewardPercent = 15;
    uint256 public marketingPercent = 5;
    uint256 public buybackPercent = 5;
    uint256 public lpInjectionPercent = 25;
    uint256 public treasuryPercent = 25;
    
    // Fees & Taxes
    uint256 public redemptionFeePercent = 1; // 1% of Ticket Amount
    uint256 public swapBuyTax = 50; // 50%
    uint256 public swapSellTax = 25; // 25%

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
    
    // Swap Pool Reserves
    uint256 public swapReserveMC;
    uint256 public swapReserveJBC;

    uint256 public nextTicketId;
    uint256 public nextStakeId;
    
    // Events
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays, uint256 stakeId);
    event FeeRefunded(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount, uint8 rewardType);
    event RewardCapped(address indexed user, uint256 amount, uint256 cappedAmount);
    event LevelRewardRecorded(uint256 indexed ticketId, address indexed upline, uint256 amount);
    event LevelRewardReleased(uint256 indexed ticketId, address indexed upline, uint256 amount);
    event Redeemed(address indexed user, uint256 principal, uint256 fee);
    event Exited(address indexed user, uint256 ticketId);
    event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax);
    event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax);
    event BuybackAndBurn(uint256 mcAmount, uint256 jbcBurned);
    event LiquidityAdded(uint256 mcAmount, uint256 jbcAmount);

    constructor(
        address _mcToken, 
        address _jbcToken,
        address _marketing,
        address _treasury,
        address _lpInjection,
        address _buybackWallet // Added parameter
    ) Ownable(msg.sender) {
        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buybackWallet;
    }

    // --- Admin Functions ---

    function setDistributionPercents(
        uint256 _direct, 
        uint256 _level, 
        uint256 _marketing, 
        uint256 _buyback, 
        uint256 _lp, 
        uint256 _treasury
    ) external onlyOwner {
        require(_direct + _level + _marketing + _buyback + _lp + _treasury == 100, "Total must be 100");
        directRewardPercent = _direct;
        levelRewardPercent = _level;
        marketingPercent = _marketing;
        buybackPercent = _buyback;
        lpInjectionPercent = _lp;
        treasuryPercent = _treasury;
    }

    function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external onlyOwner {
        require(_buyTax <= 100 && _sellTax <= 100, "Invalid tax");
        swapBuyTax = _buyTax;
        swapSellTax = _sellTax;
    }

    function setRedemptionFee(uint256 _fee) external onlyOwner {
        require(_fee <= 100, "Invalid fee");
        redemptionFeePercent = _fee;
    }

    function adminSetUserStats(address user, uint256 _activeDirects, uint256 _teamCount) external onlyOwner {
        userInfo[user].activeDirects = _activeDirects;
        userInfo[user].teamCount = _teamCount;
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

    function adminWithdrawMC(uint256 amount, address to) external onlyOwner {
        mcToken.transfer(to, amount);
    }

    function adminWithdrawJBC(uint256 amount, address to) external onlyOwner {
        jbcToken.transfer(to, amount);
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

    // --- Helper Views ---

    function getLevel(uint256 activeDirects) public pure returns (uint256 level, uint256 percent) {
        if (activeDirects >= 100000) return (9, 45);
        if (activeDirects >= 30000) return (8, 40);
        if (activeDirects >= 10000) return (7, 35);
        if (activeDirects >= 3000) return (6, 30);
        if (activeDirects >= 1000) return (5, 25);
        if (activeDirects >= 300) return (4, 20);
        if (activeDirects >= 100) return (3, 15);
        if (activeDirects >= 30) return (2, 10);
        if (activeDirects >= 10) return (1, 5);
        return (0, 0);
    }

    function getJBCPrice() public view returns (uint256) {
        uint256 mcReserve = mcToken.balanceOf(address(this));
        uint256 jbcReserve = jbcToken.balanceOf(address(this));
        if (jbcReserve == 0) return 1 ether; // Default
        // Spot Price of 1 JBC in MC = mcReserve / jbcReserve
        return (mcReserve * 1e18) / jbcReserve;
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
        // Validate Amount (T1-T4)
        require(amount == 100 * 1e18 || amount == 300 * 1e18 || amount == 500 * 1e18 || amount == 1000 * 1e18, "Invalid ticket amount");
        
        // Removed restriction: Users can buy ticket anytime
        /*
        // Ensure previous ticket is exited if it existed
        Ticket storage prevTicket = userTicket[msg.sender];
        if (prevTicket.amount > 0) {
            require(prevTicket.exited, "Previous ticket active");
        }
        */

        // Transfer MC
        mcToken.transferFrom(msg.sender, address(this), amount);

        // Init Ticket
        nextTicketId++;
        userTicket[msg.sender] = Ticket({
            ticketId: nextTicketId,
            amount: amount,
            purchaseTime: block.timestamp,
            exited: false
        });

        // Reset User Stats for new cycle
        userInfo[msg.sender].totalRevenue = 0;
        userInfo[msg.sender].currentCap = amount * 3;
        
        // Activate User immediately upon purchase
        if (!userInfo[msg.sender].isActive) {
            userInfo[msg.sender].isActive = true;
            address referrer = userInfo[msg.sender].referrer;
            if (referrer != address(0)) {
                userInfo[referrer].activeDirects++;
            }
        }
        
        // --- Distribution ---
        
        // 1. Direct Reward (25%)
        address referrerAddr = userInfo[msg.sender].referrer; // Changed variable name to avoid shadowing
        if (referrerAddr != address(0)) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            _distributeReward(referrerAddr, directAmt, REWARD_DIRECT);
        } else {
            // No referrer -> Marketing
            mcToken.transfer(marketingWallet, (amount * directRewardPercent) / 100);
        }

        // 2. Differential Reward (15%) - Calculate & Store Pending
        _calculateAndStoreLevelRewards(msg.sender, amount, nextTicketId);

        // 3. Marketing (5%)
        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        // 4. Buyback (5%) - Internal Swap & Burn
        uint256 buybackAmt = (amount * buybackPercent) / 100;
        _internalBuybackAndBurn(buybackAmt);

        // 5. Buffer / LP Injection (25%)
        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);

        // 6. Treasury (25%)
        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);

        emit TicketPurchased(msg.sender, amount, nextTicketId);
    }

    function stakeLiquidity(uint256 amount, uint256 cycleDays) external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0, "No ticket");
        require(!ticket.exited, "Ticket exited");
        
        // Cycle Check: 7, 15, 30
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Invalid cycle");
        require(amount > 0, "Zero amount");

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
        require(ticket.amount > 0 && !ticket.exited, "Not active");
        
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalPending = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            // Calculate Static Reward for this stake
            uint256 ratePerThousand = 0;
            if (stakes[i].cycleDays == 7) ratePerThousand = 20;      // 2.0%
            else if (stakes[i].cycleDays == 15) ratePerThousand = 25; // 2.5%
            else if (stakes[i].cycleDays == 30) ratePerThousand = 30; // 3.0%
            
            uint256 unitsPassed = (block.timestamp - stakes[i].startTime) / SECONDS_IN_UNIT;
            if (unitsPassed > stakes[i].cycleDays) unitsPassed = stakes[i].cycleDays;
            
            if (unitsPassed == 0) continue;

            uint256 totalStaticShouldBe = (stakes[i].amount * ratePerThousand * unitsPassed) / 1000;
            
            uint256 paid = stakes[i].paid;
            if (totalStaticShouldBe > paid) {
                uint256 stakePending = totalStaticShouldBe - paid;
                totalPending += stakePending;
                stakes[i].paid += stakePending;
            }
        }
        
        require(totalPending > 0, "No new rewards");
        
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
        if (mcToken.balanceOf(address(this)) >= mcPart) {
            mcToken.transfer(msg.sender, mcPart);
        }
        
        // JBC Transfer
        uint256 jbcPrice = getJBCPrice(); 
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount) {
            jbcToken.transfer(msg.sender, jbcAmount);
        }
        
        emit RewardPaid(msg.sender, totalPending, REWARD_STATIC);
        
        // Check Exit
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }

    function redeem() external nonReentrant {
        // Redeem all expired stakes
        Stake[] storage stakes = userStakes[msg.sender];
        uint256 totalReturn = 0;
        uint256 totalFee = 0;
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].active) continue;
            
            uint256 endTime = stakes[i].startTime + (stakes[i].cycleDays * SECONDS_IN_UNIT);
            if (block.timestamp >= endTime) {
                // Expired, can redeem
                uint256 fee = (stakes[i].amount * redemptionFeePercent) / 100; // Fee based on stake amount now?
                // User said "Ticket 1% fee". But since stakes are decoupled, maybe fee on stake?
                // Or fee based on ticket amount? 
                // Let's stick to fee on Principal being returned for simplicity and fairness.
                
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
        
        require(totalReturn > 0, "Nothing to redeem");

        mcToken.transfer(msg.sender, totalReturn);
        
        // Record Fee for next refund
        userInfo[msg.sender].refundFeeAmount += totalFee;

        emit Redeemed(msg.sender, totalReturn, totalFee);
        
        // Release Pending Level Rewards?
        // Level rewards are tied to TicketId.
        // If ticket is still active, we can release? 
        // Logic: Level rewards are released when user "Redeems".
        // Now multiple redeems possible.
        // Let's release all pending rewards for current ticket.
        _releaseLevelRewards(userTicket[msg.sender].ticketId);
    }

    // --- Internal Logic ---

    function _distributeReward(address user, uint256 amount, uint8 rType) internal {
        UserInfo storage u = userInfo[user];
        Ticket storage t = userTicket[user];
        
        // If user has no active ticket or exited, they might still receive dynamic rewards? 
        // Doc: "3倍出局... 该用户不再享受任何动态奖励"
        if (t.exited || t.amount == 0) {
            return; // Burn/Keep in contract
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
                
                uint256 fee = (stakes[i].amount * redemptionFeePercent) / 100;
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
            
            userInfo[user].isActive = false;
            
            // Decrement referrer
            address referrer = userInfo[user].referrer;
            if (referrer != address(0) && userInfo[referrer].activeDirects > 0) {
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
            // Get Upline Level
            (, uint256 percent) = getLevel(userInfo[current].activeDirects);
            
            if (percent > previousPercent) {
                uint256 diffPercent = percent - previousPercent;
                uint256 reward = (amount * diffPercent) / 100;
                
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
        PendingReward[] memory rewards = ticketPendingRewards[ticketId];
        for (uint256 i = 0; i < rewards.length; i++) {
            _distributeReward(rewards[i].upline, rewards[i].amount, REWARD_LEVEL);
            emit LevelRewardReleased(ticketId, rewards[i].upline, rewards[i].amount);
        }
        delete ticketPendingRewards[ticketId];
    }

    function _internalBuybackAndBurn(uint256 mcAmount) internal {
        // 1. Add MC to Reserves (already in address(this))
        // 2. Calculate JBC out based on pool state
        uint256 mcReserve = mcToken.balanceOf(address(this)) - mcAmount; 
        uint256 jbcReserve = jbcToken.balanceOf(address(this));
        
        if (mcReserve > 0 && jbcReserve > 0) {
            uint256 jbcOut = getAmountOut(mcAmount, mcReserve, jbcReserve);
            if (jbcOut > 0) {
                jbcToken.burn(jbcOut);
                emit BuybackAndBurn(mcAmount, jbcOut);
            }
        }
    }

    // --- AMM & Swap Support ---

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    function swapMCToJBC(uint256 mcAmount) external nonReentrant {
        require(mcAmount > 0, "Invalid amount");
        mcToken.transferFrom(msg.sender, address(this), mcAmount);

        uint256 jbcOutput = getAmountOut(mcAmount, swapReserveMC, swapReserveJBC);
        uint256 tax = (jbcOutput * swapBuyTax) / 100;
        uint256 amountToUser = jbcOutput - tax;
        
        require(jbcToken.balanceOf(address(this)) >= jbcOutput, "Insufficient JBC liquidity");

        // Update Reserves
        swapReserveMC += mcAmount;
        swapReserveJBC -= jbcOutput;
        
        jbcToken.burn(tax);
        jbcToken.transfer(msg.sender, amountToUser);
        
        emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
    }

    function swapJBCToMC(uint256 jbcAmount) external nonReentrant {
        require(jbcAmount > 0, "Invalid amount");
        jbcToken.transferFrom(msg.sender, address(this), jbcAmount);

        uint256 tax = (jbcAmount * swapSellTax) / 100;
        uint256 amountToSwap = jbcAmount - tax;
        
        jbcToken.burn(tax);
        
        uint256 mcOutput = getAmountOut(amountToSwap, swapReserveJBC, swapReserveMC);
        require(mcToken.balanceOf(address(this)) >= mcOutput, "Insufficient MC liquidity");

        // Update Reserves
        swapReserveJBC += jbcAmount; // We add full input amount? No, we burned tax.
        // Wait, standard AMM: 
        // Swap Input = amountToSwap (after tax?). 
        // In this logic: tax is burned BEFORE swap math?
        // Let's look at previous logic:
        // uint256 jbcReserve = jbcToken.balanceOf(address(this)) - amountToSwap; 
        // This implies amountToSwap was added to reserve implicitly by transfer.
        
        // Correct logic with Reserves:
        // Input JBC comes in. Tax is burned. Remaining JBC (amountToSwap) is added to JBC Reserve.
        // Then MC is calculated and removed from MC Reserve.
        
        swapReserveJBC += amountToSwap;
        swapReserveMC -= mcOutput;
        
        mcToken.transfer(msg.sender, mcOutput);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
    }

    // --- Admin ---
    function setWallets(address _marketing, address _treasury, address _lpInjection, address _buyback) external onlyOwner {
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buyback;
    }
}
