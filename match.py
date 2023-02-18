#!/usr/bin/python
# -*- coding: UTF-8 -*-

# fns word match replace

import glob, os, re, fnmatch, platform

# execute command, and return the output
def execCmd(cmd):
    r = os.popen(cmd)
    text = r.read()
    r.close()
    return text

# write "data" to file-filename
def writeFile(filename, data):
    f = open(filename, "w")
    f.write(data)
    f.close()

def find_files(directory, pattern):
    names = []
    for root, dirs, files in os.walk(directory):
        for basename in files:
            if fnmatch.fnmatch(basename, pattern):
                filename = os.path.join(root, basename)
                names.append(filename)
    return names

def getRemoteUrl():
    cmd = "git remote -v 2>&1"
    result = execCmd(cmd)
    lines = result.splitlines()
    if lines[0].startswith("fatal: detected dubious ownership in repository"):
        result = execCmd(lines[3])
    return result

def addLicenseText(names):
    for name in names:
        if name.endswith(".sol"):
            with open(name,'r+', encoding='utf-8') as f:
                file = f.read()
                if not file.find("// SPDX-License-Identifier:") >= 0:
                    if not re.match("//( *)SPDX-License-Identifier: MIT(.*)", file):
                        if not re.match("pragma solidity (.*)", file):
                            file = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.17;\n" + file
                        else:
                            file = "// SPDX-License-Identifier: MIT\n" + file
                        f.seek(0)
                        f.write(file)
                        f.truncate()
                f.close()

def replacetext(name, search_texts):
	with open(name,'r+', encoding='utf-8') as f:
		file = f.read()
		for search_text in search_texts:
		    #file = re.sub(search_text[0], search_text[1], file)
		    file = file.replace(search_text[0], search_text[1])
		f.seek(0)
		f.write(file)
		f.truncate()
		f.close()

def replacetfiles(names, search_texts):
    for name in names:
        print(name)
        replacetext(name, search_texts)

def findfileEnsContracts():
    #os.chdir("contracts")# use whatever directory you want
    solfiles = find_files("contracts", "*.sol")
    jsfiles = find_files("test", "*.js")
    tsfiles = find_files("deploy", "*.ts")
    files = solfiles + jsfiles + tsfiles + find_files("test", "*.sol") + find_files("contracts", "README.md")
    files.append('index.js')
    #print(files)
    return files

def replacetEnsContracts(search_texts):
    files = findfileEnsContracts()
    #print(files)
    addLicenseText(files)
    replacetfiles(files, search_texts)

def rename(src, dest):
    if platform.system().lower() == 'windows':
        src = src.replace('/', '\\')
        dest = dest.replace('/', '\\')
    if os.path.exists(src):
        cmd = "git mv {} {}".format(src, dest)
        print(cmd)
        execCmd(cmd)

def remove(src):
    if platform.system().lower() == 'windows':
        src = src.replace('/', '\\')
    if os.path.exists(src):
        cmd = "git rm {} -r -f".format(src)
        print(cmd)
        execCmd(cmd)

