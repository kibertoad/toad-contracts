export * from "@toad-contracts/core";

/**
 * Wraps a valibot schema so it also implements Standard JSON Schema (`~standard.jsonSchema`), which
 * core reads path-param keys from and message routing reads field names from. Valibot schemas do not
 * implement it natively; this is valibot's own converter, so it works on any schema the converter
 * understands, including `pipe(object(...), ...)`.
 *
 * ```ts
 * defineApiContract({
 *   method: "get",
 *   requestPathParamsSchema: toStandardJsonSchema(object({ userId: string() })),
 *   pathResolver: ({ userId }) => `/users/${userId}`,
 *   responsesByStatusCode: { 200: RESPONSE_SCHEMA },
 * })
 * ```
 */
export { toStandardJsonSchema } from "@valibot/to-json-schema";
