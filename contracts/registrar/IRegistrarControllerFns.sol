// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "./IPriceOracle.sol";
import "./IRegistrarController.sol";

interface IRegistrarControllerFns is IRegistrarController {
    function registerFns(
        string calldata name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) external returns (uint256);

    function renewFns(
        string calldata name,
        uint256 duration
    ) external returns (uint256, bytes32);
}

