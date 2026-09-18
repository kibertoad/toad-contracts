import { object, string } from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import {
  type BlobResponseHandle,
  blobResponse,
  noBodyResponse,
  sseBody,
  sseResponse,
} from "./contractResponse.ts";
import { defineApiContract } from "./defineApiContract.ts";
import type {
  AvailableResponseModes,
  ContractResponseMode,
  HasAnyJsonSuccessResponse,
  HasAnySseSuccessResponse,
  InferJsonSuccessResponses,
  InferNonSseSuccessResponses,
  InferSseSuccessResponses,
} from "./inferTypes.ts";

describe("inferTypes", () => {
  describe("InferJsonSuccessResponses", () => {
    it("returns never when no success response schemas are defined", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 404: object({ message: string() }) },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("extracts the union of JSON success schemas", () => {
      const schema200 = object({ name: string() });
      const schema201 = object({ id: string() });
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: schema200,
          201: schema201,
          404: object({ message: string() }),
        },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<typeof schema200 | typeof schema201>();
    });

    it("returns never for noBodyResponse()", () => {
      const contract = defineApiContract({
        method: "delete",
        pathResolver: () => "/test",
        responsesByStatusCode: { 204: noBodyResponse() },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("returns never for blobResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: blobResponse("image/png") },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("returns never for sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("extracts the JSON schema from a multi-media-type entry, excluding SSE", () => {
      const jsonSchema = object({ id: string() });
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: {
            content: {
              "application/json": jsonSchema,
              "text/event-stream": sseBody({ chunk: object({ delta: string() }) }),
            },
          },
        },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<typeof jsonSchema>();
    });

    it("extracts JSON schema from the 2xx range key", () => {
      const schema = object({ id: string() });
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": schema },
      });
      type Result = InferJsonSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<typeof schema>();
    });
  });

  describe("HasAnySseSuccessResponse", () => {
    it("returns false for JSON schema responses", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns false for noBodyResponse()", () => {
      const contract = defineApiContract({
        method: "delete",
        pathResolver: () => "/test",
        responsesByStatusCode: { 204: noBodyResponse() },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns true for sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns true for a multi-media-type entry containing an SSE body", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: {
            content: {
              "application/json": object({ id: string() }),
              "text/event-stream": sseBody({ chunk: object({ delta: string() }) }),
            },
          },
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns false for a content-map entry containing only a JSON body", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: { content: { "application/json": object({ id: string() }) } },
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns false for error-only status codes with sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          400: sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns true for sseResponse under the 2xx range key", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          "2xx": sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns false for sseResponse under a non-success range key", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          "4xx": sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns true for sseResponse under the default key", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          default: sseResponse({ chunk: object({ delta: string() }) }),
        },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns false for non-SSE response under the default key", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { default: object({ message: string() }) },
      });
      type Result = HasAnySseSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });
  });

  describe("HasAnyJsonSuccessResponse", () => {
    it("returns true for a JSON schema at an exact success code", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = HasAnyJsonSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns false for SSE-only response", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = HasAnyJsonSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });

    it("returns true for 2xx: JSON schema", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": object({ id: string() }) },
      });
      type Result = HasAnyJsonSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it("returns false for 2xx: sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = HasAnyJsonSuccessResponse<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<false>();
    });
  });

  describe("InferNonSseSuccessResponses", () => {
    it("returns the output type of a JSON success schema", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = InferNonSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<{ id: string }>();
    });

    it("returns never for SSE-only response", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = InferNonSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("returns BlobResponseHandle for blobResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: blobResponse("image/png") },
      });
      type Result = InferNonSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<BlobResponseHandle>();
    });

    it("returns the output type for 2xx: JSON schema", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": object({ id: string() }) },
      });
      type Result = InferNonSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<{ id: string }>();
    });

    it("returns never for 2xx: sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = InferNonSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });
  });

  describe("ContractResponseMode", () => {
    it("returns non-sse for a JSON-only contract", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = ContractResponseMode<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"non-sse">();
    });

    it("returns sse for an SSE-only contract", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = ContractResponseMode<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"sse">();
    });

    it("returns sse for 2xx: sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = ContractResponseMode<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"sse">();
    });

    it("returns non-sse for 2xx: JSON schema", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": object({ id: string() }) },
      });
      type Result = ContractResponseMode<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"non-sse">();
    });

    it("returns dual for 2xx: a content-map entry with SSE and JSON", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          "2xx": {
            content: {
              "application/json": object({ id: string() }),
              "text/event-stream": sseBody({ chunk: object({ delta: string() }) }),
            },
          },
        },
      });
      type Result = ContractResponseMode<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"dual">();
    });
  });

  describe("AvailableResponseModes", () => {
    it("includes json for a JSON success response", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"json">();
    });

    it("includes sse for an SSE-only response", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"sse">();
    });

    it("includes blob for a blobResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: blobResponse("image/png") },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"blob">();
    });

    it("includes json for 2xx: JSON schema", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": object({ id: string() }) },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"json">();
    });

    it("includes sse for 2xx: sseResponse", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { "2xx": sseResponse({ chunk: object({ delta: string() }) }) },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"sse">();
    });

    it("includes noContent for noBodyResponse()", () => {
      const contract = defineApiContract({
        method: "delete",
        pathResolver: () => "/test",
        responsesByStatusCode: { 204: noBodyResponse() },
      });
      type Result = AvailableResponseModes<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<"noContent">();
    });
  });

  describe("InferSseSuccessResponses", () => {
    it("returns never for JSON schema responses", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });
      type Result = InferSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it("extracts schemas object from sseResponse", () => {
      const chunkSchema = object({ delta: string() });
      const doneSchema = object({ finish_reason: string() });
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: sseResponse({ chunk: chunkSchema, done: doneSchema }),
        },
      });
      type Result = InferSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<keyof Result>().toEqualTypeOf<"chunk" | "done">();
    });

    it("extracts the SSE schemas object from a multi-media-type entry", () => {
      const chunkSchema = object({ delta: string() });
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/test",
        responsesByStatusCode: {
          200: {
            content: {
              "application/json": object({ id: string() }),
              "text/event-stream": sseBody({ chunk: chunkSchema }),
            },
          },
        },
      });
      type Result = InferSseSuccessResponses<(typeof contract)["responsesByStatusCode"]>;
      expectTypeOf<keyof Result>().toEqualTypeOf<"chunk">();
    });
  });
});
