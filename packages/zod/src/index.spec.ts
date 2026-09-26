import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineApiContract, getObjectKeys, mapApiContractToPath, validateSync } from "./index.ts";

describe("getObjectKeys with zod schemas", () => {
  it("reads the keys of a zod object schema through ~standard.jsonSchema", () => {
    const schema = z.object({ orgId: z.string(), userId: z.string() });
    expect(getObjectKeys(schema)).toEqual(["orgId", "userId"]);
    expect(getObjectKeys(schema, "output")).toEqual(["orgId", "userId"]);
  });

  it("includes optional keys", () => {
    expect(getObjectKeys(z.object({ a: z.string(), b: z.string().optional() }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("reads keys through coercion, transforms and fields JSON Schema cannot represent", () => {
    const schema = z.object({
      id: z.coerce.number(),
      name: z.string().transform((value) => value.trim()),
      at: z.date(),
    });
    expect(getObjectKeys(schema)).toEqual(["id", "name", "at"]);
    expect(getObjectKeys(schema, "output")).toEqual(["id", "name", "at"]);
  });

  it("reads input keys of a transformed object schema", () => {
    const schema = z.object({ a: z.string() }).transform((value) => value);
    expect(getObjectKeys(schema)).toEqual(["a"]);
  });

  it("merges the keys of an intersection", () => {
    const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() }));
    expect(getObjectKeys(schema)).toEqual(["a", "b"]);
  });

  it("throws for a union and a non-object schema", () => {
    expect(() =>
      getObjectKeys(z.union([z.object({ a: z.string() }), z.object({ b: z.string() })])),
    ).toThrow(TypeError);
    expect(() => getObjectKeys(z.string())).toThrow(/object schema/);
  });
});

describe("zod schemas in contracts", () => {
  it("maps a path-params schema to a route pattern with no wrapper", () => {
    const contract = defineApiContract({
      method: "get",
      requestPathParamsSchema: z.object({ orgId: z.string(), userId: z.string() }),
      pathResolver: ({ orgId, userId }) => `/orgs/${orgId}/users/${userId}`,
      responsesByStatusCode: { 200: z.object({ id: z.string() }) },
    });
    expect(mapApiContractToPath(contract)).toBe("/orgs/:orgId/users/:userId");
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = z.object({ userId: z.string() });
    expect(validateSync(schema, { userId: "u1" })).toEqual({ userId: "u1" });
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: z.object({ type: z.literal("user.created"), id: z.string() }),
      publisherSchema: z.object({ type: z.literal("user.created"), id: z.string().optional() }),
    });

    expect(getObjectKeys(contract.consumerSchema)).toEqual(["type", "id"]);
    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      type: "user.created";
      id: string;
    }>();
  });
});
