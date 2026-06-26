---
"@toad-contracts/core": minor
"@toad-contracts/valibot": minor
---

Invert the path-param key resolution so core stays vendor-neutral. Core now defines an
`ObjectKeysCarrier` interface (Standard Schema plus a `getObjectKeys()` capability) that path-param
schemas must satisfy, and reads keys through it. `mapApiContractToPath`/`describeApiContract` are now
single-argument (the `PathParamKeysResolver` parameter and type are removed). The valibot adapter
exposes `withObjectKeys(schema)`, which implements the interface from valibot's `.entries`; wrap a
contract's `requestPathParamsSchema` with it (e.g. `withObjectKeys(object({ userId: string() }))`).
