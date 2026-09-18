---
"@toad-contracts/core": major
"@toad-contracts/frontend-http-client": major
"@toad-contracts/testing": major
"@toad-contracts/hono": major
"@toad-contracts/valibot": major
"@toad-contracts/zod": major
"@toad-contracts/arktype": major
---

Replace the tagged response union with an OpenAPI-shaped content map, so one status code can declare
several media types.

A status code now maps either to a bare Standard Schema (the JSON shorthand, unchanged) or to
`{ description?, content: { '<media-type>': descriptor }, allowNoBody? }`, where a descriptor is a
Standard Schema (JSON), `blobBody()`, or `sseBody(schemas)`. The client infers one response union
member per declared media type, and media types are matched exactly, so `application/json` and
`application/json+01` stay distinct variants of the same status code.

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
