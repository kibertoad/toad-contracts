---
"@toad-contracts/hono": minor
---

Add `@toad-contracts/hono`: `buildHonoRoute` / `buildHonoRouteHandler` mount fully typed,
self-validating Hono routes from `@toad-contracts/core` contracts (method, path and request schemas
derived from the contract; `c.req.valid(...)` and the handler return typed from it), plus
`requestByContract` for server-free request testing via Hono's `app.request()`.
