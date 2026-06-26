import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Thrown when a value fails validation against a contract's Standard Schema. Carries the raw
 * {@link StandardSchemaV1.Issue} list so callers can inspect what failed.
 */
export class SchemaValidationError extends Error {
  readonly issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[], message?: string) {
    super(message ?? `Value does not satisfy the contract schema: ${JSON.stringify(issues)}`);
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

/**
 * Validates a value through a Standard Schema and returns the parsed output (unknown properties
 * stripped, transforms applied), the vendor-neutral equivalent of a schema library's `parse`.
 * Awaits schemas whose validation resolves asynchronously, and throws {@link SchemaValidationError}
 * on failure.
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

/**
 * Synchronous variant of {@link validate}. Throws a {@link TypeError} when the schema validates
 * asynchronously (its `~standard.validate` returns a Promise), for callers that cannot await.
 */
export function validateSync<T extends StandardSchemaV1>(
  schema: T,
  value: unknown,
): StandardSchemaV1.InferOutput<T> {
  const result = schema["~standard"].validate(value);

  if (result instanceof Promise) {
    throw new TypeError(
      "Standard Schema validation resolved asynchronously, but this caller requires synchronous " +
        "validation. Use a schema whose `~standard.validate` resolves synchronously.",
    );
  }

  if (result.issues) {
    throw new SchemaValidationError(result.issues);
  }

  return result.value as StandardSchemaV1.InferOutput<T>;
}
