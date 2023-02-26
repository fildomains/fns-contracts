const {deploy} = require('./contracts')
const {ethers} = require("hardhat");
const {send} = require("../../scripts/utils");
const { expect } = require('chai')

async function deployController({baseRegistrar, priceOracle, reverseRegistrar, nameWrapper}) {
    const signers = await ethers.getSigners()
    const deployer = await signers[0].getAddress()
    const nonce = await ethers.provider.getTransactionCount(deployer)
    const controllerAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce});
    const tokenAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+1});
    const sundayAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+2});
    const receiverAddress = ethers.utils.getContractAddress({from: deployer, nonce: nonce+3});

    const controller = await deploy(
        'RegistrarController',
        baseRegistrar.address,
        priceOracle.address,
        600,
        86400,
        reverseRegistrar.address,
        nameWrapper.address,
        tokenAddress
    )

    const FNStoken = await deploy('FNSToken',
        controllerAddress,
        sundayAddress,
        receiverAddress
    )

    const Sunday = await deploy('Sunday',
        tokenAddress
    )

    const Receiver = await deploy('Receiver',
        tokenAddress
    )

    expect(controllerAddress).to.equal(controller.address)
    expect(tokenAddress).to.equal(FNStoken.address)
    expect(sundayAddress).to.equal(Sunday.address)
    expect(receiverAddress).to.equal(Receiver.address)

    const fnstoken = await ethers.getContractAt('FNSToken', tokenAddress)
    const sunday = await ethers.getContractAt('Sunday', sundayAddress)

    await expect(
         fnstoken.transferOwnership(controllerAddress)
    ).to.be.emit(fnstoken, 'OwnershipTransferred').withArgs(deployer, controllerAddress);

    await expect(
         sunday.transferOwnership(tokenAddress)
    ).to.be.emit(sunday, 'OwnershipTransferred').withArgs(deployer, tokenAddress);

    return controller;
}

module.exports = {
    deployController: deployController,
}