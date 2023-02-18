// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "./IPriceOracle.sol";
import "./SafeMath.sol";
import "./StringUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface AggregatorInterface {
    function latestAnswer() external view returns (int256);
}

// StablePriceOracle sets a price in USD, based on an oracle.
contract StablePriceOracle is IPriceOracle, Ownable {
    using SafeMath for *;
    using StringUtils for *;

    // Rent in base price units by length
    uint256 public immutable price1Letter;
    uint256 public immutable price2Letter;
    uint256 public immutable price3Letter;
    uint256 public immutable price4Letter;
    uint256 public immutable price5Letter;

    // Oracle address
    AggregatorInterface public usdOracle;

    event RentPriceChanged(uint256[] prices);
    event SetOracle(address indexed old, address current);

    constructor(AggregatorInterface _usdOracle, uint256[] memory _rentPrices) {
        usdOracle = _usdOracle;
        price1Letter = _rentPrices[0];
        price2Letter = _rentPrices[1];
        price3Letter = _rentPrices[2];
        price4Letter = _rentPrices[3];
        price5Letter = _rentPrices[4];
    }

    function setOracle(AggregatorInterface oracle) external onlyOwner{
        emit SetOracle(address (usdOracle), address (oracle));

        usdOracle = oracle;
    }

    function price(
        string calldata name,
        uint256 expires,
        uint256 duration
    ) external view override returns (IPriceOracle.Price memory) {
        uint256 len = name.strlen();
        uint256 basePrice;
        uint256 priceLetter;

        if (len >= 5) {
            priceLetter = price5Letter;
        } else if (len == 4) {
            priceLetter = price4Letter;
        } else if (len == 3) {
            priceLetter = price3Letter;
        } else if (len == 2) {
            priceLetter = price2Letter;
        } else {
            priceLetter = price1Letter;
        }

        basePrice = priceLetter * duration;
        uint256 premiumPrice = _premium(name, expires, duration);
        return
            IPriceOracle.Price({
                basePrice: basePrice,
                premiumPrice: premiumPrice,
                base: attoUSDToWei(basePrice),
                premium: attoUSDToWei(premiumPrice)
            });
    }

    /**
     * @dev Returns the pricing premium in wei.
     */
    function premium(
        string calldata name,
        uint256 expires,
        uint256 duration
    ) external view returns (uint256) {
        return attoUSDToWei(_premium(name, expires, duration));
    }

    /**
     * @dev Returns the pricing premium in internal base units.
     */
    function _premium(
        string memory name,
        uint256 expires,
        uint256 duration
    ) internal view virtual returns (uint256) {
        return 0;
    }

    function attoUSDToWei(uint256 amount) internal view returns (uint256) {
        uint256 ethPrice = uint256(usdOracle.latestAnswer());
        return (amount * 1e8) / ethPrice;
    }

    function weiToAttoUSD(uint256 amount) internal view returns (uint256) {
        uint256 ethPrice = uint256(usdOracle.latestAnswer());
        return (amount * ethPrice) / 1e8;
    }

    function supportsInterface(bytes4 interfaceID)
        public
        view
        virtual
        returns (bool)
    {
        return
            interfaceID == type(IERC165).interfaceId ||
            interfaceID == type(IPriceOracle).interfaceId;
    }
}
