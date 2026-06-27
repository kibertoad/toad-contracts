# @toad-contracts/hono

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

- fac4313: Add `@toad-contracts/hono`: `buildHonoRoute` / `buildHonoRouteHandler` mount fully typed,
  self-validating Hono routes from `@toad-contracts/core` contracts (method, path and request schemas
  derived from the contract; `c.req.valid(...)` and the handler return typed from it), plus
  `requestByContract` for server-free request testing via Hono's `app.request()`.
- 0512db9: Thread the consuming app's Hono Env through contract handlers: buildHonoRoute now infers the app's Variables (e.g. container, user) so c.get(...) stays typed alongside c.get('apiContract'), plus a honoContractRoutes<AppEnv>() factory for handlers defined apart from the app. EnvOf guards against an any-typed app (e.g. the AnyHonoApp alias) so the handler env keeps contract-only typing instead of collapsing to any.

### Patch Changes

- Updated dependencies [fd22779]
- Updated dependencies [fac4313]
- Updated dependencies [c47df94]
- Updated dependencies [0c80690]
  - @toad-contracts/core@0.2.0
