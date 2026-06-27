# @toad-contracts/zod

The [zod](https://zod.dev) adapter for [`@toad-contracts/core`](../core) and
[`@toad-contracts/messages`](../messages).

The core libraries are written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which zod implements (v3.24+
and v4). This package re-exports the entire core API and adds `withMessageType`, the zod
implementation of the message-type introspection that message routing needs, something the Standard
Schema interface does not expose.

`zod` is a peer dependency.

```sh
pnpm add @toad-contracts/zod zod
```

## What this package adds

`withMessageType(schema)` attaches `@toad-contracts/messages`' `MessageTypeCarrier` to a zod object
schema by reading a field's `z.literal()` value through `.shape`:

```ts
import { withMessageType } from "@toad-contracts/zod";
import { z } from "zod";

const schema = withMessageType(z.object({ type: z.literal("user.created"), id: z.string() }));

schema.getMessageType(); // "user.created"
schema.getMessageType("type"); // "user.created"
```

`getMessageType(fieldPath)` walks `.shape` along a dot-notation path (default `"type"`, e.g.
`"detail.eventType"`) and returns the literal at the end, or `undefined` when the path is absent or
the field is not a string literal. Only object schemas expose `.shape`; a non-object schema throws an
actionable `TypeError` rather than silently yielding a schema whose message type can never resolve.

Everything else is a direct re-export from `@toad-contracts/core` (including `validate` /
`validateSync` for parsing a message through the schema). See the
[`@toad-contracts/core` README](../core/README.md) and
[`@toad-contracts/messages` README](../messages/README.md) for the full reference.
