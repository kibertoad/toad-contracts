# @toad-contracts/valibot

The [valibot](https://valibot.dev) adapter for [`@toad-contracts/core`](../core).

The core contract library is written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which valibot v1 implements.
This package re-exports the entire core API and adds `withObjectKeys`, the valibot implementation of
the single object-key introspection surface (`StandardObjectKeysV1`) that API contracts need for
path-param schemas and message contracts need for field introspection, something the Standard Schema
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

`withObjectKeys(schema)` is the only addition; everything else is a direct re-export from
`@toad-contracts/core`.

API contracts need a `requestPathParamsSchema` to expose its object keys to build the route path, and
message contracts need a schema's declared field names for routing/projection — both read through the
same `StandardObjectKeysV1` surface, which the Standard Schema interface does not provide.
`withObjectKeys` attaches that capability to a valibot object schema by reading its `.entries`:

```ts
// effectively:
export const withObjectKeys = (schema) => {
  const keys = Object.keys(schema.entries);
  Object.assign(schema["~standard"], {
    objectKeys: { input: () => keys, output: () => keys },
  });
  return schema;
};
```

Wrap any path-param or message schema with it. Only plain object schemas (`object`, `strictObject`,
`looseObject`, `objectWithRest`) expose `.entries`; a wrapped schema such as `pipe(object(...), ...)`
or a non-object schema does not, so `withObjectKeys` throws an actionable `TypeError` rather than
silently producing a schema with no object keys.

The path-mapping helpers `mapApiContractToPath(contract)` and `describeApiContract(contract)` are
re-exported from core unchanged and already single-argument; they read the keys through whatever
`withObjectKeys` attached. The same wrapper makes a schema satisfy
[`@toad-contracts/messages`](../messages)' `RoutableMessageSchema`, so a routing container can
enumerate a message's declared field names — no separate message-specific helper is needed:

```ts
import { withObjectKeys } from "@toad-contracts/valibot";
import { literal, object, string } from "valibot";

const schema = withObjectKeys(object({ type: literal("user.created"), id: string() }));
schema["~standard"].objectKeys.input(); // ["type", "id"]
```
