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

    if(controller.address !== (await token.owner())){
        await send(token, 'transferOwnership', controller.address)
    }
    if(token.address !== (await sunday.owner())){
        await send(sunday, 'transferOwnership', token.address)
    }

    if (registrar.address !== (await registry.owner( namehash('fil')))){
        console.log('Temporarily setting owner of fil tld to owner ')

        if (owner !== (await registry.owner( namehash('fil')))) {
            await send(root, 'setSubnodeOwner', labelhash('fil'), owner)
        }

        if (owner !== (await registry.owner( namehash('data.fil')))) {
            await send(registry, 'setSubnodeOwner', namehash('fil'), labelhash('data'), owner)
        }
        if (owner !== (await registry.owner( namehash('fil-usd.data.fil')))) {
            await send(registry, 'setSubnodeOwner', namehash('data.fil'), labelhash('fil-usd'), owner)
        }

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

            if(interfaces[name] !== (await resolver.interfaceImplementer(namehash('fil'), interfaceId))) {
                console.log(`Set interface implementor of fil tld for registrar controller name:${name},interfaceId:${interfaceId},address:${interfaces[name]}`)
                await send(resolver, 'setInterface', namehash('fil'), interfaceId, interfaces[name])
            }
        }

        console.log('Set owner of fil tld back to registrar')
        await send(root, 'setSubnodeOwner', labelhash('fil'), registrar.address)
    }

    if(resolver.address !== (await registry.resolver(namehash('fil')))){
        console.log('Set registrar of fil resolver')
        await send(registrar, 'setResolver', resolver.address)
    }

    if(resolver.address !== (await reverseRegistrar.defaultResolver())) {
        console.log(`Setting default resolver on ReverseRegistrar to PublicResolver ...`)
        await send(reverseRegistrar, 'setDefaultResolver', resolver.address)
    }

    if(dummyOracle.address !== (await resolver['addr(bytes32)'](namehash('fil-usd.data.fil')))) {
        await send(resolver, 'setAddr(bytes32,address)', namehash('fil-usd.data.fil'), dummyOracle.address)
    }

    if(!(await root.controllers(dnsRegistrar.address))) {
        await send(root, 'setController', dnsRegistrar.address, true)
    }

    const controllers = ['0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199']
    for(const i in controllers) {
        const addr = controllers[i]
        if(!(await receiver.controllers(addr))) {
            await send(receiver, 'setController', addr, true)
        }
        if(!(await dummyOracle.controllers(addr))) {
            await send(dummyOracle, 'setController', addr, true)
        }
    }

    if(network.tags.test){
        const testRegistrar = await ethers.getContract('TestRegistrar')
        if (testRegistrar.address !== (await registry.owner( namehash('test')))) {
            console.log('Set registrar of test')

            if (owner !== (await registry.owner( namehash('test')))) {
                await send(root, 'setSubnodeOwner', labelhash('test'), owner)
            }
            await send(root, 'setSubnodeOwner', labelhash('test'), testRegistrar.address)
        }
    }

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
