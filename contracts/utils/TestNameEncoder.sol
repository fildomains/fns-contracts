// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./NameEncoder.sol";

contract TestNameEncoder {
    using NameEncoder for string;

    function encodeName(string memory name)
        public
        pure
        returns (bytes memory, bytes32)
    {
        return name.encode();
    }
}
