// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {INameWrapperUpgrade} from "../INameWrapperUpgrade.sol";
import "../../registry/FNS.sol";
import "../../registrar/IBaseRegistrar.sol";
import {BytesUtils} from "../BytesUtils.sol";

contract UpgradedNameWrapperMock is INameWrapperUpgrade {
    using BytesUtils for bytes;

    bytes32 private constant FIL_NODE =
        0x78f6b1389af563cc5c91f234ea46b055e49658d8b999eeb9e0baef7dbbc93fdb;

    FNS public immutable fns;
    IBaseRegistrar public immutable registrar;

    constructor(FNS _fns, IBaseRegistrar _registrar) {
        fns = _fns;
        registrar = _registrar;
    }

    event NameUpgraded(
        bytes name,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry,
        bytes extraData
    );

    function wrapFromUpgrade(
        bytes calldata name,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry,
        bytes calldata extraData
    ) public {
        (bytes32 labelhash, uint256 offset) = name.readLabel(0);
        bytes32 parentNode = name.namehash(offset);
        bytes32 node = _makeNode(parentNode, labelhash);

        if (parentNode == FIL_NODE) {
            address registrant = registrar.ownerOf(uint256(labelhash));
            require(
                msg.sender == registrant &&
                    registrar.isApprovedForAll(registrant, address(this)),
                "No approval for registrar"
            );
        } else {
            address owner = fns.owner(node);
            require(
                msg.sender == owner &&
                    fns.isApprovedForAll(owner, address(this)),
                "No approval for registry"
            );
        }
        emit NameUpgraded(name, wrappedOwner, fuses, expiry, extraData);
    }

    function _makeNode(
        bytes32 node,
        bytes32 labelhash
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(node, labelhash));
    }
}
