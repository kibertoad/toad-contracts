---
"@toad-contracts/core": minor
"@toad-contracts/messages": minor
"@toad-contracts/valibot": minor
"@toad-contracts/zod": minor
"@toad-contracts/arktype": minor
---

Read object keys from Standard JSON Schema instead of the vendored `StandardObjectKeysV1`. `RequestPathParamsSchema` and `RoutableMessageSchema` now require `StandardJSONSchemaV1`, and core adds `getObjectKeys(schema, direction?)`. zod (4.2+) and arktype (2.1.28+) schemas work unwrapped, so their `withObjectKeys` is removed and the peer ranges are raised. The valibot adapter replaces `withObjectKeys` with `toStandardJsonSchema` from `@valibot/to-json-schema` and requires valibot 1.5+. `StandardObjectKeysV1` is removed.
