---
"@toad-contracts/hono": minor
---

Thread the consuming app's Hono Env through contract handlers: buildHonoRoute now infers the app's Variables (e.g. container, user) so c.get(...) stays typed alongside c.get('apiContract'), plus a honoContractRoutes<AppEnv>() factory for handlers defined apart from the app.
