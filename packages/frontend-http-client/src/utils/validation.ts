import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Thrown when a response body, SSE event payload, or response header set fails validation against
 * the contract's Standard Schema. Carries the raw {@link StandardSchemaV1.Issue} list so callers
 * can inspect what failed.
 */
export class SchemaValidationError extends Error {
  readonly issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(`Response does not satisfy the contract schema: ${JSON.stringify(issues)}`);
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

/**
 * Validates a value through a Standard Schema and returns the parsed output (unknown properties
 * stripped, transforms applied), the vendor-neutral equivalent of zod's `parse`. Awaits schemas
 * whose validation resolves asynchronously, and throws {@link SchemaValidationError} on failure.
 */
export async function validate<T extends StandardSchemaV1>(
  schema: T,
  value: unknown,
): Promise<StandardSchemaV1.InferOutput<T>> {
  let result = schema["~standard"].validate(value);

  if (result instanceof Promise) {
    result = await result;
  }

  if (result.issues) {
    throw new SchemaValidationError(result.issues);
  }

  return result.value as StandardSchemaV1.InferOutput<T>;
}
