# @toad-contracts/testing

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
