import type { StandardSchemaV1 } from "@standard-schema/spec";
import { object, string } from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import { ContractNoBody } from "./constants.ts";
import {
  type BlobBody,
  blobBody,
  blobResponse,
  noBodyResponse,
  sseBody,
  sseResponse,
} from "./contractResponse.ts";
import {
  defineApiContract,
  describeApiContract,
  getSseSchemaByEventName,
  hasAnySuccessSseResponse,
  mapApiContractToPath,
} from "./defineApiContract.ts";
import type { InferJsonSuccessResponses } from "./inferTypes.ts";
import type { StandardObjectKeysV1 } from "./standardObjectKeys.ts";

// The core is vendor-neutral: it never reads object keys itself, it relies on the path-params schema
// implementing the shared StandardObjectKeysV1 surface (dependency inversion). These tests exercise
// that contract against a minimal hand-rolled Standard Schema that implements the surface directly,
// rather than depending on any one library's introspection (the valibot `.entries` path is covered
// by the adapter's own tests in @toad-contracts/valibot).
const pathParamsSchema = <const K extends readonly string[]>(
  keys: K,
): StandardSchemaV1<Record<K[number], string>, Record<K[number], string>> &
  StandardObjectKeysV1 => ({
  "~standard": {
    version: 1,
    vendor: "toad-contracts-test",
    validate: (value) => ({ value: value as Record<K[number], string> }),
    objectKeys: {
      input: () => keys,
      output: () => keys,
    },
  },
});

describe("defineApiContract", () => {
  describe("type inference", () => {
    it("preserves responsesByStatusCode for success schema inference", () => {
      const schema = object({ name: string() });
      const route = defineApiContract({
        method: "get",
        pathResolver: () => "/users",
        responsesByStatusCode: { 200: schema },
      });

      type Result = InferJsonSuccessResponses<typeof route.responsesByStatusCode>;
      expectTypeOf<Result>().toEqualTypeOf<typeof schema>();
    });

    it("infers pathResolver param type from requestPathParamsSchema", () => {
      defineApiContract({
        method: "get",
        requestPathParamsSchema: pathParamsSchema(["userId", "orgId"]),
        pathResolver: ({ userId, orgId }) => {
          expectTypeOf(userId).toEqualTypeOf<string>();
          expectTypeOf(orgId).toEqualTypeOf<string>();
          return `/orgs/${orgId}/users/${userId}`;
        },
        responsesByStatusCode: {},
      });
    });

    it("accepts pathResolver without params when no requestPathParamsSchema", () => {
      const route = defineApiContract({
        method: "get",
        pathResolver: () => "/users",
        responsesByStatusCode: {},
      });

      expect(mapApiContractToPath(route)).toBe("/users");
    });

    it("types pathResolver param as undefined when no requestPathParamsSchema", () => {
      defineApiContract({
        method: "get",
        pathResolver: (params) => {
          expectTypeOf(params).toEqualTypeOf<undefined>();
          return "/users";
        },
        responsesByStatusCode: {},
      });
    });

    it("rejects pathResolver that declares params when no requestPathParamsSchema", () => {
      defineApiContract({
        method: "get",
        // @ts-expect-error pathResolver cannot take params without requestPathParamsSchema
        pathResolver: (params: { id: string }) => `/users/${params.id}`,
        responsesByStatusCode: {},
      });
    });

    it("preserves method literal type", () => {
      const route = defineApiContract({
        method: "post",
        pathResolver: () => "/users",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: {},
      });

      expectTypeOf(route.method).toEqualTypeOf<"post">();
    });

    it("rejects requestBodySchema on GET contracts", () => {
      // @ts-expect-error GET must not accept a request body
      defineApiContract({
        method: "get",
        pathResolver: () => "/users",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: {},
      });
    });

    it("rejects requestBodySchema on DELETE contracts", () => {
      // @ts-expect-error DELETE must not accept a request body
      defineApiContract({
        method: "delete",
        pathResolver: () => "/users/1",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: {},
      });
    });

    it("requires requestBodySchema on POST contracts", () => {
      // @ts-expect-error POST requires requestBodySchema
      defineApiContract({
        method: "post",
        pathResolver: () => "/users",
        responsesByStatusCode: {},
      });
    });

    it("accepts ContractNoBody as requestBodySchema on POST contracts", () => {
      const route = defineApiContract({
        method: "post",
        pathResolver: () => "/users",
        requestBodySchema: ContractNoBody,
        responsesByStatusCode: {},
      });

      expectTypeOf(route.requestBodySchema).toEqualTypeOf<typeof ContractNoBody>();
    });

    it("preserves a noBodyResponse entry in responsesByStatusCode", () => {
      const entry = noBodyResponse();
      const route = defineApiContract({
        method: "delete",
        requestPathParamsSchema: pathParamsSchema(["userId"]),
        pathResolver: ({ userId }) => `/users/${userId}`,
        responsesByStatusCode: { 204: entry },
      });

      expectTypeOf(route.responsesByStatusCode["204"]).toEqualTypeOf<typeof entry>();
    });

    it("preserves a blobResponse content map, including its literal media type", () => {
      const entry = blobResponse("image/png");
      const route = defineApiContract({
        method: "get",
        pathResolver: () => "/photo.png",
        responsesByStatusCode: { 200: entry },
      });

      expectTypeOf(route.responsesByStatusCode["200"]).toEqualTypeOf<typeof entry>();
      expectTypeOf(route.responsesByStatusCode["200"].content).toEqualTypeOf<{
        readonly "image/png": BlobBody;
      }>();
    });

    it("preserves a hand-written multi-media-type content map", () => {
      const jsonSchema = object({ id: string() });
      const route = defineApiContract({
        method: "get",
        pathResolver: () => "/report",
        responsesByStatusCode: {
          200: { content: { "application/json": jsonSchema, "text/csv": blobBody() } },
        },
      });

      expectTypeOf(route.responsesByStatusCode["200"].content).toEqualTypeOf<{
        readonly "application/json": typeof jsonSchema;
        readonly "text/csv": BlobBody;
      }>();
    });
  });
});

