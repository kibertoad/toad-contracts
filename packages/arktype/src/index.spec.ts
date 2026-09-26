import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { type } from "arktype";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineApiContract, getObjectKeys, mapApiContractToPath, validateSync } from "./index.ts";

describe("getObjectKeys with arktype schemas", () => {
  it("reads the keys of an arktype object schema through ~standard.jsonSchema", () => {
    const schema = type({ orgId: "string", userId: "string" });
    expect(getObjectKeys(schema)).toEqual(["orgId", "userId"]);
    expect(getObjectKeys(schema, "output")).toEqual(["orgId", "userId"]);
  });

  it("includes optional keys", () => {
    expect(getObjectKeys(type({ a: "string", "b?": "string" }))).toEqual(["a", "b"]);
  });

  it("reads keys through morphs and fields JSON Schema cannot represent", () => {
    const schema = type({ id: "string.numeric.parse", at: "Date" });
    expect(getObjectKeys(schema)).toEqual(["at", "id"]);
    expect(getObjectKeys(schema, "output")).toEqual(["at", "id"]);
  });

  it("merges the keys of an intersection", () => {
    expect(getObjectKeys(type({ a: "string" }).and({ b: "string" }))).toEqual(["a", "b"]);
  });

  it("throws for a union and a non-object schema", () => {
    expect(() => getObjectKeys(type({ a: "string" }).or({ b: "string" }))).toThrow(TypeError);
    expect(() => getObjectKeys(type("string"))).toThrow(/object schema/);
  });
});

describe("arktype schemas in contracts", () => {
  it("maps a path-params schema to a route pattern with no wrapper", () => {
    const contract = defineApiContract({
      method: "get",
      requestPathParamsSchema: type({ orgId: "string", userId: "string" }),
      pathResolver: ({ orgId, userId }) => `/orgs/${orgId}/users/${userId}`,
      responsesByStatusCode: { 200: type({ id: "string" }) },
    });
    expect(mapApiContractToPath(contract)).toBe("/orgs/:orgId/users/:userId");
  });

  it("keeps the schema usable as a Standard Schema", () => {
    expect(validateSync(type({ userId: "string" }), { userId: "u1" })).toEqual({ userId: "u1" });
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: type({ type: "'user.created'", id: "string" }),
      publisherSchema: type({ type: "'user.created'", "id?": "string" }),
    });

    // arktype normalizes object keys to a canonical (alphabetical) order.
    expect(getObjectKeys(contract.consumerSchema)).toEqual(["id", "type"]);
    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      type: "user.created";
      id: string;
    }>();
  });
});
