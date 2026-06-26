import type { StandardSchemaV1 } from "@standard-schema/spec";
import { SchemaValidationError, validate } from "@toad-contracts/core";
import type { Context, MiddlewareHandler } from "hono";
import type { OnValidationError } from "./types.ts";

/** Hono validation targets the adapter wires from contract request schemas. */
export type ValidatorTarget = "param" | "query" | "header" | "json";

/**
 * Collapses Hono's multi-value query map: a key with a single value becomes a scalar, repeated keys
 * stay arrays. Mirrors Hono's own `validator()` so array query params validate against array schemas.
 */
const collectQuery = (c: Context): Record<string, string | string[]> =>
  Object.fromEntries(
    Object.entries(c.req.queries()).map(([key, values]) =>
      values.length === 1 ? [key, values[0]] : [key, values],
    ),
  );

const readRawInput = async (c: Context, target: ValidatorTarget): Promise<unknown> => {
  switch (target) {
    case "param":
      return c.req.param();
    case "query":
      return collectQuery(c);
    case "header":
      return c.req.header();
    case "json":
      // `c.req.json()` throws a SyntaxError (not a SchemaValidationError) when the body is empty or
      // not valid JSON. Surface that as a SchemaValidationError so a malformed body is handled like
      // any other request validation failure (routed to `onValidationError` / the app's `onError`
      // as a 400) instead of escaping the validator and surfacing as a 500.
      try {
        return await c.req.json();
      } catch {
        throw new SchemaValidationError(
          [{ message: "Request body is not valid JSON" }],
          "Request body is not valid JSON",
        );
      }
  }
};

/**
 * Builds a Hono middleware that validates one request target against a contract's Standard Schema.
 * On success the parsed value is stored via `c.req.addValidatedData(target, ...)`, so `c.req.valid(
 * target)` returns it. On failure it throws a {@link SchemaValidationError} (to be handled by the
 * app's `onError`), or delegates to `onValidationError` when provided.
 *
 * The contract-derived handler types are applied at the route level (see `buildHonoRoute`); this
 * middleware is intentionally typed loosely so it can be composed for any target.
 */
export const contractValidator = (
  target: ValidatorTarget,
  schema: StandardSchemaV1,
  onValidationError?: OnValidationError,
): MiddlewareHandler => {
  return async (c, next) => {
    let parsed: unknown;

    try {
      parsed = await validate(schema, await readRawInput(c, target));
    } catch (error) {
      if (onValidationError && error instanceof SchemaValidationError) {
        return onValidationError(error, c);
      }
      throw error;
    }

    c.req.addValidatedData(target, parsed as Record<PropertyKey, unknown>);
    await next();
  };
};
