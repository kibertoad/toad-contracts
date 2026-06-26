import { object, string } from "valibot";
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
} from "./index.ts";

describe("mapApiContractToPath (valibot adapter)", () => {
  it("returns static path when no requestPathParamsSchema", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users");
  });

  it("replaces path params with :param placeholders from valibot .entries", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: object({ userId: string() }),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users/:userId");
  });

  it("replaces multiple path params", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: object({ orgId: string(), userId: string() }),
      pathResolver: ({ orgId, userId }) => `/orgs/${orgId}/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/orgs/:orgId/users/:userId");
  });

  it("throws an actionable error when the path-param schema does not expose .entries", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: string(),
      pathResolver: (id) => `/users/${id}`,
      responsesByStatusCode: {},
    });

    expect(() => mapApiContractToPath(route)).toThrow(/must be a valibot object schema/);
  });
});

describe("describeApiContract (valibot adapter)", () => {
  it("returns uppercased method and path", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: object({ userId: string() }),
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
