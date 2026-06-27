# @toad-contracts/frontend-http-client

## 0.3.0

### Minor Changes

- 2a49408: Bump all packages a minor version.

### Patch Changes

- Updated dependencies [2a49408]
  - @toad-contracts/core@0.3.0

## 0.2.0

### Minor Changes

- 0c80690: Add `@toad-contracts/frontend-http-client`: a wretch-based, type-safe HTTP client driven by
  `@toad-contracts/core` contracts. Exports `sendByApiContract` (validates request inputs and parses
  and validates responses against the contract's Standard Schema entries, returning an inferred
  `Either`), `sseStreamToCallbacks`, `UnexpectedResponseError`, and `SchemaValidationError`.

### Patch Changes

- Updated dependencies [fd22779]
- Updated dependencies [fac4313]
- Updated dependencies [c47df94]
- Updated dependencies [0c80690]
  - @toad-contracts/core@0.2.0
