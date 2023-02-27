import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('Registry')
  const dnssec = await ethers.getContract('DNSSECImpl')

  const tx = await deploy('OffchainDNSResolver', {
    from: deployer,
    args: [
      registry.address,
      dnssec.address,
      'https://dnssec-oracle.fildomains.com/',
    ],
    log: true,
  })
  console.log(`Deployed OffchainDNSResolver to ${tx.address}`)
}

func.tags = ['OffchainDNSResolver']
func.dependencies = ['registry', 'dnssec-oracle']

export default func
