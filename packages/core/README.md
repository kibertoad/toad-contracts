# @toad-contracts/core

API contracts are shared definitions that live in a shared package and are consumed by both the
client and the backend. The contract describes a route (its path, HTTP method, and
request/response schemas) and serves as the single source of truth for both sides.

The backend implements the route against the contract. The client uses the same contract to make
type-safe requests without duplicating configuration. This keeps documentation, validation, and
types in sync across the boundary.

Schemas are any [Standard Schema](https://github.com/standard-schema/spec) implementation
([valibot](https://valibot.dev), [zod](https://zod.dev), [arktype](https://arktype.io), and others).
The
contract logic only depends on the `@standard-schema/spec` interface, not on a specific library.

> Using valibot? Prefer [`@toad-contracts/valibot`](../valibot). It re-exports everything here and
> adds `withObjectKeys`, which lets a valibot object schema satisfy the object-key introspection core
> needs for path-param schemas. See [Path mapping](#path-mapping) below for the underlying mechanism.

## Defining contracts

### REST routes

A `requestPathParamsSchema` must expose its object keys so the route path can be built from the
contract (see [Path mapping](#path-mapping)). The Standard Schema interface does not expose keys, so
wrap the schema with your adapter's helper, here `withObjectKeys` from `@toad-contracts/valibot`.
Query, header, body, and response schemas need no wrapping.

```ts
import { defineApiContract, noBodyResponse } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { object, string, pipe, uuid } from "valibot";

// GET with path params
const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: withObjectKeys(object({ userId: pipe(string(), uuid()) })),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: {
    200: object({ id: string(), name: string() }),
  },
});

// POST
const createUser = defineApiContract({
  method: "post",
  pathResolver: () => "/users",
  requestBodySchema: object({ name: string() }),
  responsesByStatusCode: {
    201: object({ id: string(), name: string() }),
  },
});

// DELETE with no response body
const deleteUser = defineApiContract({
  method: "delete",
  requestPathParamsSchema: withObjectKeys(object({ userId: pipe(string(), uuid()) })),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: {
    204: noBodyResponse(),
  },
});
```

### Response entries: the content map

A status code maps either to a bare schema — the JSON shorthand, covering the common case with no
ceremony — or to an OpenAPI-shaped `{ content }` entry keyed by media type. The content map is what
lets a single status code carry more than one body: JSON _and_ a downloadable rendering, JSON _and_
an SSE stream, even several JSON variants, each matched by an exact `content-type`.

A media type's value is a **body descriptor**:

| Descriptor         | Declares                    | The client receives    |
| ------------------ | --------------------------- | ---------------------- |
| a Standard Schema  | a JSON body, validated      | the schema's output    |
| `blobBody()`       | an opaque body              | `BlobResponseHandle`   |
| `sseBody(schemas)` | a Server-Sent Events stream | `AsyncIterable<Event>` |

Three factories cover the single-media-type cases, so most contracts never write a content map by
hand: `jsonResponse(schema)`, `blobResponse(contentType)`, `sseResponse(schemas)`, plus
`noBodyResponse()` for a status code that carries nothing.

```ts
import { blobBody, blobResponse, defineApiContract, noBodyResponse } from "@toad-contracts/core";
import { object, string } from "valibot";

// A single opaque body
const downloadPhoto = defineApiContract({
  method: "get",
  pathResolver: () => "/photo.png",
  responsesByStatusCode: { 200: blobResponse("image/png") },
});

// One status code, several media types
const getReport = defineApiContract({
  method: "get",
  pathResolver: () => "/report",
  responsesByStatusCode: {
    200: {
      description: "The report as data, or rendered for download",
      content: {
        "application/json": object({ id: string(), title: string() }),
        "application/pdf": blobBody(),
      },
    },
    204: noBodyResponse(),
  },
});
```

The response type the client infers is a discriminated union with **one member per media type**, so
narrowing on the body picks the variant the server actually sent:

```ts
const { result } = await sendByApiContract(client, getReport, {});
// result?.body is { id: string; title: string } | BlobResponseHandle | undefined
```

An entry may also set `allowNoBody: true` alongside its `content`, for a status code that sometimes
answers with nothing; that contributes a `body: null` variant.

#### Non-JSON bodies

`blobBody()` is the single descriptor for every non-JSON, non-SSE body, whatever its size. The
client resolves it to a `BlobResponseHandle`: a lazy, single-consume accessor over the response
body, so the _caller_ decides how to materialize it rather than the contract deciding for them.

```ts
const { result } = await sendByApiContract(client, exportCsv, {});
if (result) {
  await result.body.text(); // decode as UTF-8
  await result.body.blob(); // buffer into a Blob
  await result.body.arrayBuffer(); // buffer into an ArrayBuffer
  result.body.stream(); // ReadableStream<Uint8Array>, nothing buffered
  await result.body.cancel(); // discard, releasing the connection
}
```

The body is a one-shot stream: the first accessor consumes it and a second throws. Draining it (any
accessor except a lazy `stream()`, or `cancel()`) is also what releases the connection — a handle
you never touch keeps it open.

#### Content-type matching

A content map declares its media types explicitly, so they are matched exactly: parameters are
stripped and case is ignored (`text/csv; charset=utf-8` matches `text/csv`), but
`application/json` and `application/json+01` stay distinct. The bare-schema shorthand declares no
media type of its own, only "this is JSON", so it accepts any JSON media type — including
structured `+json` suffixes such as `application/problem+json`.

An `application/json` key means the same thing as the shorthand, so it accepts those `+json`
suffixes too, keeping `jsonResponse(schema)` equivalent to using `schema` directly. Declaring the
suffixed media type explicitly still wins, since exact matches are tried first:

```ts
// `application/problem+json` resolves to the `application/json` schema…
400: jsonResponse(problemSchema, { description: "RFC 7807 problem details" }),
// …unless the contract declares it, which then takes precedence.
409: { content: { "application/json": conflictSchema, "application/problem+json": problemSchema } },
```

A response whose `content-type` matches no declared media type is treated as unexpected. Clients
can relax this with `strictContentType: false`, which falls back to the declared body for entries
declaring exactly one.

### SSE and dual-mode routes

Use `sseResponse()` inside `responsesByStatusCode` to define SSE event schemas. For endpoints that
respond with either JSON or an SSE stream depending on the `Accept` header, declare both media
types on the same status code with a content map.

```ts
import { defineApiContract, sseBody, sseResponse } from "@toad-contracts/core";
import { object, string } from "valibot";

// SSE-only
const notifications = defineApiContract({
  method: "get",
  pathResolver: () => "/notifications/stream",
  responsesByStatusCode: {
    200: sseResponse({
      notification: object({ id: string(), message: string() }),
    }),
  },
});

// Dual-mode: JSON response or SSE stream depending on Accept header
const chatCompletion = defineApiContract({
  method: "post",
  pathResolver: () => "/chat/completions",
  requestBodySchema: object({ message: string() }),
  responsesByStatusCode: {
    200: {
      content: {
        "application/json": object({ text: string() }),
        "text/event-stream": sseBody({
          chunk: object({ delta: string() }),
          done: object({ finish_reason: string() }),
        }),
      },
    },
  },
});
```

A contract whose success codes declare both an SSE and a non-SSE body is _dual-mode_: the client
requires an explicit `streaming` argument and infers the matching body type from it. An SSE-only
contract always streams, and a contract with no SSE body never does.

### Wildcard and default response keys

In addition to exact status codes, `responsesByStatusCode` accepts OpenAPI-style range keys
(`'1xx'`–`'5xx'`) and `'default'` as fallbacks. Lookup precedence at runtime:
exact code → range key → `'default'`.

```ts
import { defineApiContract } from "@toad-contracts/core";
import { object, array, string, unknown } from "valibot";

const listItems = defineApiContract({
  method: "get",
  pathResolver: () => "/items",
  responsesByStatusCode: {
    "2xx": object({ items: array(string()) }),
    "4xx": object({ message: string() }),
  },
});

const flexible = defineApiContract({
  method: "get",
  pathResolver: () => "/data",
  responsesByStatusCode: {
    200: object({ data: unknown() }),
    default: object({ error: string() }),
  },
});
```

The `'2xx'` range key participates in SSE detection and success/error type narrowing exactly like
explicit 2xx codes. `'default'` is split into a success half (`SuccessfulHttpStatusCode`) and a
non-success half in `InferSseClientResponse` / `InferNonSseClientResponse` so error narrowing stays
correct regardless of the actual status code.

## Path mapping

`mapApiContractToPath(contract)` turns a contract into an Express/Fastify-style path pattern
(`"/users/:userId"`); `describeApiContract(contract)` returns `"GET /users/:userId"`. Both are
single-argument.

To build the pattern, core needs the path-param field names. The Standard Schema spec is
validation-only and does not expose an object schema's keys at runtime, so core ships
`StandardObjectKeysV1` — a local copy of the [object-keys spec
extension](../../docs/proposals/object-keys-introspection.md) — and requires a
`requestPathParamsSchema` to implement it. It is the single object-key surface every adapter
implements, shared with [`@toad-contracts/messages`](../messages) for message field introspection:

```ts
export interface StandardObjectKeysV1 {
  readonly "~standard": {
    // ...the usual version/vendor/types, plus:
    readonly objectKeys: {
      readonly input: () => readonly string[];
      readonly output: () => readonly string[];
    };
  };
}
```

The dependency is inverted: core depends only on this interface, never on a concrete schema library,
and adapters satisfy it. `@toad-contracts/valibot` exposes `withObjectKeys`, which reads valibot's
`.entries`:

```ts
import { mapApiContractToPath, describeApiContract } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { object, string } from "valibot";

const getUser = defineApiContract({
  method: "get",
  requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: object({ id: string() }) },
});

mapApiContractToPath(getUser); // "/users/:userId"
describeApiContract(getUser); // "GET /users/:userId"
```

Without an adapter, implement the interface yourself by attaching an `objectKeys` lister to any
Standard Schema's `~standard` properties:

```ts
const schema = object({ userId: string() });
Object.assign(schema["~standard"], {
  objectKeys: { input: () => ["userId"], output: () => ["userId"] },
});
```

## Type utilities

- `InferNonSseSuccessResponses<T>`: TypeScript output type of all non-SSE 2xx responses. JSON
  schemas → `StandardSchemaV1.InferOutput<T>`, `blobBody()` → `BlobResponseHandle`, `allowNoBody` →
  `undefined`, `sseBody()` → `never` (excluded). Content-map entries are unpacked before mapping.
- `InferJsonSuccessResponses<T>`: union of Standard Schema types for all JSON 2xx entries.
- `InferSseSuccessResponses<T>`: SSE event schema map type from a `responsesByStatusCode` map.
- `HasAnySseSuccessResponse<T>`, `HasAnyJsonSuccessResponse<T>`, `HasAnyNonSseSuccessResponse<T>`:
  boolean checks over 2xx entries.
- `ContractResponseMode<T>`: `'dual'` (SSE + non-SSE), `'sse'` (SSE-only), or `'non-sse'`.
- `AvailableResponseModes<T>`: union of `'json' | 'sse' | 'blob' | 'noContent'`.
- `SseEventOf<S>`: discriminated union of SSE events inferred from a `schemaByEventName` map,
  aligned with the browser `MessageEvent` shape: `{ type, data, lastEventId, retry }`.

## Client types

Primarily consumed by HTTP client implementations.

- `ClientRequestParams<TApiContract, TIsStreaming>`: infers the request parameter object
  (`pathParams`, `body`, `queryParams`, `headers`, optional `pathPrefix`, and `streaming` for
  dual-mode contracts).
- `InferSseClientResponse<TApiContract>`: discriminated union of `{ statusCode, headers, body }`
  for SSE mode. Exact 2xx codes and `'2xx'` yield `AsyncIterable<SseEventOf<...>>`.
- `InferNonSseClientResponse<TApiContract>`: same shape for non-SSE mode. Exact 2xx codes and
  `'2xx'` yield JSON / `BlobResponseHandle` / `null` (SSE excluded). A content-map entry
  contributes one union member per declared media type.
- `DefaultStreaming<T>`: `true` for SSE-only contracts, `false` otherwise.

## Contract type aliases

- `ApiContract`: union of all contract variants
  (`GetApiContract | DeleteApiContract | PayloadApiContract`).
- `GetApiContract`, `DeleteApiContract`, `PayloadApiContract`: individual variants.
- `RequestQuerySchema`, `RequestHeaderSchema`, `ResponseHeaderSchema`: Standard Schema object-schema
  constraints for generic helpers.
- `ResponseEntry`, `ResponseContentMap`, `BodyDescriptor`, `BlobBody`, `SseBody`,
  `ResponseContentType`: the content-map response shapes.
- `BlobResponseHandle`: the lazy, single-consume accessor a `blobBody()` response resolves to.
- `RequestPathParamsSchema`: a Standard Schema that also implements `StandardObjectKeysV1`.
- `StandardObjectKeysV1`: the `~standard.objectKeys` object-key introspection surface a path-param
  schema must add so `mapApiContractToPath` can read its keys (see [Path mapping](#path-mapping)). A
  local copy of the proposed [spec extension](../../docs/proposals/object-keys-introspection.md),
  shared with `@toad-contracts/messages`.

## Utility functions

- `mapApiContractToPath(contract)`: Express/Fastify-style path pattern, e.g. `"/users/:userId"`.
- `describeApiContract(contract)`: human-readable `"METHOD /path"` string.
- `hasAnySuccessSseResponse(contract)`: `true` when any 2xx entry declares an SSE body under any
  media type.
- `getSseSchemaByEventName(contract)`: extracts SSE event schemas, or `null` when none are present.
- `resolveStatusEntry(responsesByStatusCode, statusCode)`: the raw contract entry for a status code
  (exact → range → `'default'`), before any content-type resolution.
- `resolveResponseEntry(...)` / `resolveContractResponse(...)`: resolve a status code + content-type
  to a concrete `ResponseKind` (`'json' | 'blob' | 'sse' | 'noContent'`).
- `blobBody()` / `sseBody(schemas)`: body descriptors for a content map, with the
  `isJsonBody` / `isBlobBody` / `isSseBody` predicates and `isContentResponseEntry` for telling a
  content-map entry from the bare-schema shorthand.

## Validation

Vendor-neutral helpers for running a value through a Standard Schema, the equivalent of a schema
library's `parse`. They back request and response validation in
[`@toad-contracts/frontend-http-client`](../frontend-http-client) and the mock helpers in
[`@toad-contracts/testing`](../testing), so every package validates the same way.

- `validate(schema, value)`: async. Returns the parsed output (unknown keys stripped, transforms
  applied), awaiting schemas whose `~standard.validate` resolves asynchronously. Throws
  `SchemaValidationError` on failure.
- `validateSync(schema, value)`: synchronous variant. Throws a `TypeError` when the schema validates
  asynchronously, for callers that cannot await (e.g. buffered mock helpers).
- `SchemaValidationError`: thrown on validation failure. Carries the raw
  `StandardSchemaV1.Issue[]` in its `issues` property; accepts an optional custom message.

```ts
import { validate, validateSync, SchemaValidationError } from "@toad-contracts/core";
import { object, string } from "valibot";

const schema = object({ id: string() });

await validate(schema, { id: "1", extra: "dropped" }); // -> { id: "1" }
validateSync(schema, { id: "1" }); // -> { id: "1" }

try {
  await validate(schema, { id: 42 });
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error(error.issues);
  }
}
```

## Module augmentation

To enforce stricter typing on `metadata`:

```ts
// file -> apiContracts.d.ts
import "@toad-contracts/core";

declare module "@toad-contracts/core" {
  interface CommonRouteDefinitionMetadata {
    myTestProp?: string[];
    mySecondTestProp?: number;
  }
}
```
