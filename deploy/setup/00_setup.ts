/* eslint-disable import/no-extraneous-dependencies */
import {Interface, namehash} from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {interfaces, computeInterfaceId, send, labelhash} from '../../scripts/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network } = hre
    const { deploy } = deployments
    const { deployer, owner } = await getNamedAccounts()

    const root = await ethers.getContract('Root', owner)
    const registry = await ethers.getContract('Registry', owner)
    const resolver = await ethers.getContract('PublicResolver', owner)
    const registrar = await ethers.getContract('BaseRegistrarImplementation')
    const controller = await ethers.getContract('RegistrarController')
    const nameWrapper = await ethers.getContract('NameWrapper')
    const bulkRenewal = await ethers.getContract('BulkRenewal')
    const dummyOracle = await ethers.getContract('DummyOracle')
    const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)
    const dnsRegistrar = await ethers.getContract('DNSRegistrar', owner)

    const token = await ethers.getContractAt('FNSToken', await controller.token())
    console.log('token:', token.address, ',controller.token():', await controller.token())
    const receiverAddress = await token.receiver()
    console.log('receiverAddress:', receiverAddress)
    const receiver = await ethers.getContractAt('Receiver', receiverAddress)
    const sundayAddress = await token.sunday()
    const sunday = await ethers.getContractAt('Sunday', sundayAddress)

    await send(token, 'transferOwnership', controller.address)
    await send(sunday, 'transferOwnership', token.address)

    console.log('Temporarily setting owner of fil tld to owner ')
    await send(root, 'setSubnodeOwner', labelhash('fil'), owner)

    await send(registry, 'setSubnodeOwner', namehash('fil'), labelhash('data'), owner)
    await send(registry, 'setSubnodeOwner', namehash('data.fil'), labelhash('fil-usd'), owner)

    const interfaces: Record<string, string> = {
        //IBaseRegistrar: registrar.address,
        IRegistrarController: controller.address,
        IBulkRenewal: bulkRenewal.address,
        NameWrapper: nameWrapper.address
    }

    const names = Object.keys(interfaces)
    for(let i = 0; i < names.length; i++){
        const name = names[i];
        const artifact = await deployments.getArtifact(name);
        const interfaceId = computeInterfaceId(new Interface(artifact.abi));

        console.log(`Set interface implementor of fil tld for registrar controller name:${name},interfaceId:${interfaceId},address:${interfaces[name]}`)
        await send(resolver, 'setInterface', namehash('fil'), interfaceId, interfaces[name])
    }

    console.log('Set owner of fil tld back to registrar')
    await send(root, 'setSubnodeOwner', labelhash('fil'), registrar.address)

    console.log('Set registrar of fil resolver')
    await send(registrar, 'setResolver', resolver.address)

    await send(reverseRegistrar, 'setDefaultResolver', resolver.address)
    console.log(`Setting default resolver on ReverseRegistrar to PublicResolver ...`)

    await send(resolver, 'setAddr(bytes32,address)', namehash('fil-usd.data.fil'), dummyOracle.address)

    await send(root, 'setController', dnsRegistrar.address, true)
    await send(receiver, 'setController', '0x6EbD420C78A3DAd8D0cF9A168EFD2F5bF2C22711', true)
    await send(dummyOracle, 'setController', '0x6EbD420C78A3DAd8D0cF9A168EFD2F5bF2C22711', true)

    console.log('Set registrar of test')

    const testRegistrar = await ethers.getContract('TestRegistrar')
    await send(root, 'setSubnodeOwner', labelhash('test'), owner)
    await send(root, 'setSubnodeOwner', labelhash('test'), testRegistrar.address)

    return true
}

func.id = 'setup'
func.tags = ['setup']
func.dependencies = [
    'root',
    'registry',
    'BaseRegistrarImplementation',
    'PublicResolver',
    'RegistrarController',
    'NameWrapper',
    'BulkRenewal',
    'DummyOracle',
    'TestRegistrar',
    'Multicall',
    'UniversalResolver',
    'dnssec-oracle',
    'dnsregistrar',
    'TestUnwrap',
]

export default func
