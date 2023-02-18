/* eslint-disable import/no-extraneous-dependencies */
import {Interface, namehash} from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {interfaces, computeInterfaceId, send} from '../../scripts/utils'

const labelHash = (label: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label))

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  if (!network.tags.use_root) {
    return true
  }

  const registry = await ethers.getContract('Registry', await ethers.getSigner(owner))

  await deploy('BulkRenewal', {
    from: deployer,
    args: [registry.address],
    log: true,
  })

  return true
}

func.id = 'bulk-renewal'
func.tags = ['BulkRenewal']
func.dependencies = [
  'root',
  'registry',
  'BaseRegistrarImplementation',
  'PublicResolver',
  'RegistrarController',
  'NameWrapper',
]

export default func
