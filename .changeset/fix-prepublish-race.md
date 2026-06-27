---
"@toad-contracts/core": patch
"@toad-contracts/valibot": patch
"@toad-contracts/testing": patch
"@toad-contracts/frontend-http-client": patch
"@toad-contracts/hono": patch
---

Remove the per-package `prepublishOnly` build. `ci:publish` already runs `turbo run build` in dependency order before `changeset publish`, so the `prepublishOnly` re-build (`rimraf dist && tsc`) was redundant and raced with concurrent publishing: when `@toad-contracts/core` ran its own `rimraf dist`, dependent packages' `tsc` failed with TS2307, leaving `valibot`, `frontend-http-client`, and `hono` unpublished.
