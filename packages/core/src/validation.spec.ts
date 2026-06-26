import type { StandardSchemaV1 } from "@standard-schema/spec";
import { number, object, pipe, string, transform } from "valibot";
import { describe, expect, it } from "vitest";
import { SchemaValidationError, validate, validateSync } from "./validation.ts";

const asyncSchema = (output: unknown): StandardSchemaV1<unknown, unknown> => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate: () => Promise.resolve({ value: output }),
  },
});

describe("validate", () => {
  it("returns the parsed output and strips unknown properties", async () => {
    const schema = object({ id: string() });

    await expect(validate(schema, { id: "1", extra: "drop me" })).resolves.toEqual({ id: "1" });
  });

  it("applies schema transforms", async () => {
    const schema = object({ count: pipe(string(), transform(Number)) });

    await expect(validate(schema, { count: "42" })).resolves.toEqual({ count: 42 });
  });

  it("awaits asynchronous validation", async () => {
    await expect(validate(asyncSchema({ ok: true }), {})).resolves.toEqual({ ok: true });
  });

  it("throws SchemaValidationError with the issue list on failure", async () => {
    const schema = object({ id: string() });

    await expect(validate(schema, { id: 42 })).rejects.toBeInstanceOf(SchemaValidationError);
    await expect(validate(schema, { id: 42 })).rejects.toThrow(
      /does not satisfy the contract schema/,
    );

    try {
      await validate(schema, { id: 42 });
    } catch (error) {
      expect((error as SchemaValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe("validateSync", () => {
  it("returns the parsed output for a synchronous schema", () => {
    const schema = object({ id: number() });

    expect(validateSync(schema, { id: 1, extra: "drop me" })).toEqual({ id: 1 });
  });

  it("throws a TypeError when the schema validates asynchronously", () => {
    expect(() => validateSync(asyncSchema({}), {})).toThrow(/requires synchronous/);
  });

  it("throws SchemaValidationError on failure", () => {
    const schema = object({ id: string() });

    expect(() => validateSync(schema, { id: 42 })).toThrow(SchemaValidationError);
  });
});

describe("SchemaValidationError", () => {
  it("accepts a custom message and keeps the issues", () => {
    const error = new SchemaValidationError([{ message: "bad" }], "custom message");

    expect(error.message).toBe("custom message");
    expect(error.name).toBe("SchemaValidationError");
    expect(error.issues).toEqual([{ message: "bad" }]);
  });
});
