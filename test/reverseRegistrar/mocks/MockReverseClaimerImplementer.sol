// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17 <0.9.0;

import {FNS} from "../../../contracts/registry/FNS.sol";
import {ReverseClaimer} from "../../../contracts/reverseRegistrar/ReverseClaimer.sol";

contract MockReverseClaimerImplementer is ReverseClaimer {
    constructor(FNS fns, address claimant) ReverseClaimer(fns, claimant) {}
}
