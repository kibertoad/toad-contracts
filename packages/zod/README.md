# @toad-contracts/zod

The [zod](https://zod.dev) adapter for [`@toad-contracts/core`](../core) and
[`@toad-contracts/messages`](../messages).

The core libraries are written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interfaces. zod 4.2+ schemas implement
both `StandardSchemaV1` and `StandardJSONSchemaV1`, which is everything core needs: path-param
keys and message field names are read from the schema's `~standard.jsonSchema` output. zod
schemas therefore work in contracts as they are, with no wrapper.

`zod` is a peer dependency.

```sh
pnpm add @toad-contracts/zod zod
```

## Usage

This package re-exports the entire `@toad-contracts/core` API, so it is a single import point:

```ts
import { defineApiContract, getObjectKeys, mapApiContractToPath } from "@toad-contracts/zod";
import { z } from "zod";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: z.object({ userId: z.string() }),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: z.object({ id: z.string() }) },
});

mapApiContractToPath(getUser); // "/users/:userId"
getObjectKeys(z.object({ type: z.literal("user.created"), id: z.string() })); // ["type", "id"]
```

See the [`@toad-contracts/core` README](../core/README.md) and
[`@toad-contracts/messages` README](../messages/README.md) for the full reference.
