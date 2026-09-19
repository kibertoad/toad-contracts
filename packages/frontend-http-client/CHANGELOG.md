# @toad-contracts/frontend-http-client

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

## 0.3.2

### Patch Changes

- Updated dependencies [0674fb3]
  - @toad-contracts/core@0.4.0

## 0.3.1

### Patch Changes

- ef2489a: Remove the per-package `prepublishOnly` build. `ci:publish` already runs `turbo run build` in dependency order before `changeset publish`, so the `prepublishOnly` re-build (`rimraf dist && tsc`) was redundant and raced with concurrent publishing: when `@toad-contracts/core` ran its own `rimraf dist`, dependent packages' `tsc` failed with TS2307, leaving `valibot`, `frontend-http-client`, and `hono` unpublished.
- Updated dependencies [ef2489a]
  - @toad-contracts/core@0.3.1

## 0.3.0

### Minor Changes

- 2a49408: Bump all packages a minor version.

### Patch Changes

- Updated dependencies [2a49408]
  - @toad-contracts/core@0.3.0

## 0.2.0

### Minor Changes

- 0c80690: Add `@toad-contracts/frontend-http-client`: a wretch-based, type-safe HTTP client driven by
  `@toad-contracts/core` contracts. Exports `sendByApiContract` (validates request inputs and parses
  and validates responses against the contract's Standard Schema entries, returning an inferred
  `Either`), `sseStreamToCallbacks`, `UnexpectedResponseError`, and `SchemaValidationError`.

### Patch Changes

- Updated dependencies [fd22779]
- Updated dependencies [fac4313]
- Updated dependencies [c47df94]
- Updated dependencies [0c80690]
  - @toad-contracts/core@0.2.0
