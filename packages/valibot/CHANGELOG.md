# @toad-contracts/valibot

## 0.2.0

### Minor Changes

- fd22779: Initial release. `@toad-contracts/core` defines contract-first API contracts against the Standard
  Schema interface; `@toad-contracts/valibot` is a thin valibot adapter that re-exports core and
  pre-wires path mapping to read valibot object schemas.
- fac4313: Invert the path-param key resolution so core stays vendor-neutral. Core now defines an
  `ObjectKeysCarrier` interface (Standard Schema plus a `getObjectKeys()` capability) that path-param
  schemas must satisfy, and reads keys through it. `mapApiContractToPath`/`describeApiContract` are now
  single-argument (the `PathParamKeysResolver` parameter and type are removed). The valibot adapter
  exposes `withObjectKeys(schema)`, which implements the interface from valibot's `.entries`; wrap a
  contract's `requestPathParamsSchema` with it (e.g. `withObjectKeys(object({ userId: string() }))`).

### Patch Changes

- Updated dependencies [fd22779]
- Updated dependencies [fac4313]
- Updated dependencies [c47df94]
- Updated dependencies [0c80690]
  - @toad-contracts/core@0.2.0
