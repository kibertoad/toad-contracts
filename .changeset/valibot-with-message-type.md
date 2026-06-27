---
"@toad-contracts/valibot": minor
---

Add `withMessageType`, which attaches `@toad-contracts/messages`' `MessageTypeCarrier` to a valibot
object schema by reading a field's `literal()` value through `.entries`. Composes with
`withObjectKeys` on the same schema.
