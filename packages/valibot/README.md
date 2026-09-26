# @toad-contracts/valibot

The [valibot](https://valibot.dev) adapter for [`@toad-contracts/core`](../core).

The core contract library is written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interfaces. API contracts read
path-param keys, and message contracts read field names, from a schema's Standard JSON Schema output
(`~standard.jsonSchema`). Valibot schemas implement Standard Schema but not Standard JSON Schema, so
this package re-exports the entire core API and adds `toStandardJsonSchema` from valibot's official
`@valibot/to-json-schema` converter.

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
  toStandardJsonSchema,
} from "@toad-contracts/valibot";
import { object, string } from "valibot";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: toStandardJsonSchema(object({ userId: string() })),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: {
    200: object({ id: string(), name: string() }),
  },
});

mapApiContractToPath(getUser); // "/users/:userId"
describeApiContract(getUser); // "GET /users/:userId"
```

## What this package adds

`toStandardJsonSchema(schema)` is the only addition; everything else is a direct re-export from
`@toad-contracts/core`. It is re-exported from `@valibot/to-json-schema` and returns a schema that
implements both `StandardSchemaV1` and `StandardJSONSchemaV1`.

Wrap any path-param or message schema with it. Because it uses valibot's own converter, it works on
any object schema the converter understands, including `pipe(object(...), ...)`. Core's
`getObjectKeys` asks the converter to emit `{}` for fields JSON Schema cannot represent (such as
`date()` or a `check` action), so those do not block key listing. A non-object schema makes
`getObjectKeys` throw a `TypeError`.

The wrapped schema also satisfies [`@toad-contracts/messages`](../messages)'
`RoutableMessageSchema`:

```ts
import { getObjectKeys, toStandardJsonSchema } from "@toad-contracts/valibot";
import { literal, object, string } from "valibot";

const schema = toStandardJsonSchema(object({ type: literal("user.created"), id: string() }));
getObjectKeys(schema); // ["type", "id"]
```
