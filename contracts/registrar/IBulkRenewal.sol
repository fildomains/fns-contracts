// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
interface IBulkRenewal {
    function rentPrice(
        string[] calldata names,
        uint256 duration
    ) external view returns (uint256 total, uint256 totalFns);

    function renewAll(
        string[] calldata names,
        uint256 duration
    ) external payable;
}
