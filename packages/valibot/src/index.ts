export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ObjectKeysCarrier } from "@toad-contracts/core";

/**
 * Augments a valibot object schema with the object-key introspection that core needs for path-param
 * schemas (core's {@link ObjectKeysCarrier} surface). Valibot exposes the keys via `.entries`, which
 * the vendor-neutral Standard Schema interface does not provide; this adapter implements core's
 * interface so core stays free of any schema-library specifics.
 *
 * Wrap the `requestPathParamsSchema` of a contract with it:
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
 * this throws an actionable error instead of silently producing a route with no path params.
 */
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
