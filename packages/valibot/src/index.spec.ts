import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { literal, object, string } from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  anyOfResponses,
  ContractNoBody,
  defineApiContract,
  describeApiContract,
  type InferNonSseClientResponse,
  mapApiContractToPath,
  noBodyResponse,
  resolveResponseEntry,
  sseResponse,
  textResponse,
  validateSync,
  withMessageType,
  withObjectKeys,
} from "./index.ts";

describe("withObjectKeys", () => {
  it("exposes the valibot object schema's keys via getObjectKeys", () => {
    const schema = withObjectKeys(object({ orgId: string(), userId: string() }));
    expect(schema.getObjectKeys()).toEqual(["orgId", "userId"]);
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = withObjectKeys(object({ userId: string() }));
    expect(schema["~standard"].vendor).toBe("valibot");
  });

  it("throws an actionable error when the schema does not expose .entries", () => {
    expect(() => withObjectKeys(string())).toThrow(/valibot object schema/);
  });
});

describe("withMessageType", () => {
  it("reads the literal() type from a flat object schema", () => {
    const schema = withMessageType(object({ type: literal("user.created"), id: string() }));
    expect(schema.getMessageType()).toBe("user.created");
    expect(schema.getMessageType("type")).toBe("user.created");
  });

  it("reads a nested literal via a dot-notation path", () => {
    const schema = withMessageType(
      object({ detail: object({ eventType: literal("order.placed") }) }),
    );
    expect(schema.getMessageType("detail.eventType")).toBe("order.placed");
  });

  it("returns undefined when the top-level field is absent", () => {
    const schema = withMessageType(object({ type: literal("a") }));
    expect(schema.getMessageType("missing")).toBeUndefined();
  });

  it("returns undefined when the field is not a string literal", () => {
    const schema = withMessageType(object({ type: string() }));
    expect(schema.getMessageType()).toBeUndefined();
  });

  it("returns undefined when the path descends past a non-object field", () => {
    const schema = withMessageType(object({ type: literal("a") }));
    expect(schema.getMessageType("type.sub")).toBeUndefined();
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = withMessageType(object({ type: literal("a") }));
    expect(schema["~standard"].vendor).toBe("valibot");
    expect(validateSync(schema, { type: "a" })).toEqual({ type: "a" });
  });

  it("composes with withObjectKeys on the same schema", () => {
    const schema = withMessageType(withObjectKeys(object({ type: literal("a"), id: string() })));
    expect(schema.getObjectKeys()).toEqual(["type", "id"]);
    expect(schema.getMessageType()).toBe("a");
  });

  it("throws an actionable error when the schema is not a valibot object", () => {
    expect(() => withMessageType(string())).toThrow(/valibot object schema/);
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: withMessageType(object({ type: literal("user.created"), id: string() })),
      publisherSchema: withMessageType(object({ type: literal("user.created"), id: string() })),
    });

    expect(contract.consumerSchema.getMessageType()).toBe("user.created");
    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      type: "user.created";
      id: string;
    }>();
  });
});

describe("mapApiContractToPath (via withObjectKeys path-param schemas)", () => {
  it("returns the static path when there is no requestPathParamsSchema", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users");
  });

  it("replaces a single path param with a :placeholder", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users/:userId");
  });

  it("replaces multiple path params", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: withObjectKeys(object({ orgId: string(), userId: string() })),
      pathResolver: ({ orgId, userId }) => `/orgs/${orgId}/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/orgs/:orgId/users/:userId");
  });
});

describe("describeApiContract", () => {
  it("returns the uppercased method and path", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(describeApiContract(route)).toBe("GET /users/:userId");
  });
});

describe("re-exported core surface", () => {
  it("re-exports response factories, predicates, and the ContractNoBody sentinel", () => {
    expect(typeof defineApiContract).toBe("function");
    expect(typeof textResponse).toBe("function");
    expect(typeof anyOfResponses).toBe("function");
    expect(typeof noBodyResponse).toBe("function");
    expect(typeof sseResponse).toBe("function");
    expect(typeof resolveResponseEntry).toBe("function");
    expect(ContractNoBody).toBe(Symbol.for("ContractNoBody"));
  });

  it("re-exports work end-to-end through the adapter (resolveResponseEntry)", () => {
    const schema = object({ id: string() });
    expect(resolveResponseEntry({ 200: schema }, 200, "application/json", true)).toEqual({
      kind: "json",
      schema,
    });
  });

  it("preserves core type inference through the adapter barrel", () => {
    const contract = defineApiContract({
      method: "get",
      pathResolver: () => "/products/1",
      responsesByStatusCode: { 200: object({ id: string() }) },
    });
    type Result = InferNonSseClientResponse<typeof contract>;
    expectTypeOf<Result>().toEqualTypeOf<{
      statusCode: 200;
      headers: Record<string, string>;
      body: { id: string };
    }>();
  });
});
