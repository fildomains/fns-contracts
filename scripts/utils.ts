import { ethers } from 'ethers'
import {Interface} from "ethers/lib/utils";
const { makeInterfaceId } = require('@openzeppelin/test-helpers')

export const namehash = require("eth-ens-namehash").hash
const { utils } = ethers
export const labelhash = (label: string) => utils.keccak256(utils.toUtf8Bytes(label))

export const interfaces = {
    legacyRegistrar: '0x7ba18ba1',
    permanentRegistrar: '0x018fac06',
    permanentRegistrarWithConfig: '0xca27ac4c',
    baseRegistrar: '0x6ccb2df4',
    bulkRenewal: '0x3150bfba',
    linearPremiumPriceOracle: '0x5e75f6a9'
};

export async function send(contract: any, fun: any, ...args : Array<any>){
    const tx = await contract[fun](...args)

    return await tx.wait()
}

export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function mine(provider: any){
    try {
        return await provider.send('evm_mine')
    }catch (e){

    }
}

export function computeInterfaceId(iface: Interface) {
    return makeInterfaceId.ERC165(Object.values(iface.functions).map((frag) => frag.format("sighash")));
}

