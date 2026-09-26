import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

type JsonSchemaNode = {
  $ref?: string;
  $defs?: Record<string, JsonSchemaNode>;
  definitions?: Record<string, JsonSchemaNode>;
  properties?: Record<string, unknown>;
  allOf?: JsonSchemaNode[];
};

/**
 * Per-vendor `libraryOptions` that make the JSON Schema converter emit `{}` for a field it cannot
 * represent (a `Date`, a custom check, a transform) instead of throwing. Key listing only reads
 * property names, so an unrepresentable field type does not matter here. The spec leaves these
 * options vendor-defined, so they are keyed by `~standard.vendor`; an unknown vendor gets none.
 */
const LENIENT_LIBRARY_OPTIONS: Record<string, Record<string, unknown>> = {
  zod: { unrepresentable: "any" },
  arktype: { fallback: (ctx: { base: unknown }) => ctx.base },
  valibot: { errorMode: "ignore" },
};

const resolveRef = (root: JsonSchemaNode, ref: string): JsonSchemaNode | undefined => {
  const match = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
  if (!match) {
    return undefined;
  }
  const defs = match[1] === "$defs" ? root.$defs : root.definitions;
  return defs?.[match[2]!];
};

const collectKeys = (root: JsonSchemaNode, node: JsonSchemaNode, keys: Set<string>): boolean => {
  if (node.$ref) {
    const target = resolveRef(root, node.$ref);
    return target ? collectKeys(root, target, keys) : false;
  }

  let isObject = false;
  if (node.properties && typeof node.properties === "object") {
    for (const key of Object.keys(node.properties)) {
      keys.add(key);
    }
    isObject = true;
  }
  // An intersection is emitted as `allOf`; its keys are the union of every member's keys.
  for (const member of node.allOf ?? []) {
    isObject = collectKeys(root, member, keys) || isObject;
  }
  return isObject;
};

/**
 * Lists the declared top-level keys of an object schema by reading `properties` from the schema's
 * Standard JSON Schema output (`~standard.jsonSchema`). `$ref`s into `$defs` and `allOf`
 * intersections are followed. Throws a `TypeError` when the schema does not describe an object with
 * declared properties, such as a union, a record, or a primitive.
 */
export const getObjectKeys = (
  schema: StandardJSONSchemaV1,
  direction: "input" | "output" = "input",
): string[] => {
  const props = schema["~standard"];
  const jsonSchema = props.jsonSchema[direction]({
    target: "draft-2020-12",
    libraryOptions: LENIENT_LIBRARY_OPTIONS[props.vendor],
  }) as JsonSchemaNode;

  const keys = new Set<string>();
  if (!collectKeys(jsonSchema, jsonSchema, keys)) {
    throw new TypeError(
      `Expected an object schema with declared properties, but the ${props.vendor} schema's JSON ` +
        "Schema has no `properties`. Unions, records and non-object schemas have no fixed key set.",
    );
  }
  return [...keys];
};
