import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Validates a mock response body through a Standard Schema and returns the parsed output (unknown
 * properties stripped, transforms applied), mirroring valibot's `parse`. Replaces the
 * schema-library-specific `parse` call so the helpers stay vendor-neutral across any Standard
 * Schema implementation.
 *
 * The mock helpers buffer the body synchronously, so a schema whose validation resolves
 * asynchronously is unsupported and throws an actionable error instead of silently producing a
 * `[object Promise]` body.
 */
export function validateResponseBody(schema: StandardSchemaV1, value: unknown): unknown {
  const result = schema["~standard"].validate(value);

  if (result instanceof Promise) {
    throw new TypeError(
      "Standard Schema validation returned a Promise. The mock helpers require synchronous " +
        "validation; use a schema whose `~standard.validate` resolves synchronously.",
    );
  }

  if (result.issues) {
    throw new Error(
      `Mock response body does not satisfy the contract schema: ${JSON.stringify(result.issues)}`,
    );
  }

  return result.value;
}
