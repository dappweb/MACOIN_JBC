// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestSimple {
    uint256 public constant SECONDS_IN_UNIT = 60;
    
    function getSecondsInUnit() external pure returns (uint256) {
        return SECONDS_IN_UNIT;
    }
}