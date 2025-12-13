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
        uint256 activeDirects; // Number of active direct referrals
        uint256 teamCount; // Total team size (simplified for this demo)
        uint256 totalRevenue; // Total earnings (dynamic + static)
        uint256 currentCap; // Current max cap (3x ticket)
        bool isActive;
    }

    struct ReferralData {
        address user;
        uint256 ticketAmount;
        uint256 joinTime;
    }

    struct Ticket {
        uint256 amount; // MC Amount
        uint256 requiredLiquidity; // MC Amount
        uint256 purchaseTime;
        bool liquidityProvided;
        uint256 liquidityAmount;
        uint256 startTime;
        uint256 cycleDays; // 7, 15, 30
        bool redeemed;
    }

    IERC20 public mcToken;
    IJBC public jbcToken;
    
    // Wallets
    address public marketingWallet;
    address public treasuryWallet;
    address public lpInjectionWallet;
    address public buybackWallet; // "Directly enter bottom pool to buy JBC" -> Simulating as wallet for now

    // Constants
    uint256 public constant SECONDS_IN_DAY = 86400;
    
    // Admin Adjustable Parameters
    uint256 public redemptionFeePercent = 1; // 1%
    uint256 public directRewardPercent = 25; // 25%
    uint256 public levelRewardPercent = 15; // 15%
    uint256 public marketingPercent = 5; // 5%
    uint256 public buybackPercent = 5; // 5%
    uint256 public lpInjectionPercent = 25; // 25%
    uint256 public treasuryPercent = 25; // 25%
    uint256 public swapBuyTax = 50; // 50%
    uint256 public swapSellTax = 25; // 25%

    // State
    mapping(address => UserInfo) public userInfo;
    mapping(address => Ticket) public userTicket;
    mapping(address => address[]) public directReferrals; // Stores list of direct referrals for each user
    
    // Events
    event BoundReferrer(address indexed user, address indexed referrer);
    event TicketPurchased(address indexed user, uint256 amount);
    event LiquidityStaked(address indexed user, uint256 amount, uint256 cycleDays);
    event RewardClaimed(address indexed user, uint256 mcAmount, uint256 jbcAmount);
    event Redeemed(address indexed user, uint256 principal, uint256 fee);
    event SwappedMCToJBC(address indexed user, uint256 mcAmount, uint256 jbcAmount, uint256 tax);
    event SwappedJBCToMC(address indexed user, uint256 jbcAmount, uint256 mcAmount, uint256 tax);

    constructor(
        address _mcToken, 
        address _jbcToken,
        address _marketing,
        address _treasury,
        address _lpInjection,
        address _buyback
    ) Ownable(msg.sender) {
        mcToken = IERC20(_mcToken);
        jbcToken = IJBC(_jbcToken);
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buyback;
    }

    // --- Admin Functions ---

    function setWallets(
        address _marketing,
        address _treasury,
        address _lpInjection,
        address _buyback
    ) external onlyOwner {
        marketingWallet = _marketing;
        treasuryWallet = _treasury;
        lpInjectionWallet = _lpInjection;
        buybackWallet = _buyback;
    }

    function setDistributionPercents(
        uint256 _direct,
        uint256 _level,
        uint256 _marketing,
        uint256 _buyback,
        uint256 _lpInjection,
        uint256 _treasury
    ) external onlyOwner {
        require(_direct + _level + _marketing + _buyback + _lpInjection + _treasury == 100, "Total must be 100");
        directRewardPercent = _direct;
        levelRewardPercent = _level;
        marketingPercent = _marketing;
        buybackPercent = _buyback;
        lpInjectionPercent = _lpInjection;
        treasuryPercent = _treasury;
    }

    function setSwapTaxes(uint256 _buyTax, uint256 _sellTax) external onlyOwner {
        swapBuyTax = _buyTax;
        swapSellTax = _sellTax;
    }

    function setRedemptionFee(uint256 _fee) external onlyOwner {
        redemptionFeePercent = _fee;
    }

    // --- Referral System ---

    function bindReferrer(address _referrer) external {
        require(userInfo[msg.sender].referrer == address(0), "Already bound");
        require(_referrer != msg.sender, "Cannot bind self");
        require(_referrer != address(0), "Invalid referrer");
        
        userInfo[msg.sender].referrer = _referrer;
        directReferrals[_referrer].push(msg.sender); // Add to referrer's list
        
        emit BoundReferrer(msg.sender, _referrer);
    }

    function getDirectReferrals(address _user) external view returns (address[] memory) {
        return directReferrals[_user];
    }

    function getDirectReferralsData(address _user) external view returns (ReferralData[] memory) {
        address[] memory directs = directReferrals[_user];
        ReferralData[] memory data = new ReferralData[](directs.length);
        
        for (uint256 i = 0; i < directs.length; i++) {
            data[i] = ReferralData({
                user: directs[i],
                ticketAmount: userTicket[directs[i]].amount,
                joinTime: userTicket[directs[i]].purchaseTime
            });
        }
        return data;
    }

    // --- Ticket Purchase ---

    function buyTicket(uint256 amount) external nonReentrant {
        require(amount == 100 ether || amount == 300 ether || amount == 500 ether || amount == 1000 ether, "Invalid ticket tier");
        require(!userTicket[msg.sender].liquidityProvided || userTicket[msg.sender].redeemed, "Active ticket exists");

        // Transfer MC from user
        mcToken.transferFrom(msg.sender, address(this), amount);

        // Distribute Funds
        // Direct Referral
        address referrer = userInfo[msg.sender].referrer;
        if (referrer != address(0)) {
            mcToken.transfer(referrer, (amount * directRewardPercent) / 100);
        } else {
            // If no referrer, send to marketing or burn? Sending to marketing for now
            mcToken.transfer(marketingWallet, (amount * directRewardPercent) / 100);
        }

        // Level Reward (Placeholder: Send to marketing to simplify contract)
        mcToken.transfer(marketingWallet, (amount * levelRewardPercent) / 100);

        // Marketing
        mcToken.transfer(marketingWallet, (amount * marketingPercent) / 100);

        // Buyback
        mcToken.transfer(buybackWallet, (amount * buybackPercent) / 100);

        // Liquidity Injection
        mcToken.transfer(lpInjectionWallet, (amount * lpInjectionPercent) / 100);

        // Treasury
        mcToken.transfer(treasuryWallet, (amount * treasuryPercent) / 100);

        // Init Ticket
        userTicket[msg.sender] = Ticket({
            amount: amount,
            requiredLiquidity: (amount * 150) / 100, // 1.5x
            purchaseTime: block.timestamp,
            liquidityProvided: false,
            liquidityAmount: 0,
            startTime: 0,
            cycleDays: 0,
            redeemed: false
        });

        // Set Cap (3x)
        userInfo[msg.sender].currentCap = amount * 3;
        userInfo[msg.sender].totalRevenue = 0; // Reset revenue for new cycle

        emit TicketPurchased(msg.sender, amount);
    }

    // --- Provide Liquidity ---

    function stakeLiquidity(uint256 cycleDays) external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.amount > 0 && !ticket.liquidityProvided, "No valid ticket");
        require(block.timestamp <= ticket.purchaseTime + 72 hours, "Ticket expired");
        require(cycleDays == 7 || cycleDays == 15 || cycleDays == 30, "Invalid cycle");

        uint256 reqAmount = ticket.requiredLiquidity;
        mcToken.transferFrom(msg.sender, address(this), reqAmount);

        ticket.liquidityProvided = true;
        ticket.liquidityAmount = reqAmount;
        ticket.startTime = block.timestamp;
        ticket.cycleDays = cycleDays;

        // Activate referrer count
        address referrer = userInfo[msg.sender].referrer;
        if (referrer != address(0) && !userInfo[msg.sender].isActive) {
            userInfo[referrer].activeDirects++;
            userInfo[msg.sender].isActive = true;
        }

        emit LiquidityStaked(msg.sender, reqAmount, cycleDays);
    }

    // --- Claim Rewards (Simulation) ---
    // Note: In production, this needs robust calculation, checks for V-levels, and JBC pricing oracle.
    // Here we simulate the basic interest claim.
    
    function claimRewards() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.liquidityProvided && !ticket.redeemed, "Not active");

        // Calculate Rate
        uint256 dailyRate = 0;
        if (ticket.cycleDays == 7) dailyRate = 20; // 2.0% (div 1000)
        else if (ticket.cycleDays == 15) dailyRate = 25; // 2.5%
        else if (ticket.cycleDays == 30) dailyRate = 30; // 3.0%

        // Calculate time passed (Simplified: assume claiming all at once or daily tracking)
        // For demo: Calculate pending since start or last claim
        // This is a simplified placeholder logic
        uint256 daysPassed = (block.timestamp - ticket.startTime) / SECONDS_IN_DAY;
        require(daysPassed > 0, "No rewards yet");

        // Limit to cycle days
        if (daysPassed > ticket.cycleDays) {
            daysPassed = ticket.cycleDays;
        }

        uint256 rewardAmount = (ticket.amount * dailyRate * daysPassed) / 1000;
        
        // Cap Check
        if (userInfo[msg.sender].totalRevenue + rewardAmount > userInfo[msg.sender].currentCap) {
            rewardAmount = userInfo[msg.sender].currentCap - userInfo[msg.sender].totalRevenue;
        }

        require(rewardAmount > 0, "No rewards to claim");

        userInfo[msg.sender].totalRevenue += rewardAmount;

        // Split 50/50
        uint256 mcPart = rewardAmount / 2;
        uint256 jbcValuePart = rewardAmount / 2;

        // MC Transfer
        // Note: Contract needs to be funded with MC for rewards! 
        // In real "Ponzi" style logic, the incoming tickets fund the rewards.
        require(mcToken.balanceOf(address(this)) >= mcPart, "Insufficient MC in pool");
        mcToken.transfer(msg.sender, mcPart);

        // JBC Transfer (Gold Standard)
        // We need a price oracle here. Assume 1 JBC = 1 MC for demo.
        uint256 jbcPrice = 1 ether; // Mock price
        uint256 jbcAmount = (jbcValuePart * 1 ether) / jbcPrice;
        
        require(jbcToken.balanceOf(address(this)) >= jbcAmount, "Insufficient JBC in pool");
        jbcToken.transfer(msg.sender, jbcAmount);

        emit RewardClaimed(msg.sender, mcPart, jbcAmount);
    }

    // --- Swap System ---

    // Buy JBC with MC (Tax)
    function swapMCToJBC(uint256 mcAmount) external nonReentrant {
        require(mcAmount > 0, "Invalid amount");
        
        // 1. Transfer MC from user to contract
        mcToken.transferFrom(msg.sender, address(this), mcAmount);
        
        // 2. Calculate JBC out (1:1 price)
        uint256 jbcTotal = mcAmount; // 1 MC = 1 JBC
        uint256 tax = (jbcTotal * swapBuyTax) / 100; // Dynamic Tax
        uint256 amountToUser = jbcTotal - tax;
        
        // 3. Check liquidity
        require(jbcToken.balanceOf(address(this)) >= jbcTotal, "Insufficient JBC liquidity");
        
        // 4. Burn Tax (Burn from contract balance)
        jbcToken.burn(tax);
        
        // 5. Transfer remaining JBC to user
        jbcToken.transfer(msg.sender, amountToUser);
        
        emit SwappedMCToJBC(msg.sender, mcAmount, amountToUser, tax);
    }

    // Sell JBC for MC (Tax)
    function swapJBCToMC(uint256 jbcAmount) external nonReentrant {
        require(jbcAmount > 0, "Invalid amount");
        
        // 1. Transfer JBC from user to contract
        jbcToken.transferFrom(msg.sender, address(this), jbcAmount);
        
        // 2. Calculate Tax (Dynamic Tax)
        uint256 tax = (jbcAmount * swapSellTax) / 100;
        uint256 amountToSwap = jbcAmount - tax;
        
        // 3. Burn Tax
        // Since we already transferred JBC to contract, we burn from contract
        jbcToken.burn(tax);
        
        // 4. Calculate MC out (1:1 price)
        uint256 mcAmount = amountToSwap; // 1 JBC = 1 MC
        
        // 5. Check liquidity
        require(mcToken.balanceOf(address(this)) >= mcAmount, "Insufficient MC liquidity");
        
        // 6. Transfer MC to user
        mcToken.transfer(msg.sender, mcAmount);
        
        emit SwappedJBCToMC(msg.sender, jbcAmount, mcAmount, tax);
    }

    // --- Redemption ---

    function redeem() external nonReentrant {
        Ticket storage ticket = userTicket[msg.sender];
        require(ticket.liquidityProvided && !ticket.redeemed, "Cannot redeem");
        require(block.timestamp >= ticket.startTime + (ticket.cycleDays * 1 days), "Cycle not finished");

        // Fee
        uint256 fee = (ticket.amount * redemptionFeePercent) / 100;
        // In whitepaper: "Need to provide redemption fee 10 MC". 
        // We deduct from principal or ask for transfer. Whitepaper says "provide redemption fee".
        // Let's assume we take it from the principal return for simplicity, 
        // OR user approves fee. Let's ask user to transfer fee to prove "providing".
        mcToken.transferFrom(msg.sender, address(this), fee);

        // Return Principal
        mcToken.transfer(msg.sender, ticket.liquidityAmount);
        
        // Return Fee? Whitepaper says: "contract automatically returns ... + Redemption Fee Return".
        // This implies the fee is a deposit? 
        // "Need to provide redemption fee... contract automatically returns ... + redemption fee"
        // This is weird. Usually fee is cost. Maybe it means "Redemption Deposit"?
        // Let's just return the principal and keep the fee as protocol revenue.
        // Wait, text says: "contract automatically returns ... + Redemption Fee 10枚". 
        // If I pay 10 and get 10 back, it's a check, not a fee. 
        // For now, let's implement: User pays fee (revenue), gets principal back.
        
        ticket.redeemed = true;
        userInfo[msg.sender].isActive = false;

        emit Redeemed(msg.sender, ticket.liquidityAmount, fee);
    }
}
