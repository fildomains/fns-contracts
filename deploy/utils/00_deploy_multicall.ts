import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {resolve} from "path";
import {existsSync, mkdirSync} from "fs";
import {readFile, writeFile} from "fs/promises";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('Multicall', {
    from: deployer,
    args: [],
    log: true,
  })
}

func.id = 'multicall'
func.tags = ['multicall', 'Multicall']
func.dependencies = ['registry']

export default func

