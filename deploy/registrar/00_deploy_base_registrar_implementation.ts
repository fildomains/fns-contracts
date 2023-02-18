import namehash from 'eth-ens-namehash'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()

  if (!network.tags.use_root) {
    return true
  }

  const registry = await ethers.getContract('Registry')
  const root = await ethers.getContract('Root')

  await deploy('BaseRegistrarImplementation', {
    from: deployer,
    args: [registry.address, namehash.hash('fil')],
    log: true,
  })
}

func.id = 'BaseRegistrarImplementation'
func.tags = ['BaseRegistrarImplementation']
func.dependencies = ['Root']

export default func
