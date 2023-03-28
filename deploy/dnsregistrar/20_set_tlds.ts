import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { hexEncodeName } from '@ensdomains/ensjs/utils/hexEncodedName'

const tld_map = {
  mainnet: ['xyz'],
  ropsten: ['xyz'],
  localhost: ['xyz'],
  filecoin: ['xyz'],
  hyperspace: ['xyz'],
  hardhat: ['xyz'],
  goerli: [
    'xyz',
  ],
}

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

async function setTLDs(
  owner: string,
  registry: any,
  registrar: any,
  tlds: any[],
) {
  if (tlds === undefined) {
    return []
  }

  const transactions: any[] = []
  for (const tld of tlds) {
    if (
      registrar.address !== (await registry.owner(ethers.utils.namehash(tld)))
    ) {
      console.log(`Transferring .${tld} to new DNS registrar`)
      transactions.push(
        await registrar.enableNode(hexEncodeName(tld), {
          //gasLimit: 10000000,
        }),
      )
    }
  }
  return transactions
}
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, network } = hre
  const { owner } = await getNamedAccounts()

  const registrar = await ethers.getContract('DNSRegistrar', owner)
  const signer = await ethers.getSigner(owner)

  let transactions: any[] = []
  const root = await ethers.getContract('Root', signer)
  const registry = await ethers.getContract('Registry', signer)
  transactions = await setTLDs(
    owner,
    registry,
    registrar,
    tld_map[network.name as keyof typeof tld_map],
  )

  if (transactions.length > 0) {
    console.log(
      `Waiting on ${transactions.length} transactions setting DNS TLDs`,
    )
    await Promise.all(transactions.map((tx) => tx.wait()))
  }
}

func.id = 'set-tlds'
func.tags = ['set-tlds']
func.dependencies = [
  'setup',
]

export default func
