# @toad-contracts/arktype

The [ArkType](https://arktype.io) adapter for [`@toad-contracts/core`](../core) and
[`@toad-contracts/messages`](../messages).

The core libraries are written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interfaces. ArkType 2.1.28+ schemas implement
both `StandardSchemaV1` and `StandardJSONSchemaV1`, which is everything core needs: path-param
keys and message field names are read from the schema's `~standard.jsonSchema` output. ArkType
schemas therefore work in contracts as they are, with no wrapper.

`arktype` is a peer dependency.

```sh
pnpm add @toad-contracts/arktype arktype
```

## Usage

This package re-exports the entire `@toad-contracts/core` API, so it is a single import point:

```ts
import { defineApiContract, getObjectKeys, mapApiContractToPath } from "@toad-contracts/arktype";
import { type } from "arktype";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: type({ userId: "string" }),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: type({ id: "string" }) },
});

mapApiContractToPath(getUser); // "/users/:userId"
getObjectKeys(type({ type: "'user.created'", id: "string" })); // ["id", "type"]
```

See the [`@toad-contracts/core` README](../core/README.md) and
[`@toad-contracts/messages` README](../messages/README.md) for the full reference.
