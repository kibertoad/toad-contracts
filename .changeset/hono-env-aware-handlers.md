---
"@toad-contracts/hono": minor
---

Thread the consuming app's Hono Env through contract handlers: buildHonoRoute now infers the app's Variables (e.g. container, user) so c.get(...) stays typed alongside c.get('apiContract'), plus a honoContractRoutes<AppEnv>() factory for handlers defined apart from the app. EnvOf guards against an any-typed app (e.g. the AnyHonoApp alias) so the handler env keeps contract-only typing instead of collapsing to any.
