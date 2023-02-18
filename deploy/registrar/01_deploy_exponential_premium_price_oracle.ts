import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import fetch from 'node-fetch'

const getPrice = async () =>{
  try{
    const response = await fetch('https://api.coincap.io/v2/assets/filecoin');
    const data = await response.json();

    return Math.floor(data.data.priceUsd * 100000000)
  }catch (e) {

  }

  return 526293702;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  //if(network.name === 'mainnet') return;

  const price = network.name === 'hardhat' ? 156058000000 : await getPrice()
  console.log(`deploy DummyOracle price:${price}`)
  const dummyOracle = await deploy('DummyOracle', {
    from: deployer,
    args: [price],
    log: true,
  })

  await deploy('ExponentialPremiumPriceOracle', {
    from: deployer,
    args: [
      dummyOracle.address,
      [0, 0, '20294266869609', '5073566717402', '158548959919'],
      '100000000000000000000000000',
      21,
    ],
    log: true,
  })
}

func.id = 'price-oracle'
func.tags = ['ethregistrar', 'ExponentialPremiumPriceOracle', 'DummyOracle']
func.dependencies = ['Root']

export default func
