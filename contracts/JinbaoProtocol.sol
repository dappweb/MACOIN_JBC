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

    struct Ticket {
        uint256 ticketId;
        uint256 amount; // MC Amount
        uint256 requiredLiquidity; // MC Amount
        uint256 purchaseTime;
        bool liquidityProvided;
        uint256 liquidityAmount;
        uint256 startTime;
        uint256 cycleDays; // 7, 15, 30
        bool redeemed;
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
    
    // Constants
    uint256 public constant SECONDS_IN_DAY = 86400;
    
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
    mapping(address => address[]) public directReferrals;
    
    // Pending Rewards for Differential System: ticketId => List of rewards to release upon redemption
    mapping(uint256 => PendingReward[]) public ticketPendingRewards;
    
    uint256 public nextTicketId;
    
    // Events
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount, uint256 ticketId);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays);
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

    constructor(
        address _mcToken, 
        address _jbcToken,
        address _marketing,
        address _treasury,
        address _lpInjection
    ) Ownable(msg.sender) {
        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
    }

    // --- Admin Functions ---

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

    // --- Core Functions ---

    function bindReferrer(address _referrer) external {
        require(userInfo[msg.sender].referrer == address(0), "Already bound");
        require(_referrer != msg.sender, "Cannot bind self");
        require(_referrer != address(0), "Invalid referrer");
        // Optional: Check if referrer exists (has purchased ticket at some point)? 
        // For now allowing any address to be referrer to bootstrap.
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender);
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    function buyTicket(uint256 amount) external nonReentrant {
        // Validate Amount (T1-T4)
        require(amount == 100 * 1e18 || amount == 300 * 1e18 || amount == 500 * 1e18 || amount == 1000 * 1e18, "Invalid ticket amount");
        
        // Ensure previous ticket is settled
        Ticket storage prevTicket = userTicket[msg.sender];
        if (prevTicket.amount > 0) {
            require(prevTicket.redeemed || prevTicket.exited, "Previous ticket active");
        }

        // Transfer MC
        mcToken.transferFrom(msg.sender, address(this), amount);

        // Init Ticket
        nextTicketId++;
        userTicket[msg.sender] = Ticket({
            ticketId: nextTicketId,
            amount: amount,
            requiredLiquidity: (amount * 150) / 100,
            purchaseTime: block.timestamp,
            liquidityProvided: false,
            liquidityAmount: 0,
            startTime: 0,
            cycleDays: 0,
            redeemed: false,
            exited: false
        });

        // Reset User Stats for new cycle
        userInfo[msg.sender].totalRevenue = 0;
        userInfo[msg.sender].currentCap = amount * 3;
        // Keep isActive false until liquidity provided

        // --- Distribution ---
        
        // 1. Direct Reward (25%)
        address referrer = userInfo[msg.sender].referrer;
        if (referrer != address(0)) {
            uint256 directAmt = (amount * directRewardPercent) / 100;
            _distributeReward(referrer, directAmt, REWARD_DIRECT);
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

    function stakeLiquidity(uint256 cycleDays) external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0 && !ticket.liquidityProvided, "Invalid ticket state");
        require(!ticket.exited, "Ticket exited");
        
        // 72 Hour Check
        require(block.timestamp <= ticket.purchaseTime + 72 hours, "Ticket expired");
        
        // Cycle Check: 7, 15, 30
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Invalid cycle");

        uint256 reqAmount = ticket.requiredLiquidity;
        mcToken.transferFrom(msg.sender, address(this), reqAmount);

        ticket.liquidityProvided = true;
        ticket.liquidityAmount = reqAmount;
        ticket.startTime = block.timestamp;
        ticket.cycleDays = cycleDays;

        // Activate User & Update Referrer Stats
        if (!userInfo[msg.sender].isActive) {
            userInfo[msg.sender].isActive = true;
            address referrer = userInfo[msg.sender].referrer;
            if (referrer != address(0)) {
                userInfo[referrer].activeDirects++;
            }
        }

        emit LiquidityStaked(msg.sender, reqAmount, cycleDays);

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
        require(ticket.liquidityProvided && !ticket.redeemed && !ticket.exited, "Not active");

        // Calculate Static Reward
        uint256 ratePerThousand = 0;
        if (ticket.cycleDays == 7) ratePerThousand = 20;      // 2.0%
        else if (ticket.cycleDays == 15) ratePerThousand = 25; // 2.5%
        else if (ticket.cycleDays == 30) ratePerThousand = 30; // 3.0%

        // Simplified Calculation: Claim since start (or last claim point - not implemented for simplicity, assuming one-time claim or external tracking)
        // For robust production: Store `lastClaimTime`.
        // Here we simulate claiming accrued rewards since last claim.
        // To prevent complex state, let's assume this demo function claims *all available* up to now?
        // Or strictly per day? 
        // Let's implement `lastClaimTime` logic for safety.
        // Re-using `ticket.startTime` as last claim time for simplicity in this update, 
        // effectively resetting the clock? No, that messes up cycle check.
        // Adding `lastClaimTime` to struct requires migration.
        // Let's stick to a simple time-based diff since `startTime`. 
        // NOTE: In production, use `lastClaimTime`. 
        
        // Current Logic: Calculate total expected, subtract already paid? 
        // `totalRevenue` includes dynamic. Can't separate easily.
        // Let's just calculate pending based on time.
        // Assuming user calls this periodically. 
        // We will just calculate reward for *now* and pay it. 
        // Ideally we need `paidStatic` tracker.
        
        // MVP Fix: Calculate 1 day worth of reward for testing? 
        // Or calculate (Now - Start) * Rate - PaidStatic.
        // Let's add `paidStatic` to Ticket struct? 
        // To avoid struct change issues with existing deployments (though we are overwriting file), I will add `paidStatic` to Ticket struct.
        
        // Actually, let's just use the `totalRevenue` check. 
        // But `totalRevenue` has dynamic rewards too.
        // OK, I will assume for this "Requirements Alignment" task, I can modify structs.
        // I'll calculate based on time elapsed since `startTime` but limit to `cycleDays`.
        
        uint256 daysPassed = (block.timestamp - ticket.startTime) / SECONDS_IN_DAY;
        if (daysPassed > ticket.cycleDays) daysPassed = ticket.cycleDays;
        
        if (daysPassed == 0) revert("Less than 1 day");

        uint256 totalStaticShouldBe = (ticket.liquidityAmount * ratePerThousand * daysPassed) / 1000;
        
        // We need to know how much static was already paid to avoid double paying.
        // Since I can't easily add storage without migration script issues if this was a proxy (it's not),
        // I will add a mapping `mapping(uint256 => uint256) public ticketStaticPaid`
        
        uint256 paid = ticketStaticPaid[ticket.ticketId];
        uint256 pending = 0;
        if (totalStaticShouldBe > paid) {
            pending = totalStaticShouldBe - paid;
        }
        
        require(pending > 0, "No new rewards");
        
        // Distribute
        // Static is 50% MC, 50% JBC.
        // Check Cap first (Static counts to cap).
        
        if (userInfo[msg.sender].totalRevenue + pending > userInfo[msg.sender].currentCap) {
            pending = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
        }
        
        if (pending == 0) {
            _handleExit(msg.sender);
            return;
        }
        
        ticketStaticPaid[ticket.ticketId] += pending;
        userInfo[msg.sender].totalRevenue += pending;
        
        uint256 mcPart = pending / 2;
        uint256 jbcValuePart = pending / 2;
        
        // MC Transfer
        if (mcToken.balanceOf(address(this)) >= mcPart) {
            mcToken.transfer(msg.sender, mcPart);
        }
        
        // JBC Transfer (Oracle needed, 1:1 simulation)
        uint256 jbcPrice = 1 ether; 
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        if (jbcToken.balanceOf(address(this)) >= jbcAmount) {
            jbcToken.transfer(msg.sender, jbcAmount);
        }
        
        emit RewardPaid(msg.sender, pending, REWARD_STATIC);
        
        // Check Exit
        if (userInfo[msg.sender].totalRevenue >= userInfo[msg.sender].currentCap) {
            _handleExit(msg.sender);
        }
    }
    
    // Additional mapping for static tracking
    mapping(uint256 => uint256) public ticketStaticPaid;

    function redeem() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.liquidityProvided && !ticket.redeemed && !ticket.exited, "Cannot redeem");
        require(block.timestamp >= ticket.startTime + (ticket.cycleDays * SECONDS_IN_DAY), "Cycle not finished");

        // Fee: 1% of TICKET AMOUNT
        uint256 fee = (ticket.amount * redemptionFeePercent) / 100;
        
        // We deduct fee from the Principal being returned.
        uint256 returnAmount = ticket.liquidityAmount;
        if (returnAmount >= fee) {
            returnAmount -= fee;
        } else {
            fee = 0; // Should not happen given 1.5x liquidity
        }

        mcToken.transfer(msg.sender, returnAmount);
        
        // Record Fee for next refund
        userInfo[msg.sender].refundFeeAmount = fee;

        ticket.redeemed = true;
        userInfo[msg.sender].isActive = false;
        
        // Decrement referrer's active count
        address referrer = userInfo[msg.sender].referrer;
        if (referrer != address(0) && userInfo[referrer].activeDirects > 0) {
            userInfo[referrer].activeDirects--;
        }

        emit Redeemed(msg.sender, ticket.liquidityAmount, fee);
        
        // Release Pending Level Rewards
        _releaseLevelRewards(ticket.ticketId);
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
            // Force redeem liquidity (minus fee)
            if (t.liquidityProvided && !t.redeemed) {
                uint256 fee = (t.amount * redemptionFeePercent) / 100;
                uint256 returnAmt = t.liquidityAmount > fee ? t.liquidityAmount - fee : 0;
                
                if (returnAmt > 0) {
                    mcToken.transfer(user, returnAmt);
                }
                t.redeemed = true;
                userInfo[user].isActive = false;
                
                // Decrement referrer
                address referrer = userInfo[user].referrer;
                if (referrer != address(0) && userInfo[referrer].activeDirects > 0) {
                    userInfo[referrer].activeDirects--;
                }
                
                emit Redeemed(user, t.liquidityAmount, fee);
            }
            emit Exited(user, t.ticketId);
        }
    }

    function _calculateAndStoreLevelRewards(address user, uint256 amount, uint256 ticketId) internal {
        address current = userInfo[user].referrer;
        uint256 previousPercent = 0;
        uint256 iterations = 0;

        while (current != address(0) && iterations < 20) {
            // Get Upline Level
            (uint256 level, uint256 percent) = getLevel(userInfo[current].activeDirects);
            
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

        uint256 mcReserve = mcToken.balanceOf(address(this)) - mcAmount;
        uint256 jbcReserve = jbcToken.balanceOf(address(this));
        
        uint256 jbcOutput = getAmountOut(mcAmount, mcReserve, jbcReserve);
        uint256 tax = (jbcOutput * swapBuyTax) / 100;
        uint256 amountToUser = jbcOutput - tax;
        
        require(jbcToken.balanceOf(address(this)) >= jbcOutput, "Insufficient JBC liquidity");
        
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
        
        uint256 jbcReserve = jbcToken.balanceOf(address(this)) - amountToSwap; 
        uint256 mcReserve = mcToken.balanceOf(address(this));
        
        uint256 mcOutput = getAmountOut(amountToSwap, jbcReserve, mcReserve);
        require(mcToken.balanceOf(address(this)) >= mcOutput, "Insufficient MC liquidity");
        
        mcToken.transfer(msg.sender, mcOutput);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcOutput, tax);
    }

    // --- Admin ---
    function setWallets(address _marketing, address _treasury, address _lpInjection) external onlyOwner {
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
    }
}
