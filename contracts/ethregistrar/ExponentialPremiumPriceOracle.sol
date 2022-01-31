pragma solidity >=0.8.4;

import "./SafeMath.sol";
import "./StablePriceOracle.sol";

contract ExponentialPremiumPriceOracle is StablePriceOracle {
    uint256 constant GRACE_PERIOD = 90 days;
    uint256 constant START_PREMIUM = 1000000 * 1e18; // $1mil start price

    bytes4 private constant TIME_UNTIL_PREMIUM_ID =
        bytes4(keccak256("timeUntilPremium(uint,uint"));

    constructor(AggregatorInterface _usdOracle, uint256[] memory _rentPrices)
        public
        StablePriceOracle(_usdOracle, _rentPrices)
    {}

    uint256 constant PRECISION = 1e18;
    uint256 constant SECONDS_IN_DAY = 86400;
    uint256 constant bit1 = 999989423469314432; // 0.5 ^ 1/65536 * (10 ** 18)
    uint256 constant bit2 = 999978847050491904; // 0.5 ^ 2/65536 * (10 ** 18)
    uint256 constant bit3 = 999957694548431104;
    uint256 constant bit4 = 999915390886613504;
    uint256 constant bit5 = 999830788931929088;
    uint256 constant bit6 = 999661606496243712;
    uint256 constant bit7 = 999323327502650752;
    uint256 constant bit8 = 998647112890970240;
    uint256 constant bit9 = 997296056085470080;
    uint256 constant bit10 = 994599423483633152;
    uint256 constant bit11 = 989228013193975424;
    uint256 constant bit12 = 978572062087700096;
    uint256 constant bit13 = 957603280698573696;
    uint256 constant bit14 = 917004043204671232;
    uint256 constant bit15 = 840896415253714560;
    uint256 constant bit16 = 707106781186547584;

    /**
     * @dev Store value in variable
     * @param startPremium value to store
     * @param elapsed time past since expiry
     */
    function decayedPremium(uint256 startPremium, uint256 elapsed)
        public
        view
        returns (uint256)
    {
        uint256 daysPast = (elapsed * PRECISION) / SECONDS_IN_DAY;
        uint256 intDays = daysPast / PRECISION;
        uint256 premium = startPremium >> intDays;
        uint256 partDay = (daysPast - intDays * PRECISION);
        uint256 fraction = (partDay * (2**16)) / PRECISION;
        uint256 totalPremium = addFractionalPremium(fraction, premium);
        return totalPremium;
    }

    /**
     * @dev Returns the pricing premium in internal base units.
     */
    function _premium(
        string memory,
        uint256 expires,
        uint256
    ) internal view override returns (uint256) {
        expires = expires + GRACE_PERIOD;
        if (expires > block.timestamp) {
            return 0;
        }

        uint256 elapsed = block.timestamp - expires;
        // add in a require that elapse is > than a certain amount e.g. 21 days to return 0
        uint256 premium = decayedPremium(START_PREMIUM, elapsed);
        return premium;
    }

    function addFractionalPremium(uint256 fraction, uint256 premium)
        internal
        pure
        returns (uint256)
    {
        if (fraction & (1 << 0) != 0) {
            premium = (premium * bit1) / PRECISION;
        }
        if (fraction & (1 << 1) != 0) {
            premium = (premium * bit2) / PRECISION;
        }
        if (fraction & (1 << 2) != 0) {
            premium = (premium * bit3) / PRECISION;
        }
        if (fraction & (1 << 3) != 0) {
            premium = (premium * bit4) / PRECISION;
        }
        if (fraction & (1 << 4) != 0) {
            premium = (premium * bit5) / PRECISION;
        }
        if (fraction & (1 << 5) != 0) {
            premium = (premium * bit6) / PRECISION;
        }
        if (fraction & (1 << 6) != 0) {
            premium = (premium * bit7) / PRECISION;
        }
        if (fraction & (1 << 7) != 0) {
            premium = (premium * bit8) / PRECISION;
        }
        if (fraction & (1 << 8) != 0) {
            premium = (premium * bit9) / PRECISION;
        }
        if (fraction & (1 << 9) != 0) {
            premium = (premium * bit10) / PRECISION;
        }
        if (fraction & (1 << 10) != 0) {
            premium = (premium * bit11) / PRECISION;
        }
        if (fraction & (1 << 11) != 0) {
            premium = (premium * bit12) / PRECISION;
        }
        if (fraction & (1 << 12) != 0) {
            premium = (premium * bit13) / PRECISION;
        }
        if (fraction & (1 << 13) != 0) {
            premium = (premium * bit14) / PRECISION;
        }
        if (fraction & (1 << 14) != 0) {
            premium = (premium * bit15) / PRECISION;
        }
        if (fraction & (1 << 15) != 0) {
            premium = (premium * bit16) / PRECISION;
        }
        return premium;
    }

    // /**
    //  * @dev Returns the timestamp at which a name with the specified expiry date will have
    //  *      the specified re-registration price premium.
    //  * @param expires The timestamp at which the name expires.
    //  * @param amount The amount, in wei, the caller is willing to pay
    //  * @return The timestamp at which the premium for this domain will be `amount`.
    //  */
    // function timeUntilPremium(uint256 expires, uint256 amount)
    //     external
    //     view
    //     returns (uint256)
    // {
    //     amount = weiToAttoUSD(amount);
    //     require(amount <= initialPremium);

    //     expires = expires.add(GRACE_PERIOD);

    //     uint256 discount = initialPremium.sub(amount);
    //     uint256 duration = discount.div(premiumDecreaseRate);
    //     return expires.add(duration);
    // }

    function supportsInterface(bytes4 interfaceID)
        public
        view
        virtual
        override
        returns (bool)
    {
        return
            (interfaceID == TIME_UNTIL_PREMIUM_ID) ||
            super.supportsInterface(interfaceID);
    }
}