def matchEnsContracts():
    rename("contracts/ethregistrar","contracts/registrar")
    rename("contracts/registrar/IETHRegistrarController.sol","contracts/registrar/IRegistrarController.sol")
    rename("contracts/registrar/ETHRegistrarController.sol","contracts/registrar/RegistrarController.sol")
    rename("deploy/ethregistrar","deploy/registrar")
    rename("deploy/registrar/03_deploy_eth_registrar_controller.ts","deploy/registrar/03_deploy_registrar_controller.ts")
    rename("test/ethregistrar","test/registrar")
    rename("test/registrar/TestEthRegistrarController.js","test/registrar/TestRegistrarController.js")
    rename("contracts/registry/ENS.sol","contracts/registry/FNS.sol")
    rename("contracts/registry/ENSRegistry.sol","contracts/registry/Registry.sol")
    remove("contracts/registry/ENSRegistryWithFallback.sol")
    remove("test/registry/TestENSRegistryWithFallback.js")
    remove("deploy/registrar/02_deploy_legacy_eth_registrar_controller.ts")
    remove("deploy/resolvers/00_deploy_legacy_public_resolver.ts")
    replacetEnsContracts([
        ["//SPDX-License-Identifier: MIT", "// SPDX-License-Identifier: MIT"],
        ["pragma solidity ^0.8.4;", "pragma solidity ^0.8.17;"],
        ["pragma solidity ^0.8.13;", "pragma solidity ^0.8.17;"],
        ["pragma solidity >=0.8.4;", "pragma solidity ^0.8.17;"],
        ["ENSRegistry", "Registry"],
        ["IETHRegistrarController", "IRegistrarController"],
        ["ETHRegistrarController", "RegistrarController"],
        ["ETH_NAMEHASH", "FIL_NAMEHASH"],
        ["ETH_NODE", "FIL_NODE"],
        ["trustedETHController", "trustedController"],
        ["_trustedETHController", "_trustedController"],
        ["unwrapETH2LD", "unwrap2LD"],
        ["wrapETH2LD", 'wrap2LD'],
        ["WrapETH2LD", "Wrap2LD"],
        ["_wrapETH2LD", "_wrap2LD"],
        ["upgradeETH2LD", "upgrade2LD"],
        ["registerAndWrapETH2LD", "registerAndWrap2LD"],
        ["vitalik.eth", "vitalik.fil"],
        ['x03eth', "x03fil"],
        ["ETH-only", "FIL-only"],
        ["ETH_LABEL", "FIL_LABEL"],
        [' ETH2LD ', ' 2LD '],
        ['EnsRegistry.', 'Registry.'],
        ['/ethregistrar/', '/registrar/'],
        ['.base.eth', '.base.fil'],
        ['current .eth', 'current .fil'],
        ["ENS.sol", "FNS.sol"],
        ['  RegistryWithFallback,\n', ''],
        ["const RegistryWithFallback = require('./build/contracts/RegistryWithFallback')\n", ""],
        ["93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae", "78f6b1389af563cc5c91f234ea46b055e49658d8b999eeb9e0baef7dbbc93fdb"],
        ["03657468000001000100000e1000", "0366696c000001000100000e1000"],
        ['03657468000006000100015180003a036e733106657468646e730378797a000a686f73746d617374657205746573743103657468', '0366696c000006000100015180003a036e73310666696c646e730378797a000a686f73746d61737465720574657374310366696c'],
        ['0x40e4b5d9555b6f20c264b5922e90f08889074195ec29c4256db06da93d187ce0', '0x4ccb1b53d75909f05555ba03f5bebfcb1ecfefb6589ed25bc1c6739625396adb'],
        ['0xbb7d787fe3173f5ee43d9616afca7cbd40c9824f2be1d61def0bbbad110261f7', '0x77ddad5c55827a1035e0a445d302d4ab72fd1d83192181345ff11a99debfd9a3'],
        ['0x5f1471f6276eafe687a7aceabaea0bce02fafaf1dfbeb787b3725234022ee294', '0x490ac2461c7528df4d0784d9871d770550255d8a9d79eaa677b4606eb788434c'],
        [" ens ", " fns "], [" ens;", " fns;"], [" ens.", " fns."], ["(ens.", "(fns."], [".ens(", ".fns("], [" _ens", " _fns"], ['.eth`', '.fil`'], ['.eth.', '.fil.'], ["'eth.'", "'fil.'"], [" eth.", " fil."],
        ["!ens.", "!fns."], [" _ens.", " _fns."], [" ens,", " fns,"], [".ens.", ".fns."], ["_ens.", "_fns."], ["	ens ", "	fns "], ["'ens()'", "'fns()'"], ['.eth"', '.fil"'],
        [' ens() ', ' fns() '], ['(ENS)', '(FNS)'], ["/ENS'", "/FNS'"],
        [".eth)", ".fil)"], ['".eth"', '".fil"'], [".eth ", ".fil "], [".eth'", ".fil'"], ["'eth'", "'fil'"], ['.eth"', '.fil"'], ['"eth"', '"fil"'], ["let ens", "let fns"],
        [" ENS ", " FNS "], [" ENS;", " ENS;"], [" ENS.", " FNS."], ["(ENS.", "(FNS."], [".ENS(", ".FNS("], [" ENS,", " FNS,"], ["'ENS'", "'FNS'"],
        ["(ENS ", "(FNS "], ["{ENS}", "{FNS}"], ["'ENS ", "'FNS "], ["'ENS ", "'FNS "], ["[ENS,", "[FNS,"], [" ENS(", " FNS("], [" ETH ", " FIL "], [" EnsRegistry", " Registry"],
        ["web3.fil.", "web3.eth."],
    ])

def findfileEnsjs():
    files = find_files("src", "*.ts")
    return files

def replacetEnsjs(search_texts):
    files = findfileEnsjs()
    replacetfiles(files, search_texts)

