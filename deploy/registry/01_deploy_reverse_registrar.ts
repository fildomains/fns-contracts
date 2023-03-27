import { namehash } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'
import {labelhash, send} from "../../scripts/utils";
import {sha3} from "web3-utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await ethers.getContract('Registry')

  await deploy('ReverseRegistrar', {
    from: owner,
    args: [registry.address],
    log: true,
  });
}

func.id = 'ReverseRegistrar'
func.tags = ['ReverseRegistrar']
func.dependencies = ['Registry']

export default func
