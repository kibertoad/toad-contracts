# @toad-contracts/messages

A minimal [Standard Schema](https://github.com/standard-schema/spec) superset for defining queue and
event message contracts, the message-side counterpart of [`@toad-contracts/core`](../core)'s API
contracts.

Message routing libraries (for example
[message-queue-toolkit](https://github.com/kibertoad/message-queue-toolkit)) need to read a schema's
declared field names with no value in hand, for field projection, routing- or partition-key
derivation, partial-update payloads, and field-to-header mapping. Message schemas here implement
Standard JSON Schema as well as Standard Schema, and core's `getObjectKeys` reads the field names
from the JSON Schema `properties`, the same way core builds route paths. zod (4.2+) and arktype
(2.1.28+) schemas qualify as they are; wrap valibot schemas with `toStandardJsonSchema` from
[`@toad-contracts/valibot`](../valibot). This package carries no schema-library runtime dependency.

```sh
pnpm add @toad-contracts/messages
```

## What it provides

- `RoutableMessageSchema` — `StandardSchemaV1 & StandardJSONSchemaV1`. A message schema whose declared
  field names can be read with `getObjectKeys(schema)` (re-exported from `@toad-contracts/core`).
- `MessageContract` — `{ consumerSchema, publisherSchema, schemaVersion?, producedBy?, domain?, tags? }`.
  No HTTP verb, path resolver, or status-code response map; a message needs none of those.
- `defineMessageContract(contract)` — identity helper preserving the literal type for inference.
- `InferConsumerMessage<T>` / `InferPublisherMessage<T>` — the parsed consumer output type and the
  publisher input type, built on `StandardSchemaV1.InferOutput` / `InferInput`.

The full `@toad-contracts/core` surface (including `validate` / `validateSync` for parsing a message
through any Standard Schema) is re-exported, so this is a single import point for downstreams.

## Usage

```ts
import {
  defineMessageContract,
  getObjectKeys,
  type InferConsumerMessage,
} from "@toad-contracts/messages";
import { z } from "zod";

const userCreated = defineMessageContract({
  consumerSchema: z.object({
    type: z.literal("user.created"),
    id: z.string(),
    payload: z.object({ name: z.string() }),
  }),
  publisherSchema: z.object({
    type: z.literal("user.created"),
    id: z.string().optional(),
    payload: z.object({ name: z.string() }),
  }),
  domain: "users",
});

getObjectKeys(userCreated.consumerSchema); // ["type", "id", "payload"]

type UserCreated = InferConsumerMessage<typeof userCreated>;
```