describe("mapApiContractToPath", () => {
  it("returns static path when no requestPathParamsSchema", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users");
  });

  it("replaces path params with :param placeholders", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: pathParamsSchema(["userId"]),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/users/:userId");
  });

  it("replaces multiple path params", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: pathParamsSchema(["orgId", "userId"]),
      pathResolver: ({ orgId, userId }) => `/orgs/${orgId}/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(mapApiContractToPath(route)).toBe("/orgs/:orgId/users/:userId");
  });
});

describe("describeApiContract", () => {
  it("returns uppercased method and path", () => {
    const route = defineApiContract({
      method: "get",
      requestPathParamsSchema: pathParamsSchema(["userId"]),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: {},
    });

    expect(describeApiContract(route)).toBe("GET /users/:userId");
  });

  it("works for POST routes", () => {
    const route = defineApiContract({
      method: "post",
      pathResolver: () => "/users",
      requestBodySchema: object({ name: string() }),
      responsesByStatusCode: {},
    });

    expect(describeApiContract(route)).toBe("POST /users");
  });
});

describe("hasAnySuccessSseResponse", () => {
  it("returns true for a direct sseResponse at a success code", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        200: sseResponse({ chunk: object({ delta: string() }) }),
      },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(true);
  });

  it("returns true for an SSE body inside a multi-media-type entry at a success code", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        200: {
          content: {
            "application/json": object({ id: string() }),
            "text/event-stream": sseBody({ chunk: string() }),
          },
        },
      },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(true);
  });

  it("returns false when sseResponse is only at an error status code", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        200: object({ id: string() }),
        404: sseResponse({ error: string() }),
      },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(false);
  });

  it("returns false when no SSE response is present", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: { 200: object({ id: string() }) },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(false);
  });

  it("returns false for a multi-media-type entry with no SSE body at a success code", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: {
        200: {
          content: { "application/json": object({ id: string() }), "text/csv": blobBody() },
        },
      },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(false);
  });

  it("returns true for sseResponse under the default key", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        default: sseResponse({ chunk: object({ delta: string() }) }),
      },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(true);
  });

  it("returns false for non-SSE response under the default key", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: { default: object({ message: string() }) },
    });

    expect(hasAnySuccessSseResponse(route)).toBe(false);
  });
});

describe("getSseSchemaByEventName", () => {
  it("returns null when no SSE schemas are present", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: { 200: object({ id: string() }) },
    });

    expect(getSseSchemaByEventName(route)).toBeNull();
  });

  it("returns null when responsesByStatusCode is not defined", () => {
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/users",
      responsesByStatusCode: {},
    });

    expect(getSseSchemaByEventName(route)).toBeNull();
  });

  it("extracts schemas from sseResponse in responsesByStatusCode", () => {
    const chunkSchema = object({ delta: string() });
    const doneSchema = object({ finish_reason: string() });
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        200: sseResponse({ chunk: chunkSchema, done: doneSchema }),
      },
    });

    const result = getSseSchemaByEventName(route);
    expect(result).not.toBeNull();
    expect(result?.chunk).toBe(chunkSchema);
    expect(result?.done).toBe(doneSchema);
  });

  it("extracts sseResponse schemas from inside anyOf", () => {
    const chunkSchema = object({ delta: string() });
    const route = defineApiContract({
      method: "get",
      pathResolver: () => "/stream",
      responsesByStatusCode: {
        200: {
          content: {
            "application/json": object({ id: string() }),
            "text/event-stream": sseBody({ chunk: chunkSchema }),
          },
        },
      },
    });

    const result = getSseSchemaByEventName(route);
    expect(result).not.toBeNull();
    expect(result?.chunk).toBe(chunkSchema);
  });
});
