// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface PublicSuffixList {
    function isPublicSuffix(bytes calldata name) external view returns (bool);
}
