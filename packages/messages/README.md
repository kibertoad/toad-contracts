# @toad-contracts/messages

A minimal [Standard Schema](https://github.com/standard-schema/spec) superset for defining queue and
event message contracts, the message-side counterpart of [`@toad-contracts/core`](../core)'s API
contracts.

Message routing libraries (for example
[message-queue-toolkit](https://github.com/kibertoad/message-queue-toolkit)) need one capability
that Standard Schema does not expose: enumerating a schema's declared field names with no value in
hand — for field projection, routing-/partition-key derivation, partial-update payloads, and
field-to-header mapping. This is the _same_ object-key introspection core uses to build route paths,
so this package reuses core's `StandardObjectKeysV1` surface rather than defining a message-specific
one. It carries no schema-library runtime dependency; the introspection is supplied by an adapter
such as [`@toad-contracts/zod`](../zod) or [`@toad-contracts/valibot`](../valibot), each of which
ships a single `withObjectKeys` that satisfies both API and message contracts.

```sh
pnpm add @toad-contracts/messages
```

## What it provides

- `RoutableMessageSchema` — `StandardSchemaV1 & StandardObjectKeysV1`. A message schema whose declared
  field names can be read via `schema["~standard"].objectKeys.input()` (the single object-key surface,
  re-exported from `@toad-contracts/core`).
- `MessageContract` — `{ consumerSchema, publisherSchema, schemaVersion?, producedBy?, domain?, tags? }`.
  No HTTP verb, path resolver, or status-code response map; a message needs none of those.
- `defineMessageContract(contract)` — identity helper preserving the literal type for inference.
- `InferConsumerMessage<T>` / `InferPublisherMessage<T>` — the parsed consumer output type and the
  publisher input type, built on `StandardSchemaV1.InferOutput` / `InferInput`.

The full `@toad-contracts/core` surface (including `validate` / `validateSync` for parsing a message
through any Standard Schema) is re-exported, so this is a single import point for downstreams.

## Usage

```ts
import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { withObjectKeys } from "@toad-contracts/zod"; // or @toad-contracts/valibot
import { z } from "zod";

const userCreated = defineMessageContract({
  consumerSchema: withObjectKeys(
    z.object({
      type: z.literal("user.created"),
      id: z.string(),
      payload: z.object({ name: z.string() }),
    }),
  ),
  publisherSchema: withObjectKeys(
    z.object({
      type: z.literal("user.created"),
      id: z.string().optional(),
      payload: z.object({ name: z.string() }),
    }),
  ),
  domain: "users",
});

userCreated.consumerSchema["~standard"].objectKeys.input(); // ["type", "id", "payload"]

type UserCreated = InferConsumerMessage<typeof userCreated>;
```
