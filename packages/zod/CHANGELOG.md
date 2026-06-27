# @toad-contracts/zod

## 0.2.0

### Minor Changes

- 0674fb3: Unify object-key introspection on a single `StandardObjectKeysV1` surface across API and message
  contracts. Core now ships `StandardObjectKeysV1` (a local copy of the proposed `@standard-schema/spec`
  object-keys extension, exposed at `schema["~standard"].objectKeys.input()/output()`), replacing the
  old `ObjectKeysCarrier`/`getObjectKeys()` interface. `@toad-contracts/messages` drops
  `MessageTypeCarrier`/`getMessageType()` and routes on the same surface: `RoutableMessageSchema` is now
  `StandardSchemaV1 & StandardObjectKeysV1`. The valibot and zod adapters each expose a single
  `withObjectKeys()` (zod gains it; both drop `withMessageType()`) that satisfies both path-param schemas
  and message schemas, so every adapter implements one introspection surface instead of two.

  Breaking: `ObjectKeysCarrier`, `MessageTypeCarrier`, `getObjectKeys`, `getMessageType`, and
  `withMessageType` are removed; `withObjectKeys` now attaches `~standard.objectKeys` rather than a
  top-level `getObjectKeys`.

### Patch Changes

- Updated dependencies [0674fb3]
  - @toad-contracts/core@0.4.0

## 0.1.0

### Minor Changes

- 13703fe: Add `@toad-contracts/zod`: the zod adapter for core and messages. Re-exports the full core surface
  and adds `withMessageType`, which attaches `MessageTypeCarrier` to a zod object schema by reading a
  field's `z.literal()` value through `.shape`.

### Patch Changes

- Updated dependencies [13703fe]
  - @toad-contracts/messages@0.1.0
