const {
  deployController: {deployController},
} = require('../test-utils')

const FNS = artifacts.require('./registry/Registry')
const PublicResolver = artifacts.require('./resolvers/PublicResolver')
const BaseRegistrar = artifacts.require('./BaseRegistrarImplementation')
const RegistrarController = artifacts.require('./RegistrarController')
const DummyOracle = artifacts.require('./DummyOracle')
const StablePriceOracle = artifacts.require('./StablePriceOracle')
const BulkRenewal = artifacts.require('./BulkRenewal')
const NameWrapper = artifacts.require('./wrapper/NameWrapper.sol')
const { deploy } = require('../test-utils/contracts')
const { EMPTY_BYTES32: EMPTY_BYTES } = require('../test-utils/constants')

const namehash = require('eth-ens-namehash')
const sha3 = require('web3-utils').sha3
const toBN = require('web3-utils').toBN
const { exceptions } = require('../test-utils')

const FIL_LABEL = sha3('fil')
const FIL_NAMEHASH = namehash.hash('fil')

contract('BulkRenewal', function (accounts) {
  let fns
  let resolver
  let baseRegistrar
  let controller
  let priceOracle
  let bulkRenewal
  let nameWrapper
  let reverseRegistrar

  const ownerAccount = accounts[0] // Account that owns the registrar
  const registrantAccount = accounts[1] // Account that owns test names
  const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'

  before(async () => {
    // Create a registry
    fns = await FNS.new()
    // Create a base registrar
    baseRegistrar = await BaseRegistrar.new(fns.address, namehash.hash('fil'), {
      from: ownerAccount,
    })

    // Setup reverseRegistrar
    reverseRegistrar = await deploy('ReverseRegistrar', fns.address)

    await fns.setSubnodeOwner(EMPTY_BYTES, sha3('reverse'), accounts[0])
    await fns.setSubnodeOwner(
      namehash.hash('reverse'),
      sha3('addr'),
      reverseRegistrar.address,
    )

    // Create a name wrapper

    nameWrapper = await NameWrapper.new(
      fns.address,
      baseRegistrar.address,
      ownerAccount,
    )
    // Create a public resolver
    resolver = await PublicResolver.new(
      fns.address,
      nameWrapper.address,
      EMPTY_ADDRESS,
      EMPTY_ADDRESS,
    )

    // Set up a dummy price oracle and a controller
    const dummyOracle = await DummyOracle.new(toBN(100000000))
    priceOracle = await StablePriceOracle.new(
      dummyOracle.address,
      [0, 0, 4, 2, 1],
    )

    controller = await deployController(
        {baseRegistrar, priceOracle, reverseRegistrar: {address: EMPTY_ADDRESS}, nameWrapper}
    )

    var wrapperAddress = await controller.nameWrapper()
    await baseRegistrar.addController(controller.address, {
      from: ownerAccount,
    })
    await baseRegistrar.addController(ownerAccount, { from: ownerAccount })
    await baseRegistrar.addController(nameWrapper.address, {
      from: ownerAccount,
    })
    await nameWrapper.setController(controller.address, true, {
      from: ownerAccount,
    })
    // Create the bulk registration contract
    bulkRenewal = await BulkRenewal.new(fns.address)

    // Configure a resolver for .fil and register the controller interface
    // then transfer the .fil node to the base registrar.
    await fns.setSubnodeRecord(
      '0x0',
      FIL_LABEL,
      ownerAccount,
      resolver.address,
      0,
    )
    await resolver.setInterface(FIL_NAMEHASH, '0x612e8c09', controller.address)
    await fns.setOwner(FIL_NAMEHASH, baseRegistrar.address)

    // Register some names
    for (const name of ['test1', 'test2', 'test3']) {
      await baseRegistrar.register(sha3(name), registrantAccount, 31536000)
    }
  })

  it('should return the cost of a bulk renewal', async () => {
    const result = await bulkRenewal.rentPrice(['test1', 'test2'], 86400)
    assert.equal(
        result[0],
        86400 * 2,
    )
    assert.equal(
        result[1],
        86400 * 2,
    )
  })

  it('should raise an error trying to renew a nonexistent name', async () => {
    await exceptions.expectFailure(bulkRenewal.renewAll(['foobar'], 86400))
  })

  it('should permit bulk renewal of names', async () => {
    const oldExpiry = await baseRegistrar.nameExpires(sha3('test2'))
    const tx = await bulkRenewal.renewAll(['test1', 'test2'], 86400, {
      value: 86401 * 2,
    })
    assert.equal(tx.receipt.status, true)
    const newExpiry = await baseRegistrar.nameExpires(sha3('test2'))
    assert.equal(newExpiry - oldExpiry, 86400)
    // Check any excess funds are returned
    assert.equal(await web3.eth.getBalance(bulkRenewal.address), 0)
  })
})
