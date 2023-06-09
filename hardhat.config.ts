import { exec as _exec } from 'child_process'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import dotenv from 'dotenv'
import 'hardhat-abi-exporter'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig, task } from 'hardhat/config'
import { Artifact } from 'hardhat/types'
import { promisify } from 'util'
import 'hardhat-contract-sizer'

const exec = promisify(_exec)

// hardhat actions
import './tasks/accounts'
import './tasks/archive_scan'
import './tasks/save'
import './tasks/seed'

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenv.config({ debug: false })

let real_accounts = undefined
if (process.env.DEPLOYER_KEY) {
  real_accounts = [process.env.DEPLOYER_KEY, process.env.OWNER_KEY || process.env.DEPLOYER_KEY, process.env.OWNER2_KEY || process.env.DEPLOYER_KEY]
}

// circular dependency shared with actions
export const archivedDeploymentPath = './deployments/archive'

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      saveDeployments: false,
      tags: ['test', 'use_root'],
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: 'http://localhost:8545',
      saveDeployments: true,
      tags: ['test', 'use_root'],
      accounts: real_accounts,
      timeout: 4000000,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['test', 'use_root'],
      chainId: 5,
      accounts: real_accounts,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['use_root'],
      chainId: 1,
      accounts: real_accounts,
    },
    filecoin: {
      url: `https://api.node.glif.io`,
      tags: ['use_root'],
      chainId: 314,
      saveDeployments: true,
      accounts: real_accounts,
    },
    hyperspace: {
      url: `https://api.hyperspace.node.glif.io/rpc/v1`,
      tags: ['test', 'use_root'],
      chainId: 3141,
      saveDeployments: true,
      accounts: real_accounts,
    },
    calibration: {
      url: `https://api.calibration.node.glif.io/rpc/v1`,
      tags: ['test', 'use_root'],
      chainId: 314159,
      saveDeployments: true,
      accounts: real_accounts,
    },
  },
  mocha: {
    timeout: 4000000
  },
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1500,
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
    owner2: {
      default: 2,
    },
    owner3: 3,
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
