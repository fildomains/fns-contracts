import { Interface } from 'ethers/lib/utils';
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registrar = await ethers.getContract('BaseRegistrarImplementation')
  const priceOracle = await ethers.getContract('ExponentialPremiumPriceOracle')
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)
  const nameWrapper = await ethers.getContract('NameWrapper')

  const minCommitmentAge = network.name == 'hardhat' ? 0 : 60
  console.log(
      `Setting RegistrarController minCommitmentAge: ${minCommitmentAge} network: ${network.name}}`
  )
  const deployArgs = {
    from: deployer,
    args: [
      registrar.address,
      priceOracle.address,
      minCommitmentAge,
      86400,
      reverseRegistrar.address,
      nameWrapper.address,
    ],
    log: true,
  };
  const controller = await deploy('RegistrarController', deployArgs)
  //if(!controller.newlyDeployed) return;

  // Only attempt to make controller etc changes directly on testnets
  //if(network.name === 'mainnet') return;

  const tx1 = await nameWrapper.setController(controller.address, {
    from: deployer,
  })
  console.log(
    `Adding RegistrarController as a controller of NameWrapper (tx: ${tx1.hash})...`,
  )
  await tx1.wait()

  const tx2 = await reverseRegistrar.setController(controller.address, {
    from: owner,
  })
  console.log(
    `Adding RegistrarController as a controller of ReverseRegistrar (tx: ${tx2.hash})...`,
  )
  await tx2.wait()
}

func.tags = ['ethregistrar', 'RegistrarController']
func.dependencies = [
  'Registry',
  'BaseRegistrarImplementation',
  'ExponentialPremiumPriceOracle',
  'ReverseRegistrar',
  'NameWrapper',
]

export default func
