// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../root/Controllable.sol";

contract Receiver is Controllable, IERC165 {
    IERC20 public token;

    receive() external payable{
    }

    constructor(address _token) {
        token = IERC20(_token);
    }

    function withdraw() payable public onlyController {
        payable(_msgSender()).transfer(address(this).balance);
        token.transfer(_msgSender(), token.balanceOf(address(this)));
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
