import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import 'hardhat-abi-exporter'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig, task } from 'hardhat/config'

const archivedDeploymentPath = './deployments/archive'

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenv.config({ debug: false })

task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

task('save', 'Saves a specified contract as a deployed contract')
  .addPositionalParam('contract', 'The contract to save')
  .addPositionalParam('block', 'The block number the contract was deployed at')
  .setAction(
    async ({ contract, block }: { contract: string; block: string }, hre) => {
      const network = hre.network.name
      const artifact = await hre.deployments.getArtifact(contract)

      const archiveName = `${contract}_${network}_${block}`
      const archivePath = `${archivedDeploymentPath}/${archiveName}.sol`

      if (existsSync(archivePath)) {
        throw new Error('Archive already exists')
      }

      let newArtifact = artifact
      newArtifact.contractName = archiveName
      newArtifact.sourceName = archivePath.substring(2)

      await fs.mkdir(archivePath)
      await fs.writeFile(
        `${archivePath}/${archiveName}.json`,
        JSON.stringify(artifact, null, 2),
      )
      console.log("Archived contract to '" + archivePath + "'")
    },
  )

let real_accounts = undefined
if (process.env.DEPLOYER_KEY && process.env.OWNER_KEY) {
  real_accounts = [process.env.DEPLOYER_KEY, process.env.OWNER_KEY]
}

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      // Required for real DNS record tests
      initialDate: '2019-03-15T14:06:45.000+13:00',
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 3,
      accounts: real_accounts,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 5,
      accounts: real_accounts,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['legacy', 'use_root'],
      chainId: 1,
      accounts: real_accounts,
    },
  },
  mocha: {},
  solidity: {
    compilers: [
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
  abiExporter: {
    path: './build/contracts',
    runOnCompile: true,
    clear: true,
    flat: true,
    except: [
      'Controllable$',
      'INameWrapper$',
      'SHA1$',
      'Ownable$',
      'NameResolver$',
      'TestBytesUtils$',
      'legacy/*',
    ],
    spacing: 2,
    pretty: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 1,
    },
  },
  external: {
    contracts: [
      {
        artifacts: [archivedDeploymentPath],
      },
    ],
  },
}

export default config
