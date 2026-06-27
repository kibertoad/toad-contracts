# @toad-contracts/valibot

The [valibot](https://valibot.dev) adapter for [`@toad-contracts/core`](../core).

The core contract library is written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which valibot v1 implements.
This package re-exports the entire core API and adds `withObjectKeys`, the valibot implementation of
the object-key introspection core needs for path-param schemas, something the Standard Schema
interface does not expose.

`valibot` is a peer dependency.

```sh
pnpm add @toad-contracts/valibot valibot
```

## Usage

Import everything from `@toad-contracts/valibot`. The full core surface (`defineApiContract`,
response factories, inference types, client types, and more) is re-exported unchanged. See the
[`@toad-contracts/core` README](../core/README.md) for the complete reference.

```ts
import {
  defineApiContract,
  mapApiContractToPath,
  describeApiContract,
  withObjectKeys,
} from "@toad-contracts/valibot";
import { object, string } from "valibot";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: {
    200: object({ id: string(), name: string() }),
  },
});

mapApiContractToPath(getUser); // "/users/:userId"
describeApiContract(getUser); // "GET /users/:userId"
```

## What this package adds

`withObjectKeys(schema)` and `withMessageType(schema)` are the only additions; everything else is a
direct re-export from `@toad-contracts/core`.

Core needs a contract's `requestPathParamsSchema` to expose its object keys to build the route path,
which the Standard Schema interface does not provide. `withObjectKeys` attaches that capability
(core's `ObjectKeysCarrier`) to a valibot object schema by reading its `.entries`:

```ts
// effectively:
export const withObjectKeys = (schema) =>
  Object.assign(schema, { getObjectKeys: () => Object.keys(schema.entries) });
```

Wrap any `requestPathParamsSchema` with it. Only plain object schemas (`object`, `strictObject`,
`looseObject`, `objectWithRest`) expose `.entries`; a wrapped schema such as `pipe(object(...), ...)`
or a non-object schema does not, so `withObjectKeys` throws an actionable `TypeError` rather than
silently producing a route with no path params.

The path-mapping helpers `mapApiContractToPath(contract)` and `describeApiContract(contract)` are
re-exported from core unchanged and already single-argument; they read the keys through whatever
`withObjectKeys` attached.

`withMessageType(schema)` attaches `@toad-contracts/messages`' `MessageTypeCarrier` for message
contracts, reading a field's `literal()` value through `.entries`:

```ts
import { withMessageType } from "@toad-contracts/valibot";
import { literal, object, string } from "valibot";

const schema = withMessageType(object({ type: literal("user.created"), id: string() }));
schema.getMessageType(); // "user.created"
```

`getMessageType(fieldPath)` walks `.entries` along a dot-notation path (default `"type"`, e.g.
`"detail.eventType"`) and returns the literal at the end, or `undefined` when the path is absent or
the field is not a string literal. It composes with `withObjectKeys` on the same schema.
