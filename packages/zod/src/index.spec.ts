import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { validateSync, withMessageType } from "./index.ts";

describe("withMessageType", () => {
  it("reads the z.literal() type from a flat object schema", () => {
    const schema = withMessageType(z.object({ type: z.literal("user.created"), id: z.string() }));
    expect(schema.getMessageType()).toBe("user.created");
    expect(schema.getMessageType("type")).toBe("user.created");
  });

  it("reads a nested literal via a dot-notation path", () => {
    const schema = withMessageType(
      z.object({ detail: z.object({ eventType: z.literal("order.placed") }) }),
    );
    expect(schema.getMessageType("detail.eventType")).toBe("order.placed");
  });

  it("returns undefined when the top-level field is absent", () => {
    const schema = withMessageType(z.object({ type: z.literal("a") }));
    expect(schema.getMessageType("missing")).toBeUndefined();
  });

  it("returns undefined when the field is not a string literal", () => {
    const schema = withMessageType(z.object({ type: z.string() }));
    expect(schema.getMessageType()).toBeUndefined();
  });

  it("returns undefined when the path descends past a non-object field", () => {
    const schema = withMessageType(z.object({ type: z.literal("a") }));
    expect(schema.getMessageType("type.sub")).toBeUndefined();
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = withMessageType(z.object({ type: z.literal("a") }));
    expect(schema["~standard"].vendor).toBe("zod");
    expect(validateSync(schema, { type: "a" })).toEqual({ type: "a" });
  });

  it("throws an actionable error when the schema is not a zod object", () => {
    expect(() => withMessageType(z.string())).toThrow(/zod object schema/);
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: withMessageType(
        z.object({ type: z.literal("user.created"), id: z.string() }),
      ),
      publisherSchema: withMessageType(
        z.object({ type: z.literal("user.created"), id: z.string().optional() }),
      ),
    });

    expect(contract.consumerSchema.getMessageType()).toBe("user.created");
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
