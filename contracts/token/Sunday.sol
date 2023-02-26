// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @dev An ERC20 token for FNS lock.
 */
contract Sunday is ERC20Pausable, Ownable, IERC165 {
    struct share {
        uint256 fil;
        uint256 fns;
        bool inited;
    }

    mapping(uint64 => share) private _shares;
    mapping(uint64 => mapping(address=> share)) private _earnings;

    IERC20 public token;
    /**
     * @dev Constructor.
     */
    constructor(address _fnsToken)
        ERC20("Sunday", "SUN")
    {
        token = IERC20(_fnsToken);
    }

    receive() external payable {
    }

    event Init(
        uint64 week,
        uint256 fil,
        uint256 fns
    );

    event Earnings(
        address indexed addr,
        uint64 week,
        uint256 fil,
        uint256 fns
    );

    /**
     * @dev Mints new tokens.
     * @param dest The address to mint the new tokens to.
     * @param amount The quantity of tokens to mint.
     */
    function mint(address dest, uint256 amount)
        external
        onlyOwner
    {
        _mint(dest, amount);
    }

    function initShare() public whenPaused returns (uint64) {
        uint64 w = week();
        require(_shares[w].inited == false, "SUN: inined");

        return _initShare(w);
    }

    function _initShare(uint64 w) internal returns (uint64) {
        if(_shares[w].inited  == false){
            uint256 fil = address(this).balance / 64;

            require(token.balanceOf(address (this)) >= totalSupply(), "SUN: share must have");
            uint256 fnsAmount = (token.balanceOf(address (this)) - totalSupply()) / 64;
            _shares[w] = share({fil: fil, fns: fnsAmount, inited: true});
            emit Init(w, fil, fnsAmount);
        }

        return w;
    }

    function week() view public returns (uint64){
        return day()/7;
    }

    function day() view public returns (uint64){
        return uint64(block.timestamp/(24*3600) + 4);
    }

    function paused() public view override returns (bool) {
        return uint64(0) != uint64(day() % 7);
    }

    function withdrawal (uint256 amount)
        external
        whenNotPaused
    {
        _burn(msg.sender, amount);
        token.transfer(msg.sender, amount);
    }

    function getShare(uint64 w)
        external
        view
        returns (share memory)
    {
        return _shares[w];
    }

    function getEarnings(uint64 w, address addr)
        external
        view
        returns (share memory)
    {
        return _earnings[w][addr];
    }

    function claimEarnings()
        external
        whenPaused
    {
        uint64 w = week();
        _initShare(w);
        require(_earnings[w][_msgSender()].inited == false, "SUN: already claim earnings");

        uint256 fil = (_shares[w].fil * balanceOf(_msgSender())) / totalSupply();
        if(fil > 0){
            payable(address (_msgSender())).transfer(fil);
        }

        uint256 fnsAmount = (_shares[w].fns * balanceOf(_msgSender())) / totalSupply();
        if(fnsAmount > 0){
            token.transfer(_msgSender(), fnsAmount);
        }

        _earnings[w][_msgSender()] = share({fil: fil, fns: fnsAmount, inited: true});
        emit Earnings(_msgSender(), w, fil, fnsAmount);
    }

    function supportsInterface(bytes4 interfaceID)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceID == type(IERC20).interfaceId ||
            interfaceID == type(IERC20Metadata).interfaceId;
    }
}