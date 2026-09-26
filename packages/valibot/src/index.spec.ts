import { defineMessageContract, type InferConsumerMessage } from "@toad-contracts/messages";
import { check, date, literal, object, optional, pipe, string, transform } from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  blobResponse,
  ContractNoBody,
  defineApiContract,
  describeApiContract,
  getObjectKeys,
  type InferNonSseClientResponse,
  jsonResponse,
  mapApiContractToPath,
  noBodyResponse,
  resolveResponseEntry,
  sseBody,
  sseResponse,
  toStandardJsonSchema,
  validateSync,
} from "./index.ts";

describe("toStandardJsonSchema", () => {
  it("lets getObjectKeys read a valibot object schema's keys", () => {
    const schema = toStandardJsonSchema(object({ orgId: string(), userId: string() }));
    expect(getObjectKeys(schema)).toEqual(["orgId", "userId"]);
    expect(getObjectKeys(schema, "output")).toEqual(["orgId", "userId"]);
  });

  it("includes optional keys", () => {
    expect(
      getObjectKeys(toStandardJsonSchema(object({ a: string(), b: optional(string()) }))),
    ).toEqual(["a", "b"]);
  });

  it("reads keys through pipes, transforms and fields JSON Schema cannot represent", () => {
    const schema = toStandardJsonSchema(
      pipe(
        object({ at: date(), name: string() }),
        check(() => true),
        transform((value) => value),
      ),
    );
    expect(getObjectKeys(schema)).toEqual(["at", "name"]);
  });

  it("keeps the schema usable as a Standard Schema", () => {
    const schema = toStandardJsonSchema(object({ userId: string() }));
    expect(schema["~standard"].vendor).toBe("valibot");
    expect(validateSync(schema, { userId: "u1" })).toEqual({ userId: "u1" });
  });

  it("makes getObjectKeys throw for a non-object schema", () => {
    expect(() => getObjectKeys(toStandardJsonSchema(string()))).toThrow(/object schema/);
  });

  it("composes into a message contract with working type inference", () => {
    const contract = defineMessageContract({
      consumerSchema: toStandardJsonSchema(object({ type: literal("user.created"), id: string() })),
      publisherSchema: toStandardJsonSchema(
        object({ type: literal("user.created"), id: string() }),
      ),
    });

    expect(getObjectKeys(contract.consumerSchema)).toEqual(["type", "id"]);
    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      type: "user.created";
      id: string;
    }>();
  });
});

describe("mapApiContractToPath (via toStandardJsonSchema path-param schemas)", () => {
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
      requestPathParamsSchema: toStandardJsonSchema(object({ userId: string() })),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users/:userId");
  });

  it("replaces multiple path params", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: toStandardJsonSchema(object({ orgId: string(), userId: string() })),
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
      requestPathParamsSchema: toStandardJsonSchema(object({ userId: string() })),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(describeApiContract(route)).toBe("GET /users/:userId");
  });
});

describe("re-exported core surface", () => {
  it("re-exports response factories, predicates, and the ContractNoBody sentinel", () => {
    expect(typeof defineApiContract).toBe("function");
    expect(typeof jsonResponse).toBe("function");
    expect(typeof blobResponse).toBe("function");
    expect(typeof noBodyResponse).toBe("function");
    expect(typeof sseResponse).toBe("function");
    expect(typeof sseBody).toBe("function");
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
