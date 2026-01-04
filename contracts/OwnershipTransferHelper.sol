// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OwnershipTransferHelper
 * @dev 用于帮助 JBC Token 合约转移协议合约 Owner 的辅助合约
 * 
 * 由于协议合约的 Owner 是 JBC Token 合约本身，而 JBC Token 合约没有调用协议合约的功能，
 * 这个辅助合约提供了一个解决方案：
 * 1. JBC Token Owner 部署此合约
 * 2. JBC Token Owner 调用此合约的 transferProtocolOwnership 函数
 * 3. 此合约会调用协议合约的 transferOwnership
 * 
 * 但是，由于协议 Owner 是 JBC Token 合约，而不是 JBC Token Owner，
 * 这个方案仍然无法直接工作。
 * 
 * 真正的解决方案是：需要先让 JBC Token 合约能够调用此合约，或者
 * 需要修改 JBC Token 合约以添加调用协议合约的功能。
 */
interface IProtocol {
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
}

contract OwnershipTransferHelper {
    address public immutable protocolAddress;
    address public immutable jbcTokenAddress;
    address public owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProtocolOwnershipTransferAttempted(address indexed newOwner);
    
    constructor(address _protocolAddress, address _jbcTokenAddress) {
        protocolAddress = _protocolAddress;
        jbcTokenAddress = _jbcTokenAddress;
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }
    
    /**
     * @dev 尝试转移协议合约的 Owner
     * @param newOwner 新的 Owner 地址
     * 
     * 注意：这个函数只有在协议 Owner 是此合约地址时才能成功。
     * 如果协议 Owner 是 JBC Token 合约，这个调用会失败。
     */
    function transferProtocolOwnership(address newOwner) external onlyOwner {
        IProtocol protocol = IProtocol(protocolAddress);
        
        // 检查当前协议 Owner
        address currentOwner = protocol.owner();
        require(currentOwner == address(this), "This contract is not the protocol owner");
        
        // 转移 Owner
        protocol.transferOwnership(newOwner);
        
        emit ProtocolOwnershipTransferAttempted(newOwner);
    }
    
    /**
     * @dev 检查协议 Owner 是否是此合约
     */
    function isProtocolOwner() external view returns (bool) {
        IProtocol protocol = IProtocol(protocolAddress);
        return protocol.owner() == address(this);
    }
    
    /**
     * @dev 检查协议 Owner 是否是 JBC Token 合约
     */
    function isJbcTokenProtocolOwner() external view returns (bool) {
        IProtocol protocol = IProtocol(protocolAddress);
        return protocol.owner() == jbcTokenAddress;
    }
}

