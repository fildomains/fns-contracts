import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('Registry')
  const dnssec = await ethers.getContract('DNSSECImpl')
  const resolver = await hre.deployments.get('OffchainDNSResolver')

  const publicSuffixList = await deploy('TLDPublicSuffixList', {
    from: deployer,
    args: [],
    log: true,
  })

  await deploy('DNSRegistrar', {
    from: deployer,
    args: [
      '0x0000000000000000000000000000000000000000',
      resolver.address,
      dnssec.address,
      publicSuffixList.address,
      registry.address,
    ],
    log: true,
  })
}

func.tags = ['dnsregistrar']
func.dependencies = ['registry', 'dnssec-oracle', 'OffchainDNSResolver', 'Root']

export default func
