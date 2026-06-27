export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardObjectKeysV1 } from "@toad-contracts/core";

/**
 * Augments a valibot object schema with the shared object-key introspection surface
 * ({@link StandardObjectKeysV1}). Valibot exposes the declared keys via `.entries`, which the
 * vendor-neutral Standard Schema interface does not; this adapter implements the spec-style
 * `~standard.objectKeys` capability so consumers — API contracts (path-param mapping) and message
 * contracts (field projection/routing) alike — stay free of any valibot specifics and rely on the
 * one surface every adapter implements.
 *
 * Wrap a contract's `requestPathParamsSchema`, or a message schema, with it:
 *
 * ```ts
 * defineApiContract({
 *   method: "get",
 *   requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
 *   pathResolver: ({ userId }) => `/users/${userId}`,
 *   responsesByStatusCode: { 200: RESPONSE_SCHEMA },
 * })
 * ```
 *
 * Only plain object schemas (`object`, `strictObject`, `looseObject`, `objectWithRest`) expose
 * `.entries`. A wrapped schema such as `pipe(object(...), ...)` or a non-object schema does not, so
 * this throws an actionable error instead of silently producing a schema with no object keys.
 */
export const withObjectKeys = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & StandardObjectKeysV1 => {
  const entries = (schema as { entries?: Record<string, unknown> }).entries;

  if (entries === null || typeof entries !== "object") {
    throw new TypeError(
      "withObjectKeys expects a valibot object schema exposing `.entries` (e.g. object({ ... })). " +
        "Wrapped schemas like pipe(object(...), ...) and non-object schemas do not expose object " +
        "keys and cannot be used for path-param mapping or message field introspection.",
    );
  }

  const keys = Object.keys(entries);
  const objectKeys: StandardObjectKeysV1.Lister = {
    // valibot strips unknown keys but keeps every declared key, so input and output keys match.
    input: () => keys,
    output: () => keys,
  };

  Object.assign(schema["~standard"], { objectKeys });

  return schema as TSchema & StandardObjectKeysV1;
};
