// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "./FERC20Votes.sol";
import "./FERC20Permit.sol";

import {IRegistrarController, IPriceOracle} from "../registrar/IRegistrarController.sol";
import {IRegistrarControllerFns} from "../registrar/IRegistrarControllerFns.sol";
import {IBulkRenewal} from "../registrar/IBulkRenewal.sol";
import {Sunday} from "./Sunday.sol";
import {Receiver} from "./Receiver.sol";

/**
 * An ERC20 token for FNS.
 *      All tokens are derived from airdrops of Filecoin domain names
 */
contract FNSToken is FERC20, FERC20Permit, FERC20Votes, Ownable, IRegistrarController, IBulkRenewal, IERC165 {
    IRegistrarControllerFns public controller;
    Sunday public sunday;
    Receiver public receiver;

    event Charge(
        string name,
        address indexed receiver,
        address indexed sunday,
        uint256 baseCost,
        uint256 premium,
        bool register
    );

    /**
     * @dev Constructor.
     */
    constructor(address _controller, address payable _sunday, address payable _receiver)
        FERC20("Filecoin Name Service", "FNS")
        FERC20Permit("Filecoin Name Service")
    {
        controller = IRegistrarControllerFns(_controller);
        sunday = Sunday(_sunday);
        receiver = Receiver(_receiver);
    }

    receive() external payable {
    }

    function receiveCall() external payable{
        payable(address(receiver)).transfer(msg.value/10);
        payable(address (sunday)).transfer(address(this).balance);
    }

    function pledge(uint256 amount) external {
        transfer(address (sunday), amount);
    }

    /**
     * @dev Mints new tokens.
     * @param dest The address to mint the new tokens to.
     * @param amount The quantity of tokens to mint.
     */
    function mint(address dest, uint256 amount) external onlyOwner {
        _mint(dest, amount);
    }

    function rentPrice(string memory name, uint256 duration)
        public
        view
        override
        returns (IPriceOracle.Price memory price)
    {
        return controller.rentPrice(name, duration);
    }

    function available(string memory name) public view override returns (bool) {
        return controller.available(name);
    }

    function makeCommitment(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) public view override returns (bytes32) {
        return controller.makeCommitment(
            name,
            owner,
            duration,
            secret,
            resolver,
            data,
            reverseRecord,
            ownerControlledFuses
        );
    }

    function commit(bytes32 commitment) public override {
        return controller.commit(commitment);
    }

    function _charge(string calldata name, uint256 duration, bool premium) internal returns (IPriceOracle.Price memory) {
        IPriceOracle.Price memory price = rentPrice(name, duration);
        uint256 amount = price.basePrice + (premium ? price.premiumPrice : 0);
        uint256 earnings = amount/10;

        _chargeTransfer(_msgSender(), address(receiver), earnings);
        _chargeTransfer(_msgSender(), address(sunday), amount - earnings);

        emit Charge(name, address(receiver), address(sunday), price.basePrice,  price.premiumPrice, premium);
        return price;
    }

    function register(
        string calldata name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) public payable override {
        require(msg.value == 0, "FNS: Please pay in FNS");

        IPriceOracle.Price memory price = _charge(name, duration, true);

        uint256 expires =  controller.registerFns(
            name,
            owner,
            duration,
            secret,
            resolver,
            data,
            reverseRecord,
            ownerControlledFuses
        );

        emit NameRegistered(
            name,
            keccak256(bytes(name)),
            owner,
            price.basePrice,
            price.premiumPrice,
            expires
        );
    }

    function renew(string calldata name, uint256 duration)
        external
        payable
        override
        returns (uint256, bytes32)
    {
        require(msg.value == 0, "FNS: Please pay in FNS");

        IPriceOracle.Price memory price = _charge(name, duration, false);
        (uint256 expires, bytes32 labelhash) =  controller.renewFns(name, duration);

        emit NameRenewed(name, labelhash, price.basePrice, expires);

        return (expires, labelhash);
    }

    // The following functions are overrides required by Solidity.
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(FERC20, FERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);

        if(to == address (sunday)){
            sunday.mint(from, amount);
        }
    }

    function _mint(address to, uint256 amount)
        internal
        override(FERC20, FERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(FERC20, FERC20Votes)
    {
        super._burn(account, amount);
    }

    function rentPrice(string[] calldata names, uint256 duration)
        external
        view
        override
        returns (uint256 total)
    {
        uint256 length = names.length;
        for (uint256 i = 0; i < length; ) {
            IPriceOracle.Price memory price = controller.rentPrice(
                names[i],
                duration
            );
            unchecked {
                ++i;
                total += (price.basePrice + price.premiumPrice);
            }
        }
    }

    function renewAll(string[] calldata names, uint256 duration)
        external
        payable
        override
    {
        require(msg.value == 0, "FNS: Please pay in FNS");

        uint256 length = names.length;
        uint256 total;
        for (uint256 i = 0; i < length; ) {
            IPriceOracle.Price memory price = _charge(names[i], duration, false);
            (uint256 expires, bytes32 labelhash) =  controller.renewFns(names[i], duration);

            emit NameRenewed(names[i], labelhash, price.basePrice, expires);

            unchecked {
                ++i;
                total += price.basePrice;
            }
        }
    }

    function supportsInterface(bytes4 interfaceID)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceID == type(IRegistrarController).interfaceId ||
            interfaceID == type(IERC20).interfaceId ||
            interfaceID == type(IERC20Permit).interfaceId ||
            interfaceID == type(IERC20Metadata).interfaceId ||
            interfaceID == type(IBulkRenewal).interfaceId;
    }
}