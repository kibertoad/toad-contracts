# toad-contracts

A pnpm + TypeScript monorepo for [Standard Schema](https://github.com/standard-schema/spec) based
API contracts.

## Packages

- [`@toad-contracts/core`](./packages/core): contract-first API definitions (`defineApiContract`)
  written against the vendor-neutral Standard Schema interface, shared between frontend and backend.
  Works with any Standard Schema implementation (valibot, zod, arktype, and others).
- [`@toad-contracts/valibot`](./packages/valibot): a thin valibot adapter. Re-exports the whole
  core API and pre-wires path mapping to read valibot object schemas.
- [`@toad-contracts/frontend-http-client`](./packages/frontend-http-client): a wretch-based,
  type-safe HTTP client that executes a contract's request, validates the request inputs, and parses
  and validates responses against the contract's schemas, returning an inferred `Either`.
- [`@toad-contracts/testing`](./packages/testing): testing utilities for mocking contract responses
  with mockttp (server-side integration tests) or msw (frontend tests).

## Development

```sh
pnpm install
pnpm build      # build all packages (turbo resolves dependency order)
pnpm lint       # oxlint + oxfmt + tsc
pnpm test:ci    # run tests with coverage
```

This repo uses pnpm, turbo, changesets, and oxlint/oxfmt. Do not use npm.
