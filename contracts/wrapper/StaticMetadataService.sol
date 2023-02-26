// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../root/Controllable.sol";
import "./IMetadataService.sol";

contract StaticMetadataService is Controllable, IERC165, IMetadataService{
    string private _uri;

    constructor(string memory _metaDataUri) {
        _uri = _metaDataUri;
    }

    function uri(uint256)
        public
        view
        override
        returns (string memory)
    {
        return _uri;
    }

    function setUri(string memory newUri) public onlyController {
        _uri = newUri;
    }

    function supportsInterface(bytes4 interfaceID)
        external
        pure
        override
        returns (bool)
    {
        return interfaceID == bytes4(keccak256("supportsInterface(bytes4)"));
    }
}
