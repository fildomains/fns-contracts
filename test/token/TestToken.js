const {
  ens: { namehash },
  evm,
  reverse: { getReverseNode },
  contracts: { deploy },
  deployController: {deployController},
} = require('../test-utils')

const { expect } = require('chai')

const { ethers } = require('hardhat')
const provider = ethers.provider
const sha3 = require('web3-utils').sha3
const {
  EMPTY_BYTES32: EMPTY_BYTES,
  EMPTY_ADDRESS: ZERO_ADDRESS,
} = require('../test-utils/constants')
const { Interface } = require("ethers/lib/utils");
const { BigNumber } = require("@ethersproject/bignumber");
const { mine } = require("../../scripts/utils");

const DAYS = 24 * 60 * 60
const REGISTRATION_TIME = 28 * DAYS
const BUFFERED_REGISTRATION_COST = REGISTRATION_TIME + 3 * DAYS
const NULL_ADDRESS = ZERO_ADDRESS

contract('FNSToken', function () {
  let fns
  let resolver
  let resolver2 // resolver signed by accounts[1]
  let baseRegistrar
  let controller
  let controller2 // controller signed by accounts[1]
  let token
  let sundayAddress
  let receiverAddress
  let receiver
  let sunday
  let priceOracle
  let reverseRegistrar
  let nameWrapper
  let dummyOracle

  const secret =
    '0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'
  let ownerAccount // Account that owns the registrar
  let registrantAccount // Account that owns test names
  let signers
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
      0,
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

  async function getDay(){
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
    registrantAccount = ownerAccount
    accounts = [ownerAccount, registrantAccount, await signers[2].getAddress()]

    fns = await deploy('Registry')

    baseRegistrar = await deploy(
      'BaseRegistrarImplementation',
      fns.address,
      namehash('fil'),
    )

    reverseRegistrar = await deploy('ReverseRegistrar', fns.address)

    await fns.setSubnodeOwner(EMPTY_BYTES, sha3('reverse'), accounts[0])
    await fns.setSubnodeOwner(
        namehash('reverse'),
        sha3('addr'),
        reverseRegistrar.address,
    )

    nameWrapper = await deploy(
        'NameWrapper',
        fns.address,
        baseRegistrar.address,
        ownerAccount,
    )

    dummyOracle = await deploy('DummyOracle', '100000000')
    priceOracle = await deploy(
      'StablePriceOracle',
      dummyOracle.address,
      [0, 0, 4, 2, 1],
    )

    controller = await deployController(
        {baseRegistrar, priceOracle, reverseRegistrar, nameWrapper}
    )

    resolver = await deploy(
        'PublicResolver',
        fns.address,
        nameWrapper.address,
        controller.address,
        reverseRegistrar.address,
    )

    await fns.setSubnodeRecord(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        sha3('fil'),
        ownerAccount,
        resolver.address,
        0,
    )
    await resolver.setInterface(namehash('fil'), '0x4d6b2f7a', nameWrapper.address)

    await fns.setSubnodeOwner(EMPTY_BYTES, sha3('fil'), baseRegistrar.address)

    await reverseRegistrar.setDefaultResolver(resolver.address)

    controller2 = controller.connect(signers[1])

    token = await ethers.getContractAt('FNSToken', await controller.token())
    sundayAddress = await token.sunday()
    receiverAddress = await token.receiver()
    sunday = await ethers.getContractAt('Sunday', sundayAddress)
    receiver = await ethers.getContractAt('Receiver', receiverAddress)

    await baseRegistrar.addController(controller.address)
    await nameWrapper.setController(controller.address, true)
    await baseRegistrar.addController(nameWrapper.address)
    await reverseRegistrar.setController(controller.address, true)

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

  it('initialize the reward pool', async () => {
    expect(
        (await token.balanceOf(sundayAddress)),
    ).to.equal('0')
    expect(
        (await token.totalSupply()),
    ).to.equal('0')
    expect(
        (await sunday.totalSupply()),
    ).to.equal('0')
  })

  it('reward issuance and token minting', async () => {
    await registerName('newconfigname')

    expect(
        (await web3.eth.getBalance(sundayAddress) - 0),
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))

    expect(
        (await token.balanceOf(receiverAddress)),
    ).to.equal('10000000000000000000')

    expect(
        (await token.balanceOf(ownerAccount)),
    ).to.equal('50000000000000000000')
  })

  it('it can only be pledged on sundays', async () => {
    await registerName('newconfigname')
    var dayOfWeek = await getDay();

    //Monday
    await evm.advanceTime((8 - dayOfWeek) * 24 * 3600)
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
    ).to.equal('49000000000000000000')

    expect(
        (await sunday.balanceOf(ownerAccount)).toString(),
    ).to.equal('1000000000000000000')

    expect(
        (await sunday.totalSupply()).toString(),
    ).to.equal('1000000000000000000')

    await sunday.withdrawal('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal('50000000000000000000')

    expect(
        (await sunday.balanceOf(ownerAccount)).toString(),
    ).to.equal('0')

    expect(
        (await sunday.totalSupply()).toString(),
    ).to.equal('0')
  })

  it('you cant collect your earnings on sundays', async () => {
    await registerName('newconfigname')
    var dayOfWeek = await getDay();

    //Sunday
    await evm.advanceTime((7 - dayOfWeek) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal('49000000000000000000')

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('Pausable: not paused')

    let sundayFnsBalance = await token.balanceOf(sundayAddress)
    let totalSupply = await sunday.totalSupply()
    let balance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        balance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))
    expect(
        sundayFnsBalance.sub(totalSupply).toString(),
    ).to.equal('40000000000000000000')

    await evm.advanceTime(24 * 3600)
    const week = await sunday.week()
    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.emit(sunday, 'Earnings')
        .withArgs(namehash('newconfigname.fil'), ownerAccount, week, Math.floor(balance/ 64).toString(), sundayFnsBalance.sub(totalSupply).div(64).toString())

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('SUN: already claim earnings')
  })

  it('you can collect your earnings on sundays with fns', async () => {
    let beforeBalance = parseInt(await web3.eth.getBalance(receiverAddress))

    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    let sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('40000000000002177280')
    let baseCost = ethers.BigNumber.from(REGISTRATION_TIME)
    let balance = ethers.BigNumber.from('49000000000000000000')
    balance = balance.sub(baseCost)
    var dayOfWeek = await getDay();

    //Sunday
    await evm.advanceTime((7 - dayOfWeek) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal(balance.toString())

    expect(
        (await token.balanceOf(receiverAddress)).toString(),
    ).to.equal(baseCost.div(10).add(ethers.BigNumber.from('10000000000000000000')).toString())

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('Pausable: not paused')

    let totalSupply = await sunday.totalSupply()
    expect(
        totalSupply.toString(),
    ).to.equal('1000000000000000000')
    let sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        sundayBalance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))
    expect(
        parseInt(await web3.eth.getBalance(receiverAddress)) - beforeBalance,
    ).to.equal(Math.floor(REGISTRATION_TIME /10))
    sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('41000000000002177280')

    await evm.advanceTime(24 * 3600)
    let week = await sunday.week()
    let nameWrapperAddress = await sunday.getNameWrapper()
    expect(
        nameWrapperAddress,
    ).to.equal(nameWrapper.address)
    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.emit(sunday, 'Earnings')
        .withArgs(namehash('newconfigname.fil'), ownerAccount, week, Math.floor(sundayBalance/ 64).toString(), baseCost.mul(9).div(640).add(ethers.BigNumber.from('40000000000000000000').div(64)).toString())  // 90% of the proceeds go into the pledge pool

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('SUN: already claim earnings')

    await evm.advanceTime(15 * 7 * 24 * 3600)
    await mine(network.provider)

    totalSupply = await sunday.totalSupply()
    sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    sundayFnsBalance = await token.balanceOf(sundayAddress)
    week = await sunday.week()
    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.emit(sunday, 'Earnings')
        .withArgs(namehash('newconfigname.fil'), ownerAccount, week, Math.floor(sundayBalance/ 64).toString(), sundayFnsBalance.sub(totalSupply).div(64).toString())

    await evm.advanceTime(2 * 7 * 24 * 3600)

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('SUN: claimEarnings to the zero address')
  })

  it('you can collect your earnings on sundays with fns, using subnames', async () => {
    let beforeBalance = parseInt(await web3.eth.getBalance(receiverAddress))

    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    let sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('40000000000002177280')
    let baseCost = ethers.BigNumber.from(REGISTRATION_TIME)
    let balance = ethers.BigNumber.from('49000000000000000000')
    balance = balance.sub(baseCost)
    var dayOfWeek = await getDay();

    //Sunday
    await evm.advanceTime((7 - dayOfWeek) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal(balance.toString())

    expect(
        (await token.balanceOf(receiverAddress)).toString(),
    ).to.equal(baseCost.div(10).add(ethers.BigNumber.from('10000000000000000000')).toString())

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('Pausable: not paused')

    let totalSupply = await sunday.totalSupply()
    expect(
        totalSupply.toString(),
    ).to.equal('1000000000000000000')
    let sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        sundayBalance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))
    expect(
        parseInt(await web3.eth.getBalance(receiverAddress)) - beforeBalance,
    ).to.equal(Math.floor(REGISTRATION_TIME /10))
    sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('41000000000002177280')

    await evm.advanceTime(24 * 3600)
    const week = await sunday.week()
    const nameWrapperAddress = await sunday.getNameWrapper()
    expect(
        nameWrapperAddress,
    ).to.equal(nameWrapper.address)

    await nameWrapper.setSubnodeRecord(
        namehash('newconfigname.fil'),
        'a',
        ownerAccount,
        resolver.address,
        '0',
        0,
        BigNumber.from(2).pow(64).sub(1)
    )

    await expect(
        sunday.claimEarnings(namehash('a.newconfigname.fil')),
    ).to.emit(sunday, 'Earnings')
        .withArgs(namehash('a.newconfigname.fil'), ownerAccount, week, Math.floor(sundayBalance/ 64).toString(), baseCost.mul(9).div(640).add(ethers.BigNumber.from('40000000000000000000').div(64)).toString())  // 90% of the proceeds go into the pledge pool

    await expect(
        sunday.claimEarnings(namehash('a.newconfigname.fil')),
    ).to.be.revertedWith('SUN: already claim earnings')
  })

  it('you cant collect your earnings on sundays with fns, name has been unwarp to base', async () => {
    let beforeBalance = parseInt(await web3.eth.getBalance(receiverAddress))

    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    let sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('40000000000002177280')
    let baseCost = ethers.BigNumber.from(REGISTRATION_TIME)
    let balance = ethers.BigNumber.from('49000000000000000000')
    balance = balance.sub(baseCost)
    var dayOfWeek = await getDay();

    //Sunday
    await evm.advanceTime((7 - dayOfWeek) * 24 * 3600)
    await token.pledge('1000000000000000000')
    expect(
        (await token.balanceOf(ownerAccount)).toString(),
    ).to.equal(balance.toString())

    expect(
        (await token.balanceOf(receiverAddress)).toString(),
    ).to.equal(baseCost.div(10).add(ethers.BigNumber.from('10000000000000000000')).toString())

    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('Pausable: not paused')

    let totalSupply = await sunday.totalSupply()
    expect(
        totalSupply.toString(),
    ).to.equal('1000000000000000000')
    let sundayBalance = parseInt(await web3.eth.getBalance(sundayAddress))
    expect(
        sundayBalance,
    ).to.equal(Math.floor((REGISTRATION_TIME * 9) /10))
    expect(
        parseInt(await web3.eth.getBalance(receiverAddress)) - beforeBalance,
    ).to.equal(Math.floor(REGISTRATION_TIME /10))
    sundayFnsBalance = await token.balanceOf(sundayAddress)
    expect(
        sundayFnsBalance.toString(),
    ).to.equal('41000000000002177280')

    await nameWrapper.unwrap2LD(sha3('newconfigname'), ownerAccount, baseRegistrar.address)

    await evm.advanceTime(24 * 3600)
    const week = await sunday.week()
    const nameWrapperAddress = await sunday.getNameWrapper()
    expect(
        nameWrapperAddress,
    ).to.equal(nameWrapper.address)
    await expect(
        sunday.claimEarnings(namehash('newconfigname.fil')),
    ).to.be.revertedWith('SUN: claimEarnings to the zero address')
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

  it('the function of setController DummyOracle can be called directly', async () => {
    const dummyOracleOther = dummyOracle.connect(signers[5])
    const otherAddress = await signers[5].getAddress()

    await expect(
        dummyOracleOther.set(1)
    ).to.be.revertedWith(
        'Controllable: Caller is not a controller',
    )

    await expect(
        dummyOracleOther.setController(
            otherAddress,
            true
        )
    ).to.be.revertedWith(
        'Ownable: caller is not the owner',
    )

    await expect(
        dummyOracleOther.transferOwnership(otherAddress)
    ).to.be.revertedWith(
        'Ownable: caller is not the owner',
    )

    await expect(
        dummyOracle.transferOwnership(otherAddress)
    ).to.be.emit(dummyOracle, 'OwnershipTransferred').withArgs(ownerAccount, otherAddress);

    await expect(dummyOracleOther.setController(
        otherAddress,
        true
    )).to.be.emit(dummyOracle, 'ControllerChanged').withArgs(otherAddress, true );

    const tx = await dummyOracleOther.set(1)
    const receipt = await tx.wait()

    expect(
        await dummyOracleOther.latestAnswer()
    ).to.be.equal('1')
  })

  it('the function of setController Receiver can be called directly', async () => {
    const reciverOther = receiver.connect(signers[5])
    const otherAddress = await signers[5].getAddress()

    await expect(
       reciverOther.setController(
           otherAddress,
          true
      )
    ).to.be.revertedWith(
        'Ownable: caller is not the owner',
    )

    await expect(
        reciverOther.transferOwnership(otherAddress)
    ).to.be.revertedWith(
        'Ownable: caller is not the owner',
    )

    await expect(
        receiver.transferOwnership(otherAddress)
    ).to.be.emit(receiver, 'OwnershipTransferred').withArgs(ownerAccount, otherAddress);

    await expect(await reciverOther.setController(
        await signers[6].getAddress(),
        true
    )).to.be.emit(receiver, 'ControllerChanged').withArgs(await signers[6].getAddress(), true);
  })

  it('the function of withdraw Receiver can be called directly', async () => {
    expect(await web3.eth.getBalance(receiverAddress)).to.be.equal('0')
    expect(await token.balanceOf(receiverAddress)).to.be.equal('0')

    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    expect(await web3.eth.getBalance(receiverAddress)).to.be.equal('241920')
    expect((await token.balanceOf(sundayAddress)).toString()).to.be.equal('40000000000002177280')
    expect((await token.balanceOf(receiverAddress)).toString()).to.be.equal('10000000000000241920')

    const reciverOther = receiver.connect(signers[5])

    await expect(reciverOther.setController(
        await signers[5].getAddress(),
        true
    )).to.be.revertedWith(
      'Ownable: caller is not the owner',
    )

    await expect(reciverOther.withdraw()).to.be.revertedWith(
        'Controllable: Caller is not a controller',
    )

    const withdrawAddress = await signers[6].getAddress()
    await expect(receiver.setController(
        withdrawAddress,
        true
    )).to.be.emit(receiver, 'ControllerChanged').withArgs(withdrawAddress, true );

    let beforeBalance = ethers.BigNumber.from(await web3.eth.getBalance(withdrawAddress))

    const tx = await receiver.connect(signers[6]).withdraw()
    const receipt = await tx.wait()

    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balance = ethers.BigNumber.from(await web3.eth.getBalance(withdrawAddress))
    expect(balance).to.be.equal(beforeBalance.sub(gasUsed).add(241920))
    expect((await token.balanceOf(withdrawAddress)).toString()).to.be.equal('10000000000000241920')

    expect(await web3.eth.getBalance(receiverAddress)).to.be.equal('0')
    expect(await token.balanceOf(receiverAddress)).to.be.equal('0')
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

  it('the function rentPrice of FNSToken can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')
    await registerNameFns('newconfigname2')

     expect((await token['rentPrice(string,uint256)'](
        'newconfigname1',
         DAYS
    ))[2].toString()).to.be.equal(DAYS.toString())

    let result = await token['rentPrice(string[],uint256)'](
        ['newconfigname1', 'newconfigname2'],
        DAYS
    )

    expect(result[0]).to.be.equal(DAYS * 2)
    expect(result[1]).to.be.equal(DAYS * 2)
  })

  it('the function renew of FNSToken can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    const expires = parseInt(await baseRegistrar.nameExpires(sha3('newconfigname1')))
    const balance = parseInt(await token.balanceOf(ownerAccount))

    await expect(token.renew(
        'newconfigname1',
        DAYS
    )).to.be.emit(token, 'NameRenewed')

    expect(parseInt(await baseRegistrar.nameExpires(sha3('newconfigname1')))).to.be.equal(expires + DAYS);
    expect(parseInt(await token.balanceOf(ownerAccount))).to.be.equal(balance - DAYS);
  })

  it('the function renew of FNSToken can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')

    await expect(token.renew(
        'newconfigname1',
        DAYS,
        { value: BUFFERED_REGISTRATION_COST }
    )).to.be.revertedWith(
        'FNS: Please pay in FNS',
    )
  })

  it('the function renewAll of FNSToken can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')
    await registerNameFns('newconfigname2')

    const expires1 = parseInt(await baseRegistrar.nameExpires(sha3('newconfigname1')))
    const expires2 = parseInt(await baseRegistrar.nameExpires(sha3('newconfigname2')))
    const balance = parseInt(await token.balanceOf(ownerAccount))

    await expect(token.renewAll(
        ['newconfigname1', 'newconfigname2'],
        DAYS
    )).to.be.emit(token, 'NameRenewed')

    expect(parseInt(await baseRegistrar.nameExpires(sha3('newconfigname1')))).to.be.equal(expires1 + DAYS);
    expect(parseInt(await baseRegistrar.nameExpires(sha3('newconfigname2')))).to.be.equal(expires2 + DAYS);
    expect(parseInt(await token.balanceOf(ownerAccount))).to.be.equal(balance - (2 * DAYS));
  })

  it('the function renewAll of FNSToken can be called directly', async () => {
    await registerName('newconfigname')
    await registerNameFns('newconfigname1')
    await registerNameFns('newconfigname2')

    await expect(token.renewAll(
        ['newconfigname1', 'newconfigname2'],
        DAYS,
        { value: BUFFERED_REGISTRATION_COST }
    )).to.be.revertedWith(
        'FNS: Please pay in FNS',
    )
  })
})
