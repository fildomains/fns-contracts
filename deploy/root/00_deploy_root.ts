import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { computeInterfaceId, send, labelhash} from '../../scripts/utils'
import { namehash } from 'ethers/lib/utils'

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  if (!network.tags.use_root) {
    return true
  }

  const registry = await ethers.getContract('Registry')

  await deploy('Root', {
    from: deployer,
    args: [registry.address],
    log: true,
  })

  const root = await ethers.getContract('Root')

  if (root.address !== (await registry.owner(ZERO_HASH))) {
    const tx1 = await registry.setOwner(ZERO_HASH, root.address)
    console.log(
        `Setting owner of root node to root contract (tx: ${tx1.hash})...`,
    )
    await tx1.wait()
  }

  const rootOwner = await root.owner()
  switch (rootOwner) {
    case deployer:
      const tx2 = await root
        .connect(await ethers.getSigner(deployer))
        .transferOwnership(owner)
      console.log(
        `Transferring root ownership to final owner (tx: ${tx2.hash})...`,
      )
      await tx2.wait()
    case owner:
      if (!(await root.controllers(owner))) {
        const tx2 = await root
          .connect(await ethers.getSigner(owner))
          .setController(owner, true)
        console.log(
          `Setting final owner as controller on root contract (tx: ${tx2.hash})...`,
        )
        await tx2.wait()
      }
      break
    default:
      console.log(
        `WARNING: Root is owned by ${rootOwner}; cannot transfer to owner account`,
      )
  }

  const reverseRegistrar = await ethers.getContract('ReverseRegistrar')
  if (reverseRegistrar.address !== (await registry.owner(namehash('addr.reverse')))) {
    if (owner != await registry.owner(namehash('reverse'))) {
      await send(root.connect(await ethers.getSigner(owner)), 'setSubnodeOwner', labelhash('reverse'), owner)
    }

    await send(registry.connect(await ethers.getSigner(owner)), 'setSubnodeOwner', namehash('reverse'), labelhash('addr'), reverseRegistrar.address)
  }

  return true
}

func.id = 'Root'
func.tags = ['Root']
func.dependencies = ['ReverseRegistrar']

export default func
