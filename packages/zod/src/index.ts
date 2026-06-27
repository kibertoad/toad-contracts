export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardObjectKeysV1 } from "@toad-contracts/core";

/**
 * Augments a zod object schema with the shared object-key introspection surface
 * ({@link StandardObjectKeysV1}). Zod exposes the declared keys via `.shape`, which the
 * vendor-neutral Standard Schema interface does not; this adapter implements the spec-style
 * `~standard.objectKeys` capability so consumers — API contracts (path-param mapping) and message
 * contracts (field projection/routing) alike — stay free of any zod specifics and rely on the one
 * surface every adapter implements.
 *
 * ```ts
 * import { z } from "zod";
 * import { withObjectKeys } from "@toad-contracts/zod";
 *
 * const schema = withObjectKeys(z.object({ userId: z.string(), orgId: z.string() }));
 * schema["~standard"].objectKeys.input(); // ["userId", "orgId"]
 * ```
 *
 * Only object schemas expose `.shape`; a non-object schema does not, so this throws an actionable
 * error instead of silently producing a schema with no object keys.
 */
export const withObjectKeys = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & StandardObjectKeysV1 => {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;

  if (shape === null || typeof shape !== "object") {
    throw new TypeError(
      "withObjectKeys expects a zod object schema exposing `.shape` (e.g. z.object({ ... })). " +
        "Non-object schemas do not expose a field shape and cannot be used for path-param mapping " +
        "or message field introspection.",
    );
  }

  const keys = Object.keys(shape);
  const objectKeys: StandardObjectKeysV1.Lister = {
    // zod strips unknown keys but keeps every declared key, so input and output keys match.
    input: () => keys,
    output: () => keys,
  };

  Object.assign(schema["~standard"], { objectKeys });

  return schema as TSchema & StandardObjectKeysV1;
};
