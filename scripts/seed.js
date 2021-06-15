const fs = require('fs')
const n = require('eth-ens-namehash')
const envfile = require('envfile')
const sourcePath = './.env'
const packet = require('dns-packet')
const { utils, BigNumber: BN } = ethers
const { use, expect } = require('chai')
const { solidity } = require('ethereum-waffle')

use(solidity)

const namehash = n.hash
const labelhash = (label) => utils.keccak256(utils.toUtf8Bytes(label))

function encodeName(name) {
  return '0x' + packet.name.encode(name).toString('hex')
}

async function main() {
    const sourceFile = fs.readFileSync(sourcePath)
    const parsedFile = envfile.parse(sourceFile);
    const [deployer] = await ethers.getSigners();
    console.log({parsedFile})
    const CAN_DO_EVERYTHING = 0
    const firstAddress = deployer.address
    console.log("Account balance:", (await deployer.getBalance()).toString());
    const {
      REGISTRY_ADDRESS:registryAddress,
      REGISTRAR_ADDRESS:registrarAddress,
      WRAPPER_ADDRESS:wrapperAddress
    } = parsedFile
    console.log({
      registryAddress,registrarAddress, wrapperAddress, firstAddress
    })
    const EnsRegistry = await (await ethers.getContractFactory("ENSRegistry")).attach(registryAddress);
    const BaseRegistrar = await (await ethers.getContractFactory("BaseRegistrarImplementation")).attach(registrarAddress);
    const NameWrapper = await (await ethers.getContractFactory("NameWrapper")).attach(wrapperAddress);
    const namehashedname = namehash('postmigration.eth')
    const labelhashedname = labelhash('postmigration')
    console.log(1, {namehashedname, labelhashedname})
    const registrarOwner = await BaseRegistrar.ownerOf(labelhashedname)
    
    await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)
    await EnsRegistry.setApprovalForAll(NameWrapper.address, true)
    await NameWrapper.wrap(encodeName('sub1.testing.eth'), firstAddress, CAN_DO_EVERYTHING)

    // const isApproved = await BaseRegistrar.isApprovedForAll(registrarOwner, firstAddress)
    // console.log(1.1, {
    //   registrarOwner,
    //   firstAddress,
    //   isApproved
    // })
    // await NameWrapper.wrapETH2LD('superawesome', firstAddress, CAN_DO_EVERYTHING)
    console.log(2.1)
    // await NameWrapper.wrapETH2LD('postmigration', firstAddress, CAN_DO_EVERYTHING)
    console.log(2.2)
    // console.log(3)
    // let owner = await NameWrapper.ownerOf(namehashedname)
    // console.log(4, {owner})
    // console.log(5)
    // console.log(6)
    // let tokenURI = await NameWrapper.uri(namehashedname)
    // console.log(7)
    // console.log('owner', {owner, tokenURI})
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });