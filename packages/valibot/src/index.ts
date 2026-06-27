export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ObjectKeysCarrier } from "@toad-contracts/core";
import type { MessageTypeCarrier } from "@toad-contracts/messages";

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

type ValibotLiteralNode = { literal?: unknown };
type ValibotObjectNode = { entries?: Record<string, unknown> };

const readValibotLiteral = (schema: ValibotObjectNode, fieldPath: string): string | undefined => {
  let current: ValibotObjectNode & ValibotLiteralNode = schema;

  for (const part of fieldPath.split(".")) {
    if (!current.entries) {
      return undefined;
    }
    current = current.entries[part] as ValibotObjectNode & ValibotLiteralNode;
    if (!current) {
      return undefined;
    }
  }

  return typeof current.literal === "string" ? current.literal : undefined;
};

/**
 * Augments a valibot object schema with the message-type introspection that message routing needs
 * (`@toad-contracts/messages`' {@link MessageTypeCarrier} surface). Valibot exposes a field's literal
 * via `.entries[field].literal`, which the vendor-neutral Standard Schema interface does not; this
 * adapter implements that interface so consumers stay free of valibot specifics.
 *
 * `getMessageType(fieldPath)` walks `.entries` along a dot-notation path (default `"type"`) and
 * returns the `literal()` value at the end, or `undefined` when the path is absent or the field is
 * not a string literal:
 *
 * ```ts
 * const schema = withMessageType(object({ type: literal("user.created"), id: string() }));
 * schema.getMessageType(); // "user.created"
 * ```
 *
 * Only object schemas expose `.entries`; a non-object schema does not, so this throws an actionable
 * error rather than silently returning a schema whose message type can never be resolved.
 */
export const withMessageType = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & MessageTypeCarrier => {
  const entries = (schema as ValibotObjectNode).entries;

  if (entries === null || typeof entries !== "object") {
    throw new TypeError(
      "withMessageType expects a valibot object schema exposing `.entries` (e.g. object({ ... })). " +
        "Non-object schemas do not expose object entries and cannot carry a message type.",
    );
  }

  return Object.assign(schema, {
    getMessageType: (fieldPath = "type"): string | undefined =>
      readValibotLiteral(schema as ValibotObjectNode, fieldPath),
  });
};
