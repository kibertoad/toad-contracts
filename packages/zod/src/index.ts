export * from "@toad-contracts/core";

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { MessageTypeCarrier } from "@toad-contracts/messages";

type ZodLiteralNode = { value?: unknown };
type ZodObjectNode = { shape?: Record<string, unknown> };

const readZodLiteral = (schema: ZodObjectNode, fieldPath: string): string | undefined => {
  let current: ZodObjectNode & ZodLiteralNode = schema;

  for (const part of fieldPath.split(".")) {
    if (!current.shape) {
      return undefined;
    }
    current = current.shape[part] as ZodObjectNode & ZodLiteralNode;
    if (!current) {
      return undefined;
    }
  }

  return typeof current.value === "string" ? current.value : undefined;
};

/**
 * Augments a zod object schema with the message-type introspection that message routing needs
 * (`@toad-contracts/messages`' {@link MessageTypeCarrier} surface). Zod exposes a field's literal via
 * `.shape[field].value`, which the vendor-neutral Standard Schema interface does not; this adapter
 * implements that interface so consumers stay free of zod specifics.
 *
 * `getMessageType(fieldPath)` walks `.shape` along a dot-notation path (default `"type"`) and returns
 * the `z.literal()` value at the end, or `undefined` when the path is absent or the field is not a
 * string literal:
 *
 * ```ts
 * const schema = withMessageType(z.object({ type: z.literal("user.created"), id: z.string() }));
 * schema.getMessageType(); // "user.created"
 * ```
 *
 * Only object schemas expose `.shape`; a non-object schema does not, so this throws an actionable
 * error rather than silently returning a schema whose message type can never be resolved.
 */
export const withMessageType = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
): TSchema & MessageTypeCarrier => {
  const shape = (schema as ZodObjectNode).shape;

  if (shape === null || typeof shape !== "object") {
    throw new TypeError(
      "withMessageType expects a zod object schema exposing `.shape` (e.g. z.object({ ... })). " +
        "Non-object schemas do not expose a field shape and cannot carry a message type.",
    );
  }

  return Object.assign(schema, {
    getMessageType: (fieldPath = "type"): string | undefined =>
      readZodLiteral(schema as ZodObjectNode, fieldPath),
  });
};
