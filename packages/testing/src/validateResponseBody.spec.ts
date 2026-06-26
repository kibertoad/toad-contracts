import type { StandardSchemaV1 } from "@standard-schema/spec";
import { object, string } from "valibot";
import { describe, expect, it } from "vitest";
import { validateResponseBody } from "./validateResponseBody.ts";

describe("validateResponseBody", () => {
  it("returns the parsed output and strips unknown properties", () => {
    const schema = object({ id: string() });

    expect(validateResponseBody(schema, { id: "1", extra: "drop me" })).toEqual({ id: "1" });
  });

  it("throws when the value does not satisfy the schema", () => {
    const schema = object({ id: string() });

    expect(() => validateResponseBody(schema, { id: 42 })).toThrow(
      /does not satisfy the contract schema/,
    );
  });

  it("throws when the schema validates asynchronously", () => {
    const asyncSchema: StandardSchemaV1<unknown, unknown> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => Promise.resolve({ value: {} }),
      },
    };

    expect(() => validateResponseBody(asyncSchema, {})).toThrow(/require synchronous/);
  });
});
