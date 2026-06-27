# @toad-contracts/hono

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
