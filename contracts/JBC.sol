// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JBC is ERC20, Ownable {
    // Burn address
    address public constant BLACK_HOLE = 0x000000000000000000000000000000000000dEaD;
    
    // LP Pair address to identify buy/sell
    address public uniswapV2Pair;
    
    // Protocol Contract Address (Exempt from tax and can mint/burn)
    address public protocolAddress;

    // Taxes
    uint256 public constant BUY_TAX = 50; // 50%
    uint256 public constant SELL_TAX = 25; // 25%

    constructor(address initialOwner) ERC20("Jinbao Coin", "JBC") Ownable(initialOwner) {
        // Initial mint: 100 million
        // 5 million to LP (should be handled by deployer/protocol)
        // 95 million to Protocol for Mining
        _mint(msg.sender, 100_000_000 * 10**decimals());
    }

    function setPair(address _pair) external onlyOwner {
        uniswapV2Pair = _pair;
    }

    function setProtocol(address _protocol) external onlyOwner {
        protocolAddress = _protocol;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Skip tax for owner, protocol, or if pair not set
        if (from == owner() || to == owner() || from == protocolAddress || to == protocolAddress || uniswapV2Pair == address(0)) {
            super._update(from, to, value);
            return;
        }

        uint256 taxAmount = 0;

        if (from == uniswapV2Pair) {
            // Buy
            taxAmount = (value * BUY_TAX) / 100;
        } else if (to == uniswapV2Pair) {
            // Sell
            taxAmount = (value * SELL_TAX) / 100;
        }

        if (taxAmount > 0) {
            // Burn the tax
            super._update(from, BLACK_HOLE, taxAmount);
            super._update(from, to, value - taxAmount);
        } else {
            super._update(from, to, value);
        }
    }

    // Allow protocol to burn tokens (e.g., daily deflation)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
