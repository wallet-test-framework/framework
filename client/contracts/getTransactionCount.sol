// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
contract Dummy {
}
contract Deploy {
    function deploy() external {
        new Dummy();
    }
}
