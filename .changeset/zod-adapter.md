---
"@toad-contracts/zod": minor
---

Add `@toad-contracts/zod`: the zod adapter for core and messages. Re-exports the full core surface
and adds `withMessageType`, which attaches `MessageTypeCarrier` to a zod object schema by reading a
field's `z.literal()` value through `.shape`.
