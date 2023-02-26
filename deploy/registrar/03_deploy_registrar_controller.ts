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

  const nonce = await ethers.provider.getTransactionCount(deployer)
  const minCommitmentAge = network.name == 'hardhat' ? 0 : 60
  console.log(
      `Setting RegistrarController minCommitmentAge: ${minCommitmentAge},network: ${network.name},nonce: ${nonce}}`
  )

  const controllerAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce});
  const tokenAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+1});
  const sundayAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+2});
  const receiverAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+3});
  console.log('controllerAddress:', controllerAddress, 'tokenAddress:', tokenAddress, ',receiverAddress:', receiverAddress, ',sundayAddress:', sundayAddress)

  const deployArgs = {
    from: deployer,
    args: [
      registrar.address,
      priceOracle.address,
      minCommitmentAge,
      86400,
      reverseRegistrar.address,
      nameWrapper.address,
      tokenAddress
    ],
    log: true,
  };
  const controller = await deploy('RegistrarController', deployArgs)
  //if(!controller.newlyDeployed) return;

  await deploy('FNSToken', {
    from: deployer,
    args: [
      controllerAddress,
      sundayAddress,
      receiverAddress
    ],
    log: true,
  })

  await deploy('Sunday', {
    from: deployer,
    args: [
      tokenAddress
    ],
    log: true,
  })

  await deploy('Receiver', {
    from: deployer,
    args: [
      tokenAddress
    ],
    log: true,
  })

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
