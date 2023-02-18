// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Interface for the legacy (FIL-only) addr function.
 */
interface IAddrResolver {
    event AddrChanged(bytes32 indexed node, address a);

    /**
     * Returns the address associated with an FNS node.
     * @param node The FNS node to query.
     * @return The associated address.
     */
    function addr(bytes32 node) external view returns (address payable);
}
