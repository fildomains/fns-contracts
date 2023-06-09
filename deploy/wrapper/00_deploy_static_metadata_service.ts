import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  let metadataHost =
    process.env.METADATA_HOST || 'https://metadata.fildomains.com'

  if (network.name === 'localhost') {
    metadataHost = 'http://localhost:8080'
  }

  const metadataUrl = `${metadataHost}/${network.name}/`

  console.log(`Deploying StaticMetadataService metadataUrl: ${metadataUrl}`)
  await deploy('StaticMetadataService', {
    from: deployer,
    args: [metadataUrl],
    log: true,
  })
}

func.id = 'metadata'
func.tags = ['wrapper', 'StaticMetadataService']
func.dependencies = []

export default func
