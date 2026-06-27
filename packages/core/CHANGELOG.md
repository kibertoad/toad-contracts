# @toad-contracts/core

## 0.3.1

### Patch Changes

- ef2489a: Remove the per-package `prepublishOnly` build. `ci:publish` already runs `turbo run build` in dependency order before `changeset publish`, so the `prepublishOnly` re-build (`rimraf dist && tsc`) was redundant and raced with concurrent publishing: when `@toad-contracts/core` ran its own `rimraf dist`, dependent packages' `tsc` failed with TS2307, leaving `valibot`, `frontend-http-client`, and `hono` unpublished.

## 0.3.0

### Minor Changes

- 2a49408: Bump all packages a minor version.

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
- c47df94: Export `resolveStatusEntry`: resolves the raw contract response entry for a status code with
  exact → range → `'default'` precedence, before content-type resolution. `resolveResponseEntry` now
  builds on it, and adapters can reuse the lookup without duplicating the range-key boundaries.
- 0c80690: Add vendor-neutral `validate`, `validateSync`, and `SchemaValidationError` to core, built on
  `~standard.validate`. The testing helpers now reuse `validateSync` instead of duplicating the
  validate-and-throw logic. Also bumps the `@standard-schema/spec` dependency to `^1.1.0` for
  consistency across the workspace.
