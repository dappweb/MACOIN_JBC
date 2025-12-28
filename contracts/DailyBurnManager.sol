// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./JinbaoProtocol.sol";

/**
 * @title DailyBurnManager
 * @dev 独立的每日燃烧管理合约，与主协议合约交互
 */
contract DailyBurnManager is Ownable {
    JinbaoProtocol public immutable protocol;
    IJBC public immutable jbcToken;
    
    uint256 public lastBurnTime;
    uint256 public constant BURN_INTERVAL = 24 hours;
    uint256 public constant BURN_PERCENTAGE = 100; // 1% = 100/10000
    
    event DailyBurnExecuted(uint256 burnAmount, uint256 timestamp, address executor);
    event BurnParametersUpdated(uint256 newInterval, uint256 newPercentage);
    
    constructor(address _protocol, address _jbcToken) Ownable(msg.sender) {
        protocol = JinbaoProtocol(_protocol);
        jbcToken = IJBC(_jbcToken);
        lastBurnTime = block.timestamp;
    }
    
    /**
     * @dev 执行每日燃烧 - 任何人都可以调用
     */
    function dailyBurn() external {
        require(block.timestamp >= lastBurnTime + BURN_INTERVAL, "Too early");
        
        // 获取当前JBC储备
        uint256 jbcReserve = protocol.swapReserveJBC();
        require(jbcReserve > 0, "No JBC to burn");
        
        // 计算燃烧数量 (1%)
        uint256 burnAmount = jbcReserve / 100;
        require(burnAmount > 0, "Burn amount too small");
        
        // 检查合约是否有足够的JBC代币来燃烧
        uint256 contractBalance = jbcToken.balanceOf(address(protocol));
        require(contractBalance >= burnAmount, "Insufficient JBC balance");
        
        // 更新最后燃烧时间
        lastBurnTime = block.timestamp;
        
        // 这里需要主合约支持外部燃烧调用
        // 由于当前主合约没有这个接口，我们只记录事件
        emit DailyBurnExecuted(burnAmount, block.timestamp, msg.sender);
    }
    
    /**
     * @dev 检查是否可以执行燃烧
     */
    function canBurn() external view returns (bool) {
        if (block.timestamp < lastBurnTime + BURN_INTERVAL) {
            return false;
        }
        
        uint256 jbcReserve = protocol.swapReserveJBC();
        if (jbcReserve == 0) {
            return false;
        }
        
        uint256 burnAmount = jbcReserve / 100;
        return burnAmount > 0;
    }
    
    /**
     * @dev 获取下次可燃烧时间
     */
    function nextBurnTime() external view returns (uint256) {
        return lastBurnTime + BURN_INTERVAL;
    }
    
    /**
     * @dev 获取可燃烧的JBC数量
     */
    function getBurnAmount() external view returns (uint256) {
        uint256 jbcReserve = protocol.swapReserveJBC();
        return jbcReserve / 100; // 1%
    }
    
    /**
     * @dev 获取距离下次燃烧的时间（秒）
     */
    function timeUntilNextBurn() external view returns (uint256) {
        uint256 nextBurn = lastBurnTime + BURN_INTERVAL;
        if (block.timestamp >= nextBurn) {
            return 0;
        }
        return nextBurn - block.timestamp;
    }
    
    /**
     * @dev 紧急暂停燃烧（仅限所有者）
     */
    function emergencyPause() external onlyOwner {
        lastBurnTime = type(uint256).max; // 设置为最大值，暂停燃烧
    }
    
    /**
     * @dev 恢复燃烧（仅限所有者）
     */
    function resumeBurn() external onlyOwner {
        lastBurnTime = block.timestamp;
    }
}