# @toad-contracts/arktype

## 0.1.0

### Minor Changes

- b8f1259: Add `@toad-contracts/arktype`: the ArkType adapter for core and messages. Re-exports the full core
  surface and adds `withObjectKeys`, which attaches the `StandardObjectKeysV1` object-key
  introspection surface to an ArkType object `type` by reading the declared keys from `.props`.
