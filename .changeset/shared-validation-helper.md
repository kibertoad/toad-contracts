---
"@toad-contracts/core": minor
"@toad-contracts/testing": patch
---

Add vendor-neutral `validate`, `validateSync`, and `SchemaValidationError` to core, built on
`~standard.validate`. The testing helpers now reuse `validateSync` instead of duplicating the
validate-and-throw logic. Also bumps the `@standard-schema/spec` dependency to `^1.1.0` for
consistency across the workspace.
