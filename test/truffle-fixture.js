const RSASHA1Algorithm = artifacts.require('./algorithms/RSASHA1Algorithm')
const RSASHA256Algorithm = artifacts.require('./algorithms/RSASHA256Algorithm')
const SHA1Digest = artifacts.require('./digests/SHA1Digest')
const SHA256Digest = artifacts.require('./digests/SHA256Digest')
const DNSSEC = artifacts.require('./DNSSECImpl')
const DummyAlgorithm = artifacts.require('./algorithms/DummyAlgorithm')
const DummyDigest = artifacts.require('./digests/DummyDigest')
const P256SHA256Algorithm = artifacts.require('P256SHA256Algorithm.sol')
const EllipticCurve = artifacts.require('EllipticCurve.sol')

const dnsAnchors = require('./test-utils/anchors.js')

async function deploy(contract, ...args) {
  const instance = await contract.new(...args)
  contract.setAsDeployed(instance)
  return instance
}

module.exports = async function (hre) {
  let dev = hre.network.name == 'hardhat' || hre.network.name == 'local'
  // From http://data.iana.org/root-anchors/root-anchors.xml
  let anchors = dnsAnchors.realEntries

  if (dev) {
    anchors.push(dnsAnchors.dummyEntry)
  }
  const dnssec = await deploy(DNSSEC, dnsAnchors.encode(anchors))

  const rsasha256 = await deploy(RSASHA256Algorithm)
  const rsasha1 = await deploy(RSASHA1Algorithm)
  const sha256 = await deploy(SHA256Digest)
  const sha1 = await deploy(SHA1Digest)

  const curve = await deploy(EllipticCurve)
  const p256 = await deploy(P256SHA256Algorithm, curve.address)

    if (dev) {
      const dummyalgorithm = await deploy(DummyAlgorithm)
      await dnssec.setAlgorithm(253, dummyalgorithm.address)
      await dnssec.setAlgorithm(254, dummyalgorithm.address)

      const dummydigest = await deploy(DummyDigest)
      await dnssec.setDigest(253, dummydigest.address)
    }

    await dnssec.setAlgorithm(5, rsasha1.address)
    await dnssec.setAlgorithm(7, rsasha1.address)
    await dnssec.setAlgorithm(8, rsasha256.address)
    await dnssec.setAlgorithm(13, p256.address)

    await dnssec.setDigest(1, sha1.address)
    await dnssec.setDigest(2, sha256.address)
}
