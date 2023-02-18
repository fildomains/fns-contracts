/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-await-in-loop */
import { BigNumber } from '@ethersproject/bignumber'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {sleep, mine} from "../../scripts/utils";
const { makeRegistrationData } = require('@ensdomains/ensjs/utils/registerHelpers')
const { encodeFuses } = require('@ensdomains/ensjs/utils/fuses')
import {labelhash, namehash} from '../../scripts/utils'

const FUSES = {
  CAN_DO_EVERYTHING: 0,
  CANNOT_UNWRAP: 1,
  CANNOT_BURN_FUSES: 2,
  CANNOT_TRANSFER: 4,
  CANNOT_SET_RESOLVER: 8,
  CANNOT_SET_TTL: 16,
  CANNOT_CREATE_SUBDOMAIN: 32,
  PARENT_CANNOT_CONTROL: 2 ** 16,
  IS_DOT_ETH: 2 ** 17,
  CAN_EXTEND_EXPIRY: 2 ** 18
}

const dummyABI = [
  {
    type: 'event',
    anonymous: false,
    name: 'ABIChanged',
    inputs: [
      {
        type: 'bytes32',
        indexed: true,
      },
      {
        type: 'uint256',
        indexed: true,
      },
    ],
  },
  {
    type: 'event',
    anonymous: false,
    name: 'VersionChanged',
    inputs: [
      {
        type: 'bytes32',
        indexed: true,
      },
      {
        type: 'uint64',
      },
    ],
  },
  {
    type: 'function',
    name: 'ABI',
    constant: true,
    stateMutability: 'view',
    payable: false,
    inputs: [
      {
        type: 'bytes32',
      },
      {
        type: 'uint256',
      },
    ],
    outputs: [
      {
        type: 'uint256',
      },
      {
        type: 'bytes',
      },
    ],
  },
  {
    type: 'function',
    name: 'clearRecords',
    constant: false,
    payable: false,
    inputs: [
      {
        type: 'bytes32',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordVersions',
    constant: true,
    stateMutability: 'view',
    payable: false,
    inputs: [
      {
        type: 'bytes32',
      },
    ],
    outputs: [
      {
        type: 'uint64',
      },
    ],
  },
  {
    type: 'function',
    name: 'setABI',
    constant: false,
    payable: false,
    inputs: [
      {
        type: 'bytes32',
      },
      {
        type: 'uint256',
      },
      {
        type: 'bytes',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'supportsInterface',
    constant: true,
    stateMutability: 'view',
    payable: false,
    inputs: [
      {
        type: 'bytes4',
      },
    ],
    outputs: [
      {
        type: 'bool',
      },
    ],
  },
]

const names: {
  label: string
  namedOwner: string
  namedAddr: string
  reverseRecord?: boolean
  wrapped?: boolean
  duration?: number
  fuses?: number
  records?: {
    text?: {
      key: string
      value: string
    }[]
    addr?: {
      key: number
      value: string
    }[]
    contenthash?: string
    abi?: {
      contentType: 1 | 2 | 4 | 8 | 256
      data: object | string
    }
  }
  subnames?: {
    label: string
    namedOwner: string
    fuses?: number
    expiry?: number
  }[]
}[] = [
  {
    label: 'wrapped',
    namedOwner: 'owner',
    namedAddr: 'owner',
    reverseRecord: false,
    wrapped: true,
  },
  {
    label: 'wrapped-with-subnames',
    namedOwner: 'owner',
    namedAddr: 'owner',
    wrapped: true,
    subnames: [
      { label: 'test', namedOwner: 'owner2' },
      { label: 'legacy', namedOwner: 'owner2' },
      { label: 'xyz', namedOwner: 'owner2' },
      { label: 'addr', namedOwner: 'owner2' },
    ],
  },
  {
    label: 'expired-wrapped',
    namedOwner: 'owner',
    namedAddr: 'owner',
    wrapped: true,
    subnames: [{ label: 'test', namedOwner: 'owner2' }],
    duration: 2419200,
  },
  {
    label: 'wrapped-with-expiring-subnames',
    namedOwner: 'owner',
    namedAddr: 'owner',
    wrapped: true,
    fuses: encodeFuses({
      child: {
        named: ['CANNOT_UNWRAP'],
      },
    }),
    subnames: [
      {
        label: 'test',
        namedOwner: 'owner2',
        expiry: Math.floor(Date.now() / 1000),
      },
      {
        label: 'test1',
        namedOwner: 'owner2',
        expiry: 0,
      },
      {
        label: 'recent-pcc',
        namedOwner: 'owner2',
        expiry: Math.floor(Date.now() / 1000),
      },
    ],
  },

  {
    label: 'reverse-wrapped',
    namedOwner: 'owner',
    namedAddr: 'owner',
    reverseRecord: true,
    wrapped: true,
  },
  {
    label: 'nowrapped-with-subnames',
    namedOwner: 'owner',
    namedAddr: 'owner',
    reverseRecord: false,
    wrapped: false,
    subnames: [
      { label: 'test', namedOwner: 'owner2' },
      { label: 'legacy', namedOwner: 'owner2' },
      { label: 'xyz', namedOwner: 'owner2' },
      { label: 'addr', namedOwner: 'owner2' },
    ],
  },
  {
    label: 'test123',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'to-be-wrapped',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'resume-and-wrap',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'other-registrant',
    namedOwner: 'deployer',
    namedAddr: 'deployer',
  },
  {
    label: 'other-eth-record',
    namedOwner: 'owner',
    namedAddr: 'deployer',
  },
  {
    label: 'from-settings',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'with-legacy-resolver',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'with-profile',
    namedOwner: 'owner2',
    namedAddr: 'owner2',
    records: {
      text: [
        { key: 'description', value: 'Hello2' },
        { key: 'url', value: 'twitter.com' },
        { key: 'blankrecord', value: '' },
        { key: 'email', value: 'fakeemail@fake.com' },
      ],
      addr: [
        { key: 61, value: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
        { key: 0, value: '0x00149010587f8364b964fcaa70687216b53bd2cbd798' },
        { key: 2, value: '0x0000000000000000000000000000000000000000' },
      ],
    },
  },
  {
    label: 'with-contenthash',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      contenthash:
          '0xe301017012204edd2984eeaf3ddf50bac238ec95c5713fb40b5e428b508fdbe55d3b9f155ffe',
    },
  },
  {
    label: 'to-be-renewed',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'with-subnames',
    namedOwner: 'owner',
    namedAddr: 'owner',
    subnames: [
      { label: 'test', namedOwner: 'owner2' },
      { label: 'legacy', namedOwner: 'owner2' },
      { label: 'xyz', namedOwner: 'owner2' },
      { label: 'addr', namedOwner: 'owner2' },
    ],
  },
  {
    label: 'with-unknown-subnames',
    namedOwner: 'owner',
    namedAddr: 'owner',
    subnames: [
      { label: 'aaa123', namedOwner: 'owner2' },
      { label: 'not-known', namedOwner: 'owner2' },
    ],
  },
  {
    label: 'aaa123',
    namedOwner: 'owner',
    namedAddr: 'owner',
  },
  {
    label: 'with-type-1-abi',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      abi: {
        contentType: 1,
        data: dummyABI,
      },
    },
  },
  {
    label: 'with-type-2-abi',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      abi: {
        contentType: 2,
        data: dummyABI,
      },
    },
  },
  {
    label: 'with-type-4-abi',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      abi: {
        contentType: 4,
        data: dummyABI,
      },
    },
  },
  {
    label: 'with-type-8-abi',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      abi: {
        contentType: 8,
        data: 'https://example.com',
      },
    },
  },
  {
    label: 'with-type-256-abi',
    namedOwner: 'owner',
    namedAddr: 'owner',
    records: {
      abi: {
        contentType: 256,
        data: dummyABI,
      },
    },
  },
  {
    label: 'expired',
    namedOwner: 'owner',
    namedAddr: 'owner',
    duration: 2419200,
  },
  ...Array.from({ length: 34 }, (_, i) => ({
    label: `${i}-dummy`,
    namedOwner: 'owner2',
    namedAddr: 'owner2',
  })),
]

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, network } = hre
  if(network.name !== 'hardhat') return

  const allNamedAccts = await getNamedAccounts()

  const controller = await ethers.getContract('RegistrarController')
  const publicResolver = await ethers.getContract('PublicResolver')
  const nameWrapper = await ethers.getContract('NameWrapper')
  const registry = await ethers.getContract('Registry')

  const minCommitmentAge = parseInt(await controller.minCommitmentAge())

  console.log('register_test Commiting commitment for allNamedAccts:', allNamedAccts)
  for (let { label, namedOwner, namedAddr, records, subnames, reverseRecord, wrapped, duration, fuses = 0, } of names) {
    const secret = '0x0000000000000000000000000000000000000000000000000000000000000000'
    const registrant = allNamedAccts[namedOwner]
    const resolver = publicResolver.address
    const addr = allNamedAccts[namedAddr]
    const duration = 31536000
    const data: any[] = []
    const owner = registrant
    const fuses = 0

    let registrationData = makeRegistrationData({ owner, name: `${label}.fil`, duration, reverseRecord, fuses,
      resolver: publicResolver,
      records : !reverseRecord ? { coinTypes: [{ key: "ETH", value: registrant}] } : null,
      secret,
    })

    console.log(`register_test Commiting commitment for ${label}.fil, minCommitmentAge:${minCommitmentAge}, registrant:${registrant}, registrationData:${registrationData} ...`)

    const commitment = await controller.makeCommitment(...registrationData)

    await mine(network.provider)

    const _controller = controller.connect(await ethers.getSigner(registrant))
    const commitTx = await _controller.commit(commitment)
    await commitTx.wait()

    await sleep(minCommitmentAge * 1000)
    await mine(network.provider)

    const price = await controller.rentPrice(label, duration)

    await mine(network.provider)

    const count = 5;
    for(let i = 0; i < count; i++){
      try {
        const registerTx = await _controller.register(
            ...registrationData,
            {
              value: price[0],
            },
        )

        await registerTx.wait()
        break;
      }catch (e) {
        console.log(`register_test Registeringed e: ${e}, i: ${i},`)
        if(i + 1 >= count){
          throw e;
        }
      }
    }

    if(!wrapped){
      await nameWrapper.connect(await ethers.getSigner(registrant)).unwrap2LD(labelhash(label), registrant, registrant)
    }

    if (records) {
      const _publicResolver = publicResolver.connect(
          await ethers.getSigner(registrant),
      )

      const hash = namehash(`${label}.fil`)
      console.log(`register_test Setting records for ${label}.fil...`)
      if (records.text) {
        for (const { key, value } of records.text) {
          const setTextTx = await _publicResolver.setText(hash, key, value)
          console.log(`register_test - ${key} ${value} (tx: ${setTextTx.hash})...`)
          await setTextTx.wait()
        }
      }
      if (records.addr) {
        for (const { key, value } of records.addr) {
          const setAddrTx = await _publicResolver[
              'setAddr(bytes32,uint256,bytes)'
              ](hash, key, value)
          console.log(`register_test - ${key} ${value} (tx: ${setAddrTx.hash})...`)
          await setAddrTx.wait()
        }
      }
      if (records.contenthash) {
        const setContenthashTx = await _publicResolver.setContenthash(
            hash,
            records.contenthash,
        )
        console.log(
            `register_test - ${records.contenthash} (tx: ${setContenthashTx.hash})...`,
        )
        await setContenthashTx.wait()
      }
    }

    if (subnames) {
      const nameWrapper = await ethers.getContract('NameWrapper')
      for (const {
        label: subnameLabel,
        namedOwner: namedSubnameOwner,
        fuses: subnameFuses = 0,
        expiry: subnameExpiry = BigNumber.from(2).pow(64).sub(1),
      } of subnames) {
        if(wrapped){
          const subnameOwner = allNamedAccts[namedSubnameOwner]
          const _nameWrapper = nameWrapper.connect(await ethers.getSigner(owner))
          const setSubnameTx = await _nameWrapper.setSubnodeRecord(
              namehash(`${label}.fil`),
              subnameLabel,
              subnameOwner,
              resolver,
              '0',
              subnameFuses,
              subnameExpiry,
              {gasLimit: 30000000},
          )

          const data = await _nameWrapper.getData(namehash(`${label}.fil`))
          console.log(`register_test - ${subnameLabel}, ${subnameFuses.toString()}, ${subnameExpiry.toString()}, (tx: ${setSubnameTx.hash})...`)
          await setSubnameTx.wait()
          await mine(network.provider)
        }else{
          const subnameOwner = allNamedAccts[namedSubnameOwner]
          const _registry = registry.connect(await ethers.getSigner(owner))
          const setSubnameTx = await _registry.setSubnodeRecord(
              namehash(`${label}.fil`),
              labelhash(subnameLabel),
              subnameOwner,
              resolver,
              '0',
          )
          console.log(`register_test _registry - ${subnameLabel} (tx: ${setSubnameTx.hash})...`)
          await setSubnameTx.wait()
          await mine(network.provider)
        }
      }
    }
  }

  return true
}

func.id = 'register-names'
func.tags = ['register-names']
func.dependencies = ['RegistrarController']
func.runAtTheEnd = true

export default func
