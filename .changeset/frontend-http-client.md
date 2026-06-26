---
"@toad-contracts/frontend-http-client": minor
---

Add `@toad-contracts/frontend-http-client`: a wretch-based, type-safe HTTP client driven by
`@toad-contracts/core` contracts. Exports `sendByApiContract` (parses and validates responses against
the contract's Standard Schema entries, returning an inferred `Either`), `sseStreamToCallbacks`,
`UnexpectedResponseError`, and `SchemaValidationError`.
