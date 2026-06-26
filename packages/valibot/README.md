# @toad-contracts/valibot

The [valibot](https://valibot.dev) adapter for [`@toad-contracts/core`](../core).

The core contract library is written against the vendor-neutral
[Standard Schema](https://github.com/standard-schema/spec) interface, which valibot v1 implements.
This package re-exports the entire core API and adds valibot-aware versions of the two helpers that
need to read an object schema's keys — something the Standard Schema interface does not expose.

`valibot` is a peer dependency.

```sh
pnpm add @toad-contracts/valibot valibot
```

## Usage

Import everything from `@toad-contracts/valibot`. The full core surface (`defineApiContract`,
response factories, inference types, client types, …) is re-exported unchanged. See the
[`@toad-contracts/core` README](../core/README.md) for the complete reference.

```ts
import {
  defineApiContract,
  mapApiContractToPath,
  describeApiContract,
} from "@toad-contracts/valibot";
import { object, string } from "valibot";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: object({ userId: string() }),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: {
    200: object({ id: string(), name: string() }),
  },
});

mapApiContractToPath(getUser); // "/users/:userId"
describeApiContract(getUser); // "GET /users/:userId"
```

## What this package adds

`mapApiContractToPath(contract)` and `describeApiContract(contract)` are single-argument here. They
wrap the core functions with a resolver that lists a valibot object schema's keys via its `.entries`
property:

```ts
// effectively:
const getValibotPathParamKeys = (schema) => Object.keys(schema.entries);
export const mapApiContractToPath = (contract) =>
  coreMapApiContractToPath(contract, getValibotPathParamKeys);
```

Everything else is a direct re-export from `@toad-contracts/core`.
