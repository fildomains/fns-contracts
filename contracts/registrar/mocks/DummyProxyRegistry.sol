// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract DummyProxyRegistry {
    address target;

    constructor(address _target) {
        target = _target;
    }

    function proxies(address) external view returns (address) {
        return target;
    }
}
