# @toad-contracts/zod

The [zod](https://zod.dev) adapter for [`@toad-contracts/core`](../core) and
[`@toad-contracts/messages`](../messages).

The core libraries are written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which zod implements (v3.24+
and v4). This package re-exports the entire core API and adds `withObjectKeys`, the zod
implementation of the single object-key introspection surface (`StandardObjectKeysV1`) that API
contracts need for path-param schemas and message contracts need for field introspection, something
the Standard Schema interface does not expose.

`zod` is a peer dependency.

```sh
pnpm add @toad-contracts/zod zod
```

## What this package adds

`withObjectKeys(schema)` attaches core's `StandardObjectKeysV1` surface to a zod object schema by
reading the declared keys from `.shape`:

```ts
import { withObjectKeys } from "@toad-contracts/zod";
import { z } from "zod";

const schema = withObjectKeys(z.object({ type: z.literal("user.created"), id: z.string() }));

schema["~standard"].objectKeys.input(); // ["type", "id"]
```

The same wrapper serves both an API contract's `requestPathParamsSchema` (so `mapApiContractToPath`
can build the route path) and a [`@toad-contracts/messages`](../messages) `RoutableMessageSchema` (so
a routing container can enumerate a message's declared field names) — one surface, no
message-specific helper. Only object schemas expose `.shape`; a non-object schema throws an
actionable `TypeError` rather than silently yielding a schema with no object keys.

Everything else is a direct re-export from `@toad-contracts/core` (including `validate` /
`validateSync` for parsing a message through the schema). See the
[`@toad-contracts/core` README](../core/README.md) and
[`@toad-contracts/messages` README](../messages/README.md) for the full reference.
