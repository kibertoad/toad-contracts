# @toad-contracts/testing

## 0.3.1

### Patch Changes

- ef2489a: Remove the per-package `prepublishOnly` build. `ci:publish` already runs `turbo run build` in dependency order before `changeset publish`, so the `prepublishOnly` re-build (`rimraf dist && tsc`) was redundant and raced with concurrent publishing: when `@toad-contracts/core` ran its own `rimraf dist`, dependent packages' `tsc` failed with TS2307, leaving `valibot`, `frontend-http-client`, and `hono` unpublished.
- Updated dependencies [ef2489a]
  - @toad-contracts/core@0.3.1

## 0.3.0

### Minor Changes

- 2a49408: Bump all packages a minor version.

### Patch Changes

- Updated dependencies [2a49408]
  - @toad-contracts/core@0.3.0

## 0.2.0

### Minor Changes

- c47df94: Add `@toad-contracts/testing`: `ApiContractMockttpHelper` and `MswHelper` mock HTTP responses from
  `@toad-contracts/core` contracts, validating each body through the contract's Standard Schema. Plus
  `mockSseStream` for on-demand SSE emission and the `formatSseResponse` body formatter.

### Patch Changes

- 0c80690: Add vendor-neutral `validate`, `validateSync`, and `SchemaValidationError` to core, built on
  `~standard.validate`. The testing helpers now reuse `validateSync` instead of duplicating the
  validate-and-throw logic. Also bumps the `@standard-schema/spec` dependency to `^1.1.0` for
  consistency across the workspace.
- Updated dependencies [fd22779]
- Updated dependencies [fac4313]
- Updated dependencies [c47df94]
- Updated dependencies [0c80690]
  - @toad-contracts/core@0.2.0
