// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./FNS.sol";

/**
 * A registrar that allocates subdomains to the first person to claim them, but
 * expires registrations a fixed period after they're initially claimed.
 */
contract TestRegistrar {
    uint256 constant registrationPeriod = 4 weeks;

    FNS public immutable fns;
    bytes32 public immutable rootNode;
    mapping(bytes32 => uint256) public expiryTimes;

    /**
     * Constructor.
     * @param ensAddr The address of the FNS registry.
     * @param node The node that this registrar administers.
     */
    constructor(FNS ensAddr, bytes32 node) {
        fns = ensAddr;
        rootNode = node;
    }

    /**
     * Register a name that's not currently registered
     * @param label The hash of the label to register.
     * @param owner The address of the new owner.
     */
    function register(bytes32 label, address owner) public {
        require(expiryTimes[label] < block.timestamp);

        expiryTimes[label] = block.timestamp + registrationPeriod;
        fns.setSubnodeOwner(rootNode, label, owner);
    }
}
