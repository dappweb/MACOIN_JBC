// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title JBC Migration Contract
 * @dev 用于从旧 JBC 代币迁移到新 JBCv2 代币的合约
 * 
 * 功能:
 * - 1:1 比例代币兑换
 * - 安全的迁移流程
 * - 迁移统计和事件记录
 * - 紧急暂停功能
 */
contract JBCMigration is Ownable, ReentrancyGuard {
    
    // =============================================================================
    // 状态变量
    // =============================================================================
    
    IERC20 public immutable oldJBC;    // 旧 JBC 代币合约
    IERC20 public immutable newJBC;    // 新 JBCv2 代币合约
    
    bool public migrationEnabled;      // 迁移开关
    uint256 public totalMigrated;      // 总迁移数量
    uint256 public migrationCount;     // 迁移次数
    
    // 用户迁移记录
    mapping(address => uint256) public userMigrated;
    mapping(address => uint256) public userMigrationTime;
    
    // =============================================================================
    // 事件定义
    // =============================================================================
    
    event Migration(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event MigrationEnabled(bool enabled);
    event EmergencyWithdraw(address token, uint256 amount);
    
    // =============================================================================
    // 构造函数
    // =============================================================================
    
    constructor(
        address _oldJBC,
        address _newJBC
    ) Ownable(msg.sender) {
        require(_oldJBC != address(0), "Invalid old JBC address");
        require(_newJBC != address(0), "Invalid new JBC address");
        
        oldJBC = IERC20(_oldJBC);
        newJBC = IERC20(_newJBC);
        migrationEnabled = true;
        
        emit MigrationEnabled(true);
    }
    
    // =============================================================================
    // 迁移功能
    // =============================================================================
    
    /**
     * @dev 迁移代币 (1:1 比例)
     * @param amount 迁移数量
     */
    function migrate(uint256 amount) external nonReentrant {
        require(migrationEnabled, "Migration disabled");
        require(amount > 0, "Amount must be greater than 0");
        
        // 检查用户旧代币余额
        uint256 userBalance = oldJBC.balanceOf(msg.sender);
        require(userBalance >= amount, "Insufficient old JBC balance");
        
        // 检查合约新代币余额
        uint256 contractBalance = newJBC.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient new JBC in contract");
        
        // 转移旧代币到合约
        require(
            oldJBC.transferFrom(msg.sender, address(this), amount),
            "Old JBC transfer failed"
        );
        
        // 转移新代币给用户
        require(
            newJBC.transfer(msg.sender, amount),
            "New JBC transfer failed"
        );
        
        // 更新统计
        userMigrated[msg.sender] += amount;
        userMigrationTime[msg.sender] = block.timestamp;
        totalMigrated += amount;
        migrationCount++;
        
        emit Migration(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev 批量迁移 (为多个用户)
     * @param users 用户地址数组
     * @param amounts 迁移数量数组
     */
    function batchMigrate(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(migrationEnabled, "Migration disabled");
        require(users.length == amounts.length, "Array length mismatch");
        require(users.length <= 100, "Too many users");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // 检查合约新代币余额
        uint256 contractBalance = newJBC.balanceOf(address(this));
        require(contractBalance >= totalAmount, "Insufficient new JBC in contract");
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = amounts[i];
            
            if (amount == 0) continue;
            
            // 检查用户旧代币余额
            uint256 userBalance = oldJBC.balanceOf(user);
            if (userBalance < amount) continue;
            
            // 转移旧代币到合约 (需要用户预先授权)
            if (oldJBC.transferFrom(user, address(this), amount)) {
                // 转移新代币给用户
                require(newJBC.transfer(user, amount), "New JBC transfer failed");
                
                // 更新统计
                userMigrated[user] += amount;
                userMigrationTime[user] = block.timestamp;
                totalMigrated += amount;
                migrationCount++;
                
                emit Migration(user, amount, block.timestamp);
            }
        }
    }
    
    // =============================================================================
    // 管理功能
    // =============================================================================
    
    /**
     * @dev 设置迁移开关
     * @param enabled 是否启用迁移
     */
    function setMigrationEnabled(bool enabled) external onlyOwner {
        migrationEnabled = enabled;
        emit MigrationEnabled(enabled);
    }
    
    /**
     * @dev 向合约充值新代币 (用于迁移)
     * @param amount 充值数量
     */
    function fundContract(uint256 amount) external onlyOwner {
        require(
            newJBC.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }
    
    /**
     * @dev 紧急提取代币
     * @param token 代币地址
     * @param amount 提取数量
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        
        IERC20(token).transfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
    
    /**
     * @dev 销毁收集的旧代币
     * @param amount 销毁数量
     */
    function burnOldTokens(uint256 amount) external onlyOwner {
        uint256 balance = oldJBC.balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        // 如果旧代币支持燃烧，调用 burn 函数
        // 否则发送到黑洞地址
        try IERC20(oldJBC).transfer(0x000000000000000000000000000000000000dEaD, amount) {
            // 成功发送到黑洞地址
        } catch {
            // 如果失败，保留在合约中
            revert("Burn failed");
        }
    }
    
    // =============================================================================
    // 视图函数
    // =============================================================================
    
    /**
     * @dev 获取迁移统计信息
     */
    function getMigrationStats() external view returns (
        uint256 totalMigrated_,
        uint256 migrationCount_,
        uint256 oldTokenBalance,
        uint256 newTokenBalance,
        bool enabled
    ) {
        return (
            totalMigrated,
            migrationCount,
            oldJBC.balanceOf(address(this)),
            newJBC.balanceOf(address(this)),
            migrationEnabled
        );
    }
    
    /**
     * @dev 获取用户迁移信息
     * @param user 用户地址
     */
    function getUserMigrationInfo(address user) external view returns (
        uint256 migrated,
        uint256 migrationTime,
        uint256 oldBalance,
        uint256 newBalance
    ) {
        return (
            userMigrated[user],
            userMigrationTime[user],
            oldJBC.balanceOf(user),
            newJBC.balanceOf(user)
        );
    }
    
    /**
     * @dev 检查用户是否可以迁移指定数量
     * @param user 用户地址
     * @param amount 迁移数量
     */
    function canMigrate(address user, uint256 amount) external view returns (
        bool canMigrate_,
        string memory reason
    ) {
        if (!migrationEnabled) {
            return (false, "Migration disabled");
        }
        
        if (amount == 0) {
            return (false, "Amount must be greater than 0");
        }
        
        uint256 userBalance = oldJBC.balanceOf(user);
        if (userBalance < amount) {
            return (false, "Insufficient old JBC balance");
        }
        
        uint256 contractBalance = newJBC.balanceOf(address(this));
        if (contractBalance < amount) {
            return (false, "Insufficient new JBC in contract");
        }
        
        uint256 allowance = oldJBC.allowance(user, address(this));
        if (allowance < amount) {
            return (false, "Insufficient allowance");
        }
        
        return (true, "Can migrate");
    }
    
    /**
     * @dev 获取迁移进度
     */
    function getMigrationProgress() external view returns (
        uint256 totalOldSupply,
        uint256 totalMigrated_,
        uint256 migrationPercentage,
        uint256 remainingToMigrate
    ) {
        // 注意: 这里假设旧代币有 totalSupply 函数
        try IERC20(oldJBC).totalSupply() returns (uint256 supply) {
            totalOldSupply = supply;
            totalMigrated_ = totalMigrated;
            
            if (totalOldSupply > 0) {
                migrationPercentage = (totalMigrated * 10000) / totalOldSupply; // 基点 (0.01%)
                remainingToMigrate = totalOldSupply - totalMigrated;
            }
        } catch {
            // 如果获取失败，返回 0
            totalOldSupply = 0;
            totalMigrated_ = totalMigrated;
            migrationPercentage = 0;
            remainingToMigrate = 0;
        }
        
        return (totalOldSupply, totalMigrated_, migrationPercentage, remainingToMigrate);
    }
}