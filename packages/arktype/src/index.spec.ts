import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { type } from "arktype";
import { describe, expect, expectTypeOf, it } from "vitest";
import { validateSync, withObjectKeys } from "./index.ts";

describe("withObjectKeys", () => {
  it("exposes the arktype object schema's keys via the ~standard.objectKeys surface", () => {
    const schema = withObjectKeys(type({ orgId: "string", userId: "string" }));
    expect(schema["~standard"].objectKeys.input()).toEqual(["orgId", "userId"]);
    expect(schema["~standard"].objectKeys.output()).toEqual(["orgId", "userId"]);
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = withObjectKeys(type({ userId: "string" }));
    expect(schema["~standard"].vendor).toBe("arktype");
    expect(validateSync(schema, { userId: "u1" })).toEqual({ userId: "u1" });
  });

  it("throws an actionable error when the schema is not an arktype object", () => {
    expect(() => withObjectKeys(type("string"))).toThrow(/arktype object schema/);
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: withObjectKeys(type({ type: "'user.created'", id: "string" })),
      publisherSchema: withObjectKeys(type({ type: "'user.created'", "id?": "string" })),
    });

    // arktype normalizes object keys to a canonical (alphabetical) order via `.props`.
    expect(contract.consumerSchema["~standard"].objectKeys.input()).toEqual(["id", "type"]);
    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      type: "user.created";
      id: string;
    }>();
  });
});

describe("re-exported core surface", () => {
  it("re-exports core helpers through the adapter barrel", () => {
    expect(typeof validateSync).toBe("function");
  });
});
