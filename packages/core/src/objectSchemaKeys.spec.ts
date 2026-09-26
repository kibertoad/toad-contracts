import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { describe, expect, it } from "vitest";
import { getObjectKeys } from "./objectSchemaKeys.ts";

const fromJsonSchema = (
  jsonSchema: Record<string, unknown>,
  vendor = "toad-contracts-test",
): StandardJSONSchemaV1 & { calls: StandardJSONSchemaV1.Options[] } => {
  const calls: StandardJSONSchemaV1.Options[] = [];
  const convert = (options: StandardJSONSchemaV1.Options) => {
    calls.push(options);
    return jsonSchema;
  };
  return {
    calls,
    "~standard": { version: 1, vendor, jsonSchema: { input: convert, output: convert } },
  };
};

describe("getObjectKeys", () => {
  it("lists the keys of an object schema's properties", () => {
    const schema = fromJsonSchema({ type: "object", properties: { orgId: {}, userId: {} } });
    expect(getObjectKeys(schema)).toEqual(["orgId", "userId"]);
  });

  it("includes optional keys", () => {
    const schema = fromJsonSchema({
      type: "object",
      properties: { a: {}, b: {} },
      required: ["a"],
    });
    expect(getObjectKeys(schema)).toEqual(["a", "b"]);
  });

  it("follows a root $ref into $defs", () => {
    const schema = fromJsonSchema({
      $ref: "#/$defs/User",
      $defs: { User: { type: "object", properties: { id: {} } } },
    });
    expect(getObjectKeys(schema)).toEqual(["id"]);
  });

  it("follows a $ref into draft-07 definitions", () => {
    const schema = fromJsonSchema({
      $ref: "#/definitions/User",
      definitions: { User: { type: "object", properties: { id: {} } } },
    });
    expect(getObjectKeys(schema)).toEqual(["id"]);
  });

  it("throws when a $ref cannot be resolved", () => {
    expect(() => getObjectKeys(fromJsonSchema({ $ref: "#/$defs/Missing" }))).toThrow(TypeError);
    expect(() => getObjectKeys(fromJsonSchema({ $ref: "https://example.com/user.json" }))).toThrow(
      TypeError,
    );
  });

  it("merges the keys of an allOf intersection", () => {
    const schema = fromJsonSchema({
      allOf: [
        { type: "object", properties: { a: {} } },
        { type: "object", properties: { b: {}, a: {} } },
      ],
    });
    expect(getObjectKeys(schema)).toEqual(["a", "b"]);
  });

  it("throws for a union", () => {
    const schema = fromJsonSchema({
      anyOf: [
        { type: "object", properties: { a: {} } },
        { type: "object", properties: { b: {} } },
      ],
    });
    expect(() => getObjectKeys(schema)).toThrow(TypeError);
  });

  it("throws for a non-object schema", () => {
    expect(() => getObjectKeys(fromJsonSchema({ type: "string" }))).toThrow(/object schema/);
  });

  it("passes the vendor's lenient converter options", () => {
    const schema = fromJsonSchema({ type: "object", properties: { a: {} } }, "zod");
    getObjectKeys(schema);
    expect(schema.calls[0]).toEqual({
      target: "draft-2020-12",
      libraryOptions: { unrepresentable: "any" },
    });
  });

  it("passes an arktype fallback that keeps the base schema of an unrepresentable field", () => {
    const schema = fromJsonSchema({ type: "object", properties: { a: {} } }, "arktype");
    getObjectKeys(schema);
    const fallback = schema.calls[0]!.libraryOptions!.fallback as (ctx: {
      base: unknown;
    }) => unknown;
    expect(fallback({ base: { type: "object" } })).toEqual({ type: "object" });
  });

  it("passes no library options for an unknown vendor", () => {
    const schema = fromJsonSchema({ type: "object", properties: { a: {} } });
    getObjectKeys(schema);
    expect(schema.calls[0]).toEqual({ target: "draft-2020-12", libraryOptions: undefined });
  });
});
