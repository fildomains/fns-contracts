// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

interface INameWrapperUpgrade {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external;

    function wrap2LD(
        string calldata label,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry,
        address resolver
    ) external;
}
