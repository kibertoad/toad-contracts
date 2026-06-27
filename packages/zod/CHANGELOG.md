# @toad-contracts/zod

## 0.1.0

### Minor Changes

- 13703fe: Add `@toad-contracts/zod`: the zod adapter for core and messages. Re-exports the full core surface
  and adds `withMessageType`, which attaches `MessageTypeCarrier` to a zod object schema by reading a
  field's `z.literal()` value through `.shape`.

### Patch Changes

- Updated dependencies [13703fe]
  - @toad-contracts/messages@0.1.0
