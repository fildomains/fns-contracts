// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "../registry/FNS.sol";
import "../resolvers/Resolver.sol";
import {INameWrapper} from "../wrapper/INameWrapper.sol";

/**
 * @dev An ERC20 token for FNS lock.
 */
contract Sunday is ERC20Pausable, Ownable, IERC165 {
    bytes32 private constant FIL_NAMEHASH =
    0x78f6b1389af563cc5c91f234ea46b055e49658d8b999eeb9e0baef7dbbc93fdb;

    struct share {
        uint256 fil;
        uint256 fns;
        bool inited;
    }

    FNS public immutable fns;
    mapping(uint64 => share) private _shares;
    mapping(uint64 => mapping(address=> share)) private _earnings;

    IERC20 public token;
    /**
     * @dev Constructor.
     */
    constructor(FNS _fns, address _fnsToken)
        ERC20("Sunday", "SUN")
    {
        fns = _fns;
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
        uint256 indexed tokenId,
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
        uint64 _week = week();
        require(_shares[_week].inited == false, "SUN: inined");

        return _initShare(_week);
    }

    function _initShare(uint64 _week) internal returns (uint64) {
        if(_shares[_week].inited  == false){
            uint256 fil = address(this).balance / 64;

            require(token.balanceOf(address (this)) >= totalSupply(), "SUN: balance must gte totalSupply");
            uint256 fnsAmount = (token.balanceOf(address (this)) - totalSupply()) / 64;
            _shares[_week] = share({fil: fil, fns: fnsAmount, inited: true});
            emit Init(_week, fil, fnsAmount);
        }

        return _week;
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

    function withdrawal(uint256 amount)
        external
        whenNotPaused
    {
        _burn(msg.sender, amount);
        token.transfer(msg.sender, amount);
    }

    function getShare(uint64 _week)
        external
        view
        returns (share memory)
    {
        return _shares[0 == _week ? week() : _week];
    }

    function getEarnings(uint64 _week, address addr)
        external
        view
        returns (share memory)
    {
        return _earnings[0 == _week ? week() : _week][addr];
    }

    function getNameWrapper() public view returns (INameWrapper) {
        Resolver r = Resolver(fns.resolver(FIL_NAMEHASH));

        return INameWrapper(
            r.interfaceImplementer(
                FIL_NAMEHASH,
                type(INameWrapper).interfaceId
            )
        );
    }

    function claimEarnings(uint256 tokenId)
        external
        whenPaused
    {
        INameWrapper nameWrapper = getNameWrapper();
        address account = nameWrapper.ownerOf(tokenId);
        require(account != address(0), "SUN: claimEarnings to the zero address");

        uint64 _week = week();
        _initShare(_week);
        require(_earnings[_week][account].inited == false, "SUN: already claim earnings");

        require(totalSupply() > 0, "SUN: totalSupply to the zero");

        uint256 fil = (_shares[_week].fil * balanceOf(account)) / totalSupply();
        if(fil > 0){
            payable(account).transfer(fil);
        }

        uint256 fnsAmount = (_shares[_week].fns * balanceOf(account)) / totalSupply();
        if(fnsAmount > 0){
            token.transfer(account, fnsAmount);
        }

        _earnings[_week][account] = share({fil: fil, fns: fnsAmount, inited: true});
        emit Earnings(tokenId, account, _week, fil, fnsAmount);
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