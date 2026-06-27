# @toad-contracts/arktype

The [ArkType](https://arktype.io) adapter for [`@toad-contracts/core`](../core) and
[`@toad-contracts/messages`](../messages).

The core libraries are written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which ArkType implements
(v2+). This package re-exports the entire core API and adds `withObjectKeys`, the ArkType
implementation of the single object-key introspection surface (`StandardObjectKeysV1`) that API
contracts need for path-param schemas and message contracts need for field introspection, something
the Standard Schema interface does not expose.

`arktype` is a peer dependency.

```sh
pnpm add @toad-contracts/arktype arktype
```

## What this package adds

`withObjectKeys(schema)` attaches core's `StandardObjectKeysV1` surface to an ArkType object schema
by reading the declared keys from `.props`:

```ts
import { withObjectKeys } from "@toad-contracts/arktype";
import { type } from "arktype";

const schema = withObjectKeys(type({ type: "'user.created'", id: "string" }));

schema["~standard"].objectKeys.input(); // ["type", "id"]
```

The same wrapper serves both an API contract's `requestPathParamsSchema` (so `mapApiContractToPath`
can build the route path) and a [`@toad-contracts/messages`](../messages) `RoutableMessageSchema` (so
a routing container can enumerate a message's declared field names) — one surface, no
message-specific helper. Only object types expose their `.props`; a non-object type throws an
actionable `TypeError` rather than silently yielding a schema with no object keys.

Everything else is a direct re-export from `@toad-contracts/core` (including `validate` /
`validateSync` for parsing a message through the schema). See the
[`@toad-contracts/core` README](../core/README.md) and
[`@toad-contracts/messages` README](../messages/README.md) for the full reference.
