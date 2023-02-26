// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../root/Controllable.sol";

contract DummyOracle is Controllable, IERC165 {
    int256 value;

    constructor(int256 _value) public {
        value = _value;
    }

    function set(int256 _value) public onlyController {
        value = _value;
    }

    function latestAnswer() public view returns (int256) {
        return value;
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
