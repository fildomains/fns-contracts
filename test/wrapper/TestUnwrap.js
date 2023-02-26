const { ethers } = require('hardhat')
const { use, expect } = require('chai')
const { solidity } = require('ethereum-waffle')
const { labelhash, namehash, encodeName, FUSES } = require('../test-utils/ens')
const { deploy } = require('../test-utils/contracts')
const { EMPTY_BYTES32, EMPTY_ADDRESS } = require('../test-utils/constants')

use(solidity)

const ROOT_NODE = EMPTY_BYTES32

const DAY = 86400

const {
  CANNOT_UNWRAP,
  CANNOT_BURN_FUSES,
  CANNOT_TRANSFER,
  CANNOT_SET_RESOLVER,
  CANNOT_SET_TTL,
  CANNOT_CREATE_SUBDOMAIN,
  PARENT_CANNOT_CONTROL,
  CAN_DO_EVERYTHING,
  IS_DOT_ETH,
  CAN_EXTEND_EXPIRY,
} = FUSES

describe('TestUnwrap', () => {
  let Registry
  let BaseRegistrar
  let NameWrapper
  let TestUnwrap
  let MetaDataservice
  let signers
  let account
  let account2
  let result

  before(async () => {
    signers = await ethers.getSigners()
    account = await signers[0].getAddress()
    account2 = await signers[1].getAddress()
    hacker = await signers[2].getAddress()

    Registry = await deploy('Registry')

    BaseRegistrar = await deploy(
      'BaseRegistrarImplementation',
      Registry.address,
      namehash('fil'),
    )

    await BaseRegistrar.addController(account)
    await BaseRegistrar.addController(account2)

    MetaDataservice = await deploy(
      'StaticMetadataService',
      'https://ens.domains',
    )

    NameWrapper = await deploy(
      'NameWrapper',
      Registry.address,
      BaseRegistrar.address,
      MetaDataservice.address,
    )

    TestUnwrap = await deploy(
      'TestUnwrap',
      Registry.address,
      BaseRegistrar.address,
    )

    // setup .eth
    await Registry.setSubnodeOwner(
      ROOT_NODE,
      labelhash('fil'),
      BaseRegistrar.address,
    )

    //make sure base registrar is owner of eth TLD
    expect(await Registry.owner(namehash('fil'))).to.equal(
      BaseRegistrar.address,
    )
  })

  beforeEach(async () => {
    result = await ethers.provider.send('evm_snapshot')
  })
  afterEach(async () => {
    await ethers.provider.send('evm_revert', [result])
  })

  describe('wrapFromUpgrade()', () => {
    describe('.fil', () => {
      const encodedName = encodeName('wrapped.fil')
      const label = 'wrapped'
      const labelHash = labelhash(label)
      const nameHash = namehash(label + '.fil')

      it('allows unwrapping from an approved NameWrapper', async () => {
        await BaseRegistrar.register(labelHash, account, 1 * DAY)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)

        expect(await NameWrapper.ownerOf(nameHash)).to.equal(EMPTY_ADDRESS)

        await NameWrapper.wrap2LD(
          label,
          account,
          CAN_DO_EVERYTHING,
          EMPTY_ADDRESS,
        )

        //make sure reclaim claimed ownership for the wrapper in registry

        expect(await Registry.owner(nameHash)).to.equal(NameWrapper.address)
        expect(await NameWrapper.ownerOf(nameHash)).to.equal(account)
        expect(await BaseRegistrar.ownerOf(labelHash)).to.equal(
          NameWrapper.address,
        )

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)
        await TestUnwrap.setWrapperApproval(NameWrapper.address, true)

        await NameWrapper.upgrade(encodedName, 0)

        expect(await Registry.owner(nameHash)).to.equal(account)
        expect(await BaseRegistrar.ownerOf(labelHash)).to.equal(account)
        expect(await NameWrapper.ownerOf(nameHash)).to.equal(EMPTY_ADDRESS)
      })
      it('does not allow unwrapping from an unapproved NameWrapper', async () => {
        await BaseRegistrar.register(labelHash, account, 1 * DAY)
        await BaseRegistrar.nameExpires(labelHash)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)

        expect(await NameWrapper.ownerOf(nameHash)).to.equal(EMPTY_ADDRESS)

        await NameWrapper.wrap2LD(
          label,
          account,
          CAN_DO_EVERYTHING,
          EMPTY_ADDRESS,
        )

        //make sure reclaim claimed ownership for the wrapper in registry

        expect(await Registry.owner(nameHash)).to.equal(NameWrapper.address)
        expect(await NameWrapper.ownerOf(nameHash)).to.equal(account)
        expect(await BaseRegistrar.ownerOf(labelHash)).to.equal(
          NameWrapper.address,
        )

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)

        await expect(NameWrapper.upgrade(encodedName, 0)).to.be.revertedWith(
          'Unauthorised',
        )
      })
      it('does not allow unwrapping from an unapproved sender', async () => {
        await BaseRegistrar.register(labelHash, account, 1 * DAY)
        await BaseRegistrar.nameExpires(labelHash)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)

        expect(await NameWrapper.ownerOf(nameHash)).to.equal(EMPTY_ADDRESS)

        await NameWrapper.wrap2LD(
          label,
          account,
          CAN_DO_EVERYTHING,
          EMPTY_ADDRESS,
        )

        //make sure reclaim claimed ownership for the wrapper in registry

        expect(await Registry.owner(nameHash)).to.equal(NameWrapper.address)
        expect(await NameWrapper.ownerOf(nameHash)).to.equal(account)
        expect(await BaseRegistrar.ownerOf(labelHash)).to.equal(
          NameWrapper.address,
        )

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)
        await TestUnwrap.setWrapperApproval(NameWrapper.address, true)

        await expect(
          TestUnwrap.wrapFromUpgrade(encodedName, account, 0, 0, 0),
        ).to.be.revertedWith('Unauthorised')
      })
    })
    describe('other', () => {
      const label = 'to-upgrade'
      const parentLabel = 'wrapped2'
      const name = label + '.' + parentLabel + '.fil'
      const parentLabelHash = labelhash(parentLabel)
      const parentHash = namehash(parentLabel + '.fil')
      const nameHash = namehash(name)
      const encodedName = encodeName(name)
      it('allows unwrapping from an approved NameWrapper', async () => {
        await Registry.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.register(parentLabelHash, account, 1 * DAY)
        await NameWrapper.wrap2LD(
          parentLabel,
          account,
          CANNOT_UNWRAP,
          EMPTY_ADDRESS,
        )
        await NameWrapper.setSubnodeOwner(
          parentHash,
          'to-upgrade',
          account,
          0,
          0,
        )
        const ownerOfWrapped = await NameWrapper.ownerOf(nameHash)
        expect(ownerOfWrapped).to.equal(account)

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)
        await TestUnwrap.setWrapperApproval(NameWrapper.address, true)

        await NameWrapper.upgrade(encodedName, 0)

        expect(await Registry.owner(nameHash)).to.equal(account)
      })
      it('does not allow unwrapping from an unapproved NameWrapper', async () => {
        await Registry.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.register(parentLabelHash, account, 1 * DAY)
        await NameWrapper.wrap2LD(
          parentLabel,
          account,
          CANNOT_UNWRAP,
          EMPTY_ADDRESS,
        )
        await NameWrapper.setSubnodeOwner(
          parentHash,
          'to-upgrade',
          account,
          0,
          0,
        )
        const ownerOfWrapped = await NameWrapper.ownerOf(nameHash)
        expect(ownerOfWrapped).to.equal(account)

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)

        await expect(NameWrapper.upgrade(encodedName, 0)).to.be.revertedWith(
          'Unauthorised',
        )
      })
      it('does not allow unwrapping from an unapproved sender', async () => {
        await Registry.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)
        await BaseRegistrar.register(parentLabelHash, account, 1 * DAY)
        await NameWrapper.wrap2LD(
          parentLabel,
          account,
          CANNOT_UNWRAP,
          EMPTY_ADDRESS,
        )
        await NameWrapper.setSubnodeOwner(
          parentHash,
          'to-upgrade',
          account,
          0,
          0,
        )
        const ownerOfWrapped = await NameWrapper.ownerOf(nameHash)
        expect(ownerOfWrapped).to.equal(account)

        //set the upgradeContract of the NameWrapper contract
        await NameWrapper.setUpgradeContract(TestUnwrap.address)
        await TestUnwrap.setWrapperApproval(NameWrapper.address, true)

        await expect(
          TestUnwrap.wrapFromUpgrade(encodedName, account, 0, 0, 0),
        ).to.be.revertedWith('Unauthorised')
      })
    })
  })
})
