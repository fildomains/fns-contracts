const {
  evm,
  reverse: { getReverseNode },
  contracts: { deploy },
} = require('../test-utils')

const { expect } = require('chai')

const { ethers } = require('hardhat')
const provider = ethers.provider
const { namehash, encodeName} = require('../test-utils/ens')
const sha3 = require('web3-utils').sha3

const DAYS = 24 * 60 * 60
const REGISTRATION_TIME = 28 * DAYS
const BUFFERED_REGISTRATION_COST = REGISTRATION_TIME + 3 * DAYS
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const MAX_EXPIRY = 2n ** 64n - 1n
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants')
contract('FNSToken', function () {
  let fns
  let resolver
  let resolver2 // resolver signed by accounts[1]
  let baseRegistrar
  let controller
  let controller2 // controller signed by accounts[1]
  let token
  let sundayAddress
  let beneficiary
  let sunday
  let priceOracle
  let reverseRegistrar
  let nameWrapper
  let callData

  const secret =
    '0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'
  let ownerAccount // Account that owns the registrar
  let registrantAccount // Account that owns test names
  let accounts = []

  async function registerName(
    name,
    txOptions = { value: BUFFERED_REGISTRATION_COST },
  ) {
    var commitment = await controller.makeCommitment(
      name,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      NULL_ADDRESS,
      [],
      false,
      0
    )
    var tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await provider.getBlock(tx.blockNumber)).timestamp,
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    var tx = await controller.register(
      name,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      NULL_ADDRESS,
      [],
      false,
      0,
      txOptions,
    )

    expect(
        (await web3.eth.getBalance(controller.address)),
    ).to.equal('0')

    return tx
  }

  async function getWeek(){
    const blockNumber = await provider.getBlockNumber()
    const block = await provider.getBlock(blockNumber)
    const timestamp = block.timestamp * 1000;

    return new Date(timestamp).getDay();
  }

  async function registerNameFns(
      name,
      txOptions = { },
  ) {
    var commitment = await token.makeCommitment(
        name,
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0
    )
    var tx = await token.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
        (await provider.getBlock(tx.blockNumber)).timestamp,
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    var tx = await token.register(
        name,
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        txOptions,
    )

    const block = await provider.getBlock(tx.blockNumber)
    let baseCost = ethers.BigNumber.from(REGISTRATION_TIME)
    await expect(tx)
        .to.emit(token, 'NameRegistered')
        .withArgs(
            name,
            sha3(name),
            registrantAccount,
            baseCost.toString(),
            0,
            block.timestamp + REGISTRATION_TIME,
        )
    return tx
  }

  before(async () => {
    signers = await ethers.getSigners()
    ownerAccount = await signers[0].getAddress()
    registrantAccount = await signers[1].getAddress()
    accounts = [ownerAccount, registrantAccount, signers[2].getAddress()]

    fns = await deploy('Registry')

    baseRegistrar = await deploy(
      'BaseRegistrarImplementation',
      fns.address,
      namehash('fil'),
    )

    nameWrapper = await deploy(
      'NameWrapper',
      fns.address,
      baseRegistrar.address,
      ownerAccount,
    )

    reverseRegistrar = await deploy('ReverseRegistrar', fns.address)

    await fns.setSubnodeOwner(EMPTY_BYTES, sha3('fil'), baseRegistrar.address)

    const dummyOracle = await deploy('DummyOracle', '100000000')
    priceOracle = await deploy(
      'StablePriceOracle',
      dummyOracle.address,
      [0, 0, 4, 2, 1],
    )
    controller = await deploy(
      'RegistrarController',
      baseRegistrar.address,
      priceOracle.address,
      600,
      86400,
      reverseRegistrar.address,
      nameWrapper.address,
    )
    controller2 = controller.connect(signers[1])

    token = await ethers.getContractAt('FNSToken', await controller.token())
    sundayAddress = await token.sunday()
    beneficiary = await token.beneficiary()
    sunday = await ethers.getContractAt('Sunday', sundayAddress)

    await baseRegistrar.addController(controller.address)
    await nameWrapper.setController(controller.address, true)
    await baseRegistrar.addController(nameWrapper.address)
    await reverseRegistrar.setController(controller.address, true)

    resolver = await deploy(
      'PublicResolver',
      fns.address,
      nameWrapper.address,
      controller.address,
      reverseRegistrar.address,
    )

    callData = [
      resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
        namehash('newconfigname.fil'),
        registrantAccount,
      ]),
      resolver.interface.encodeFunctionData('setText', [
        namehash('newconfigname.fil'),
        'url',
        'ethereum.com',
      ]),
    ]

    resolver2 = await resolver.connect(signers[1])

    await fns.setSubnodeOwner(EMPTY_BYTES, sha3('reverse'), accounts[0], {
      from: accounts[0],
    })
    await fns.setSubnodeOwner(
      namehash('reverse'),
      sha3('addr'),
      reverseRegistrar.address,
      { from: accounts[0] },
    )
  })

  beforeEach(async () => {
    result = await ethers.provider.send('evm_snapshot')
  })
  afterEach(async () => {
    await ethers.provider.send('evm_revert', [result])
  })

  it('reward issuance and token minting', async () => {
    await registerName('newconfigname')

    expect(
        (await web3.eth.getBalance(sundayAddress) - 0),
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))

    expect(
        (await token.balanceOf(ownerAccount)),
    ).to.equal('100000000000000000000')
  })

  it('it can only be pledged on sundays', async () => {
    await registerName('newconfigname')
    var week = await getWeek();

    //Monday
    await evm.advanceTime((8 - week) * 24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await expect(
        token.pledge('1000000000000000000'),
    ).to.be.revertedWith('ERC20Pausable: token transfer while paused')

    await evm.advanceTime(24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal('99000000000000000000')

    expect(
        (await sunday.balanceOf(ownerAccount)).toString(),
    ).to.equal('1000000000000000000')

    expect(
        (await sunday.totalSupply()).toString(),
    ).to.equal('1000000000000000000')

    await sunday.withdrawal('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal('100000000000000000000')

    expect(
        (await sunday.balanceOf(ownerAccount)).toString(),
    ).to.equal('0')

    expect(
        (await sunday.totalSupply()).toString(),
    ).to.equal('0')
  })

  it('you cant collect your earnings on sundays', async () => {
    await registerName('newconfigname')
    var week = await getWeek();

    //Sunday
    await evm.advanceTime((7 - week) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal('99000000000000000000')

    await expect(
        sunday.claimEarnings(),
    ).to.be.revertedWith('Pausable: not paused')

    let sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        sundayBalance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))

    await evm.advanceTime(24 * 3600)
    week = await sunday.week()
    await expect(
        sunday.claimEarnings(),
    ).to.emit(sunday, 'Earnings')
        .withArgs(ownerAccount, week, Math.floor(sundayBalance/ 64).toString(), '0')

    await expect(
        sunday.claimEarnings(),
    ).to.be.revertedWith('SUN: already claim earnings')
  })

  it('you cant collect your earnings on sundays with fns', async () => {
    let beforeBalance = parseInt(await web3.eth.getBalance(beneficiary))

    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    let baseCost = ethers.BigNumber.from(REGISTRATION_TIME)
    let balance = ethers.BigNumber.from('99000000000000000000')
    balance = balance.sub(baseCost)
    var week = await getWeek();

    //Sunday
    await evm.advanceTime((7 - week) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal(balance.toString())

    expect(
        (await token.balanceOf(beneficiary)).toString(),
    ).to.equal(baseCost.div(10).toString())

    await expect(
        sunday.claimEarnings(),
    ).to.be.revertedWith('Pausable: not paused')

    let sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        sundayBalance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))
    expect(
        parseInt(await web3.eth.getBalance(beneficiary)) - beforeBalance,
    ).to.equal(Math.floor(REGISTRATION_TIME /10))

    await evm.advanceTime(24 * 3600)
    week = await sunday.week()
    await expect(
        sunday.claimEarnings(),
    ).to.emit(sunday, 'Earnings')
        .withArgs(ownerAccount, week, Math.floor(sundayBalance/ 64).toString(), baseCost.mul(9).div(640).toString())  // 90% of the proceeds go into the pledge pool

    await expect(
        sunday.claimEarnings(),
    ).to.be.revertedWith('SUN: already claim earnings')
  })

  it('the function registerFns of RegistrarController cannot be called directly', async () => {
    var commitment = await controller.makeCommitment(
        name,
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0
    )
    var tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
        (await provider.getBlock(tx.blockNumber)).timestamp,
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    await expect(controller.registerFns(
        name,
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0
    )).to.be.revertedWith(
        'FNS: caller is not the fns',
    )
  })

  it('the function renew of RegistrarController can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    await expect(controller.renew(
        'newconfigname1',
        DAYS,
        { value: BUFFERED_REGISTRATION_COST }
    )).to.be.emit(controller, 'NameRenewed')
  })

  it('the function renewFns of RegistrarController cannot be called directly', async () => {
    await registerName('newconfigname')

    await expect(controller.renewFns(
        'newconfigname',
        REGISTRATION_TIME
    )).to.be.revertedWith(
        'FNS: caller is not the fns',
    )
  })
})
