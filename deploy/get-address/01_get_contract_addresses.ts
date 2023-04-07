/* eslint-disable import/no-extraneous-dependencies */
import { writeFile } from 'fs/promises'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { resolve } from 'path'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network } = hre

  const allDeployments = await hre.deployments.all()
  const deploymentAddressMap = Object.fromEntries(
    Object.keys(allDeployments).map((dkey) => [dkey, allDeployments[dkey].address]),
  )

  await writeFile(
    resolve(__dirname, `../.${network.name}.env`),
    `${JSON.stringify(deploymentAddressMap, null, 4)}`,
  )

  console.log(`Wrote contract addresses to .${network.name}.env`)
}

func.runAtTheEnd = true
func.id = 'get-address'
func.tags = ['get-address']
func.dependencies = [
  'setup',
]

export default func
