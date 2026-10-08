# @toad-contracts/zod

## 1.0.0

### Major Changes

- 6cf843a: Replace the tagged response union with an OpenAPI-shaped content map, so one status code can declare
  several media types.

  A status code now maps either to a bare Standard Schema (the JSON shorthand, unchanged) or to
  `{ description?, content: { '<media-type>': descriptor }, allowNoBody? }`, where a descriptor is a
  Standard Schema (JSON), `blobBody()`, or `sseBody(schemas)`. The client infers one response union
  member per declared media type, and media types are matched exactly, so `application/json` and
  `application/json+01` stay distinct variants of the same status code. An `application/json` key
  also accepts structured `+json` suffixes (`application/problem+json`, `application/vnd.api+json`)
  unless the contract declares that media type itself, which keeps `jsonResponse(schema)` equivalent
  to using the schema directly.

  Breaking changes:

  - `anyOfResponses()` is removed; declare each body under its own media type in a `content` map.
  - `textResponse()` and `streamResponse()` are removed. `blobResponse(contentType)` now resolves to a
    lazy, single-consume `BlobResponseHandle` with `.text()`, `.blob()`, `.arrayBuffer()`, `.stream()`
    and `.cancel()`, so the caller picks how to materialize any non-JSON body.
  - `ContractNoBody` is a request-body sentinel only; responses use `noBodyResponse()`.
  - The `isTextResponse` / `isBlobResponse` / `isStreamResponse` / `isSseResponse` /
    `isNoBodyResponse` / `isAnyOfResponses` predicates are replaced by `isContentResponseEntry` and
    the descriptor predicates `isJsonBody` / `isBlobBody` / `isSseBody`.
  - `ResponseKind` loses its `'text'` and `'stream'` members.
  - The `@toad-contracts/testing` mock params take `responseBlob` in place of `responseText` /
    `responseStream`, and accept `contentType` to pick between media types on one status code.

  Additions: `jsonResponse(schema, options?)` for an `application/json` entry carrying a description,
  `allowNoBody` for a status code that may answer with or without a body, and `resolveStatusEntry()`
  for reading a status code's raw entry before content-type resolution.

### Patch Changes

- f9b9e5a: Add a `prepublishOnly` script to every package so publishing always rebuilds `dist` (and the packages it depends on) first.
- Updated dependencies [6cf843a]
- Updated dependencies [f9b9e5a]
  - @toad-contracts/core@1.0.0

## 0.2.0

### Minor Changes

- 0674fb3: Unify object-key introspection on a single `StandardObjectKeysV1` surface across API and message
  contracts. Core now ships `StandardObjectKeysV1` (a local copy of the proposed `@standard-schema/spec`
  object-keys extension, exposed at `schema["~standard"].objectKeys.input()/output()`), replacing the
  old `ObjectKeysCarrier`/`getObjectKeys()` interface. `@toad-contracts/messages` drops
  `MessageTypeCarrier`/`getMessageType()` and routes on the same surface: `RoutableMessageSchema` is now
  `StandardSchemaV1 & StandardObjectKeysV1`. The valibot and zod adapters each expose a single
  `withObjectKeys()` (zod gains it; both drop `withMessageType()`) that satisfies both path-param schemas
  and message schemas, so every adapter implements one introspection surface instead of two.

  Breaking: `ObjectKeysCarrier`, `MessageTypeCarrier`, `getObjectKeys`, `getMessageType`, and
  `withMessageType` are removed; `withObjectKeys` now attaches `~standard.objectKeys` rather than a
  top-level `getObjectKeys`.

### Patch Changes

- Updated dependencies [0674fb3]
  - @toad-contracts/core@0.4.0

## 0.1.0

### Minor Changes

- 13703fe: Add `@toad-contracts/zod`: the zod adapter for core and messages. Re-exports the full core surface
  and adds `withMessageType`, which attaches `MessageTypeCarrier` to a zod object schema by reading a
  field's `z.literal()` value through `.shape`.

### Patch Changes

- Updated dependencies [13703fe]
  - @toad-contracts/messages@0.1.0
