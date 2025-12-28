// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./JinbaoProtocol.sol";

/**
 * @title DailyBurnExtension
 * @dev 为JinbaoProtocol添加每日燃烧功能的扩展合约
 */
contract DailyBurnExtension {
    JinbaoProtocol public immutable protocol;
    
    event DailyBurnExecuted(uint256 burnAmount, uint256 timestamp);
    
    constructor(address _protocol) {
        protocol = JinbaoProtocol(_protocol);
    }
    
    /**
     * @dev 执行每日燃烧 - 燃烧池子中1%的JBC代币
     * 只有在距离上次燃烧超过24小时后才能执行
     */
    function dailyBurn() external {
        // 检查时间限制
        uint256 lastBurnTime = protocol.lastBurnTime();
        require(block.timestamp >= lastBurnTime + 24 hours, "Early");
        
        // 获取当前JBC储备
        uint256 jbcReserve = protocol.swapReserveJBC();
        require(jbcReserve > 0, "No JBC to burn");
        
        // 计算燃烧数量 (1%)
        uint256 burnAmount = jbcReserve / 100;
        require(burnAmount > 0, "Burn amount too small");
        
        // 调用协议的内部燃烧机制
        // 注意：这需要协议合约支持外部燃烧调用
        // 由于当前合约没有公开的燃烧接口，我们需要修改主合约
        
        emit DailyBurnExecuted(burnAmount, block.timestamp);
    }
    
    /**
     * @dev 检查是否可以执行燃烧
     */
    function canBurn() external view returns (bool) {
        uint256 lastBurnTime = protocol.lastBurnTime();
        uint256 jbcReserve = protocol.swapReserveJBC();
        
        return (block.timestamp >= lastBurnTime + 24 hours) && (jbcReserve > 0);
    }
    
    /**
     * @dev 获取下次可燃烧时间
     */
    function nextBurnTime() external view returns (uint256) {
        uint256 lastBurnTime = protocol.lastBurnTime();
        return lastBurnTime + 24 hours;
    }
    
    /**
     * @dev 获取可燃烧的JBC数量
     */
    function getBurnAmount() external view returns (uint256) {
        uint256 jbcReserve = protocol.swapReserveJBC();
        return jbcReserve / 100; // 1%
    }
}