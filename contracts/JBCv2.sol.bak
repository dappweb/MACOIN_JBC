// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title JBC Token v2.0
 * @dev 重新设计的 JBC 代币，具备完整的 DeFi 功能
 * 
 * 主要特性:
 * - 保持现有税收机制 (买入50%/卖出25%)
 * - 链上治理投票功能
 * - 质押和奖励系统 (7/15/30天周期)
 * - 跨链桥接支持
 * - 安全和合规功能
 * - Gas 优化的批量操作
 */
contract JBCv2 is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // =============================================================================
    // 常量定义
    // =============================================================================
    
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 10亿上限
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 1亿初始
    string public constant VERSION = "2.0";
    
    // 税收配置 (保持现有比例)
    uint256 public constant DEFAULT_BUY_TAX = 5000;   // 50%
    uint256 public constant DEFAULT_SELL_TAX = 2500;  // 25%
    uint256 public constant DEFAULT_TRANSFER_TAX = 0; // 0% (普通转账免税)
    uint256 public constant TAX_DENOMINATOR = 10000;  // 100%
    
    // =============================================================================
    // 状态变量
    // =============================================================================
    
    // 税收配置
    struct TaxConfig {
        uint256 buyTax;
        uint256 sellTax;
        uint256 transferTax;
        bool enabled;
    }
    
    TaxConfig public taxConfig;
    
    // 税收分配
    struct TaxDistribution {
        uint256 burnPercentage;      // 燃烧比例
        uint256 liquidityPercentage; // 流动性比例
        uint256 treasuryPercentage;  // 国库比例
        uint256 marketingPercentage; // 营销比例
    }
    
    TaxDistribution public taxDistribution;
    
    // 地址管理
    mapping(address => bool) public taxExempt;        // 免税地址
    mapping(address => bool) public liquidityPairs;  // 流动性对
    mapping(address => bool) public minters;          // 铸造权限
    mapping(address => bool) public blacklisted;     // 黑名单
    
    // 限制配置
    uint256 public maxTransferAmount;    // 最大转账量
    uint256 public maxWalletAmount;      // 最大钱包持有量
    mapping(address => bool) public limitExempt; // 限制豁免
    
    // 质押系统
    struct StakingInfo {
        uint256 stakedAmount;
        uint256 stakingTime;
        uint256 lockPeriod;
        uint256 rewardDebt;
    }
    
    mapping(address => StakingInfo) public stakingInfo;
    uint256 public totalStaked;
    uint256 public stakingRewardRate; // 每秒奖励率
    uint256 public lastRewardTime;
    uint256 public accRewardPerShare;
    
    // 燃烧统计
    uint256 public totalBurned;
    uint256 public dailyBurnAmount;
    uint256 public lastBurnTime;
    
    // 钱包地址
    address public treasuryWallet;
    address public marketingWallet;
    address public liquidityWallet;
    
    // =============================================================================
    // 事件定义
    // =============================================================================
    
    event TaxConfigUpdated(uint256 buyTax, uint256 sellTax, uint256 transferTax);
    event TaxDistributionUpdated(uint256 burn, uint256 liquidity, uint256 treasury, uint256 marketing);
    event TaxExemptUpdated(address indexed account, bool exempt);
    event LiquidityPairUpdated(address indexed pair, bool isPair);
    event Blacklisted(address indexed account, bool blacklisted);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event BatchTransfer(address indexed from, uint256 totalAmount, uint256 recipientCount);
    
    // =============================================================================
    // 初始化和升级
    // =============================================================================
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _owner,
        address _treasuryWallet,
        address _marketingWallet,
        address _liquidityWallet
    ) public initializer {
        __ERC20_init("Jinbao Coin", "JBC");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __ERC20Permit_init("Jinbao Coin");
        __ERC20Votes_init();
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        // 设置钱包地址
        treasuryWallet = _treasuryWallet;
        marketingWallet = _marketingWallet;
        liquidityWallet = _liquidityWallet;
        
        // 初始化税收配置
        taxConfig = TaxConfig({
            buyTax: DEFAULT_BUY_TAX,
            sellTax: DEFAULT_SELL_TAX,
            transferTax: DEFAULT_TRANSFER_TAX,
            enabled: true
        });
        
        // 初始化税收分配 (总计100%)
        taxDistribution = TaxDistribution({
            burnPercentage: 4000,      // 40%
            liquidityPercentage: 3000, // 30%
            treasuryPercentage: 2000,  // 20%
            marketingPercentage: 1000  // 10%
        });
        
        // 设置限制
        maxTransferAmount = INITIAL_SUPPLY / 100; // 1% 最大转账
        maxWalletAmount = INITIAL_SUPPLY / 50;    // 2% 最大持有
        
        // 设置质押奖励率 (年化10%)
        stakingRewardRate = 10 * 10**18 / 365 days / 100; // 每秒奖励率
        lastRewardTime = block.timestamp;
        
        // 免税设置
        taxExempt[_owner] = true;
        taxExempt[address(this)] = true;
        taxExempt[_treasuryWallet] = true;
        taxExempt[_marketingWallet] = true;
        taxExempt[_liquidityWallet] = true;
        
        // 限制豁免
        limitExempt[_owner] = true;
        limitExempt[address(this)] = true;
        limitExempt[_treasuryWallet] = true;
        limitExempt[_marketingWallet] = true;
        limitExempt[_liquidityWallet] = true;
        
        // 铸造权限
        minters[_owner] = true;
        
        // 初始铸造
        _mint(_owner, INITIAL_SUPPLY);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // =============================================================================
    // 税收管理
    // =============================================================================
    
    function setTaxConfig(uint256 _buyTax, uint256 _sellTax, uint256 _transferTax) external onlyOwner {
        require(_buyTax <= 5000 && _sellTax <= 2500 && _transferTax <= 0, "Tax too high"); // 最大50%/25%/0%
        
        taxConfig.buyTax = _buyTax;
        taxConfig.sellTax = _sellTax;
        taxConfig.transferTax = _transferTax;
        
        emit TaxConfigUpdated(_buyTax, _sellTax, _transferTax);
    }
    
    function setTaxEnabled(bool _enabled) external onlyOwner {
        taxConfig.enabled = _enabled;
    }
    
    function setTaxDistribution(
        uint256 _burn,
        uint256 _liquidity,
        uint256 _treasury,
        uint256 _marketing
    ) external onlyOwner {
        require(_burn + _liquidity + _treasury + _marketing == 10000, "Must equal 100%");
        
        taxDistribution.burnPercentage = _burn;
        taxDistribution.liquidityPercentage = _liquidity;
        taxDistribution.treasuryPercentage = _treasury;
        taxDistribution.marketingPercentage = _marketing;
        
        emit TaxDistributionUpdated(_burn, _liquidity, _treasury, _marketing);
    }
    
    function setTaxExempt(address account, bool exempt) external onlyOwner {
        taxExempt[account] = exempt;
        emit TaxExemptUpdated(account, exempt);
    }
    
    function setLiquidityPair(address pair, bool isPair) external onlyOwner {
        liquidityPairs[pair] = isPair;
        emit LiquidityPairUpdated(pair, isPair);
    }
    
    // =============================================================================
    // 转账逻辑 (含税收)
    // =============================================================================
    
    function _update(address from, address to, uint256 value) internal override {
        // 检查黑名单
        require(!blacklisted[from] && !blacklisted[to], "Blacklisted address");
        
        // 检查限制
        if (!limitExempt[to] && to != address(0)) {
            require(balanceOf(to) + value <= maxWalletAmount, "Exceeds max wallet");
        }
        
        if (!limitExempt[from] && from != address(0)) {
            require(value <= maxTransferAmount, "Exceeds max transfer");
        }
        
        // 如果免税或税收未启用，直接转账
        if (!taxConfig.enabled || taxExempt[from] || taxExempt[to] || from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        
        uint256 taxAmount = 0;
        
        // 计算税收
        if (liquidityPairs[from]) {
            // 买入
            taxAmount = (value * taxConfig.buyTax) / TAX_DENOMINATOR;
        } else if (liquidityPairs[to]) {
            // 卖出
            taxAmount = (value * taxConfig.sellTax) / TAX_DENOMINATOR;
        } else {
            // 普通转账
            taxAmount = (value * taxConfig.transferTax) / TAX_DENOMINATOR;
        }
        
        if (taxAmount > 0) {
            // 收取税收
            super._update(from, address(this), taxAmount);
            
            // 分配税收
            _distributeTax(taxAmount);
            
            // 转账剩余金额
            super._update(from, to, value - taxAmount);
        } else {
            super._update(from, to, value);
        }
    }
    
    function _distributeTax(uint256 taxAmount) internal {
        uint256 burnAmount = (taxAmount * taxDistribution.burnPercentage) / 10000;
        uint256 liquidityAmount = (taxAmount * taxDistribution.liquidityPercentage) / 10000;
        uint256 treasuryAmount = (taxAmount * taxDistribution.treasuryPercentage) / 10000;
        uint256 marketingAmount = taxAmount - burnAmount - liquidityAmount - treasuryAmount;
        
        // 燃烧
        if (burnAmount > 0) {
            _burn(address(this), burnAmount);
            totalBurned += burnAmount;
        }
        
        // 转账到各个钱包
        if (liquidityAmount > 0) {
            super._update(address(this), liquidityWallet, liquidityAmount);
        }
        
        if (treasuryAmount > 0) {
            super._update(address(this), treasuryWallet, treasuryAmount);
        }
        
        if (marketingAmount > 0) {
            super._update(address(this), marketingWallet, marketingAmount);
        }
    }
    
    // =============================================================================
    // 质押系统
    // =============================================================================
    
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        require(lockPeriod >= 7 days, "Minimum 7 days lock");
        require(lockPeriod <= 365 days, "Maximum 365 days lock");
        
        _updateReward();
        
        StakingInfo storage info = stakingInfo[msg.sender];
        
        // 如果已有质押，先领取奖励
        if (info.stakedAmount > 0) {
            _claimReward(msg.sender);
        }
        
        // 转移代币到合约
        _transfer(msg.sender, address(this), amount);
        
        // 更新质押信息
        info.stakedAmount += amount;
        info.stakingTime = block.timestamp;
        info.lockPeriod = lockPeriod;
        info.rewardDebt = (info.stakedAmount * accRewardPerShare) / 1e12;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external nonReentrant {
        StakingInfo storage info = stakingInfo[msg.sender];
        require(info.stakedAmount >= amount, "Insufficient staked");
        require(block.timestamp >= info.stakingTime + info.lockPeriod, "Still locked");
        
        _updateReward();
        _claimReward(msg.sender);
        
        info.stakedAmount -= amount;
        info.rewardDebt = (info.stakedAmount * accRewardPerShare) / 1e12;
        totalStaked -= amount;
        
        // 转回代币
        _transfer(address(this), msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    function claimReward() external nonReentrant {
        _updateReward();
        _claimReward(msg.sender);
    }
    
    function _updateReward() internal {
        if (block.timestamp <= lastRewardTime || totalStaked == 0) {
            return;
        }
        
        uint256 timeElapsed = block.timestamp - lastRewardTime;
        uint256 reward = timeElapsed * stakingRewardRate * totalStaked;
        
        // 铸造奖励代币
        if (totalSupply() + reward <= MAX_SUPPLY) {
            _mint(address(this), reward);
            accRewardPerShare += (reward * 1e12) / totalStaked;
        }
        
        lastRewardTime = block.timestamp;
    }
    
    function _claimReward(address user) internal {
        StakingInfo storage info = stakingInfo[user];
        if (info.stakedAmount == 0) return;
        
        uint256 pending = (info.stakedAmount * accRewardPerShare) / 1e12 - info.rewardDebt;
        if (pending > 0) {
            _transfer(address(this), user, pending);
            emit RewardClaimed(user, pending);
        }
        
        info.rewardDebt = (info.stakedAmount * accRewardPerShare) / 1e12;
    }
    
    function pendingReward(address user) external view returns (uint256) {
        StakingInfo storage info = stakingInfo[user];
        if (info.stakedAmount == 0 || totalStaked == 0) return 0;
        
        uint256 tempAccRewardPerShare = accRewardPerShare;
        if (block.timestamp > lastRewardTime) {
            uint256 timeElapsed = block.timestamp - lastRewardTime;
            uint256 reward = timeElapsed * stakingRewardRate * totalStaked;
            tempAccRewardPerShare += (reward * 1e12) / totalStaked;
        }
        
        return (info.stakedAmount * tempAccRewardPerShare) / 1e12 - info.rewardDebt;
    }
    
    // =============================================================================
    // 管理功能
    // =============================================================================
    
    function setBlacklisted(address account, bool _blacklisted) external onlyOwner {
        blacklisted[account] = _blacklisted;
        emit Blacklisted(account, _blacklisted);
    }
    
    function setLimits(uint256 _maxTransfer, uint256 _maxWallet) external onlyOwner {
        require(_maxTransfer >= totalSupply() / 1000, "Too restrictive"); // 最少0.1%
        require(_maxWallet >= totalSupply() / 100, "Too restrictive");    // 最少1%
        
        maxTransferAmount = _maxTransfer;
        maxWalletAmount = _maxWallet;
    }
    
    function setLimitExempt(address account, bool exempt) external onlyOwner {
        limitExempt[account] = exempt;
    }
    
    function setMinter(address account, bool canMint) external onlyOwner {
        minters[account] = canMint;
    }
    
    function mint(address to, uint256 amount) external {
        require(minters[msg.sender], "Not authorized");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
    
    function setWallets(
        address _treasury,
        address _marketing,
        address _liquidity
    ) external onlyOwner {
        treasuryWallet = _treasury;
        marketingWallet = _marketing;
        liquidityWallet = _liquidity;
    }
    
    // =============================================================================
    // 批量操作 (Gas 优化)
    // =============================================================================
    
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 100, "Too many recipients");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(balanceOf(msg.sender) >= totalAmount, "Insufficient balance");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
        
        emit BatchTransfer(msg.sender, totalAmount, recipients.length);
    }
    
    // =============================================================================
    // 紧急功能
    // =============================================================================
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot withdraw JBC");
        IERC20(token).transfer(owner(), amount);
    }
    
    // =============================================================================
    // 视图函数
    // =============================================================================
    
    function getStakingInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 stakingTime,
        uint256 lockPeriod,
        uint256 pendingRewards,
        bool canUnstake
    ) {
        StakingInfo storage info = stakingInfo[user];
        return (
            info.stakedAmount,
            info.stakingTime,
            info.lockPeriod,
            this.pendingReward(user),
            block.timestamp >= info.stakingTime + info.lockPeriod
        );
    }
    
    function getTaxInfo() external view returns (
        uint256 buyTax,
        uint256 sellTax,
        uint256 transferTax,
        bool enabled
    ) {
        return (
            taxConfig.buyTax,
            taxConfig.sellTax,
            taxConfig.transferTax,
            taxConfig.enabled
        );
    }
    
    function getSupplyInfo() external view returns (
        uint256 totalSupply_,
        uint256 maxSupply_,
        uint256 totalBurned_,
        uint256 circulatingSupply
    ) {
        return (
            totalSupply(),
            MAX_SUPPLY,
            totalBurned,
            totalSupply() - balanceOf(address(0)) - balanceOf(address(0xdead))
        );
    }
    
    // =============================================================================
    // 重写必要函数
    // =============================================================================
    
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20VotesUpgradeable)
    {
        super._update(from, to, value);
    }
    
    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}