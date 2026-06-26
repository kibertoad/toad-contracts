# toad-contracts

A pnpm + TypeScript monorepo for [Standard Schema](https://github.com/standard-schema/spec) based
API contracts.

## Packages

- [`@toad-contracts/core`](./packages/core) — contract-first API definitions (`defineApiContract`)
  written against the vendor-neutral Standard Schema interface, shared between frontend and backend.
  Works with any Standard Schema implementation (valibot, zod, arktype, …).
- [`@toad-contracts/valibot`](./packages/valibot) — a thin valibot adapter. Re-exports the whole
  core API and pre-wires path mapping to read valibot object schemas.

## Development

```sh
pnpm install
pnpm build      # build all packages (core first, then adapters)
pnpm lint       # oxlint + oxfmt + tsc
pnpm test:ci    # run tests with coverage
```

This repo uses pnpm, turbo, changesets, and oxlint/oxfmt. Do not use npm.
