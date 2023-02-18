import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {interfaces, send, labelhash, namehash} from '../../scripts/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await ethers.getContract('Registry', owner)
  const nameWrapper = await ethers.getContract('NameWrapper', owner)
  const controller = await ethers.getContract('RegistrarController', owner)
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)

  await deploy('PublicResolver', {
    from: deployer,
    args: [
      registry.address,
      nameWrapper.address,
      controller.address,
      reverseRegistrar.address,
    ],
    log: true,
  })
  //if(!publicResolver.newlyDeployed) return;
}

func.id = 'resolver'
func.tags = ['resolvers', 'PublicResolver']
func.dependencies = [
  'registry',
  'RegistrarController',
  'NameWrapper',
  'ReverseRegistrar',
]

export default func
