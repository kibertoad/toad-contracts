# Proposal: standardized object-keys introspection for Standard Schema

**Status:** Draft · **Author:** toad-contracts maintainers · **Audience:**
[`@standard-schema/spec`](https://github.com/standard-schema/spec)

## Summary

[Standard Schema](https://github.com/standard-schema/spec) gives the ecosystem one validation
interface across valibot, zod, arktype, and others. It deliberately keeps that interface tiny: a
schema exposes only `~standard.validate`, `~standard.vendor`, `~standard.version`, and the
type-level `~standard.types`. There is no standardized, runtime way to ask an object schema *which
keys it declares*.

That single missing capability forces every tool that needs an object schema's shape — and there are
many — to reach into each library's private internals (valibot's `.entries`, zod's `.shape` /
`.keyof()`, arktype's props), or to make callers hand the keys over a second time. This proposal
makes the narrow case for adding an **optional, opt-in way to list an object schema's keys** to the
Standard Schema spec, so consumers can read shape once, library-agnostically, the same way they
already validate library-agnostically today.

We scope this intentionally to **object keys only**. A broader structural-introspection surface
(nested schemas, element types, unions) is explicitly out of scope here; see
[Alternatives](#drawbacks-and-alternatives).

## Motivation

`@toad-contracts/core` is a contract-first API layer written entirely against the vendor-neutral
Standard Schema interface — it never imports valibot, zod, or any concrete library. That neutrality
is the whole point: a contract authored with one library runs anywhere.

But one core feature genuinely needs an object schema's keys. To mount a contract as a route, core
turns its path-params schema into an Express/Fastify-style pattern such as
`/orgs/:orgId/users/:userId`. The only way to do that is to enumerate the schema's keys and replace
each with a `:placeholder`:

```ts
// packages/core/src/defineApiContract.ts
export const mapApiContractToPath = (routeConfig: ApiContract): string => {
  if (!routeConfig.requestPathParamsSchema) {
    return routeConfig.pathResolver(undefined);
  }

  const resolverParams = routeConfig.requestPathParamsSchema
    .getObjectKeys()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = `:${key}`;
      return acc;
    }, {});

  return routeConfig.pathResolver(resolverParams);
};
```

Standard Schema cannot answer `getObjectKeys()`, so core has to define the capability itself, as a
one-method interface that sits *beside* Standard Schema:

```ts
// packages/core/src/defineApiContract.ts
export interface ObjectKeysCarrier {
  /** Lists the schema's object-property keys. */
  readonly getObjectKeys: () => readonly string[];
}

/** A path-params schema: a Standard Schema that also carries object-key introspection. */
export type RequestPathParamsSchema = RequestObjectSchema & ObjectKeysCarrier;
```

And because the spec can't satisfy that interface, every schema library needs an adapter whose *only*
job is to recover keys. The valibot adapter reads valibot's private `.entries`:

```ts
// packages/valibot/src/index.ts
export const withObjectKeys = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & ObjectKeysCarrier => {
  const entries = (schema as { entries?: Record<string, unknown> }).entries;

  if (entries === null || typeof entries !== "object") {
    throw new TypeError(
      "withObjectKeys expects a valibot object schema exposing `.entries` (e.g. object({ ... })). " +
        "Wrapped schemas like pipe(object(...), ...) and non-object schemas do not expose object " +
        "keys and cannot be used for path-param mapping.",
    );
  }

  const keys = Object.keys(entries);
  return Object.assign(schema, { getObjectKeys: (): readonly string[] => keys });
};
```

This works, but it is pure friction that exists solely because the spec stops one step short:

- **Every adapter re-implements it.** A zod adapter would read `.shape`; an arktype adapter its props.
  `ObjectKeysCarrier` is a small standard interface re-satisfied N times against N private surfaces.
- **It leaks the library back into "library-agnostic" code.** Authors must wrap path-param schemas in
  `withObjectKeys(...)` (or otherwise attach the keys) — a step that has nothing to do with their
  domain and exists only to paper over a spec gap.
- **It is fragile.** `.entries` is valibot-internal and only present on plain object schemas;
  `pipe(object(...), ...)` loses it, hence the runtime guard above. A standardized accessor would
  carry the same guarantees as `validate` does.

toad-contracts is just one consumer. The same gap is felt by anyone generating OpenAPI, building
forms, projecting message fields, or otherwise programming against a schema's *shape* rather than a
*value*.

## Use cases unlocked

Reading object keys is a foundational primitive. A representative, non-exhaustive list:

### API contracts

- **Route-pattern derivation** — exactly the toad-contracts case: turn a path-params schema into
  `/users/:userId` without the author restating the keys.
- **Query-param and header documentation** — enumerate the names a contract declares for its query
  string or headers to render docs, generate an OpenAPI `parameters` array, or print a human-readable
  contract summary, without coupling to any one library.
- **Contract self-consistency checks** — verify at startup that a `pathResolver` template and its
  path-params schema agree (every `:placeholder` has a matching key, and vice versa), catching drift
  before it ships.

### Message and event schemas

When a schema describes a queue/stream message rather than an HTTP request, you frequently need its
field *names* with no value in hand:

- **Field projection / selection** — pick a subset of fields for an event envelope, a change-data
  record, or a column list for a columnar sink, driven by the schema's declared keys.
- **Routing-key / partition-key derivation** — build a routing or partition key from named fields
  enumerated off the schema.
- **Partial "patch" payloads** — iterate a schema's keys to construct or validate a partial-update
  message where any declared subset of fields may be present.
- **Field-to-header mapping** — promote selected message fields onto transport metadata/headers,
  keyed by the schema's field names.

### Cross-cutting

- **Form and UI generation** — render one input per declared key.
- **Masking / redaction** — walk declared keys to decide what to drop or hash before logging.
- **Shape diffing** — compare two schemas' key sets to detect a breaking change.

Every one of these is reachable today only via per-library internals or by asking the caller to
repeat the keys the schema already knows.

## Why `validate` is not enough

A reasonable first reaction is "you already have `validate` — recover the keys from that." You can't,
reliably:

- **Validation needs a value; introspection does not.** Keys are *static structure*, available before
  any data exists. Manufacturing a "probe" object to feed `validate` means inventing values that pass
  every field's constraints — generally impossible in the common case.
- **Validation transforms and strips.** A passing result reflects the *output* shape after coercion,
  defaulting, and unknown-key stripping — not the declared input keys. Optional keys absent from the
  probe simply won't appear.
- **Async schemas can't be introspected synchronously.** `~standard.validate` may return a `Promise`.
  Route mapping, OpenAPI emission, and form rendering are synchronous; awaiting validation just to
  learn field names is the wrong tool.

Keys are metadata about the schema, in the same category as `~standard.vendor` — not something to be
reverse-engineered from a validation run.

## Prior art: libraries already expose this

The capability isn't speculative. Every major Standard Schema implementation already exposes object
keys at runtime — each spells it differently, which is precisely the fragmentation Standard Schema
exists to remove.

**valibot** — a plain object schema exposes its key→schema map as `.entries`:

```ts
import { object, string } from "valibot";

const schema = object({ userId: string(), orgId: string() });
Object.keys(schema.entries); // ["userId", "orgId"]
```

Only plain object schemas (`object`, `strictObject`, `looseObject`, `objectWithRest`) carry
`.entries`; a wrapped `pipe(object(...), ...)` does not.

**zod** — an object schema exposes `.shape`, and `.keyof()` returns an enum of its keys (both v3 and
v4):

```ts
import { z } from "zod";

const schema = z.object({ userId: z.string(), orgId: z.string() });
Object.keys(schema.shape);     // ["userId", "orgId"]
schema.keyof().options;        // ["userId", "orgId"]
```

**arktype** — object types expose their structure through the type's internal representation
(props/required keys), reachable from a parsed type.

The shared takeaway: **listing an object's keys is universal and already implemented everywhere — it
is simply unstandardized.** Lifting it into the spec replaces three private spellings with one public
contract.

## Proposed spec extension

The spec already extends itself in exactly the way this proposal needs. The current
[`@standard-schema/spec`](https://github.com/standard-schema/standard-schema/tree/main/packages/spec)
defines a base `StandardTypedV1` (carrying `version` / `vendor` / `types`) and then layers optional
capabilities on top as **sibling interfaces** that each declare their own `"~standard"` properties:
`StandardSchemaV1` adds `validate`, and `StandardJSONSchemaV1` adds a `jsonSchema` converter. A
schema library opts into a capability by *also* satisfying its interface; a consumer feature-detects
by checking for the member.

This proposal adds one more sibling in that same mold: **`StandardObjectKeysV1`**. The shape mirrors
`StandardJSONSchemaV1` deliberately — including the input/output split, since a schema's declared
input keys and its post-transform output keys can differ — so it slots into the existing package
without inventing new conventions:

```ts
/** The Standard Object Keys interface. */
export interface StandardObjectKeysV1<Input = unknown, Output = Input> {
  /** The Standard Object Keys properties. */
  readonly "~standard": StandardObjectKeysV1.Props<Input, Output>;
}

export declare namespace StandardObjectKeysV1 {
  /** The Standard Object Keys properties interface. */
  export interface Props<Input = unknown, Output = Input>
    extends StandardTypedV1.Props<Input, Output> {
    /** Methods for listing the input/output object keys. */
    readonly objectKeys: StandardObjectKeysV1.Lister;
  }

  /** The Standard Object Keys lister interface. */
  export interface Lister {
    /** Lists the declared keys of the input object shape. May throw if the schema does not describe an object. */
    readonly input: (
      options?: StandardObjectKeysV1.Options | undefined,
    ) => ReadonlyArray<string>;
    /** Lists the declared keys of the output object shape. May throw if the schema does not describe an object. */
    readonly output: (
      options?: StandardObjectKeysV1.Options | undefined,
    ) => ReadonlyArray<string>;
  }

  /** The options for the input/output methods. */
  export interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input>
    extends StandardTypedV1.Types<Input, Output> {}

  /** Infers the input type of a Standard. */
  export type InferInput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferInput<Schema>;

  /** Infers the output type of a Standard. */
  export type InferOutput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferOutput<Schema>;
}
```

A drop-in copy of this extension, formatted to match the spec package's `src/index.ts`, lives
alongside this proposal at
[`object-keys-spec-extension.ts`](./object-keys-spec-extension.ts).

### How libraries implement it

Each library already has the data; satisfying the interface is a thin wrapper. Valibot, for example:

```ts
import type { StandardObjectKeysV1 } from "@standard-schema/spec";

const keys = Object.keys(object({ userId: string(), orgId: string() }).entries);
const objectKeys: StandardObjectKeysV1.Lister = {
  input: () => keys,
  output: () => keys, // valibot strips unknowns but keeps declared keys
};
```

### How consumers use it

Consumers feature-detect on the `objectKeys` member — the same pattern they already use to tell a
plain `StandardSchemaV1` from a `StandardJSONSchemaV1`:

```ts
const hasObjectKeys = (
  schema: StandardSchemaV1,
): schema is StandardSchemaV1 & StandardObjectKeysV1 =>
  "objectKeys" in schema["~standard"];
```

Design intent:

- **Optional and additive.** It is a separate interface, exactly like `StandardJSONSchemaV1`. Nothing
  about existing schemas changes; non-object schemas and non-adopting libraries simply don't satisfy
  it, and `validate` is untouched.
- **Keys only.** Returns declared top-level property names — no nested schemas, no value types. Every
  library already has this, so implementation is trivial and consumer semantics are obvious.
- **Consistent with the spec's own precedent.** Same `"~standard"` namespace, same `Props`/`Types`/
  `InferInput`/`InferOutput` boilerplate, same input/output split as `StandardJSONSchemaV1`.
- **Mirrors today's `ObjectKeysCarrier`.** The same one-method idea toad-contracts already ships,
  promoted from a bolt-on interface to a first-class, vendor-neutral spec extension.

The exact name and whether the lister exposes `input`/`output` or a single accessor are open for the
spec authors; this proposal argues for the *capability* and offers a faithful, spec-formatted shape.

## Drawbacks and alternatives

- **Status quo — keep adapter glue.** Every consumer keeps shipping its own `ObjectKeysCarrier` +
  `withObjectKeys` equivalent against private internals. Workable, but it's exactly the per-library
  coupling Standard Schema set out to eliminate, duplicated across the ecosystem.
- **Standardize a broader introspection surface** (nested schemas, element/value types, unions,
  optionality). More powerful, but far larger and harder to land, and most consumers — including
  toad-contracts — only need the key list. We deliberately keep this proposal narrow; a fuller
  surface can build on it later if the spec authors want it.
- **Open questions** for whichever direction is chosen: should keys include optional/absent fields
  (they should — they're declared); is key *order* guaranteed (insertion order is the natural,
  already-observed behavior); and how should object *unions* (`a | b`) report keys (likely out of
  scope — `objectKeys` simply absent).

## Impact on toad-contracts

If adopted, the gap that motivated `ObjectKeysCarrier` disappears:

- `mapApiContractToPath` reads keys via `schema["~standard"].objectKeys.input()` directly — no
  bespoke interface.
- `RequestPathParamsSchema` drops the `& ObjectKeysCarrier` intersection and becomes
  `StandardSchemaV1 & StandardObjectKeysV1`, expressed entirely in spec types.
- `@toad-contracts/valibot`'s `withObjectKeys` wrapper — and the analogous wrapper every other
  adapter would otherwise need — is deleted. Authors stop wrapping their path-param schemas.

That is the proposal's value in miniature: one small, optional spec addition removes a whole category
of per-library glue, for us and for everyone else programming against a schema's shape.
