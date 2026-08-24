---
"@toad-contracts/arktype": patch
"@toad-contracts/core": patch
"@toad-contracts/frontend-http-client": patch
"@toad-contracts/hono": patch
"@toad-contracts/messages": patch
"@toad-contracts/testing": patch
"@toad-contracts/valibot": patch
"@toad-contracts/zod": patch
---

Add a `prepublishOnly` script to every package so publishing always rebuilds `dist` (and the packages it depends on) first.
