# ENS Name Wrapper

The ENS Name Wrapper is a smart contract that wraps existing ENS names, providing several new features:

- Wrapped names are ERC1155 tokens
- Better permission control over wrapped names
- Consistent API for names at any level of the hierarchy

In addition to implementing ERC1155, wrapped names have an ERC721-compatible `ownerOf` function to return the owner of a wrapped name.

Making ENS names ERC1155 compatible allows them to be displayed, transferred and traded in any wallet that supports the standard.

`NameWrapper` implements the optional ERC1155 metadata extension; presently this is via an HTTPS URL to a service ENS operates, but this can be changed in future as better options become available.

With the exception of the functionality to upgrade the metadata generation for tokens, there is no upgrade mechanism or centralised control over wrapped names.

## Wrapping a name

`.eth` 2LDs (second-level domains) such as `example.eth` can be wrapped by calling `wrapETH2LD(label, wrappedOwner, fuses)`. `label` is the first part of the domain name (eg, `'example'` for `example.eth`), `wrappedOwner` is the desired owner for the wrapped name, and `fuses` is a bitfield representing permissions over the name that should be irrevoacably burned (see 'Fuses' below). A `fuses` value of `0` represents no restrictions on the name.

In order to wrap a `.eth` 2LD, the owner of the name must have authorised the wrapper by calling `setApprovalForAll` on the registrar, and the caller of `wrapETH2LD` must be either the owner, or authorised by the owner on either the wrapper or the registrar.

All other domains (non `.eth` names as well as `.eth` subdomains such as `sub.example.eth` can be wrapped by calling `wrap(parentNode, label, wrappedOwner, fuses)`. `parentNode` is the namehash of the name one level higher than the name to be wrapped, `label` is the first part of the name, `wrappedOwner` is the address that should own the wrapped name, and `fuses` is a bitfield representing permissions over the name that should be irrevocably burned (see 'Fuses' below). A `fuses` value of `0` represents no restrictions on the name. For example, to wrap `sub.example.eth`, you should call `wrap(namehash('example.eth'), 'example', owner, fuses)`.

In order to wrap a domain that is not a `.eth` 2LD, the owner of the name must have authorised the wrapper by calling `setApprovalForAll` on the registry, and the caller of `wrap` must be either the owner, or authorised by the owner on either the wrapper or the registry.

## Wrapping a name by sending the `.eth` token

An alternative way to wrap `.eth` names is to send the name to the NameWrapper contract, this bypasses the need to `setApprovalForAll` on the registrar and is preferable when only wrapping one name.

To wrap a name by sending to the contract, you must add in extra data on `safeTransferFrom`, this must be formatted as a `string` for the plaintext label and a `uint96` for the fuses.

Example:

```js
// Using ethers.js
abiCoder.encode(['string', 'uint96'], ['vitalik', '0x000000000000000000000001'])
```

## Unwrapping a name

Wrapped names can be unwrapped by calling either `unwrapETH2LD(label, newRegistrant, newController)` or `unwrap(parentNode, label, newController)` as appropriate. `label` and `parentNode` have meanings as described under "Wrapping a name", while `newRegistrant` is the address that should own the .eth registrar token, and `newController` is the address that should be set as the owner of the ENS registry record.

## Working with wrapped names

The wrapper exposes all the registry functionality via its own methods - `setSubnodeOwner`, `setSubnodeRecord`, `setRecord`, `setResolver` and `setTTL` are all implemented with the same functionality as the registry, and pass through to it after doing authorisation checks. Transfers are handled via ERC1155's transfer methods rather than mirroring the registry's `setOwner` method.

In addition, `setSubnodeOwnerAndWrap` and `setSubnodeRecordAndWrap` methods are provided, which create or replace subdomains while automatically wrapping the resulting subdomain.

All functions for working with wrapped names utilise ERC1155's authorisation mechanism, meaning an account that is authorised to act on behalf of another account can manage all its names.

## Fuses

`NameWrapper` also implements a permissions mechanism called 'fuses'. Each name has a set of fuses representing permissions over that name. Fuses can be 'burned' either at the time the name is wrapped or at any subsequent time when the owner or authorised operator calls `burnFuses`. Once a fuse is burned, it cannot be 'unburned' - the permission that fuse represents is permanently revoked.

Before any fuses can be burned on a name, the parent name's "replace subdomain" fuse must first be burned. Without this restriction, any permissions revoked via fuses can be evaded by the parent name replacing the subdomain and then re-wrapping it with a more permissive fuse field. Likewise, when any fuses on a name are burned, the "unwrap" fuse must also be burned, to prevent the name being directly unwrapped and re-wrapped to reset the fuses. These restrictions have the effect of allowing applications to simply check the fuse value they care about on the name they are examining without having to be aware of the entire chain of custody up to the root.

The ENS root and the .eth 2LD are treated as having the "replace subdomain" and "unwrap" fuses burned. There is one edge-case here insofar as a .eth name's registration can expire; at that point the name can be purchased by a new registrant and effectively becomes unwrapped despite any fuse restrictions. When that name is re-wrapped, fuse fields can be set to a more permissive value than the name previously had. Any application relying on fuse values for .eth subdomains should check the expiration date of the .eth name and warn users if this is likely to expire soon.

The fuses field is 96 bits, and only 7 fuses are defined by the `NameWrapper` contract itself. Applications may use additional fuse bits to encode their own restrictions on applications. Any application wishing to do so should submit a PR to this README in order to record the use of the value and ensure there is no unintentional overlap.

Each fuse is represented by a single bit. If that bit is cleared (0) the restriction is not applied, and if it is set (1) the restriction is applied. Any updates to the fuse field for a name are treated as a logical-OR; as a result bits can only be set, never cleared.

### CANNOT_UNWRAP = 1

If this fuse is burned, the name cannot be unwrapped, and calls to `unwrap` and `unwrapETH2LD` will fail.

### CANNOT_BURN_FUSES = 2

If this fuse is burned, no further fuses can be burned. This has the effect of 'locking open' some set of permissions on the name. Calls to `burnFuses` will fail.

### CANNOT_TRANSFER = 4

If this fuse is burned, the name cannot be transferred. Calls to `safeTransferFrom` and `safeBatchTransferFrom` will fail.

### CANNOT_SET_RESOLVER = 8

If this fuse is burned, the resolver cannot be changed. Calls to `setResolver` and `setRecord` will fail.

### CANNOT_SET_TTL = 16

If this fuse is burned, the TTL cannot be changed. Calls to `setTTL` and `setRecord` will fail.

### CANNOT_CREATE_SUBDOMAIN = 32

If this fuse is burned, new subdomains cannot be created. Calls to `setSubnodeOwner`, `setSubnodeRecord`, `setSubnodeOwnerAndWrap` and `setSubnodeRecordAndWrap` will fail if they reference a name that does not already exist.

### CANNOT_REPLACE_SUBDOMAIN = 64

If this fuse is burned, existing subdomains cannot be replaced by the parent name. Calls to `setSubnodeOwner`, `setSubnodeRecord`, `setSubnodeOwnerAndWrap` and `setSubnodeRecordAndWrap` will fail if they reference a name that already exists.

## Installation and setup

```bash
npm install
```

## Testing

```bash
npm run test
```

Any contract with `2` at the end, is referring to the contract being called by `account2`, rather than `account1`. This is for tests that require authorising another user.
