// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract Emit {
    event Log(uint256 indexed arg0);
    event DifferentLog(uint256 indexed arg0);

    function logSomething(uint256 arg0) external {
        emit Log(arg0);
    }

    function logSomethingElse(uint256 arg0) external {
        emit DifferentLog(arg0);
    }
}
