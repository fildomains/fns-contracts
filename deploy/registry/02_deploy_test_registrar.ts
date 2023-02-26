import { namehash } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'
import {labelhash, send} from "../../scripts/utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()

  if (!network.tags.test){
    return true;
  }

  const registry = await ethers.getContract('Registry')

  await deploy('TestRegistrar', {
    from: owner,
    args: [registry.address, labelhash('test')],
    log: true,
  })
}

func.id = 'TestRegistrar'
func.tags = ['TestRegistrar']
func.dependencies = ['DNSRegistrar']

export default func
