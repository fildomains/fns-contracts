/* eslint-disable import/no-extraneous-dependencies */
import {Interface, namehash} from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import {interfaces, computeInterfaceId, send, labelhash} from '../../scripts/utils'

const labelHash = (label: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(label))

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

    console.log('Temporarily setting owner of fil tld to owner ')
    await send(root, 'setSubnodeOwner', labelHash('fil'), owner)

    await send(root, 'setSubnodeOwner', labelhash('reverse'), owner)
    await send(registry, 'setSubnodeOwner', namehash('reverse'), labelhash('addr'), reverseRegistrar.address)

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
    await send(root, 'setSubnodeOwner', labelHash('fil'), registrar.address)

    console.log('Set registrar of fil resolver')
    await send(registrar, 'setResolver', resolver.address)

    await send(reverseRegistrar, 'setDefaultResolver', resolver.address)
    console.log(`Setting default resolver on ReverseRegistrar to PublicResolver ...`)

    if (network.tags.test){
        console.log('Set registrar of test')

        const testRegistrar = await ethers.getContract('TestRegistrar')
        await send(root, 'setSubnodeOwner', labelHash('test'), owner)
        await send(root, 'setSubnodeOwner', labelhash('test'), testRegistrar.address)
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
]

export default func
