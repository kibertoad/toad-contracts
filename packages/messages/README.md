# @toad-contracts/messages

A minimal [Standard Schema](https://github.com/standard-schema/spec) superset for defining queue and
event message contracts, the message-side counterpart of [`@toad-contracts/core`](../core)'s API
contracts.

Message routing libraries (for example
[message-queue-toolkit](https://github.com/kibertoad/message-queue-toolkit)) need one capability
that Standard Schema does not expose: reading the literal type discriminator declared in a schema so
a message's type can be discovered from its schema at registration time. This package defines that
capability as the vendor-neutral `MessageTypeCarrier` interface (the analogue of core's
`ObjectKeysCarrier`) and a slim `MessageContract` type. It carries no schema-library runtime
dependency; the introspection is supplied by an adapter such as
[`@toad-contracts/zod`](../zod) or [`@toad-contracts/valibot`](../valibot).

```sh
pnpm add @toad-contracts/messages
```

## What it provides

- `MessageTypeCarrier` — `{ getMessageType(fieldPath?): string | undefined }`. The single capability
  beyond Standard Schema. `fieldPath` is dot-notation (default `"type"`, e.g. `"detail-type"` or
  `"metadata.eventType"`).
- `RoutableMessageSchema` — `StandardSchemaV1 & MessageTypeCarrier`.
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
import { withMessageType } from "@toad-contracts/zod"; // or @toad-contracts/valibot
import { z } from "zod";

const userCreated = defineMessageContract({
  consumerSchema: withMessageType(
    z.object({
      type: z.literal("user.created"),
      id: z.string(),
      payload: z.object({ name: z.string() }),
    }),
  ),
  publisherSchema: withMessageType(
    z.object({
      type: z.literal("user.created"),
      id: z.string().optional(),
      payload: z.object({ name: z.string() }),
    }),
  ),
  domain: "users",
});

userCreated.consumerSchema.getMessageType(); // "user.created"

type UserCreated = InferConsumerMessage<typeof userCreated>;
```
