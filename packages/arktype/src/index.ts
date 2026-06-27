export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardObjectKeysV1 } from "@toad-contracts/core";

/**
 * Augments an ArkType object schema with the shared object-key introspection surface
 * ({@link StandardObjectKeysV1}). ArkType exposes the declared keys via `.props`, which the
 * vendor-neutral Standard Schema interface does not; this adapter implements the spec-style
 * `~standard.objectKeys` capability so consumers — API contracts (path-param mapping) and message
 * contracts (field projection/routing) alike — stay free of any ArkType specifics and rely on the
 * one surface every adapter implements.
 *
 * ```ts
 * import { type } from "arktype";
 * import { withObjectKeys } from "@toad-contracts/arktype";
 *
 * const schema = withObjectKeys(type({ userId: "string", orgId: "string" }));
 * schema["~standard"].objectKeys.input(); // ["userId", "orgId"]
 * ```
 *
 * Only object types expose their `.props`; reading `.props` on a non-object `type` throws, so this
 * checks the type is an object first and throws an actionable error instead of silently producing a
 * schema with no object keys.
 */
export const withObjectKeys = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & StandardObjectKeysV1 => {
  const arkSchema = schema as unknown as {
    extends: (def: "object") => boolean;
    props: ReadonlyArray<{ key: string }>;
  };

  if (!arkSchema.extends("object")) {
    throw new TypeError(
      "withObjectKeys expects an arktype object schema exposing its declared keys via `.props` " +
        "(e.g. type({ ... })). Non-object schemas do not expose object keys and cannot be used for " +
        "path-param mapping or message field introspection.",
    );
  }

  const keys = arkSchema.props.map((prop) => prop.key);
  const objectKeys: StandardObjectKeysV1.Lister = {
    // arktype's `.props` lists every declared key; the declared key set is identical for input and output.
    input: () => keys,
    output: () => keys,
  };

  // Unlike valibot/zod, arktype exposes `~standard` as a getter that returns a fresh object on every
  // read, so a plain Object.assign would not persist. Shadow it with an own property that snapshots
  // the spec props and adds the objectKeys surface.
  Object.defineProperty(schema, "~standard", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: { ...schema["~standard"], objectKeys },
  });

  return schema as TSchema & StandardObjectKeysV1;
};
