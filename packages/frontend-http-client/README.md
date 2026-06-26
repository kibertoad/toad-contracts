# @toad-contracts/frontend-http-client

An opinionated, type-safe HTTP client that executes requests described by
[`@toad-contracts/core`](../core) contracts. Built on [wretch](https://github.com/elbywan/wretch),
it parses and validates every response against the contract's
[Standard Schema](https://github.com/standard-schema/spec) entries and returns a discriminated
`Either<error, result>` whose types are inferred from the contract.

This is the standard-schema equivalent of `@lokalise/frontend-http-client`, which targets the
zod-based `@lokalise/api-contracts`. The modern `sendByApiContract` surface is ported; the deprecated
per-method helpers (`sendGet`/`sendPost`/`sendByContract`/`connectSseByContract`) are not, since they
were built on the older zod route-definition shape that has no equivalent here.

`wretch` is a peer dependency.

```sh
pnpm add @toad-contracts/frontend-http-client wretch
```

## Usage

```ts
import wretch from "wretch";
import { sendByApiContract } from "@toad-contracts/frontend-http-client";
import { defineApiContract } from "@toad-contracts/core";
import { number, object, string } from "valibot";

const getProduct = defineApiContract({
  method: "get",
  requestPathParamsSchema: object({ productId: string() }),
  pathResolver: ({ productId }) => `/products/${productId}`,
  responsesByStatusCode: {
    200: object({ id: number(), title: string() }),
    404: object({ message: string() }),
  },
});

const client = wretch("https://api.example.com");

const { result, error } = await sendByApiContract(client, getProduct, {
  pathParams: { productId: "1" },
});

if (result) {
  // result.statusCode === 200, result.body is { id: number; title: string }
  console.log(result.body.title);
}
```

### Error handling

By default (`captureAsError: true`), non-2xx responses declared in the contract are returned as
`Either.error` and the `result` type is narrowed to success status codes. Pass `captureAsError: false`
to receive every contract-defined response as `Either.result`:

```ts
const { result } = await sendByApiContract(client, getProduct, {
  pathParams: { productId: "1" },
  captureAsError: false,
});
// result is the 200 body OR the 404 body, discriminated by result.statusCode
```

A status code absent from the contract, or a `content-type` that matches no declared entry, is always
returned as an `UnexpectedResponseError` on the `error` side.

### Server-sent events

A contract whose success response is an `sseResponse` (or a dual-mode `anyOfResponses` with
`streaming: true`) yields an `AsyncIterable` of typed events. Iterate directly, or bridge to callbacks
with `sseStreamToCallbacks`:

```ts
import { sendByApiContract, sseStreamToCallbacks } from "@toad-contracts/frontend-http-client";

const { result } = await sendByApiContract(client, sseContract, {});

for await (const event of result.body) {
  if (event.type === "item.updated") console.log(event.data);
}

// or, callback-based:
sseStreamToCallbacks(result.body, {
  onEvent: { "item.updated": (data) => console.log(data) },
  onError: (err) => console.error(err),
  onDone: () => console.log("stream closed"),
});
```

## Options

`sendByApiContract(client, contract, params)` accepts, alongside the contract-derived request fields
(`pathParams`, `queryParams`, `body`, `headers`, `pathPrefix`, `streaming`):

- `captureAsError`: route declared non-2xx responses to `error` (default `true`).
- `strictContentType`: require the response `content-type` to match the contract entry (default
  `true`). When `false`, single-entry responses fall back to the entry's declared kind.
- `signal`: an `AbortSignal` to cancel the in-flight request.

Validation is performed through each schema's `~standard.validate`, so any Standard Schema
implementation (valibot, zod 3.24+, arktype, and others) works. A response body that fails
validation rejects the returned promise with a `SchemaValidationError`. Request inputs (path params,
query, body, headers) are validated against their contract schemas before the request is sent.
