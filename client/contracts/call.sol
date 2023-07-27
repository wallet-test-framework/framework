// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract Call {

    function add1(uint256 arg0) external pure returns (uint256) {
        return arg0 + 1;
    }
}