def matchEnsjs():
    rename("src/contracts/ethRegistrarController.ts", "src/contracts/registrarController.ts")
    rename("src/generated/ENSRegistry.ts", "src/generated/Registry.ts")
    rename("src/generated/ETHRegistrarController.ts", "src/generated/RegistrarController.ts")
    rename("src/generated/factories/ENSRegistry__factory.ts", "src/generated/factories/Registry__factory.ts")
    rename("src/generated/factories/ETHRegistrarController__factory.ts", "src/generated/factories/RegistrarController__factory.ts")
    replacetEnsjs([
        [".eth'", ".fil'"],  ["'eth'", "'fil'"], ['.eth ', '.fil '],
        ["ensInstance", "fnsInstance"],
        ['ENSArgs', 'FNSArgs'],
        [' ENS\n', ' FNS\n'], [' ENS ', ' FNS '], [' ENS.', ' FNS.'], [" ENS'", " FNS'"], ['{ENS} ', '{FNS} '], [' ENS(', ' FNS('], [' newENS', ' newFNS'],
        [' ENS,', ' FNS,'], [' ENS>', ' FNS>'],
        [' ETH ', ' FIL '],
        [' .eth\n', ' .fil\n'],
        ['.unwrapETH2LD(', '.unwrap2LD('],
        ["unwrapETH2LD", "unwrap2LD"],
        [' ENSOptions', ' FNSOptions'],
        [' InternalENS', ' InternalFNS'],
        [' StaticENS', ' StaticFNS'],
        ["wrapETH2LD", 'wrap2LD'],
        ["WrapETH2LD", "Wrap2LD"],
        ["_wrapETH2LD", "_wrap2LD"],
        ["upgradeETH2LD", "upgrade2LD"],
        ["registerAndWrapETH2LD", "registerAndWrap2LD"],
        ['ENSRegistry__factory', 'Registry__factory'],
        ['ETHRegistrarController__factory', 'RegistrarController__factory'],
        ['getEthRegistrarController', 'getRegistrarController'],
        ['ENSRegistry', 'Registry'],
        ['ETHRegistrarController', 'RegistrarController'],
        ['0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae', '0x78f6b1389af563cc5c91f234ea46b055e49658d8b999eeb9e0baef7dbbc93fdb'],
        ['0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f', '0xbae79aa33d674a496f9e0782c1a197bbac0d7a2dcccb8a7b67e76b72fe6eabcd'],
        ["export type SupportedNetworkId = '1' | '3' | '4' | '5' | '1337'", "export type SupportedNetworkId = '1' | '3' | '4' | '5' | '314' | '3141' |  '31337'"],
    ])

def findfileSubgraph():
    files = find_files("src", "*.ts") + find_files("tests", "*.ts")
    return files

def replacetSubgraph(search_texts):
    files = findfileSubgraph()
    replacetfiles(files, search_texts)

def matchSubgraph():
    rename("abis/EthRegistrarController.json", "abis/RegistrarController.json")
    rename("src/ensRegistry.ts", "src/registry.ts")
    rename("src/ethRegistrar.ts", "src/registrar.ts")
    rename("tests/ensRegistrar.test.ts", "tests/registrar.test.ts")
    remove("abis/AuctionRegistrar.json")
    remove("abis/Deed.json")
    remove("abis/EthRegistrarControllerOld.json")
    replacetSubgraph([
        ['EnsRegistry', 'Registry'],
        ["ENSRegistry", "Registry"],
        ['EthRegistrarController', 'RegistrarController'],
        ['ensRegistry', 'registry'],
        ['ethRegistrar', 'registrar'],
        ['ETH_NAMEHASH', 'FIL_NAMEHASH'],
        ["'.eth'", "'.fil'"], ['.eth)', '.fil)'],
        ['93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae', '78f6b1389af563cc5c91f234ea46b055e49658d8b999eeb9e0baef7dbbc93fdb'],
    ])

if __name__ == '__main__':
    result = getRemoteUrl()
    if result.find("https://github.com/ensdomains/ens-contracts") >= 0 or result.find("https://github.com/fildomains/fns-contracts") >= 0:
        matchEnsContracts()
    elif result.find("https://github.com/ensdomains/ensjs-v3") >= 0:
        matchEnsjs()
    elif result.find("https://github.com/ensdomains/ens-subgraph") >= 0:
        matchSubgraph()

        #find_files("contracts", "*.sol")

